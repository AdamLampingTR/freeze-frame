# Skip list

Single source of truth for the skip-list design — the biggest lever on false
positives in the whole system. Extracted from
`docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md` ("Skip list
(deliberately-skipped commits)"). This replaces the hand-typed `R`/`X`/`L`
markers in the legacy `dev-staging-changes-*.md` process.

## Store

Azure Table Storage in the existing `fluffyttisancusfrontend` account
(connection string in SWA app settings as `SKIP_TABLE_CONNECTION_STRING`).
Chosen because the skip list must be writable at runtime (managed Functions
have a read-only filesystem, so a bundled JSON file can't work), shared
across all users (server-side, not client-local), and is tiny and rarely
written — a full database would be overkill, and this reuses a resource we
already have while keeping the write path server-side behind the API.

## Keying: PR-ID first, patch-id fallback — never the raw SHA

- **Key on the PR-ID** (`pr:<id>` prefix), because discovery dedupes by PR-ID
  and squash/re-merge changes the commit SHA. A SHA-keyed skip would silently
  stop matching after a re-merge and resurface a dismissed commit.
- **Fallback for genuinely PR-less commits:** key on `patch:<sha>`. The design
  intent is `git patch-id --stable` (a rebase/cherry-pick keeps the same
  patch-id, so a re-applied dismissed commit would stay dismissed), but SWA
  managed Functions run on a read-only filesystem and cannot execute git (see
  `docs/conventions/api.md` / `.claude/rules/api.md`). So the implemented
  fallback keys on the **raw commit SHA** as a documented compromise, with the
  known limitation that a re-applied PR-less commit gets a new SHA and would
  resurface. This only affects PR-less commits; the common PR-keyed path is
  squash/re-merge-safe as designed. (patch-id can be revisited if the diff ever
  moves to a git-capable agent — see the pipeline fallback in the spec.)
- The `pr:` / `patch:` RowKey prefixes exist specifically so the two keyspaces
  can't collide.

## Entity shape

- `PartitionKey` = repo
- `RowKey` = `pr:<id>` or `patch:<hash>`
- `dismissedBy` — from SWA's `x-ms-client-principal` header (no separate login
  flow or prefs system needed)
- `dismissedAt`
- `reason` — a small preset set: `reverted` / `superseded-by-later-commit` /
  `held` / `shipped-elsewhere` / `not-ready`, plus optional free text (many of
  these reasons are non-obvious to the next reader and won't be inferred)
- `kind` — `permanent` (gone forever) or `hold` (deliberate "ship in a later
  release, not this one" — the one genuinely per-release case)
- `dismissedForRelease` — the target release selected at time of dismissal,
  recorded for context

`dismissedBy` + `reason` double as a lightweight audit trail that directly
answers "why isn't this commit showing?".

## Scope: durable and global by default

Once dismissed, a candidate stays out of candidacy **across freezes**
(matching the legacy permanent `R`/`X`/`L` behaviour), with the target release
at dismissal recorded for context via `dismissedForRelease`. This is
deliberate: the skip list absorbs a messy long tail that PR-ID dedupe alone
can't catch — remove→revert→reapply chains, non-squashed merges where the
commit/PR-ID mapping doesn't line up the way squash-based dedupe assumes, and
commits made moot because a later commit already overwrote their values to
the intended end state. None of those land "on staging," so nothing
auto-excludes them; most are permanent, which is why global-durable is the
right default. The `kind` field is what distinguishes the rare per-release
`hold` case from the common `permanent` case.

## Orphan pruning

Once a skipped PR lands on staging it drops out of candidacy on its own,
leaving a stale entry behind. The skip-list view should intersect stored
entries with the current candidate set (or mark orphans) so the store doesn't
accrete cruft that nobody prunes.

## Visible and reversible in the UI — required, not optional

Because the skip list is the biggest false-positive lever *and* is
global-permanent, a hidden store would quietly become a new black hole as
long-tail cases pile up unseen. It is a first-class panel: each entry shows
who dismissed it, when, why, its `kind`, and for which release, with un-skip
as a first-class action.

**API flow:**

- Dismiss: `POST /api/freeze-candidates/{id}/dismiss` writes a row.
- View: `GET /api/skips` lists them.
- Un-skip: `DELETE /api/skips/{key}` removes the row.

The diff service reads the whole (small) skip set once per refresh and
filters candidates by PR-ID / patch-id **before** the rule engine runs — see
`docs/conventions/architecture.md` for where this sits in pipeline order.

## Contract location

The skip-entry contract lives once in `shared/types.ts`; both
`api/src/types.ts` and `frontend/src/types.ts` re-export it (type-only). Do
not redefine the shape independently on either side.
