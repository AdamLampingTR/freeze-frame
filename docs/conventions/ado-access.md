# ADO access

Single source of truth for how FreezeFrame talks to Azure DevOps: which
org/project, what the service PAT can do, and how commits resolve to work
items. Extracted from `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`
("Confirmed decisions", "Branch / repo scope", "Porting Jared's logic... §§
2 and 4").

## Org / project scope

Everything — repos, PRs, and work items — lives under a **single ADO
project**: `tr-core-ai-data-platforms`. Unlike some other repos in this
workspace, FreezeFrame does **not** split repos and work items across two
different ADO orgs/projects — both the monitored repos and their linked work
items resolve within `tr-core-ai-data-platforms`. *(The spec flags this as
"confirm both TT.AskDI and TT.OfficeAddin live under it" — treat as confirmed
per the locked plan, but re-verify against live ADO if commit/work-item
linking ever comes up empty.)*

## Monitored repos and branches

Two repos, both diffed dev-branch → staging-branch:

- **TT.AskDI:** `development` → `staging`
- **TT.OfficeAddin:** `dev` → `staging`

Candidates from both repos are shown in **one combined, sortable list** with
a prominent per-row repo badge — not per-repo tabs.

## Service PAT scopes

All server-side ADO REST calls (via `ado.service.ts`, see
`docs/conventions/api.md`) use a single **service PAT** stored in SWA
application settings (`AZURE_DEVOPS_PAT`), scoped to exactly:

- **Code (read)**
- **Work Items (read)**

No write scopes — FreezeFrame never mutates ADO state, only reads it. A
pasted or Keychain PAT is not viable here because it can't back a
shared/server-side dashboard; the PAT must be a dedicated service credential
issued for this app and rotated like any other app secret (never committed —
see `.claude/rules/secrets.md`).

Locally, use a separate **read-only PAT** with the same two scopes — see
`docs/conventions/local-dev.md`.

## Commit → work-item linking convention

Resolution order, first hit wins:

1. **Commit-subject convention:** ADO work-item IDs parsed from the commit
   subject — `ADO-<id>` or `#<id>` (confirm the exact convention actually in
   use against real commit history on Day 1; both forms are anticipated).
2. **Fallback — PR title / branch:** the PR title and PR source-branch name
   for the candidate's PR. This fallback exists because subject-only parsing
   is known to miss real cases (e.g. TT.AskDI PR 23369, where the work-item ID
   lived only in the PR title, not the commit subject).
3. **Fallback — PR's linked work items:** the PR's own linked work items via
   the ADO PR REST endpoint.

A candidate with none of these hits is a **no-ticket candidate** and is
routed to the non-PR / no-ticket bucket (see
`docs/conventions/architecture.md`) rather than being flagged red.

## Cross-workspace note

This convention doc describes FreezeFrame's own ADO access model only. It is
unrelated to, and should not be confused with, the `ado-curl tt` / `ado-curl
cc` org-alias split used for *reviewing* other repos in the broader
`~/Developer` workspace (see the top-level `~/Developer/CLAUDE.md` index) —
that split exists because those repos' work items and code live in different
ADO orgs. FreezeFrame's own org/project is singular, as described above.
