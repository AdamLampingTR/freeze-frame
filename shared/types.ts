// Canonical FreezeFrame contract. frontend/src/types.ts and api/src/types.ts each
// re-export from here via `export type ... from` — type-only, fully erased at build,
// so there is no runtime import and no SWA two-build fragility. shared/types.ts is
// never emitted (type-only imports are elided), so it does not violate api's rootDir.
export type FlagStatus = "ready" | "warning" | "bad-state" | "no-ticket";
export type SkipKind = "permanent" | "hold";

export interface Ticket {
  id: string;
  title: string;
  state: string;
  assignedTo: string | null;
  tags: string[];
}

export interface FreezeCandidate {
  key: string; // "pr:<id>" or "patch:<hash>"
  repo: string;
  prId: number | null;
  commitId: string;
  title: string;
  author: string | null;
  tickets: Ticket[];
  status: FlagStatus;
}
