import { describe, it, expect } from "vitest";
import { parsePrId, parseAdoIds, resolveTicketIds } from "./linking.service";

describe("linking pure helpers", () => {
  it("parses the PR id from a squash-merge subject", () => {
    expect(parsePrId("Merged PR 23521: ado-1137466 - Bug ...")).toBe(23521);
    expect(parsePrId("Merged PR #23490: ADO-1165133 Fix")).toBe(23490);
    expect(parsePrId("just a normal commit")).toBeNull();
  });

  it("parses distinct ADO ids in any accepted form, ignores bare numbers", () => {
    expect(parseAdoIds("ado-1137466 - Bug 1137466: title")).toEqual([
      "1137466",
    ]);
    expect(parseAdoIds("ADO-1160180 and ADO#1162189 and ADO 1155410")).toEqual([
      "1155410",
      "1160180",
      "1162189",
    ]);
    expect(parseAdoIds("Merged PR 23521: no ado ref")).toEqual([]);
  });
});

describe("resolveTicketIds", () => {
  const base = { repo: "TT.AskDI", commitId: "c1", committedDate: "", author: null };

  it("uses commit-subject ids when present (viaPr=false), skips PR fetch", async () => {
    let prFetched = false;
    const deps = {
      getPullRequest: async () => {
        prFetched = true;
        return null;
      },
      getPullRequestWorkItemIds: async () => [],
    };
    const ids = await resolveTicketIds(
      {
        ...base,
        key: "pr:100",
        prId: 100,
        subject: "Merged PR 100: ADO-1000001 x",
      },
      "R",
      deps,
    );
    expect(ids).toEqual([{ id: "1000001", viaPr: false }]);
    expect(prFetched).toBe(false);
  });

  it("falls back to PR title/branch then PR refs (viaPr=true)", async () => {
    const deps = {
      getPullRequest: async () => ({
        title: "no ado here",
        sourceRefName: "refs/heads/fix/ADO-1137466-x",
        createdBy: null,
      }),
      getPullRequestWorkItemIds: async () => ["9999999"],
    };
    const ids = await resolveTicketIds(
      { ...base, key: "pr:100", prId: 100, subject: "Merged PR 100: no id" },
      "R",
      deps,
    );
    expect(ids).toEqual([{ id: "1137466", viaPr: true }]);
  });

  it("returns [] for a PR-less commit with no ids", async () => {
    const ids = await resolveTicketIds(
      { ...base, key: "patch:c1", prId: null, subject: "hotfix" },
      "R",
      {
        getPullRequest: async () => null,
        getPullRequestWorkItemIds: async () => [],
      },
    );
    expect(ids).toEqual([]);
  });
});
