// Commit/PR → work-item linking. Pure subject/PR parsers plus resolveTicketIds,
// which layers the subject → PR-title/branch → PR-refs fallback (first hit wins).
import {
  getPullRequest as realGetPr,
  getPullRequestWorkItemIds as realGetPrWi,
} from "./ado.service";
import type { DiscoveredCandidate } from "./diff.service";

// PR marker: "Merged PR 23521" / "Merged PR #23521" (case-insensitive).
export function parsePrId(subject: string): number | null {
  const m = /Merged PR #?(\d+)/i.exec(subject);
  return m ? Number(m[1]) : null;
}

// ADO work-item ids: "ADO-1137466" / "ADO#1137466" / "ADO 1137466" / "ADO1137466",
// case-insensitive, 6–8 digits. Bare numbers (e.g. "Bug 1137466") are NOT matched.
export function parseAdoIds(text: string): string[] {
  const ids = new Set<string>();
  const re = /ADO[-# ]*(\d{6,8})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) ids.add(m[1]);
  return Array.from(ids).sort();
}

interface LinkDeps {
  getPullRequest: typeof realGetPr;
  getPullRequestWorkItemIds: typeof realGetPrWi;
}

// First hit wins: (1) commit subject, (2) PR title + source branch, (3) PR's
// linked work items. viaPr marks ids that only surfaced via the PR (2)/(3).
export async function resolveTicketIds(
  candidate: DiscoveredCandidate,
  repoId: string,
  deps: LinkDeps = {
    getPullRequest: realGetPr,
    getPullRequestWorkItemIds: realGetPrWi,
  },
): Promise<{ id: string; viaPr: boolean }[]> {
  const fromSubject = parseAdoIds(candidate.subject);
  if (fromSubject.length > 0)
    return fromSubject.map((id) => ({ id, viaPr: false }));

  if (candidate.prId === null) return []; // PR-less + no subject id → no-ticket

  const pr = await deps.getPullRequest(repoId, candidate.prId);
  if (pr) {
    const fromPr = parseAdoIds(`${pr.title} ${pr.sourceRefName}`);
    if (fromPr.length > 0) return fromPr.map((id) => ({ id, viaPr: true }));
  }

  const refs = await deps.getPullRequestWorkItemIds(repoId, candidate.prId);
  return refs.map((id) => ({ id, viaPr: true }));
}
