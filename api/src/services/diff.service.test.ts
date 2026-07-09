import { it, expect } from "vitest";
import { discoverCandidates } from "./diff.service";
import type { RepoConfig } from "../config";

const repo: RepoConfig = {
  name: "TT.AskDI",
  repoId: "R",
  devBranch: "development",
  stagingBranch: "staging",
};

it("dedupes commits of one PR to a single candidate and drops PRs already on staging", async () => {
  const deps = {
    commitsBatch: async () => [
      {
        commitId: "c1",
        comment: "Merged PR 100: ADO-1000001 a",
        author: { email: "x@example.com", name: "X" },
      },
      {
        commitId: "c2",
        comment: "Merged PR 100: ADO-1000001 a (fixup)",
        author: { email: "x@example.com", name: "X" },
      },
      {
        commitId: "c3",
        comment: "Merged PR 200: ADO-2000002 b",
        author: { email: "y@example.com", name: "Y" },
      },
      {
        commitId: "c4",
        comment: "hotfix no pr",
        author: { email: "z@example.com", name: "Z" },
      },
    ],
    stagingPrIds: async () => new Set<number>([200]),
  };
  const out = await discoverCandidates(repo, deps);
  expect(out.map((c) => c.key).sort()).toEqual(["patch:c4", "pr:100"]);
  const pr100 = out.find((c) => c.key === "pr:100")!;
  expect(pr100.prId).toBe(100);
  expect(pr100.commitId).toBe("c1"); // first (newest) commit bearing the PR marker
  expect(out.find((c) => c.key === "patch:c4")!.prId).toBeNull();
});
