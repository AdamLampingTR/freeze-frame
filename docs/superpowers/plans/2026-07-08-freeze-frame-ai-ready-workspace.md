# FreezeFrame AI-Ready Workspace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare `AdamLampingTR/freeze-frame` so an autonomous agent can implement the FreezeFrame MVP against an in-repo spec, with a green/deployable skeleton and self-verifiable guardrails.

**Architecture:** Azure Static Web Apps — a Vite/React/TS frontend (`frontend/`) and HTTP-triggered Azure Functions TS API (`api/`), deployed by the SWA GitHub Actions workflow already on `main`. The agent harness mirrors `atpa-materia_core-services` / `cari-ai-assistant_agentic-draft-service`: `CLAUDE.md` → `AGENTS.md`, `.claude/` as source of truth, committed `.agents/skills` + `.cursor/skills` symlinks.

**Tech Stack:** TypeScript (strict), React 18 + Vite, Azure Functions v4 (Node), Vitest, ESLint + Prettier, GitHub Actions.

**Source spec:** `docs/superpowers/specs/2026-07-08-freeze-frame-agent-harness-design.md` (this repo). The FreezeFrame MVP spec transcribed in Task 12 comes from the Notion "Plan Phase — Build Plan (Revised)" (`https://app.notion.com/p/3980339a01d1813b8284fd4cc971af91`) and `~/Developer/2026-hackathon-freezeframe-project-notes/Plan Phase.pdf`.

## Global Constraints

- **Node 20**, TypeScript **strict** mode, in both `frontend/` and `api/`.
- **Identifiers use `freeze-frame`** (hyphen); the brand name **FreezeFrame** stays camelCase in prose.
- **Never commit secrets.** ADO PATs / connection strings / webhook URLs live in SWA app settings or gitignored `api/local.settings.json`; `NOTIFY_DRY_RUN=1` locally.
- **`main` auto-deploys.** All work is on feature branches → PR → CI gate → **human merge**. Never commit to `main`.
- **API is HTTP-only, read-only filesystem, ~230s response ceiling.** No git, no local file writes at runtime; all state via ADO REST + Table Storage. `/api` route prefix.
- **SWA build locations:** `app_location: frontend`, `api_location: api`, `output_location: dist`.
- **Harness mirrors the reference repos:** commit symlinks as git mode `120000` (no bootstrap script); note the Windows `core.symlinks` caveat in the README.
- Work happens on branch `chore/ai-ready-workspace`; **do not push** until the whole plan is complete and the user approves opening the PR.

---

### Task 1: Baseline housekeeping — `.gitignore`, remove Express placeholder

**Files:**
- Create: `.gitignore`, `shared/types.ts`
- Delete: `backend/` (Express placeholder — the plan uses `api/` instead)

**Interfaces:**
- Consumes: nothing.
- Produces: a clean base; `.gitignore` covering node/build/secrets/personal-harness files every later task relies on; `shared/types.ts` — the **canonical** `FreezeCandidate`/`Ticket`/`FlagStatus`/`SkipKind` contract both projects re-export (type-only).

- [ ] **Step 1: Write `.gitignore`**

```gitignore
# Dependencies
node_modules/
# Build output
dist/
frontend/dist/
api/dist/
# Azure Functions local
api/local.settings.json
# Env / secrets
.env
.env.*
!.env.example
# Claude Code — ignore personal, keep shared harness
.claude/*
!.claude/settings.json
!.claude/hooks/
!.claude/rules/
!.claude/skills/
!.claude/commands/
.claude/settings.local.json
# Cursor personal
.cursor/personal/
# OS
.DS_Store
```

- [ ] **Step 2: Remove the Express placeholder**

Run: `git rm -r backend`
Expected: `backend/package.json`, `backend/src/index.ts`, `backend/tsconfig.json` staged for deletion.

- [ ] **Step 3: Verify**

Run: `test ! -d backend && echo "backend removed"` and `git status --short`
Expected: `backend removed`; `.gitignore` staged, `backend/*` deleted.

- [ ] **Step 4: Write the canonical contract `shared/types.ts`**

```typescript
// Canonical FreezeFrame contract. frontend/src/types.ts and api/src/types.ts each
// re-export from here via `export type ... from` — type-only, fully erased at build,
// so there is no runtime import and no SWA two-build fragility. shared/types.ts is
// never emitted (type-only imports are elided), so it does not violate api's rootDir.
export type FlagStatus = "ready" | "warning" | "bad-state" | "no-ticket";
export type SkipKind = "permanent" | "hold";

export interface Ticket {
  id: string;
  title: string;
  state: string;
  assignedTo: string | null;
  tags: string[];
}

export interface FreezeCandidate {
  key: string; // "pr:<id>" or "patch:<hash>"
  repo: string;
  prId: number | null;
  commitId: string;
  title: string;
  author: string | null;
  tickets: Ticket[];
  status: FlagStatus;
}
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore shared/types.ts
git commit -m "chore: .gitignore, remove Express backend/, add shared/types.ts contract"
```

---

### Task 2: Frontend skeleton that builds — Vite + React + TS + Vitest

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/types.ts`, `frontend/src/lib/status.ts`, `frontend/src/lib/status.test.ts`, `frontend/.eslintrc.cjs`, `frontend/.prettierrc.json`
- Delete: `frontend/public/index.html` (Vite wants `index.html` at the frontend root)

**Interfaces:**
- Consumes: nothing.
- Produces: `frontend/src/types.ts` — a type-only re-export barrel of the canonical `shared/types.ts` (Task 1), so the rest of the frontend imports from `./types` as usual; `statusColor(status: FlagStatus): string`.

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "freeze-frame-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write .",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "@vitejs/plugin-react": "^4.3.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.3.2",
    "typescript": "^5.5.2",
    "vite": "^5.3.1",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Write TypeScript + tooling configs**

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`frontend/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

`frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
});
```

`frontend/.eslintrc.cjs`:
```javascript
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  env: { browser: true, es2022: true },
  ignorePatterns: ["dist", "node_modules"],
};
```

`frontend/.prettierrc.json`:
```json
{ "semi": true, "singleQuote": false, "trailingComma": "all" }
```

- [ ] **Step 3: Write the contract barrel `frontend/src/types.ts`**

```typescript
// Re-export the canonical contract (type-only, erased at build).
export type {
  FlagStatus,
  SkipKind,
  Ticket,
  FreezeCandidate,
} from "../../shared/types";
```

- [ ] **Step 4: Write the trivial pure helper + its test (proves the test harness runs green)**

`frontend/src/lib/status.ts`:
```typescript
import type { FlagStatus } from "../types";

export function statusColor(status: FlagStatus): string {
  switch (status) {
    case "ready":
      return "green";
    case "warning":
      return "amber";
    case "bad-state":
      return "red";
    case "no-ticket":
      return "gray";
  }
}
```

`frontend/src/lib/status.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { statusColor } from "./status";

describe("statusColor", () => {
  it("maps each status to its color", () => {
    expect(statusColor("ready")).toBe("green");
    expect(statusColor("warning")).toBe("amber");
    expect(statusColor("bad-state")).toBe("red");
    expect(statusColor("no-ticket")).toBe("gray");
  });
});
```

- [ ] **Step 5: Write the app entry + delete the stale public/index.html**

`frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FreezeFrame — Release Readiness</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`frontend/src/App.tsx`:
```tsx
export function App() {
  return (
    <main>
      <h1>FreezeFrame</h1>
      <p>Release-readiness dashboard — skeleton. See docs/superpowers/specs.</p>
    </main>
  );
}
```

Run: `git rm frontend/public/index.html`

- [ ] **Step 6: Install, build, verify all green**

Run:
```bash
cd frontend && npm install && npm run typecheck && npm run lint && npm run test && npm run build
```
Expected: typecheck PASS, lint clean, 1 test file / 1 test PASS, `dist/` produced.

- [ ] **Step 7: Commit**

```bash
cd .. && git add frontend && git commit -m "feat(frontend): Vite+React+TS skeleton with Vitest/ESLint/Prettier"
```

---

### Task 3: API skeleton that compiles — Azure Functions v4 (TS) with mock endpoint

**Files:**
- Create: `api/package.json`, `api/tsconfig.json`, `api/host.json`, `api/.funcignore`, `api/src/index.ts`, `api/src/types.ts`, `api/src/functions/freezeCandidates.ts`, `api/src/functions/freezeCandidates.test.ts`, `api/src/services/{ado,diff,linking,releaseTag,rules,skip,notification}.service.ts`, `api/src/config/rules.config.json`, `api/local.settings.json.example`, `api/.eslintrc.cjs`, `api/.prettierrc.json`

**Interfaces:**
- Consumes: the contract shape from Task 2 (`FreezeCandidate`, `Ticket`, `FlagStatus`).
- Produces: `api/src/types.ts` — a type-only re-export barrel of `shared/types.ts`; a working `GET /api/freeze-candidates` returning `FreezeCandidate[]` (mock); typed no-op service stubs the agent will fill: `discoverCandidates`, `extractWorkItemIds`, `isReleaseTag`, `overallStatus`, `readSkips`, `adoGet`, `notify`.

- [ ] **Step 1: Write `api/package.json`**

```json
{
  "name": "freeze-frame-api",
  "private": true,
  "main": "dist/src/index.js",
  "scripts": {
    "build": "tsc",
    "start": "func start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write .",
    "test": "vitest run"
  },
  "dependencies": {
    "@azure/functions": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.2",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.3.2",
    "typescript": "^5.5.2",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Write configs**

`api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```

`api/host.json`:
```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

`api/.funcignore`:
```
*.test.ts
node_modules
tsconfig.json
```

`api/.eslintrc.cjs`:
```javascript
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  env: { node: true, es2022: true },
  ignorePatterns: ["dist", "node_modules"],
};
```

`api/.prettierrc.json`:
```json
{ "semi": true, "singleQuote": false, "trailingComma": "all" }
```

- [ ] **Step 3: Write the contract barrel `api/src/types.ts`**

```typescript
// Re-export the canonical contract (type-only, erased at build — shared/types.ts is
// never emitted or resolved at runtime, so it does not fall under this project's rootDir).
export type {
  FlagStatus,
  SkipKind,
  Ticket,
  FreezeCandidate,
} from "../../shared/types";
```

- [ ] **Step 4: Write typed service stubs (the agent fills these later)**

`api/src/services/releaseTag.service.ts`:
```typescript
// Stub — port of Jared's is_release_tag. Agent implements per docs/conventions/architecture.md.
export function isReleaseTag(_tag: string): boolean {
  throw new Error("not implemented: isReleaseTag");
}
```

`api/src/services/diff.service.ts`:
```typescript
import type { FreezeCandidate } from "../types";
// Stub — cherry-pick + PR-ID dedupe over ADO REST.
export async function discoverCandidates(
  _repo: string,
  _release: string,
): Promise<FreezeCandidate[]> {
  throw new Error("not implemented: discoverCandidates");
}
```

`api/src/services/linking.service.ts`:
```typescript
// Stub — commit-subject + PR-title/branch fallback linking.
export function extractWorkItemIds(_subject: string): string[] {
  throw new Error("not implemented: extractWorkItemIds");
}
```

`api/src/services/rules.service.ts`:
```typescript
import type { FlagStatus } from "../types";
// Stub — rule engine (tag + state + release). Agent implements per rules.config.json.
export function overallStatus(_flags: FlagStatus[]): FlagStatus {
  throw new Error("not implemented: overallStatus");
}
```

`api/src/services/skip.service.ts`:
```typescript
// Stub — Table Storage skip list, keyed pr:<id> / patch:<hash>.
export interface SkipEntry {
  key: string;
  repo: string;
  dismissedBy: string;
  dismissedAt: string;
  reason: string;
  kind: "permanent" | "hold";
  dismissedForRelease: string;
}
export async function readSkips(): Promise<SkipEntry[]> {
  throw new Error("not implemented: readSkips");
}
```

`api/src/services/ado.service.ts`:
```typescript
// Stub — ADO REST client (commits, PRs, work items, tags). Service PAT from env.
export async function adoGet<T>(_url: string): Promise<T> {
  throw new Error("not implemented: adoGet");
}
```

`api/src/services/notification.service.ts`:
```typescript
// Stub — Power Automate webhook. Honors NOTIFY_DRY_RUN.
export async function notify(_commitId: string): Promise<{ sentTo: string[] }> {
  throw new Error("not implemented: notify");
}
```

- [ ] **Step 5: Write the rule config**

`api/src/config/rules.config.json`:
```json
{
  "requiredStates": ["Verified", "Closed"],
  "requireReleaseTag": true,
  "requireWorkItemReference": true
}
```

- [ ] **Step 6: Write the mock endpoint + its test (the green vertical slice)**

`api/src/functions/freezeCandidates.ts`:
```typescript
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import type { FreezeCandidate } from "../types";

export const MOCK_CANDIDATES: FreezeCandidate[] = [
  {
    key: "pr:12345",
    repo: "TT.AskDI",
    prId: 12345,
    commitId: "abc12345",
    title: "Mock candidate",
    author: "someone",
    tickets: [],
    status: "no-ticket",
  },
];

export async function freezeCandidates(
  _req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  return { jsonBody: MOCK_CANDIDATES };
}

app.http("freezeCandidates", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "freeze-candidates",
  handler: freezeCandidates,
});
```

`api/src/functions/freezeCandidates.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freezeCandidates, MOCK_CANDIDATES } from "./freezeCandidates";

describe("GET /api/freeze-candidates (mock)", () => {
  it("returns the mock candidate array", async () => {
    const res = await freezeCandidates({} as never, {} as never);
    expect(res.jsonBody).toEqual(MOCK_CANDIDATES);
  });
});
```

`api/src/index.ts` (registers functions on load):
```typescript
import "./functions/freezeCandidates";
```

- [ ] **Step 7: Install, build, verify green**

Run:
```bash
cd api && npm install && npm run typecheck && npm run lint && npm run test && npm run build
```
Expected: typecheck PASS, lint clean, 1 test PASS, `dist/` produced.

- [ ] **Step 8: Write `api/local.settings.json.example`**

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "AZURE_DEVOPS_PAT": "<read-only PAT: Code + Work Items read>",
    "AZURE_DEVOPS_ORG": "tr-core-ai-data-platforms",
    "AZURE_DEVOPS_PROJECT": "CoCounsel",
    "SKIP_TABLE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "POWER_AUTOMATE_WEBHOOK_URL": "<flow url>",
    "NOTIFY_DRY_RUN": "1",
    "DASHBOARD_URL": "http://localhost:4280"
  }
}
```

- [ ] **Step 9: Commit**

```bash
cd .. && git add api && git commit -m "feat(api): Azure Functions v4 skeleton, mock endpoint, typed service stubs"
```

---

### Task 4: SWA config + verify workflow paths

**Files:**
- Create: `staticwebapp.config.json`
- Verify: `.github/workflows/*.yml` (the existing SWA workflow)

**Interfaces:**
- Consumes: `frontend/` (build → `dist`) and `api/` from Tasks 2–3.
- Produces: SPA fallback + `/api` routing so the deployed app serves the frontend and proxies the Functions.

- [ ] **Step 1: Write `staticwebapp.config.json`**

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*", "*.{png,jpg,svg,ico}"]
  },
  "routes": [{ "route": "/api/*", "allowedRoles": ["anonymous"] }]
}
```

- [ ] **Step 2: Verify the SWA workflow build locations**

Run: `grep -nE "app_location|api_location|output_location" .github/workflows/*.yml`
Expected: `app_location: "frontend"`, `api_location: "api"`, `output_location: "dist"`. If `output_location` is `build`, change it to `dist` (Vite default) — this is the most likely first-deploy failure.

- [ ] **Step 3: Commit**

```bash
git add staticwebapp.config.json .github/workflows/
git commit -m "feat: add staticwebapp.config.json; align SWA workflow build paths"
```

---

### Task 5: CI gate — typecheck + lint + test on PR

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the npm scripts from Tasks 2–3.
- Produces: a required status check gating PRs before human merge.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npm run build
  api:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

- [ ] **Step 2: Verify locally (proxy for CI, since it runs on push)**

Run: `(cd frontend && npm ci && npm run typecheck && npm run lint && npm run test) && (cd api && npm ci && npm run typecheck && npm run lint && npm run test)`
Expected: all green. (Also sanity-check the YAML parses: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK`.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck+lint+test gate for frontend and api on PRs"
```

---

### Task 6: Harness entry points — `CLAUDE.md` + `AGENTS.md`

**Files:**
- Create: `CLAUDE.md`, `AGENTS.md`

**Interfaces:**
- Consumes: nothing (points to `docs/` created in Task 12 and skills in Task 9 — forward references are fine; they're pointers).
- Produces: the agent-agnostic memory every tool loads.

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
@AGENTS.md
```

- [ ] **Step 2: Write `AGENTS.md`**

```markdown
# FreezeFrame

Release-readiness dashboard for code-freeze prep. Agent-agnostic memory — pointers into `docs/`, not prose.

## Coding Tasks

- **MANDATORY:** every code task follows `/implement-from-spec` (`.claude/skills/implement-from-spec/SKILL.md`). The build target is `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`.
- **Definition of done:** `/verify-freeze-frame` passes — typecheck + lint + test in both `frontend/` and `api/`, and the local loop serves `GET /api/freeze-candidates`.
- **PRs:** feature branch → PR → CI gate → **human merge** (never commit to `main`; it auto-deploys). Draft PR, ADO work-item link in the description, `AI Generated` label. See `/creating-pull-requests`.

## Project

- **Repo:** `AdamLampingTR/freeze-frame` (SWA: `frontend/` static assets + `api/` HTTP Functions).
- **Stack:** React+TS+Vite · Azure Functions v4 (TS) · Azure Table Storage · ADO REST · Power Automate webhook.
- **Monitors:** `TT.AskDI` (`development`→`staging`), `TT.OfficeAddin` (`dev`→`staging`), single ADO project `tr-core-ai-data-platforms`.

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
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "feat: add CLAUDE.md (@AGENTS.md) + agent-agnostic AGENTS.md"
```

---

### Task 7: `.claude/` settings + format hook

**Files:**
- Create: `.claude/settings.json`, `.claude/hooks/post-edit-format.sh`

**Interfaces:**
- Consumes: Prettier from Tasks 2–3.
- Produces: auto-format on edit; the base `.claude/` dir the rules/skills live under.

- [ ] **Step 1: Write `.claude/settings.json`**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "bash .claude/hooks/post-edit-format.sh" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Write `.claude/hooks/post-edit-format.sh`**

```bash
#!/usr/bin/env bash
# Best-effort format after Edit/Write on TS/TSX files. Never blocks (exit 0).
set -uo pipefail
file="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
case "$file" in
  *.ts|*.tsx)
    if [ -f frontend/package.json ] && [[ "$file" == *frontend/* ]]; then
      (cd frontend && npx --no-install prettier --write "${file#frontend/}") >/dev/null 2>&1 || true
    elif [ -f api/package.json ] && [[ "$file" == *api/* ]]; then
      (cd api && npx --no-install prettier --write "${file#api/}") >/dev/null 2>&1 || true
    fi
    ;;
esac
exit 0
```

- [ ] **Step 3: Make executable + verify**

Run: `chmod +x .claude/hooks/post-edit-format.sh && bash -n .claude/hooks/post-edit-format.sh && echo "syntax ok"`
Expected: `syntax ok`.

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.json .claude/hooks/post-edit-format.sh
git commit -m "feat(harness): .claude settings + post-edit format hook"
```

---

### Task 8: Path-scoped rules — `.claude/rules/*.md` + `.cursor/rules/*.mdc` mirrors

**Files:**
- Create: `.claude/rules/{api,frontend,skip-list,secrets}.md`, `.cursor/rules/{api,frontend,skip-list,secrets}.mdc`

**Interfaces:**
- Consumes: nothing.
- Produces: path-scoped guidance Claude Code (`paths:`) and Cursor (`globs:`) auto-attach.

- [ ] **Step 1: Write `.claude/rules/api.md`**

```markdown
---
paths:
  - "api/**"
---
Azure Functions v4, HTTP-triggered only (no timers/Durable). Read-only filesystem: never write local files or run git at runtime — all state via ADO REST + Table Storage. Any single response must finish within ~230s; batch ADO work-item fetches. All ADO calls go through `ado.service.ts`. Auth is anonymous at the Function level (SWA handles auth). See `docs/conventions/api.md`.
```

- [ ] **Step 2: Write `.claude/rules/frontend.md`**

```markdown
---
paths:
  - "frontend/**"
---
React + Vite. The frontend is stateless, holds no secrets, and talks only to `/api`. Durable state (skips) lives server-side. Visual language follows the `release-readiness-dashboard` reference (dot status indicators, hoverable rows, inline ticket expansion). See `docs/conventions/architecture.md`.
```

- [ ] **Step 3: Write `.claude/rules/skip-list.md`**

```markdown
---
paths:
  - "api/**/skip*"
  - "api/**/dismiss*"
---
Skip list invariants (load-bearing — the biggest false-positive lever):
- Key on **PR-ID** (`pr:<id>`); fall back to `git patch-id --stable` (`patch:<hash>`) for PR-less commits — never raw SHA (squash/re-merge changes the SHA).
- Entity: PartitionKey=repo, RowKey=`pr:<id>`|`patch:<hash>`, plus `dismissedBy`, `dismissedAt`, `reason`, `kind` (`permanent`|`hold`), `dismissedForRelease`.
- Global-durable by default. Visible + reversible in the UI (un-skip). Prune orphans (intersect with current candidates).
- The contract lives once in `shared/types.ts`; both `api/src/types.ts` and `frontend/src/types.ts` re-export it (type-only).
See `docs/conventions/skip-list.md`.
```

- [ ] **Step 4: Write `.claude/rules/secrets.md`**

```markdown
---
---
Never commit PATs, connection strings, or webhook URLs. Config comes from SWA app settings (deployed) or gitignored `api/local.settings.json` (local). Use `NOTIFY_DRY_RUN=1` locally so notifications log instead of sending. See `api/local.settings.json.example`.
```

- [ ] **Step 5: Write the `.cursor/rules/*.mdc` mirrors**

Each mirrors the matching `.claude` rule with Cursor frontmatter. Example `.cursor/rules/api.mdc`:
```markdown
---
description: API (Azure Functions) conventions
globs: api/**
alwaysApply: false
---
Azure Functions v4, HTTP-triggered only (no timers/Durable). Read-only filesystem: never write local files or run git at runtime — all state via ADO REST + Table Storage. Any single response must finish within ~230s; batch ADO work-item fetches. All ADO calls go through `ado.service.ts`. Auth is anonymous at the Function level (SWA handles auth). See `docs/conventions/api.md`.
```
`.cursor/rules/frontend.mdc` (`globs: frontend/**`), `.cursor/rules/skip-list.mdc` (`globs: api/**/skip*, api/**/dismiss*`), and `.cursor/rules/secrets.mdc` (`alwaysApply: true`, no globs) carry the same body text as their `.claude` counterparts.

- [ ] **Step 6: Verify frontmatter**

Run: `head -4 .claude/rules/api.md && head -5 .cursor/rules/api.mdc`
Expected: `paths:` list in the `.md`; `globs:`/`alwaysApply:` in the `.mdc`.

- [ ] **Step 7: Commit**

```bash
git add .claude/rules .cursor/rules
git commit -m "feat(harness): path-scoped rules (.claude .md + .cursor .mdc mirrors)"
```

---

### Task 9: Skills — `implement-from-spec`, `verify-freeze-frame`, `creating-pull-requests`

**Files:**
- Create: `.claude/skills/implement-from-spec/SKILL.md`, `.claude/skills/verify-freeze-frame/SKILL.md`, `.claude/skills/creating-pull-requests/SKILL.md`

**Interfaces:**
- Consumes: the MVP spec (Task 12), the npm scripts (Tasks 2–3).
- Produces: `/`-invocable skills auto-discovered by Claude Code and (via symlink, Task 10) visible to Cursor/other agents.

- [ ] **Step 1: Write `.claude/skills/implement-from-spec/SKILL.md`**

```markdown
---
name: implement-from-spec
description: The mandatory FreezeFrame build loop — implement one spec slice at a time against docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md, test-first, commit per slice.
---
# Implement From Spec

1. Read `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md` and the relevant `docs/conventions/*.md`.
2. Pick the next unbuilt slice in dependency order: discovery → linking → release-tag → rules → skip list → notifications → frontend.
3. Write a failing test first (Vitest), then the minimal implementation, then make it pass.
4. Run `/verify-freeze-frame` before committing.
5. Commit per slice on a feature branch. Open a draft PR via `/creating-pull-requests`. Never commit to `main`.
6. Replace each `throw new Error("not implemented")` stub in `api/src/services/` with the real port of Jared's `code-freeze-dashboard` logic (algorithms, re-expressed over ADO REST).
```

- [ ] **Step 2: Write `.claude/skills/verify-freeze-frame/SKILL.md`**

```markdown
---
name: verify-freeze-frame
description: The runnable definition of done for FreezeFrame — typecheck, lint, test, build both projects and confirm the local loop serves the API.
---
# Verify FreezeFrame

Run and confirm all green:

    cd frontend && npm run typecheck && npm run lint && npm run test && npm run build
    cd ../api && npm run typecheck && npm run lint && npm run test && npm run build

Then the local loop (see `docs/conventions/local-dev.md`):

1. Start Azurite (Table emulator).
2. `swa start` (serves frontend, proxies `/api`, emulates auth — provides `x-ms-client-principal`).
3. `curl http://localhost:4280/api/freeze-candidates` returns a JSON array.

Done = both suites green AND the endpoint responds. Check the result against the spec's Success/Failure criteria.
```

- [ ] **Step 3: Write `.claude/skills/creating-pull-requests/SKILL.md`**

```markdown
---
name: creating-pull-requests
description: Open a PR for FreezeFrame the right way — feature branch, draft, ADO work-item link, AI Generated label, target main (human merges).
---
# Creating Pull Requests

- Branch from `main`; never commit to `main` (it auto-deploys).
- Open a **draft** PR targeting `main` with `gh pr create --draft`.
- Description must carry the ADO work-item reference (`AB#<id>` or the full work-item URL).
- Apply the `AI Generated` label: `gh pr edit <pr> --add-label "AI Generated"` (create the label once if missing).
- CI (typecheck + lint + test) must be green. A human merges — the agent does not self-merge.
```

- [ ] **Step 4: Verify**

Run: `for d in implement-from-spec verify-freeze-frame creating-pull-requests; do head -3 ".claude/skills/$d/SKILL.md"; echo ---; done`
Expected: each shows valid `---`/`name:`/`description:` frontmatter.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills
git commit -m "feat(harness): implement-from-spec, verify-freeze-frame, creating-pull-requests skills"
```

---

### Task 10: Committed skills symlinks — `.agents/skills` + `.cursor/skills`

**Files:**
- Create (as symlinks): `.agents/skills` → `../.claude/skills`, `.cursor/skills` → `../.claude/skills`

**Interfaces:**
- Consumes: `.claude/skills/` from Task 9.
- Produces: the same skills visible to the `.agents` and Cursor conventions with zero duplication.

- [ ] **Step 1: Create the symlinks**

```bash
mkdir -p .agents .cursor
ln -s ../.claude/skills .agents/skills
ln -s ../.claude/skills .cursor/skills
```

- [ ] **Step 2: Verify they resolve**

Run: `readlink .agents/skills && readlink .cursor/skills && ls .agents/skills/`
Expected: both print `../.claude/skills`; the `ls` lists the three skill dirs.

- [ ] **Step 3: Stage and confirm git records them as symlinks (mode 120000)**

Run: `git add .agents/skills .cursor/skills && git ls-files -s .agents/skills .cursor/skills`
Expected: both entries begin with `120000` (symlink mode), not `100644`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(harness): commit .agents/skills and .cursor/skills symlinks -> .claude/skills"
```

---

### Task 11: MCP config for ADO access

**Files:**
- Create: `.mcp.json`, `.claude/settings.local.json`
- Note: `.claude/settings.local.json` is gitignored (Task 1) — created locally, not committed.

**Interfaces:**
- Consumes: nothing.
- Produces: ADO MCP servers the agent can opt into for querying tickets/repos during the build.

- [ ] **Step 1: Write `.mcp.json`**

```json
{
  "mcpServers": {
    "ado-tickets": {
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "tr-core-ai-data-platforms"]
    },
    "ado-repos": {
      "command": "npx",
      "args": ["-y", "@azure-devops/mcp", "ThoughtTrace"]
    }
  }
}
```

- [ ] **Step 2: Create the local opt-in (gitignored, not committed)**

Write `.claude/settings.local.json`:
```json
{ "enabledMcpjsonServers": ["ado-tickets", "ado-repos"] }
```

- [ ] **Step 3: Verify it is ignored**

Run: `git check-ignore .claude/settings.local.json && echo "ignored ok"`
Expected: prints the path + `ignored ok` (it must NOT be committed).

- [ ] **Step 4: Commit (only `.mcp.json`)**

```bash
git add .mcp.json
git commit -m "feat(harness): ADO MCP server config (opt-in via gitignored settings.local.json)"
```

---

### Task 12: In-repo spec + convention docs (transcribe the locked Plan)

**Files:**
- Create: `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`, `docs/conventions/{architecture,api,skip-list,local-dev,ado-access}.md`

**Interfaces:**
- Consumes: the Notion "Plan Phase — Build Plan (Revised)" (`https://app.notion.com/p/3980339a01d1813b8284fd4cc971af91`) / `~/Developer/2026-hackathon-freezeframe-project-notes/Plan Phase.pdf` as the authoritative source.
- Produces: the build target for `/implement-from-spec` and the convention docs that `AGENTS.md` + rules point to.

- [ ] **Step 1: Transcribe the MVP spec**

Copy the full body of the Notion "Plan Phase — Build Plan (Revised)" into `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md`, preserving every section (What changed, Confirmed decisions, SWA constraints, Branch/repo scope, Repository layout, Porting Jared's logic 1–4, Target release selection, Rule engine, Skip list, Non-PR bucket, Frontend, Notifications, Configuration/secrets, Build sequence, Success/failure criteria, Fallback). Normalize any no-hyphen `freezeframe` repo references to `freeze-frame` (keep the brand "FreezeFrame"). Keep the Success/Failure criteria section verbatim — it is the agent's done-bar.

- [ ] **Step 2: Write the convention docs (extracts from the spec, one responsibility each)**

- `docs/conventions/architecture.md` — the pipeline (discover → link → release-tag → rules → skip-filter), the `FreezeCandidate`/`Ticket` contract, dependency order.
- `docs/conventions/api.md` — Functions v4 conventions, the 230s ceiling, read-only FS, ADO-via-`ado.service`, batching, `/api` routing.
- `docs/conventions/skip-list.md` — the full skip-list design (PR-ID/patch-id keying, `pr:`/`patch:` prefixes, entity shape, `kind`, orphan pruning, un-skip, Table Storage).
- `docs/conventions/local-dev.md` — `swa start` (auth emulation → `x-ms-client-principal`), `func start`, Azurite (`UseDevelopmentStorage=true`), read-only PAT, `NOTIFY_DRY_RUN`.
- `docs/conventions/ado-access.md` — org/project split (`tr-core-ai-data-platforms`/CoCounsel for work items; `ThoughtTrace` for repos/PRs), service PAT scopes (Code read + Work Items read), commit-subject `ADO-<id>` / `#<id>` convention + PR-title/branch fallback.

Each doc is the single source of truth for its topic; `AGENTS.md` and the rules only point here.

- [ ] **Step 3: Verify no stray no-hyphen identifier**

Run: `grep -rn "freezeframe" docs/ || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md docs/conventions
git commit -m "docs: transcribe FreezeFrame MVP spec + convention docs"
```

---

### Task 13: README harness section + final full verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: onboarding for humans/agents; a final green gate over the whole prep.

- [ ] **Step 1: Rewrite `README.md`**

```markdown
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
```

- [ ] **Step 2: Full verification across the repo**

Run:
```bash
(cd frontend && npm ci && npm run typecheck && npm run lint && npm run test && npm run build) \
 && (cd api && npm ci && npm run typecheck && npm run lint && npm run test && npm run build) \
 && readlink .agents/skills && readlink .cursor/skills \
 && git ls-files -s .agents/skills .cursor/skills | grep 120000 \
 && grep -rn "freezeframe" . --include=*.md --include=*.ts --include=*.tsx --include=*.json | grep -v node_modules || echo "no stray freezeframe"
```
Expected: both suites green; both symlinks resolve and are mode `120000`; `no stray freezeframe`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README harness + local-dev + verify section"
```

- [ ] **Step 4: Hand off (do NOT push yet)**

Report to the user: branch `chore/ai-ready-workspace` is complete and green. Ask for approval to push and open the PR (draft, targeting `main`, `AI Generated` label, description linking the ADO work item if one exists). The user/Adam confirms before any push to `AdamLampingTR/freeze-frame`.

---

## Self-Review

**Spec coverage:** §1 entry-points → Task 6; §2 `.claude/` (settings/hooks/rules/skills) → Tasks 7–9; §3 spec-in-repo + conventions → Task 12; §4 skeleton (api/ + frontend/ + staticwebapp + shared types) → Tasks 2–4; §5 guardrails (Vitest/ESLint/Prettier, CI, seed tests) → Tasks 2,3,5 (+ domain seed tests deferred to `/implement-from-spec` as `it.todo` is intentionally *not* pre-created, to keep the boundary clean and CI green — the mock-endpoint and helper tests prove the harness); §6 MCP → Task 11; §7 housekeeping (name, .gitignore, README caveat) → Tasks 1,12,13. Committed-symlink approach → Task 10. All covered.

**Placeholder scan:** service files ship as `throw new Error("not implemented")` typed stubs — deliberate hand-off points for the agent, not plan placeholders; every plan step has concrete content. Task 12's spec body references its authoritative source (an existing document to transcribe) rather than re-inlining ~400 lines — acceptable for a transcription task.

**Type consistency:** `FreezeCandidate` / `Ticket` / `FlagStatus` / `SkipKind` are defined **once** in `shared/types.ts` (Task 1) and re-exported by both projects' `src/types.ts` barrels (Tasks 2, 3); `SkipEntry` (Task 3) matches the skip-list rule (Task 8) and the skip-list convention (Task 12). Service signatures (`discoverCandidates`, `extractWorkItemIds`, `isReleaseTag`, `overallStatus`, `readSkips`, `adoGet`, `notify`) are referenced consistently across Tasks 3, 8, 9, 12.
