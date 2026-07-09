---
paths:
  - "api/**/skip*"
  - "api/**/dismiss*"
---
Skip list invariants (load-bearing — the biggest false-positive lever):
- Key on **PR-ID** (`pr:<id>`); fall back to `patch:<sha>` for PR-less commits. The design intent is `git patch-id --stable`, but managed Functions can't run git at runtime (see `api.md`), so the fallback keys on the **raw commit SHA** as a documented compromise — a re-applied PR-less commit gets a new SHA and would resurface. PR-keyed skips (the common path) are unaffected by this.
- Entity: PartitionKey=repo, RowKey=`pr:<id>`|`patch:<hash>`, plus `dismissedBy`, `dismissedAt`, `reason`, `kind` (`permanent`|`hold`), `dismissedForRelease`.
- Global-durable by default. Visible + reversible in the UI (un-skip). Prune orphans (intersect with current candidates).
- The contract lives once in `shared/types.ts`; both `api/src/types.ts` and `frontend/src/types.ts` re-export it (type-only).
See `docs/conventions/skip-list.md`.
