# FreezeFrame — AI-Ready Workspace / Agent Harness Design

**Date:** 2026-07-08
**Repo:** `AdamLampingTR/freeze-frame`
**Status:** Approved (brainstorm) — pending spec review, then implementation plan

## Goal

Prepare this repo so an **autonomous coding agent (Claude Code first, but tool-agnostic)** can implement the FreezeFrame MVP against an in-repo spec, with enough structure and guardrails that hands-off runs are safe and self-verifiable.

This document is the design for the **prep work** (harness + skeleton + guardrails). It is *not* the FreezeFrame application spec — that is a deliverable of this prep (§3), transcribed from the locked "Plan Phase — Build Plan (Revised)".

### Boundary

- **This session builds:** the harness wiring, a green/deployable skeleton, the guardrails (tests/CI/verification), and drops the app spec into the repo.
- **The autonomous agent builds later:** the actual FreezeFrame app (discovery, linking, rules, skip list, notifications, frontend) against that spec.

### Confirmed decisions

1. **Work lands via a branch + PR** to `AdamLampingTR/freeze-frame` (branch `chore/ai-ready-workspace`). Not pushed to `main` directly.
2. **Human-merge gate retained:** agent works on feature branches → PR → CI gate → **human merge** (never direct-to-`main`, since `main` auto-deploys via the SWA workflow).
3. **Conventional tooling:** Vitest + ESLint + Prettier (not Biome).

### Non-goals

- Implementing the FreezeFrame app itself.
- Windows-first support. Symlinks are committed (git mode `120000`) mirroring the reference repos; this breaks on Windows `core.symlinks=false`. Team is on macOS — accepted caveat, noted in README.

## Precedent

Mirrors the harness pattern already used in `atpa-materia_core-services` and `cari-ai-assistant_agentic-draft-service`:

- `CLAUDE.md` is a one-line stub that `@`-imports `AGENTS.md`.
- `AGENTS.md` is the agent-agnostic memory, holding **pointers into `docs/`**, not prose.
- `.claude/` is the single source of truth (rules + skills + hooks + settings).
- `.agents/skills` and `.cursor/skills` are **committed symlinks** to `../.claude/skills` (no bootstrap script; git recreates them on clone).
- Rules are duplicated per-tool where formats differ (`.claude/rules/*.md` with `paths:` ↔ `.cursor/rules/*.mdc` with `globs:`/`alwaysApply:`).

## 1. Entry-point wiring

- `CLAUDE.md` → exactly `@AGENTS.md`.
- `AGENTS.md` → agent-agnostic memory, pointers into `docs/`. Sections:
  - **Coding Tasks** — mandatory `/implement-from-spec` workflow; PR standards (feature branch → PR → CI → human merge; `AI Generated` label; ADO work-item link in description).
  - **Project** — stack (SWA · React+TS+Vite frontend · Azure Functions TS `api/` · Table Storage · ADO REST · Power Automate) and the two source repos monitored (`TT.AskDI` `development`→`staging`, `TT.OfficeAddin` `dev`→`staging`).
  - **Quick Commands** — `swa start`, `func start`, Azurite, `npm run {build,typecheck,lint,test,format}`.
  - **Context Budget** — load-first (spec, always-loaded rules) vs load-when-relevant (convention docs).
  - **Architecture** — `frontend/` + `api/`; the diff → link → releaseTag → rules → skip pipeline; dependency order.
  - **Skills** — list + when each fires.
  - **Definition of Done** — must pass typecheck + lint + tests and the `verify-freeze-frame` skill; check against the spec's success criteria.
- Committed symlinks: `.agents/skills` → `../.claude/skills`, `.cursor/skills` → `../.claude/skills`.

## 2. `.claude/` — source of truth

- `settings.json` — PostToolUse `Edit|Write` → `hooks/post-edit-format.sh` (Prettier/ESLint on `.ts`/`.tsx`).
- `hooks/post-edit-format.sh` — best-effort format after edits (`exit 0` always).
- `rules/*.md` (path-scoped `paths:` frontmatter), mirrored as `.cursor/rules/*.mdc` (`globs:`/`alwaysApply:`):
  - `api.md` (`api/**`) — Azure Functions conventions; ADO REST only via `ado.service`; the 230s response ceiling; read-only filesystem (no local files / no git).
  - `frontend.md` (`frontend/**`) — talks only to `/api`; holds no secrets; visual language follows the `release-readiness-dashboard` reference.
  - `skip-list.md` (`api/**/skip*`) — the load-bearing invariants: key on **PR-ID**, `patch-id --stable` fallback for PR-less commits, `pr:`/`patch:` RowKey prefixes, `kind` (`permanent`/`hold`), orphan pruning.
  - `secrets.md` (always-loaded) — never commit PATs; config via SWA app settings / gitignored `local.settings.json`; `NOTIFY_DRY_RUN` for local.
- `skills/`:
  - `implement-from-spec` — the mandatory build loop (read a spec slice → plan → implement → verify), modeled on materia's `implement-from-task`.
  - `verify-freeze-frame` — the runnable **definition of done**: typecheck + lint + test; bring up `swa start` + Azurite; exercise `GET /api/freeze-candidates`; check against the spec's success criteria.
  - `creating-pull-requests` — draft PR, ADO work-item link, `AI Generated` label (from agentic-draft-service).

## 3. The spec in-repo (what the agent implements from)

- Transcribe the locked **Plan Phase — Build Plan (Revised)** (currently only in Notion) → `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`, including the success/failure criteria as the done-bar.
- Supporting convention docs (pointers from `AGENTS.md` + rules): `docs/conventions/{architecture,api,skip-list,local-dev,ado-access}.md`.

## 4. Building, deployable skeleton

- Remove `backend/` (Express placeholder). Add `api/` (Azure Functions, TS) per the plan's tree — `functions/`, `services/`, `config/rules.config.json`, `types/`, `host.json`, `package.json` — as **typed stubs that compile** (e.g. `GET /api/freeze-candidates` returns a mock; services are typed no-ops).
- Fix `frontend/`: add `src/main.tsx`, `App.tsx`, `vite.config.ts`, `tsconfig.node.json`, `components/` stubs.
- Add `staticwebapp.config.json` (SPA fallback + `/api` routing).
- Verify the existing SWA workflow's `app_location: frontend` / `api_location: api` / `output_location: dist`.
- Shared `types/` for the `FreezeCandidate` / `Ticket` contract (from the Explore doc) so frontend + api agree from day one.
- **Result:** `git clone` → build green → deploys via the SWA workflow already on `main`.

## 5. Guardrails for autonomy

- Tooling: strict TypeScript; ESLint + Prettier; Vitest. npm scripts: `build`, `typecheck`, `lint`, `test`, `format`.
- **CI gate:** a GitHub Actions workflow (separate from the SWA deploy) running typecheck + lint + test on every PR — objective gate on the agent's PRs before the human merge.
- **Seed tests** as executable spec anchors (also regression guards + worked examples for the agent):
  - squash-safe diff dedupe (PR-ID collapses many commits to one candidate),
  - `is_release_tag` (month-name + ISO + Dec/Jan year-wrap; past-tag exclusion),
  - skip-list keying (`pr:` vs `patch:` prefixes; SHA-vs-patch-id stability across re-merge).

## 6. MCP / ADO access

- `.mcp.json` with ADO MCP servers (`ado-tickets`, `ado-repos`), opt-in via gitignored `settings.local.json` (agentic-draft-service pattern), so the agent can query ADO while building.
- `local.settings.json.example` documenting: read-only ADO PAT (Code + Work Items read), `SKIP_TABLE_CONNECTION_STRING=UseDevelopmentStorage=true` (Azurite), `NOTIFY_DRY_RUN=1`.

## 7. Housekeeping

- Standardize on **`freeze-frame`** (hyphenated) everywhere — repo, package names, skill names, and file identifiers. When transcribing the Plan, normalize its no-hyphen repo references to `freeze-frame`. (The product/brand name "FreezeFrame" stays camelCase in prose.)
- `.gitignore`: materia-style `.claude/*` + `!`-negations for shared subdirs; `local.settings.json`; `.env`; `node_modules`; `dist`.
- README section: the harness layout, the local loop, and the committed-symlink / Windows caveat.

## Deliverables checklist

- [ ] `CLAUDE.md` (`@AGENTS.md`) + `AGENTS.md`
- [ ] `.claude/{settings.json, hooks/, rules/, skills/}`
- [ ] `.cursor/rules/*.mdc` mirrors + `.agents/skills` & `.cursor/skills` committed symlinks
- [ ] `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md` (transcribed Plan) + `docs/conventions/*.md`
- [ ] `api/` skeleton (compiles) replacing `backend/`
- [ ] `frontend/` fixed (builds) with shared `types/`
- [ ] `staticwebapp.config.json`; SWA workflow paths verified
- [ ] Vitest + ESLint + Prettier + npm scripts; seed tests
- [ ] CI workflow (typecheck + lint + test on PR)
- [ ] `.mcp.json` + `settings.local.json` (gitignored) + `local.settings.json.example`
- [ ] `.gitignore`; README harness section

## Success criteria (for the prep)

- `git clone` → `npm ci` → `npm run build` is green; the app deploys via the SWA workflow.
- A fresh Claude Code (or Cursor/Codex) session picks up `AGENTS.md`, the path-scoped rules, and the skills automatically.
- The FreezeFrame MVP spec and conventions are readable in-repo; the agent can start `/implement-from-spec` with no external context beyond ADO/MCP credentials.
- The CI gate runs on a PR and blocks on typecheck/lint/test failure.
- `verify-freeze-frame` runs the local loop end-to-end (`swa start` + Azurite + a `GET /api/freeze-candidates` against the mock).
