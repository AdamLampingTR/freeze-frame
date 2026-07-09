# FreezeFrame

Release-readiness dashboard for code-freeze prep. Agent-agnostic memory — pointers into `docs/`, not prose.

## Coding Tasks

- **MANDATORY:** every code task follows `/implement-from-spec` (`.claude/skills/implement-from-spec/SKILL.md`). The build target is `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`.
- **Definition of done:** `/verify-freeze-frame` passes — typecheck + lint + test in both `frontend/` and `api/`, and the local loop serves `GET /api/freeze-candidates`.
- **PRs:** feature branch → PR → CI gate → **human merge** (never commit to `main`; it auto-deploys). Draft PR, ADO work-item link in the description, `AI Generated` label. See `/creating-pull-requests`.

## Project

- **Repo:** `AdamLampingTR/freeze-frame` (SWA: `frontend/` static assets + `api/` HTTP Functions).
- **Stack:** React+TS+Vite · Azure Functions v4 (TS) · Azure Table Storage · ADO REST · Power Automate webhook.
- **Monitors:** `TT.AskDI` (`development`→`staging`), `TT.OfficeAddin` (`dev`→`staging`), single ADO project `CoCounsel` in organization `tr-core-ai-data-platforms`.

## Quick Commands

- Frontend: `cd frontend && npm run {dev,build,typecheck,lint,test}`
- API: `cd api && npm run {build,typecheck,lint,test}`; `func start` (needs Core Tools)
- Local loop: `swa start` (port 4280) + `func start` + Azurite. See `docs/conventions/local-dev.md`.

## Context Budget

- Always: this file, `.claude/rules/*` (path-scoped), the MVP spec when implementing.
- When relevant: `docs/conventions/{architecture,api,skip-list,local-dev,ado-access}.md`.

## Architecture

Pipeline: discover (`diff.service`) → link (`linking.service`) → release-tag (`releaseTag.service`) → rules (`rules.service`) → skip-filter (`skip.service`). See `docs/conventions/architecture.md`. The skip list is load-bearing — see `docs/conventions/skip-list.md`.

## Skills

- `/implement-from-spec` — the mandatory build loop.
- `/verify-freeze-frame` — the runnable definition of done.
- `/creating-pull-requests` — draft PR, ADO link, AI Generated label.
