import { it, expect } from "vitest";
import { buildCandidates } from "./pipeline";
import { loadRules } from "../config";
import type { RawWorkItem } from "./ado.service";

const NOW = new Date("2026-07-09T00:00:00Z");

it("assembles candidates, applies skips, splits the no-ticket bucket, computes stats", async () => {
  const deps = {
    repos: [
      {
        name: "TT.AskDI",
        repoId: "R",
        devBranch: "development",
        stagingBranch: "staging",
      },
    ],
    discover: async () => [
      {
        key: "pr:100",
        repo: "TT.AskDI",
        prId: 100,
        commitId: "c1",
        committedDate: "2026-07-01T00:00:00Z",
        subject: "Merged PR 100: ADO-1000001 a",
        author: "a@example.com",
      },
      {
        key: "pr:101",
        repo: "TT.AskDI",
        prId: 101,
        commitId: "c2",
        committedDate: "2026-07-02T00:00:00Z",
        subject: "Merged PR 101: ADO-1000002 b",
        author: "b@example.com",
      },
      {
        key: "patch:c3",
        repo: "TT.AskDI",
        prId: null,
        commitId: "c3",
        committedDate: "2026-07-03T00:00:00Z",
        subject: "hotfix",
        author: "c@example.com",
      },
    ],
    resolve: async (c: { prId: number | null }) =>
      c.prId === 100
        ? [{ id: "1000001", viaPr: false }]
        : c.prId === 101
          ? [{ id: "1000002", viaPr: false }]
          : [],
    fetchWorkItems: async () =>
      new Map<string, RawWorkItem>([
        [
          "1000001",
          {
            id: 1000001,
            title: "A",
            state: "Verified",
            workItemType: "User Story",
            assignedTo: "a@example.com",
            tags: ["July 23"],
          },
        ],
        [
          "1000002",
          {
            id: 1000002,
            title: "B",
            state: "Active",
            workItemType: "Bug",
            assignedTo: "b@example.com",
            tags: ["SRE"],
          },
        ],
      ]),
    listSkips: async () => [
      {
        repo: "TT.AskDI",
        key: "pr:101",
        dismissedBy: "x",
        dismissedAt: "t",
        reason: "held" as const,
        kind: "hold" as const,
        dismissedForRelease: "July 23",
      },
    ],
    rules: loadRules(),
  };
  const res = await buildCandidates("July 23", NOW, deps);
  expect(res.candidates.map((c) => c.key)).toEqual(["pr:100"]); // pr:101 held for July 23
  expect(res.candidates[0].status).toBe("ready");
  expect(res.candidates[0].matchesRelease).toBe(true); // tagged July 23
  expect(res.candidates[0].releaseTags).toEqual(["July 23"]);
  expect(res.noTicket.map((c) => c.key)).toEqual(["patch:c3"]);
  expect(res.stats).toMatchObject({ ready: 1, noTicket: 1 });
  expect(res.availableReleases).toContain("July 23");

  // Highlight, not filter: switching release keeps everything visible (only the
  // July-23 hold is released for August 6). pr:100 is still shown even though it
  // is tagged for another freeze — just no longer flagged matchesRelease.
  const other = await buildCandidates("August 6", NOW, deps);
  expect(other.candidates.map((c) => c.key).sort()).toEqual([
    "pr:100",
    "pr:101",
  ]);
  expect(other.candidates.find((c) => c.key === "pr:100")!.matchesRelease).toBe(
    false,
  );
});
