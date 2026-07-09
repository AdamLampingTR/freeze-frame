# ADO access

Single source of truth for how FreezeFrame talks to Azure DevOps: which
orgs/projects, what the service PATs can do, and how commits resolve to work
items. Extracted from `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`
("Confirmed decisions", "Branch / repo scope", "Porting Jared's logic... §§
2 and 4").

## Org / project scope

FreezeFrame spans **two ADO orgs**, not one — repos/PRs and work items live
in different places:

- **Repos and PRs** (`TT.AskDI`, `TT.OfficeAddin`, their commits, PRs,
  branches) live in the **`ThoughtTrace`** org, project **`ThoughtTrace
  Core`**.
- **Work items** linked from those PRs/commits live in the
  **`tr-core-ai-data-platforms`** org, project **`CoCounsel`**.

This mirrors the `ado-curl tt` / `ado-curl cc` org-alias split used elsewhere
in the `~/Developer` workspace for the same two repos — see the top-level
`~/Developer/CLAUDE.md` index. Each org needs its own PAT; a PAT scoped to
one org will not authenticate against the other.

## Monitored repos and branches

Two repos, both diffed dev-branch → staging-branch:

- **TT.AskDI:** `development` → `staging`
- **TT.OfficeAddin:** `dev` → `staging`

Candidates from both repos are shown in **one combined, sortable list** with
a prominent per-row repo badge — not per-repo tabs.

## Service PAT scopes

All server-side ADO REST calls (via `ado.service.ts`, see
`docs/conventions/api.md`) use **two service PATs**, one per org, stored in
SWA application settings:

- **`ADO_REPOS_PAT`** — issued on `ThoughtTrace`, scoped to **Code (read)**
  only. Backs commit/PR lookups.
- **`ADO_WORKITEMS_PAT`** — issued on `tr-core-ai-data-platforms`, scoped to
  **Work Items (read)** only. Backs work-item state/tag lookups.

No write scopes on either — FreezeFrame never mutates ADO state, only reads
it. A pasted or Keychain PAT is not viable here because it can't back a
shared/server-side dashboard; each PAT must be a dedicated service credential
issued for this app and rotated like any other app secret (never committed —
see `.claude/rules/secrets.md`).

Locally, use two separate **read-only PATs** with the same scopes — see
`docs/conventions/local-dev.md`.

## Dev-time MCP servers

Separate from the runtime service PATs above, local agent/dev tooling talks
to ADO through two `@azure-devops/mcp` servers configured in `.mcp.json`,
each with its own PAT env var:

| MCP server | ADO org | Env var (PAT) | Purpose |
|------------|---------|----------------|---------|
| `ado-tickets` | `tr-core-ai-data-platforms` | `ADO_MCP_AUTH_TOKEN` | Work items / tickets |
| `ado-repos` | `ThoughtTrace` | `ADO_REPOS_MCP_AUTH_TOKEN` | Repositories, PRs, branches |

These MCP tokens are independent of the `ADO_REPOS_PAT` / `ADO_WORKITEMS_PAT`
runtime settings above — the MCP servers are for interactive agent use, the
runtime PATs back the deployed/local Functions.

### Setting up the MCP tokens

`.mcp.json` runs both servers with `--authentication envvar`, so each reads
its PAT from the environment — there is **no interactive fallback**. If the
matching env var isn't exported, that server's ADO tools silently fail to
authenticate. Set both up once before using the ADO MCP tools:

1. **Mint two PATs** — one per org (a PAT can't span orgs):
   - `tr-core-ai-data-platforms` (tickets) — https://dev.azure.com/tr-core-ai-data-platforms/_usersSettings/tokens — scope **Work Items (Read)** (+ **Identity (Read)**).
   - `ThoughtTrace` (repos) — https://dev.azure.com/ThoughtTrace/_usersSettings/tokens — scope **Code (Read)** (+ **Identity (Read)**).
2. **Export both** so they persist across shells:

   ```bash
   echo 'export ADO_MCP_AUTH_TOKEN=<tr-core-ai-data-platforms PAT>' >> ~/.zshrc
   echo 'export ADO_REPOS_MCP_AUTH_TOKEN=<ThoughtTrace PAT>' >> ~/.zshrc
   source ~/.zshrc
   ```

   (bash: use `~/.bashrc`. For a keychain-backed alternative, see the
   `macos-keychain` convention in `~/.claude/conventions/`.)

Read-only scopes are sufficient — FreezeFrame never writes to ADO.

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

FreezeFrame's own ADO access model **does** span two orgs — the same
`ThoughtTrace` (repos) / `tr-core-ai-data-platforms` (work items) split used
by the `ado-curl tt` / `ado-curl cc` org-alias convention for *reviewing*
these same repos elsewhere in the broader `~/Developer` workspace (see the
top-level `~/Developer/CLAUDE.md` index). It is the same underlying ADO
topology, just accessed via service PATs + REST here instead of `ado-curl`.
This is not a singular org/project — treat it as two from the start.
