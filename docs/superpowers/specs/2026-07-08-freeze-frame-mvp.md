# FreezeFrame MVP — Build Plan (Revised)

> Transcribed verbatim from the Notion page "Plan Phase — Build Plan (Revised)"
> (page id `3980339a01d1813b8284fd4cc971af91`, parent: "July 2026 Hackathon -
> Pre-Hackathon Preparation Roadmap"), itself transcribed from `Plan Phase.pdf`
> on 2026-07-08. This is the locked build plan for the FreezeFrame hackathon
> MVP — it **supersedes the first draft**. Assumes Explore is complete and the
> decisions below are locked — this is the thing to build against.
>
> Normalization note: the source spelled the repo identifier without a
> hyphen in two places (the repo slug and the repository-layout tree root).
> Both are normalized to `freeze-frame` below to match this repo's actual
> name (`AdamLampingTR/freeze-frame`). The brand name "FreezeFrame"
> (camelCase, no hyphen) is unchanged — it's prose, not an identifier.

## What changed in this revision

Three things reshaped the earlier draft:

1. There is **more-mature prior art** — Jared's [`code-freeze-dashboard`](https://github.com/JaredGotteTR/code-freeze-dashboard) (bash + jq) — whose discovery and flagging logic we are **porting rather than reinventing**.
2. The naive commit **set-difference is rejected** in favour of squash-safe **cherry-pick + PR-ID dedupe**.
3. Two requirements the first draft lacked — a **persisted, user-editable skip list** and a surfaced **"non-PR / no-ticket" bucket** — are now first-class.

Notifications remain the **Power Automate webhook we already built and tested** (both email *and* Teams), which supersedes the synthesis doc's stale "SMTP / nodemailer, email-only" note.

## Confirmed decisions

- **Hosting:** Azure Static Web Apps, Free plan. Creation rights confirmed. Live / interactive architecture. **Surfaced to users by embedding the SWA in an ADO dashboard via the "embedded webpage" widget** (current direction). ⚠️ *Validate Day 1:* SWA AAD auth *inside the dashboard iframe* can be blocked (X-Frame-Options / `frame-ancestors` / SameSite + third-party cookies), and the "`dismissedBy` for free" win depends on that session — anonymous SWA is iframe-friendly but yields no principal, while authenticated SWA gives the principal but the in-iframe login is the fragile part. Same-tenant AAD helps; force first-login in a new tab if needed.
- **Foundation:** partial rewrite of Jared's bash logic into **TypeScript running over the ADO REST API**, so we stay on SWA **managed** Functions (HTTP-only). We are *not* shelling out to git.
- **Repo:** `AdamLampingTR/freeze-frame`, monorepo, deployed via the SWA-generated GitHub Actions workflow. (The `freeze-frame` scaffold is boilerplate only — no `src/` — so this is a port, not a head start.)
- **Frontend:** React + TypeScript (Vite), served as SWA static assets.
- **API:** HTTP-triggered Azure Functions in the SWA `api/` folder.
- **Commit discovery:** cherry-pick + PR-ID dedupe (Jared's approach), reimplemented over REST. Not naive SHA set-difference.
- **Commit → work-item linking:** PR-title/branch fallback in addition to commit-subject parsing.
- **Release-tag logic:** month-name and ISO tags (e.g. `July 9`, `July 23`), with past-tag exclusion and Dec/Jan year-wrap — ported from Jared's `is_release_tag`.
- **Target release:** user picks the target tag, defaulting to the nearest upcoming release.
- **Skip list:** Azure Table Storage in the existing `fluffyttisancusfrontend` account; PR-ID keyed; durable / global with release context recorded; visible and reversible in the UI.
- **Non-PR / no-ticket commits:** surfaced in a collapsed section, not flagged red, never silently dropped.
- **Refresh:** manual, request-driven. No server-side timer (managed Functions are HTTP-only).
- **Scope:** single project, `tr-core-ai-data-platforms`. *(Confirm both TT.AskDI and TT.OfficeAddin live under it.)*
- **Users:** primarily lead devs; also release managers.
- **Notifications:** manual per-candidate trigger → Power Automate webhook → both Outlook email and Teams adaptive card. Recipients = commit author + ADO assignee.
- **Fallback:** ADO pipeline rendering a static report to Storage `$web`. Documented at the end.

## SWA constraints the design respects

Managed Functions are **HTTP-triggered only** (no cron, no Durable) — hence manual refresh. Any single HTTP response must finish within **~230s**. The API route prefix must be `/api`. Secrets live in SWA application settings. And — the reason for the whole TS-over-REST rewrite — managed Functions run on a **read-only filesystem and cannot execute git**, so both the diff and any persisted state must go through APIs (ADO REST, Table Storage), not local files or a working copy.

## Branch / repo scope

Single project `tr-core-ai-data-platforms`, two repos:

- **TT.AskDI:** `development` → `staging`
- **TT.OfficeAddin:** `dev` → `staging`

Displayed as **one combined, sortable list with a prominent per-row repo badge** (not per-repo tabs).

## Repository layout

`backend/` from the scaffold is replaced by `api/`.

```javascript
freeze-frame/
├── .github/workflows/          # SWA-generated build+deploy workflow
├── frontend/                   # React + TS (Vite)
│   ├── src/
│   │   ├── components/         # Cards, stats, filters, notify menu,
│   │   │                       #   skip-list panel, non-PR section, release picker
│   │   ├── api/                # Thin client for /api calls
│   │   ├── types/               # Shared TS types
│   │   └── App.tsx
│   └── vite.config.ts
├── api/                         # Azure Functions (HTTP-triggered)
│   ├── src/
│   │   ├── functions/
│   │   │   ├── freezeCandidates.ts      # GET    /api/freeze-candidates
│   │   │   ├── freezeCandidateById.ts   # GET    /api/freeze-candidates/{id}
│   │   │   ├── notify.ts                # POST   /api/freeze-candidates/{id}/notify
│   │   │   ├── skipList.ts              # GET    /api/skips
│   │   │   ├── dismiss.ts               # POST   /api/freeze-candidates/{id}/dismiss
│   │   │   └── unskip.ts                # DELETE /api/skips/{key}
│   │   ├── services/
│   │   │   ├── ado.service.ts           # ADO REST: commits, PRs, work items, tags
│   │   │   ├── diff.service.ts          # cherry-pick + PR-ID dedupe over REST
│   │   │   ├── linking.service.ts       # commit→work-item (subject + PR fallback)
│   │   │   ├── releaseTag.service.ts    # is_release_tag port (month-name/ISO/wrap)
│   │   │   ├── rules.service.ts         # rule engine (tag + state + release)
│   │   │   ├── skip.service.ts          # Table Storage read/write
│   │   │   └── notification.service.ts  # Power Automate webhook call
│   │   ├── config/
│   │   │   └── rules.config.json
│   │   └── types/
│   ├── host.json
│   └── package.json
├── staticwebapp.config.json    # SPA fallback + secure /api routes
├── LICENSE
└── README.md
```

Verify in the generated workflow: `app_location: "frontend"`, `api_location: "api"`, `output_location: "dist"` (Vite default; the template often guesses `build` — the most likely first-run failure).

## Porting Jared's logic to TypeScript-over-REST

Jared's `code-freeze-dashboard` is bash + jq that shells out to git and `ado-curl`. We keep its *algorithms* and re-express its *mechanics* as ADO REST calls. Reuse the logic; replace the transport. In dependency order:

### 1. Commit discovery — `diff.service.ts`

Goal: the set of commits merged into the source branch but not yet in the target, **deduplicated the squash-safe way**. Naive SHA set-difference over-reports squash-merges and re-merges — precisely the false-positive risk — so it is rejected.

Jared's git formulation is `git log staging..dev --cherry-pick --right-only` plus PR-ID dedupe. Over REST there is no direct `--cherry-pick` flag, so we reproduce its intent:

- Pull the commits reachable from source but not target via the ADO commits/diffs REST endpoint.
- For each commit, resolve its associated PR (ADO links commits ↔ PRs; use the PR that introduced it).
- **Dedupe by PR-ID**, collapsing the many commits of a squashed/re-merged PR to a single candidate. The PR-ID becomes the candidate's identity.
- Commits with no associated PR pass through as SHA-identified candidates (they land in the non-PR bucket, below).

The unit of candidacy is therefore the **PR**, not the commit — this is what makes the dedupe squash-safe and what the skip list keys on.

### 2. Commit → work-item linking — `linking.service.ts`

Subject-only parsing is the weaker option and misses real cases (e.g. TT.AskDI PR 23369, where the ID lived only in the PR title). Confirmed: the ADO number is in the PR title, and links are added to PRs and vice versa. So link in this order:

1. ADO work-item IDs parsed from the commit subject (`ADO-12345` / `#12345` — confirm exact convention day 1).
2. **Fallback:** the PR title and PR source-branch name for the candidate's PR.
3. **Fallback:** the PR's own linked work items from the ADO PR REST endpoint.

First hit wins; a candidate with none of these is a no-ticket candidate (non-PR bucket).

### 3. Release-tag parsing — `releaseTag.service.ts`

Port Jared's `is_release_tag` verbatim in behaviour: recognise both ISO and month-name release tags (`July 9`, `July 23`), including Dec/Jan year-wrap, within a recency window. Do not substring-match. Phase 1 confirms tags are exactly this shape, so the port covers the real data.

"Consider older tags" resolves operationally as: if a work item's only release tag is a **past** release date → exclude the candidate (already shipped in a prior freeze); a **current-or-future** tag → it's a candidate for that release.

### 4. ADO access — `ado.service.ts`

Server-side direct ADO REST with a **service PAT** from SWA app settings (Code read, Work Items read). A pasted or Keychain PAT cannot back a shared dashboard, and MCP-per-request is too heavy server-side. Batch work-item fetches to stay inside the 230s ceiling and be gentle on rate limits.

## Target release selection

A new concept the first draft lacked. The user picks the **target release tag** (e.g. `July 9`) from a picker, defaulting to the nearest upcoming release. This target drives release-tag evaluation in the rule engine (which tag counts as "current" for this freeze) and is recorded as context when a candidate is dismissed. The selected target is passed to `GET /api/freeze-candidates?release=July%209`.

## Rule engine — `rules.service.ts`

Minimum viable flag set, confirmed: **both** the release tag **and** the correct ADO state must be set. State is a first-class flag (Jared's dashboard flags on it; the old skill fetched-but-ignored it — don't repeat that). Config is data-driven so rules tune without code changes, because false positives are the primary failure mode.

```json
{
  "requiredStates": ["Verified", "Closed"],
  "requireReleaseTag": true,
  "requireWorkItemReference": true
}
```

Per candidate (after skip-filtering and release resolution):

- **Wrong state** — any linked work item whose state isn't in `requiredStates` → error (bad-state).
- **Missing release tag** — no current-or-future release tag for the target → warning.
- **Past-tag-only** — handled in discovery (excluded), not flagged.
- **No work-item reference** — routed to the non-PR / no-ticket bucket, not flagged red.

Overall status is the **worst** flag: any error → red; else any warning → amber; else ready → green. Start conservative — under-flag rather than erode trust.

## Skip list (deliberately-skipped commits)

This replaces today's hand-typed `R`/`X`/`L` markers in `dev-staging-changes-*.md`, and the synthesis doc calls it the single biggest lever on false positives.

**Store:** Azure Table Storage in the existing `fluffyttisancusfrontend` account. Chosen because the skip list must be writable at runtime (managed Functions have a read-only filesystem, so a bundled JSON can't work), shared across all users (server-side, not client), and is tiny and rarely written — a full database is overkill, and Table Storage is in a resource we already have and keeps the write server-side behind the API. Connection string in SWA app settings.

**Key:** the **PR-ID** — never the commit SHA. Because discovery dedupes by PR-ID and squash/re-merge changes the SHA, a SHA-keyed skip would silently stop matching after a re-merge and resurface a dismissed commit. For genuinely PR-less commits, fall back to keying on `git patch-id --stable` (not the raw SHA): a rebase or cherry-pick produces a new SHA but the same patch-id, so a re-applied dismissed commit stays dismissed. Prefix the RowKeys — `pr:12345` vs `patch:<hash>` — so the two buckets can't collide. (patch-id is already computed in the `ccd` scripts.)

**Entity shape:** `PartitionKey` = repo, `RowKey` = `pr:<id>` (or `patch:<hash>` fallback), plus `dismissedBy`, `dismissedAt`, `reason`, `kind`, and `dismissedForRelease`. `reason` is a small preset set — `reverted` / `superseded-by-later-commit` / `held` / `shipped-elsewhere` / `not-ready` — plus optional free text (many of these reasons are non-obvious and won't be inferred by the next person).

**Scope:** durable and **global** by default — once dismissed, a candidate stays out of candidacy across freezes (matching today's permanent `R`/`X`/`L` behaviour) — with the target release at dismissal recorded for context. This matters more than it first looks: the skip list absorbs a messy long tail the PR-ID dedupe can't catch on its own — remove→revert→reapply chains, non-squashed merges (where the commit/PR-ID mapping doesn't line up the way squash-based dedupe assumes), and commits made moot because a later commit already overwrote their values to the intended end state. None of those are "on staging," so nothing auto-excludes them; most are permanent, which is why global-durable is the right default. A `kind` field distinguishes `permanent` (gone forever) from `hold` (a deliberate "ship in July 23, not July 9" — the one genuinely per-release case), so the UI can show them differently.

**Identity for free:** `dismissedBy` comes from SWA built-in auth, which passes the user principal to the Function in the `x-ms-client-principal` header. No login flow or prefs system needed. `dismissedBy` + `reason` double as a lightweight audit trail and directly answer "why isn't this commit showing?". In the deployed SWA the principal is present; **locally** there is no SWA auth in front of the Function, so the `swa start` emulator supplies a fake one (see *Local development / testing*). This win also depends on the in-iframe auth working when embedded — see the caveat under *Hosting*.

**Visible and reversible in the UI (required, not optional):** because the skip list is the biggest false-positive lever *and* is global-permanent, a hidden store would quietly become a new black hole as the long-tail cases pile up unseen. So it is a first-class panel — each entry showing who dismissed it, when, why, its `kind`, and for which release — with un-skip as a first-class action. Flow: dismiss (`POST …/dismiss` writes a row), view (`GET /api/skips` lists them), un-skip (`DELETE /api/skips/{key}` removes the row). The diff service reads the whole (small) skip set once per refresh and filters candidates by PR-ID / patch-id before the rule engine runs. **Prune orphans:** once a skipped PR lands on staging it drops out of candidacy on its own, leaving a stale entry — so the skip-list view should intersect with the current candidate set (or mark orphans) to avoid accreting cruft.

## Non-PR / no-ticket bucket

Both prior dashboards silently dropped non-Merged-PR commits. Confirmed requirement: don't drop, don't flag red — surface them in a **collapsed "non-PR / no-ticket" section** so nothing vanishes unexplained. These are SHA-identified, can still be dismissed (patch-id-keyed skip, per the Skip list section), and are excluded from the ready/warning/bad-state counts (shown as their own count).

## Frontend

Everything visual and stateless; holds no secrets; talks only to `/api`.

**Components:** the combined sortable candidate list with per-row repo badge and color-coded status; the stats summary (total, ready, warning, bad-state, plus a separate non-PR/no-ticket count); expand-to-see-tickets per card; filtering and sorting; the **release picker** (defaulting to nearest upcoming); the **notify** control with email/Teams/both; the **skip-list panel** (view + un-skip) and a per-candidate **dismiss** affordance; the collapsed **non-PR/no-ticket** section; and **cherry-pick copy** — confirmed in-scope and called the highest-value action for release managers, so it ships in MVP, not as a stretch. UI state (filter, expansion) is React state; durable state (skips) lives server-side.

Visual language follows the `release-readiness-dashboard` reference: dot status indicators, hoverable rows, inline ticket expansion.

## Notifications

Unchanged from what we built and tested — this supersedes the synthesis doc's SMTP/email-only note. Manual per-candidate trigger; the frontend calls `POST /api/freeze-candidates/{id}/notify` with `{ notifyVia: 'email' | 'teams' | 'both' }`; the Function resolves recipients (commit author + ADO assignees, deduplicated) and POSTs to the Power Automate webhook (`POWER_AUTOMATE_WEBHOOK_URL` in app settings). The flow fans out to Outlook email and a Teams adaptive card. Payload uses string arrays (the shape the flow's trigger schema expects):

```json
{
  "commitHash": "abc12345",
  "commitMessage": "…",
  "commitAuthor": "…",
  "to": ["author@example.com", "assignee@example.com"],
  "adoTickets": ["ADO-12345: Title (State: Active, Assigned to: …)"],
  "flags": ["❌ …", "⚠️ …"],
  "dashboardUrl": "https://<swa-host>/candidates/abc12345"
}
```

MVP limits (carried): manual only (no auto-notify), no notification history, no prefs, single Teams channel — all Phase 2.

## Configuration and secrets

SWA application settings, read via `process.env`:

- `AZURE_DEVOPS_PAT` — service PAT, Code (read) + Work Items (read)
- `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT` (`tr-core-ai-data-platforms`)
- `SKIP_TABLE_CONNECTION_STRING` — Table Storage in `fluffyttisancusfrontend`
- `POWER_AUTOMATE_WEBHOOK_URL`
- `DASHBOARD_URL`

`rules.config.json` and repo/branch config ship as versioned files (not secret).

## Local development / testing

The whole stack emulates locally, and the SWA CLI is the front door — crucially, its auth emulation supplies the same `x-ms-client-principal` the deployed app gets from SWA built-in auth, so `dismissedBy` works locally with no sign-in flow and no custom hack.

- **SWA CLI** (`swa start`, port 4280) — serves the frontend, proxies `/api`, and **emulates auth**: pick a fake identity at `/.auth/login/aad` and the emulator injects the principal into requests it forwards to the Functions. The Function code path is identical local vs deployed. (Keep a trivial hardcoded-user fallback only for running `func start` bare, without the CLI in front.)
- **Azure Functions Core Tools** (`func start`, port 7071) — runs the managed Functions; `local.settings.json` (gitignored) holds settings + secrets.
- **Azurite** — the Table Storage emulator; set `SKIP_TABLE_CONNECTION_STRING=UseDevelopmentStorage=true`. The skip list works fully offline.
- **ADO REST** — the one dependency that can't be emulated: a **read-only PAT** (Code + Work Items read) in `local.settings.json`. Optionally record/replay JSON fixtures for fully-offline dev (the `ccd` scripts already carry canned responses to reuse).
- **Notifications** — a `NOTIFY_DRY_RUN` flag makes `notification.service.ts` log instead of POSTing to the real Power Automate flow, so testing never emails or Teams-pings real people.

Standard loop: a `swa-cli.config.json` points `appLocation` / `apiLocation` at `frontend` / `api`; run Azurite in the background; `swa start` brings up the rest. This is the documented SWA dev workflow, not something to invent.

## Build sequence

Front-loads the risky integrations so blockers surface while there's time to react.

- **Day 1 morning — de-risk.** Confirm the service PAT reads commits, PRs, and work items against `tr-core-ai-data-platforms` (throwaway REST script). Confirm the commit-subject ADO-ID convention. Verify the SWA workflow deploys the starter frontend end to end; fix `output_location` if it fails. Stand up the Table Storage table and confirm a function can read/write it. Bring up the local loop (`swa start` + `func start` + Azurite) and confirm the auth emulator yields a principal. **Validate the ADO-dashboard embed early** — confirm the SWA renders *and* authenticates inside the embedded-webpage iframe, since that gates the `dismissedBy` approach.
- **Day 1 afternoon — API first, mock the frontend.** Port `diff.service.ts` (cherry-pick + PR-ID dedupe over REST) and `linking.service.ts` (subject + PR fallback). Port `releaseTag.service.ts`. Build `rules.service.ts` and `skip.service.ts`. Wire `GET /api/freeze-candidates?release=…` end to end against real data. Frontend team builds list/cards/stats/release-picker against a mock matching the candidate type.
- **Day 2 — integrate.** Point the frontend at real `/api`. Wire dismiss / skip-list / un-skip. Wire the notify button to the proven webhook. Test end to end with real data; tune rules to kill false positives; verify squash-merged PRs collapse to one candidate and stay dismissed after re-merge.
- **Day 2–3 — polish / stretch.** Cherry-pick copy (in-scope, prioritise), sorting/filtering, non-PR section polish, responsive layout, single-candidate detail endpoint. Stretch (Phase 2, don't attempt under deadline): auto-notify on flag change (needs BYO Functions + timer), notification history.

## Success and failure criteria

**Success** — measurably less time chasing ticket status before freeze; a higher share of work items correctly stated and tagged before the freeze; release managers and a majority of squads open the dashboard *during* the sprint. Concrete target from Explore v2: **fewer than 5 false positives across the first 2 freezes**, and flags actually acted upon (state corrected / tags added).

**Failure** — inaccurate flags erode trust and people revert to manual checking; or it's only opened at the last minute, surfacing problems without changing when they're fixed. The squash-safe dedupe, the skip list, and conservative rule tuning are the three levers aimed squarely at the first failure mode.

## Fallback: ADO pipeline + Blob `$web`

Kept as a documented alternative if SWA becomes unworkable. An ADO pipeline references the GitHub code, runs the diff + rule logic as a build step (on an agent that *does* have git — so Jared's bash could run closer to as-is there), renders `index.html` into the existing Storage Account `$web` container, and calls the same Power Automate webhook for notifications. Trade-off: the dashboard becomes a published report of the last run rather than a live app, and loses the interactive dismiss/un-skip round-trips (the skip list would need the pipeline to read the Table and the UI to be regenerated). The diff/linking/rules/notification logic is shared, so falling back is a repackaging exercise — though the interactive skip-list UX is the piece that degrades most, which is another reason to prefer the SWA path.
