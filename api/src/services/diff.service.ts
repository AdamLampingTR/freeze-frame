import {
  commitsBatch as realCommitsBatch,
  stagingPrIds as realStagingPrIds,
} from "./ado.service";
import { parsePrId } from "./linking.service";
import type { RepoConfig } from "../config";

export interface DiscoveredCandidate {
  key: string; // pr:<id> | patch:<sha>
  repo: string;
  prId: number | null;
  commitId: string;
  subject: string;
  author: string | null;
}

interface Deps {
  commitsBatch: typeof realCommitsBatch;
  stagingPrIds: typeof realStagingPrIds;
}

// Commits merged into the dev branch but not staging, deduped the squash-safe
// way: one candidate per PR (PR-ID keyed), PR-less commits pass through as
// patch:<sha>. PRs already merged to staging are dropped.
export async function discoverCandidates(
  repo: RepoConfig,
  deps: Deps = {
    commitsBatch: realCommitsBatch,
    stagingPrIds: realStagingPrIds,
  },
): Promise<DiscoveredCandidate[]> {
  const [commits, applied] = await Promise.all([
    deps.commitsBatch(repo.repoId, repo.stagingBranch, repo.devBranch),
    deps.stagingPrIds(repo.repoId, repo.stagingBranch),
  ]);

  // commitsBatch returns newest-first. For a squash merge there is exactly one
  // commit per PR (its merge commit, "Merged PR N: ..."); for the rare
  // multi-commit case we keep the first (newest) commit bearing the PR marker
  // as the candidate's representative. Display order is not load-bearing — the
  // frontend re-sorts by status.
  const seenPr = new Set<number>();
  const out: DiscoveredCandidate[] = [];

  for (const c of commits) {
    const subject = (c.comment ?? "").split("\n")[0];
    const prId = parsePrId(subject);
    const author = c.author?.email ?? null;
    if (prId !== null) {
      if (applied.has(prId) || seenPr.has(prId)) continue; // already shipped / already a candidate
      seenPr.add(prId);
      out.push({
        key: `pr:${prId}`,
        repo: repo.name,
        prId,
        commitId: c.commitId,
        subject,
        author,
      });
    } else {
      out.push({
        key: `patch:${c.commitId}`,
        repo: repo.name,
        prId: null,
        commitId: c.commitId,
        subject,
        author,
      });
    }
  }
  return out;
}
