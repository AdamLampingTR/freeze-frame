// Canonical FreezeFrame contract. frontend/src/types.ts and api/src/types.ts each
// re-export from here via `export type ... from` — type-only, fully erased at build,
// so there is no runtime import and no SWA two-build fragility. shared/types.ts is
// never emitted (type-only imports are elided), so it does not violate api's rootDir.
export type FlagStatus = "ready" | "warning" | "bad-state" | "no-ticket";
export type SkipKind = "permanent" | "hold";
export type SkipReason =
  | "reverted"
  | "superseded-by-later-commit"
  | "held"
  | "shipped-elsewhere"
  | "not-ready";
export type NotifyVia = "email" | "teams" | "both";

export interface Ticket {
  id: string;
  title: string;
  state: string;
  workItemType: string; // System.WorkItemType (D1 filter operates on this)
  assignedTo: string | null; // email (System.AssignedTo.uniqueName)
  tags: string[];
  viaPr: boolean; // true = resolved via PR title/branch/refs, not the commit subject
}

export interface FreezeCandidate {
  key: string; // "pr:<id>" or "patch:<sha>"
  repo: string; // "TT.AskDI" | "TT.OfficeAddin"
  prId: number | null;
  commitId: string;
  title: string; // commit subject, first line
  author: string | null; // email
  tickets: Ticket[];
  status: FlagStatus;
  flags: string[]; // human-readable flag lines (for UI + notify payload)
}

export interface SkipEntry {
  repo: string;
  key: string; // pr:<id> | patch:<sha>
  dismissedBy: string;
  dismissedAt: string; // ISO
  reason: SkipReason;
  reasonText?: string;
  kind: SkipKind;
  dismissedForRelease: string;
  orphan?: boolean; // computed: no longer in the current candidate set
}

export interface Stats {
  total: number;
  ready: number;
  warning: number;
  badState: number;
  noTicket: number;
}

export interface CandidatesResponse {
  release: string;
  availableReleases: string[];
  generatedAt: string; // ISO
  candidates: FreezeCandidate[]; // have >=1 US/Bug ticket
  noTicket: FreezeCandidate[]; // non-PR / no-ticket bucket
  stats: Stats;
}
