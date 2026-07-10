# Local development

Single source of truth for running the full FreezeFrame stack locally.
Extracted from `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`
("Local development / testing"). This is the documented SWA dev workflow,
not something to invent per-task.

## Quickstart (one command)

```bash
# one-time
npm i -g azure-functions-core-tools@4 @azure/static-web-apps-cli azurite
cp api/local.settings.json.example api/local.settings.json   # then fill in 2 read-only ADO PATs

# every time
./scripts/dev-local.sh
```

`scripts/dev-local.sh` checks prerequisites, builds `api/`, then starts Azurite
+ the Functions host + the SWA dev server in the right order and tears them all
down on Ctrl-C. When it prints the banner, open **http://localhost:4280** — the
SWA proxy, **not** `:5173`; the `/api` routes only exist behind the proxy.

The rest of this doc explains what each process does and why, for when you want
to run them by hand or debug one in isolation.

## Why the SWA CLI is the front door

`swa start` is not optional scaffolding — its auth emulation supplies the
same `x-ms-client-principal` header the deployed app gets from SWA's built-in
auth, so `dismissedBy` (see `docs/conventions/skip-list.md`) works locally
with no sign-in flow and no custom hack. The Function code path is identical
local vs. deployed.

## The three local processes

- **SWA CLI** (`swa start`, port 4280) — serves the frontend, proxies `/api`
  to the Functions host, and **emulates auth**: pick a fake identity at
  `/.auth/login/aad` and the emulator injects the principal into requests it
  forwards to the Functions. Keep a trivial hardcoded-user fallback only for
  running `func start` bare, without the CLI in front.
- **Azure Functions Core Tools** (`func start`, port 7071) — runs the managed
  Functions directly. `local.settings.json` (gitignored — see
  `.claude/rules/secrets.md`) holds settings and secrets for this process.
- **Azurite** — the Table Storage emulator for the skip list. Set
  `SKIP_TABLE_CONNECTION_STRING=UseDevelopmentStorage=true` to point
  `skip.service.ts` at it. The skip list works fully offline this way.

Standard loop: a `swa-cli.config.json` points `appLocation` / `apiLocation` at
`frontend` / `api`; run Azurite in the background; `swa start` brings up the
rest.

## The one dependency that can't be emulated: ADO REST

Use two **read-only PATs** — one per org, same scopes as the deployed
service PATs, see `docs/conventions/ado-access.md` — in
`local.settings.json`: `ADO_REPOS_PAT` (Code read, on `ThoughtTrace`) and
`ADO_WORKITEMS_PAT` (Work Items read, on `tr-core-ai-data-platforms`).
Optionally record/replay JSON fixtures for fully offline development — the
`ccd` scripts already carry canned responses that can be reused rather than
re-recorded.

Separately, dev-time MCP tooling (used interactively, not by the Functions
runtime) authenticates via `ADO_MCP_AUTH_TOKEN` (tickets,
`tr-core-ai-data-platforms`) and `ADO_REPOS_MCP_AUTH_TOKEN` (repos,
`ThoughtTrace`) — see `.mcp.json`. These are distinct env vars from the
runtime PATs above.

## Notifications: dry-run by default locally

Set `NOTIFY_DRY_RUN=1` (or truthy) so `notification.service.ts` logs the
would-be payload instead of POSTing to the real Power Automate webhook.
Testing locally must never email or Teams-ping real people. See
`.claude/rules/secrets.md`.

## Summary of local env vars

| Variable | Local value |
|---|---|
| `ADO_REPOS_ORG` / `ADO_REPOS_PROJECT` | same as deployed (`ThoughtTrace` / `ThoughtTrace Core`) |
| `ADO_REPOS_PAT` | read-only PAT, Code (read), on `ThoughtTrace` |
| `ADO_WORKITEMS_ORG` / `ADO_WORKITEMS_PROJECT` | same as deployed (`tr-core-ai-data-platforms` / `CoCounsel`) |
| `ADO_WORKITEMS_PAT` | read-only PAT, Work Items (read), on `tr-core-ai-data-platforms` |
| `SKIP_TABLE_CONNECTION_STRING` | `UseDevelopmentStorage=true` (Azurite) |
| `NOTIFY_DRY_RUN` | `1` |
| `POWER_AUTOMATE_WEBHOOK_URL` | not required when `NOTIFY_DRY_RUN=1` |

All of the above live in gitignored `api/local.settings.json` — see
`api/local.settings.json.example` for the template, and never commit a real
PAT or webhook URL into any tracked file.

Dev-time MCP tokens are separate from the runtime vars above and are not set
in `local.settings.json` — they live in the shell environment as
`ADO_MCP_AUTH_TOKEN` (tickets) and `ADO_REPOS_MCP_AUTH_TOKEN` (repos), read by
`.mcp.json`.
