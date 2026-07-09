# freeze-frame

FreezeFrame — a release-readiness dashboard for code-freeze prep. Azure Static Web App: `frontend/` (React+Vite) + `api/` (Azure Functions, TS).

## Agent harness

- `CLAUDE.md` imports `AGENTS.md` (agent-agnostic memory).
- `.claude/` is the source of truth: `rules/` (path-scoped), `skills/`, `settings.json`, `hooks/`.
- `.agents/skills` and `.cursor/skills` are committed symlinks to `.claude/skills`.
  - **Windows note:** symlinks require `git config core.symlinks true` (default on macOS/Linux). On Windows without it, they check out as text files.
- Build target for autonomous work: `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`.

## Develop locally

    cd frontend && npm install && npm run dev      # http://localhost:5173
    cd api && npm install && npm run build

Full local loop (dashboard + API + storage): `swa start` + `func start` + Azurite. See `docs/conventions/local-dev.md`. Copy `api/local.settings.json.example` → `api/local.settings.json` (gitignored) and fill in a read-only ADO PAT.

## Verify

    cd frontend && npm run typecheck && npm run lint && npm run test && npm run build
    cd api && npm run typecheck && npm run lint && npm run test && npm run build
