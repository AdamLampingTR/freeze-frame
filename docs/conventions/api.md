# API conventions

Single source of truth for how the `api/` Azure Functions are built and
constrained. Extracted from `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`
("SWA constraints the design respects", "Porting Jared's logic... § 4 ADO
access", "Configuration and secrets").

## Azure Functions v4, HTTP-triggered only

- The API is HTTP-triggered Azure Functions in the SWA `api/` folder — SWA
  **managed** Functions support HTTP triggers only. No cron / timer triggers,
  no Durable Functions. This is why refresh is manual and request-driven
  rather than a background job.
- Route prefix is fixed at `/api` by the SWA platform; individual functions
  live under it (`GET /api/freeze-candidates`, `POST
  /api/freeze-candidates/{id}/notify`, `GET /api/skips`, `POST
  /api/freeze-candidates/{id}/dismiss`, `DELETE /api/skips/{key}`, etc.).
- Auth is anonymous at the Function level — SWA's built-in auth sits in front
  and forwards the user principal via the `x-ms-client-principal` header;
  Functions read that header rather than implementing their own login.

## The ~230s ceiling

Any single HTTP response must finish within **~230 seconds** (the SWA
managed-Functions timeout). Batch ADO work-item fetches to stay inside this
ceiling and to be gentle on ADO rate limits — do not fetch work items
one-by-one in a loop over a large candidate set.

## Read-only filesystem

Managed Functions run on a **read-only filesystem and cannot execute git**.
Concretely:

- Never write local files or shell out to git at runtime.
- Both the commit diff (discovery) and any persisted state (the skip list)
  must go through APIs — ADO REST for the diff, Azure Table Storage for the
  skip list — never a local working copy or bundled/writable JSON file.

## All ADO access goes through `ado.service.ts`

Server-side, direct ADO REST calls, authenticated with **two service PATs**
stored in SWA application settings — one per ADO org (`ADO_REPOS_PAT`: Code
read on `ThoughtTrace`; `ADO_WORKITEMS_PAT`: Work Items read on
`tr-core-ai-data-platforms`) — see `docs/conventions/ado-access.md` for the
org/project split and PAT-scope detail. Do not call ADO REST directly from
route handlers or other services;
route all ADO calls through `ado.service.ts` so batching, auth, and rate-limit
handling live in one place. A pasted or Keychain PAT cannot back a shared
dashboard, and per-request MCP is too heavy server-side — hence the plain
service-PAT-over-REST approach.

## Configuration (via `process.env`, from SWA application settings)

- `ADO_REPOS_ORG` (`ThoughtTrace`), `ADO_REPOS_PROJECT` (`ThoughtTrace Core`),
  `ADO_REPOS_PAT` — service PAT scoped to Code (read); backs commit/PR
  lookups
- `ADO_WORKITEMS_ORG` (`tr-core-ai-data-platforms`), `ADO_WORKITEMS_PROJECT`
  (`CoCounsel`), `ADO_WORKITEMS_PAT` — service PAT scoped to Work Items
  (read); backs work-item lookups
- `SKIP_TABLE_CONNECTION_STRING` — Table Storage connection string
- `POWER_AUTOMATE_WEBHOOK_URL`
- `DASHBOARD_URL`

`rules.config.json` and repo/branch config ship as versioned files in the
repo, not secrets. See `.claude/rules/secrets.md` and
`docs/conventions/local-dev.md` for how these are supplied locally.
