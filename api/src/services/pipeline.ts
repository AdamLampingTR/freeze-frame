import {
  loadRepos,
  loadRules,
  type RepoConfig,
  type RulesConfig,
} from "../config";
import { discoverCandidates, type DiscoveredCandidate } from "./diff.service";
import { resolveTicketIds } from "./linking.service";
import { fetchWorkItems, mapLimit, type RawWorkItem } from "./ado.service";
import { listSkips } from "./skip.service";
import { evaluate } from "./rules.service";
import { activeReleaseTags } from "./releaseTag.service";
import type {
  CandidatesResponse,
  FreezeCandidate,
  SkipEntry,
  Ticket,
} from "../types";

export interface PipelineDeps {
  repos: RepoConfig[];
  discover: (repo: RepoConfig) => Promise<DiscoveredCandidate[]>;
  resolve: (
    c: DiscoveredCandidate,
    repoId: string,
  ) => Promise<{ id: string; viaPr: boolean }[]>;
  fetchWorkItems: (ids: string[]) => Promise<Map<string, RawWorkItem>>;
  listSkips: () => Promise<SkipEntry[]>;
  rules: RulesConfig;
}

function realDeps(): PipelineDeps {
  return {
    repos: loadRepos(),
    discover: (repo) => discoverCandidates(repo),
    resolve: (c, repoId) => resolveTicketIds(c, repoId),
    fetchWorkItems,
    listSkips,
    rules: loadRules(),
  };
}

// The set of `${repo} ${key}` currently discovered in dev-not-staging, BEFORE
// skip-filtering. Used to detect orphaned skips (a dismissed PR that has since
// landed on staging drops out of discovery on its own). Cheap — discovery only,
// no linking/work-item fetch.
export async function discoveredKeys(
  deps: Pick<PipelineDeps, "repos" | "discover"> = realDeps(),
): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const repo of deps.repos) {
    for (const c of await deps.discover(repo)) keys.add(`${c.repo} ${c.key}`);
  }
  return keys;
}

// The full pipeline for both repos: discover → skip-filter → link → batch-fetch
// work items → rule-evaluate → split into flagged candidates vs the non-PR /
// no-ticket bucket, with stats and the active release list for the picker.
export async function buildCandidates(
  release: string | undefined,
  now: Date,
  deps: PipelineDeps = realDeps(),
): Promise<CandidatesResponse> {
  const skips = await deps.listSkips();
  const skipKeys = new Set(skips.map((s) => `${s.repo} ${s.key}`));

  const discovered: DiscoveredCandidate[] = [];
  for (const repo of deps.repos) {
    const found = await deps.discover(repo);
    for (const c of found)
      if (!skipKeys.has(`${c.repo} ${c.key}`)) discovered.push(c);
  }

  const repoIdByName = new Map(deps.repos.map((r) => [r.name, r.repoId]));
  const links = await mapLimit(discovered, 8, async (c) => ({
    candidate: c,
    ids: await deps.resolve(c, repoIdByName.get(c.repo)!),
  }));

  const allIds = Array.from(
    new Set(links.flatMap((l) => l.ids.map((i) => i.id))),
  );
  const wiMap = await deps.fetchWorkItems(allIds);
  const allTags = Array.from(wiMap.values()).flatMap((w) => w.tags);
  const availableReleases = activeReleaseTags(allTags, now);
  const targetRelease = release ?? availableReleases[0] ?? "";

  const candidates: FreezeCandidate[] = [];
  const noTicket: FreezeCandidate[] = [];

  for (const { candidate, ids } of links) {
    const tickets: Ticket[] = ids.map(({ id, viaPr }) => {
      const wi = wiMap.get(id);
      return {
        id,
        title: wi?.title ?? "(not found)",
        state: wi?.state ?? "",
        workItemType: wi?.workItemType ?? "",
        assignedTo: wi?.assignedTo ?? null,
        tags: wi?.tags ?? [],
        viaPr,
      };
    });
    const result = evaluate(tickets, deps.rules, now);
    if (result.excluded) continue; // past-tag-only → already shipped

    const fc: FreezeCandidate = {
      key: candidate.key,
      repo: candidate.repo,
      prId: candidate.prId,
      commitId: candidate.commitId,
      title: candidate.subject,
      author: candidate.author,
      tickets,
      status: result.status,
      flags: result.flags,
    };
    if (fc.status === "no-ticket") noTicket.push(fc);
    else candidates.push(fc);
  }

  const stats = {
    total: candidates.length,
    ready: candidates.filter((c) => c.status === "ready").length,
    warning: candidates.filter((c) => c.status === "warning").length,
    badState: candidates.filter((c) => c.status === "bad-state").length,
    noTicket: noTicket.length,
  };

  return {
    release: targetRelease,
    availableReleases,
    generatedAt: now.toISOString(),
    candidates,
    noTicket,
    stats,
  };
}
