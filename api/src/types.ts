// Re-export the canonical contract (type-only, erased at runtime). tsconfig's rootDir is
// ".." (repo root, not "api/") specifically so this cross-package type-only import
// type-checks under tsc's rootDir enforcement.
export type {
  FlagStatus,
  SkipKind,
  SkipReason,
  NotifyVia,
  Ticket,
  FreezeCandidate,
  SkipEntry,
  Stats,
  CandidatesResponse,
} from "../../shared/types";
