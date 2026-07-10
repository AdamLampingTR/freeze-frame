# freeze-frame

FreezeFrame — a release-readiness dashboard for code-freeze prep. Azure Static Web App: `frontend/` (React+Vite) + `api/` (Azure Functions, TS).

## Agent harness

- `CLAUDE.md` imports `AGENTS.md` (agent-agnostic memory).
- `.claude/` is the source of truth: `rules/` (path-scoped), `skills/`, `settings.json`, `hooks/`.
- `.agents/skills` and `.cursor/skills` are committed symlinks to `.claude/skills`.
  - **Windows note:** symlinks require `git config core.symlinks true` (default on macOS/Linux). On Windows without it, they check out as text files.
- Build target for autonomous work: `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`.

## Develop locally

**One-time setup:**

    npm i -g azure-functions-core-tools@4 @azure/static-web-apps-cli azurite   # global tools
    cp api/local.settings.json.example api/local.settings.json                 # gitignored; fill in 2 read-only ADO PATs

**Run the full loop (one command):**

    ./scripts/dev-local.sh

This starts Azurite (skip-list storage), the Functions host, and the SWA dev
server, then serves everything at **http://localhost:4280** — open that, **not**
`:5173` (the `/api` routes only exist behind the SWA proxy). Ctrl-C stops all
three. The skip list uses Azurite and notifications are dry-run by default; only
ADO is hit for real, hence the read-only PATs.

Prefer to run the pieces yourself, or want to know what each does and why?
See **`docs/conventions/local-dev.md`**.

Per-package commands (no full loop):

    cd frontend && npm install && npm run dev      # http://localhost:5173
    cd api && npm install && npm run build

## Verify

    cd frontend && npm run typecheck && npm run lint && npm run test && npm run build
    cd api && npm run typecheck && npm run lint && npm run test && npm run build
