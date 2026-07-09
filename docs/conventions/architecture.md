# Architecture

Single source of truth for the FreezeFrame pipeline shape and its core data
contract. Extracted from `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`
("Porting Jared's logic to TypeScript-over-REST", "Rule engine", "Skip list").

## The pipeline

Five stages, run in this dependency order on every manual refresh
(`GET /api/freeze-candidates?release=…`):

1. **Discover** — `diff.service.ts`. Pulls commits reachable from the source
   branch but not the target via the ADO commits/diffs REST endpoint, then
   resolves each commit's associated PR and **dedupes by PR-ID** (squash-safe;
   rejects naive SHA set-difference, which over-reports squash-merges and
   re-merges). Commits with no associated PR pass through as SHA-identified
   candidates and land in the non-PR / no-ticket bucket. **The unit of
   candidacy is the PR, not the commit.**
2. **Link** — `linking.service.ts`. Resolves each candidate's work item(s),
   first hit wins:
   1. ADO work-item IDs parsed from the commit subject (`ADO-<id>` / `#<id>`).
   2. Fallback: the PR title and PR source-branch name.
   3. Fallback: the PR's own linked work items from the ADO PR REST endpoint.
   A candidate with none of these is a no-ticket candidate.
3. **Release-tag** — `releaseTag.service.ts`. Ports Jared's `is_release_tag`
   behaviour: recognises ISO and month-name tags (`July 9`, `July 23`),
   including Dec/Jan year-wrap, within a recency window — no substring
   matching. A work item whose only release tag is in the past is excluded
   from candidacy (already shipped); a current-or-future tag makes it a
   candidate for that release.
4. **Rules** — `rules.service.ts`. Evaluates each surviving candidate against
   `rules.config.json` (`requiredStates`, `requireReleaseTag`,
   `requireWorkItemReference`). Overall status is the **worst** flag: any
   error → red (bad-state); else any warning → amber (missing release tag);
   else green (ready). No work-item reference routes to the non-PR bucket
   instead of flagging red. Start conservative — under-flag rather than erode
   trust; false positives are the primary failure mode this pipeline is
   designed against.
5. **Skip-filter** — `skip.service.ts`. Reads the whole skip set once per
   refresh from Table Storage and filters candidates by PR-ID / patch-id
   **before** the rule engine runs (skip-filter therefore actually sits
   between discovery/link and rules in execution, even though `AGENTS.md`
   lists it last by responsibility). See `docs/conventions/skip-list.md` for
   the full design.

All ADO access in stages 1–3 goes through `ado.service.ts` — see
`docs/conventions/api.md`.

## The `FreezeCandidate` / work-item contract

- **Identity:** a candidate's identity is its **PR-ID** (`pr:<id>`), or, for
  PR-less commits, a **patch-id** (`patch:<hash>`, via `git patch-id --stable`
  semantics) — never the raw commit SHA. Squash and re-merge change the SHA
  but not the PR-ID/patch-id, which is what keeps dedupe and the skip list
  stable across those operations.
- **Per-candidate fields (conceptual):** repo, PR (or SHA for non-PR), linked
  work item(s) with state and release tags, resolved release-tag verdict,
  rule-engine status (`ready` / `warning` / `bad-state` / `non-PR`), and
  whether it's currently skipped.
- **Shared type location:** the contract lives once in `shared/types.ts`;
  `api/src/types.ts` and `frontend/src/types.ts` re-export it (type-only) —
  do not duplicate the shape in both places.
- **Buckets:** ready / warning / bad-state candidates feed the main sortable
  list; non-PR / no-ticket candidates feed a separate collapsed section and
  are excluded from the ready/warning/bad-state counts.

## Dependency order matters

Discovery must run before linking (linking needs a resolved PR), linking
before release-tag resolution (a work item's tags are read off the linked
item), release-tag resolution before rules (rules consume the resolved
tag verdict), and skip-filtering must happen before rules evaluate a
candidate (a skipped candidate should never reach — and never be scored by —
the rule engine). Reordering any of these breaks the false-positive
guarantees the design is built around.
