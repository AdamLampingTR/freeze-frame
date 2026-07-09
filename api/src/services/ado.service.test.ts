import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const OLD_ENV = { ...process.env };

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("ado.service", () => {
  beforeEach(() => {
    process.env.ADO_REPOS_ORG = "ThoughtTrace";
    process.env.ADO_REPOS_PROJECT = "ThoughtTrace Core";
    process.env.ADO_REPOS_PAT = "repospat";
    process.env.ADO_WORKITEMS_ORG = "tr-core-ai-data-platforms";
    process.env.ADO_WORKITEMS_PROJECT = "CoCounsel";
    process.env.ADO_WORKITEMS_PAT = "wipat";
  });
  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.restoreAllMocks();
  });

  it("commitsBatch posts base+compare and maps commits", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        count: 1,
        value: [
          {
            commitId: "abc123def",
            comment: "Merged PR 23521: ado-1137466 - x",
            author: { email: "author@example.com", name: "A" },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { commitsBatch } = await import("./ado.service");
    const commits = await commitsBatch("REPOID", "staging", "development", 100);
    expect(commits).toHaveLength(1);
    expect(commits[0].commitId).toBe("abc123def");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/git/repositories/REPOID/commitsBatch");
    expect(url).toContain("ThoughtTrace%20Core");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.itemVersion.version).toBe("staging");
    expect(body.compareVersion.version).toBe("development");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: `Basic ${Buffer.from(":repospat").toString("base64")}`,
    });
  });

  it("fetchWorkItems maps the workitemsbatch response and splits tags", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({
        value: [
          {
            id: 1165133,
            fields: {
              "System.Title": "T",
              "System.State": "Ready for QA Testing",
              "System.WorkItemType": "User Story",
              "System.Tags": "July 23; Ready2Refine",
              "System.AssignedTo": { uniqueName: "user@example.com" },
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchWorkItems } = await import("./ado.service");
    const map = await fetchWorkItems(["1165133"]);
    const wi = map.get("1165133")!;
    expect(wi.workItemType).toBe("User Story");
    expect(wi.tags).toEqual(["July 23", "Ready2Refine"]);
    expect(wi.assignedTo).toBe("user@example.com");
  });

  it("fetchWorkItems returns empty map for no ids without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { fetchWorkItems } = await import("./ado.service");
    expect((await fetchWorkItems([])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
