# FreezeFrame MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full FreezeFrame release-readiness dashboard MVP — discover PRs merged to a dev branch but not staging, link them to ADO work items, flag missing release tags / wrong ADO state, persist a skip list, and notify via Power Automate — as an Azure Static Web App (React + TS frontend, HTTP Azure Functions API) hitting real ADO REST.

**Architecture:** A pipeline of pure-ish services in `api/src/services/` (ado → diff → linking → releaseTag → rules → skip) composed by six HTTP Functions under `/api`. The frontend is a single-page React app that talks only to `/api`. All ADO access is server-side REST with two per-org read PATs; durable state (skip list) is Azure Table Storage; notifications POST to a Power Automate webhook. No git, no filesystem writes at runtime (SWA managed Functions constraint).

**Tech Stack:** React 18 + TypeScript + Vite (frontend) · Azure Functions v4 programming model (TypeScript, Node 22) · `@azure/data-tables` (Table Storage) · native `fetch` (ADO REST) · Vitest (both packages) · SWA CLI + Azure Functions Core Tools + Azurite (local loop).

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-07-08-freeze-frame-mvp.md` (the build target). Every task's requirements implicitly include this section.

- **Two ADO orgs.** Repos/PRs: org `ThoughtTrace`, project `ThoughtTrace Core` (URL-encoded `ThoughtTrace%20Core`), PAT env `ADO_REPOS_PAT` (Code read). Work items: org `tr-core-ai-data-platforms`, project `CoCounsel`, PAT env `ADO_WORKITEMS_PAT` (Work Items read). A PAT cannot span orgs.
- **Repos + branches.** `TT.AskDI`: `development` → `staging`. `TT.OfficeAddin`: `dev` → `staging`. Shown as one combined sortable list with a per-row repo badge.
- **Commit discovery is PR-ID-deduped, not naive SHA set-difference.** The unit of candidacy is the PR, not the commit. Commits with no PR pass through as SHA-identified non-PR candidates.
- **Linking order (first hit wins):** (1) `ADO[-# ]*[0-9]{6,8}` in the commit subject; (2) PR title + PR source-branch name; (3) PR's linked work items. `viaPr` records that a ticket was found only via fallback (2)/(3).
- **Release tags** are ISO (`YYYY-MM-DD`) or month-name (`July 9`, `July 23`); month-name resolves to the nearest year (Dec/Jan wrap); recency window −45d..+60d. Do not substring-match.
- **D1 — only `User Story` and `Bug`** work items drive flags (`rules.config.json > workItemTypes`).
- **Rule engine** (data-driven via `api/src/config/rules.config.json`): `requiredStates: ["Verified","Closed"]`, `requireReleaseTag: true`, `requireWorkItemReference: true`, `workItemTypes: ["User Story","Bug"]`. Wrong state → `bad-state` (red); missing current-or-future release tag → `warning` (amber); a past-tag-only candidate is excluded in discovery; no US/Bug ticket → `no-ticket` bucket (not red). Candidate status = worst flag across its tickets. Start conservative.
- **Skip list** in Azure Table Storage (`fluffyttisancusfrontend`), `SKIP_TABLE_CONNECTION_STRING`. `PartitionKey` = repo, `RowKey` = `pr:<id>` or `patch:<sha>`. Fields: `dismissedBy`, `dismissedAt`, `reason`, `reasonText?`, `kind` (`permanent`|`hold`), `dismissedForRelease`. Durable + global. `dismissedBy` from the `x-ms-client-principal` header (SWA auth / SWA-CLI emulator).
- **Notifications:** `POST /api/freeze-candidates/{id}/notify` `{ notifyVia: 'email'|'teams'|'both' }` → resolve recipients (commit author + ADO assignees, deduped) → POST the Power Automate webhook (`POWER_AUTOMATE_WEBHOOK_URL`). `NOTIFY_DRY_RUN=1` logs instead of POSTing. Payload shape in the spec's Notifications section (string arrays).
- **Secrets** never committed. Config from SWA app settings (deployed) or gitignored `api/local.settings.json` (local). See `.claude/rules/secrets.md`.
- **API route prefix is `/api`; single HTTP response must finish < ~230s.** Batch work-item fetches (chunk 200); bound PR-detail fetch concurrency.
- **Shared contract** lives in `shared/types.ts`; `api/src/types.ts` and `frontend/src/types.ts` re-export it type-only.
- **Git workflow:** feature branch `feat/freeze-frame-mvp` (already created) → commit per task → draft PR to `main` (hackathon-POC) → human merge. Never push `main`.

## File Structure

**Contract**
- `shared/types.ts` — MODIFY: extend `Ticket` (add `workItemType`, `assignedTo`, `viaPr`), `FreezeCandidate` (add `flags`), add `SkipReason`, `SkipEntry`, `CandidatesResponse`.

**API services** (`api/src/services/`)
- `ado.service.ts` — MODIFY: two-org REST client (`commitsBatch`, `stagingPrIds`, `getPullRequest`, `getPullRequestWorkItemIds`, `fetchWorkItems`, `mapLimit`). Auth = Basic `:PAT`.
- `diff.service.ts` — MODIFY: `discoverCandidates(repo, deps?)` → `DiscoveredCandidate[]` via commitsBatch + PR-ID dedupe + applied-PR-id filter.
- `linking.service.ts` — MODIFY: `parsePrId`, `parseAdoIds`, `resolveTicketIds` (subject → PR title/branch → PR refs).
- `releaseTag.service.ts` — MODIFY: `isReleaseTag`, `resolveEpoch`, `classifyTags`, `activeReleaseTags`.
- `rules.service.ts` — MODIFY: `loadRules`, `evaluate(tickets, rules, now)`.
- `skip.service.ts` — MODIFY: `listSkips`, `addSkip`, `removeSkip`, `skipKeyFor`, `ensureTable` (Table Storage via `@azure/data-tables`).
- `notification.service.ts` — MODIFY: `notifyCandidate(candidate, notifyVia)`.
- `principal.ts` — CREATE: `getPrincipal(req)` decodes `x-ms-client-principal`.
- `pipeline.ts` — CREATE: `buildCandidates(release?, now?, deps?)` composes the pipeline for both repos (used by several functions).

**API config** (`api/src/config/`)
- `repos.config.json` — CREATE: two-repo/branch scope (with repo IDs).
- `rules.config.json` — MODIFY: add `workItemTypes`.
- `index.ts` — CREATE: `loadRepos()`, `loadRules()`.

**API functions** (`api/src/functions/`)
- `freezeCandidates.ts` — MODIFY: `GET /api/freeze-candidates?release=`.
- `freezeCandidateById.ts` — CREATE: `GET /api/freeze-candidates/{id}`.
- `notify.ts` — CREATE: `POST /api/freeze-candidates/{id}/notify`.
- `skipList.ts` — CREATE: `GET /api/skips`.
- `dismiss.ts` — CREATE: `POST /api/freeze-candidates/{id}/dismiss`.
- `unskip.ts` — CREATE: `DELETE /api/skips/{key}?repo=`.

**Frontend** (`frontend/src/`)
- `api/client.ts` — CREATE: typed fetch wrappers + `cherryPickCommand`.
- `lib/status.ts` — MODIFY: `statusLabel`, `statusDot`.
- `components/*` — CREATE: `StatsBar`, `ReleasePicker`, `CandidateList`, `CandidateRow`, `NonPrSection`, `SkipPanel`, `DismissDialog`, `NotifyMenu`.
- `App.tsx` — MODIFY: compose the page + data fetching + filter/sort state.
- `index.css` — CREATE: dots/badges/rows/dialog/toast styling.

**Local dev**
- `swa-cli.config.json` — CREATE (repo root).
- `api/local.settings.json` — CREATE (gitignored).

---

## Task 1: Extend the shared contract

**Files:**
- Modify: `shared/types.ts`, `api/src/types.ts`, `frontend/src/types.ts`
- (No unit test — types are compile-time; `npm run typecheck` in both packages is the gate, exercised by later tasks.)

**Interfaces:**
- Produces: the types every later task consumes.

- [ ] **Step 1: Replace `shared/types.ts` with the extended contract**

```typescript
// Canonical FreezeFrame contract. frontend/src/types.ts and api/src/types.ts each
// re-export from here via `export type ... from` — type-only, fully erased at build.
export type FlagStatus = "ready" | "warning" | "bad-state" | "no-ticket";
export type SkipKind = "permanent" | "hold";
export type SkipReason =
  | "reverted"
  | "superseded-by-later-commit"
  | "held"
  | "shipped-elsewhere"
  | "not-ready";
export type NotifyVia = "email" | "teams" | "both";

export interface Ticket {
  id: string;
  title: string;
  state: string;
  workItemType: string; // System.WorkItemType (D1 filter operates on this)
  assignedTo: string | null; // email (System.AssignedTo.uniqueName)
  tags: string[];
  viaPr: boolean; // true = resolved via PR title/branch/refs, not the commit subject
}

export interface FreezeCandidate {
  key: string; // "pr:<id>" or "patch:<sha>"
  repo: string; // "TT.AskDI" | "TT.OfficeAddin"
  prId: number | null;
  commitId: string;
  title: string; // commit subject, first line
  author: string | null; // email
  tickets: Ticket[];
  status: FlagStatus;
  flags: string[]; // human-readable flag lines (for UI + notify payload)
}

export interface SkipEntry {
  repo: string;
  key: string; // pr:<id> | patch:<sha>
  dismissedBy: string;
  dismissedAt: string; // ISO
  reason: SkipReason;
  reasonText?: string;
  kind: SkipKind;
  dismissedForRelease: string;
  orphan?: boolean; // computed: no longer in the current candidate set
}

export interface Stats {
  total: number;
  ready: number;
  warning: number;
  badState: number;
  noTicket: number;
}

export interface CandidatesResponse {
  release: string;
  availableReleases: string[];
  generatedAt: string; // ISO
  candidates: FreezeCandidate[]; // have >=1 US/Bug ticket
  noTicket: FreezeCandidate[]; // non-PR / no-ticket bucket
  stats: Stats;
}
```

- [ ] **Step 2: Mirror the new type names in both re-export files**

Set both `api/src/types.ts` and `frontend/src/types.ts` to:

```typescript
export type {
  FlagStatus,
  SkipKind,
  SkipReason,
  NotifyVia,
  Ticket,
  FreezeCandidate,
  SkipEntry,
  Stats,
  CandidatesResponse,
} from "../../shared/types";
```

- [ ] **Step 3: Typecheck both packages**

Run: `cd api && npm run typecheck && cd ../frontend && npm run typecheck`
Expected: PASS. (If the existing mock in `freezeCandidates.ts` errors on the new `flags` field, add `flags: []` to it — it is replaced entirely in Task 10.)

- [ ] **Step 4: Commit**

```bash
git add shared/types.ts api/src/types.ts frontend/src/types.ts
git commit -m "feat(contract): extend shared types (workItemType, viaPr, flags, SkipEntry, CandidatesResponse)"
```

---

## Task 2: Repo config + rules config

**Files:**
- Create: `api/src/config/repos.config.json`, `api/src/config/index.ts`
- Modify: `api/src/config/rules.config.json`
- Test: `api/src/config/config.test.ts`

**Interfaces:**
- Produces: `RepoConfig`, `loadRepos(): RepoConfig[]`, `RulesConfig`, `loadRules(): RulesConfig`.

- [ ] **Step 1: Write the failing test**

```typescript
// api/src/config/config.test.ts
import { describe, it, expect } from "vitest";
import { loadRepos, loadRules } from "./index";

describe("config", () => {
  it("loads both monitored repos with branch + repo id", () => {
    const repos = loadRepos();
    expect(repos.map((r) => r.name).sort()).toEqual(["TT.AskDI", "TT.OfficeAddin"]);
    const askdi = repos.find((r) => r.name === "TT.AskDI")!;
    expect(askdi.devBranch).toBe("development");
    expect(askdi.stagingBranch).toBe("staging");
    expect(askdi.repoId).toBe("1bc795ea-7164-4ac0-830c-8206a584ccb8");
  });

  it("loads rules with the D1 work-item-type filter", () => {
    const rules = loadRules();
    expect(rules.requiredStates).toContain("Verified");
    expect(rules.workItemTypes).toEqual(["User Story", "Bug"]);
    expect(rules.requireReleaseTag).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/config/config.test.ts`
Expected: FAIL (`Cannot find module './index'`).

- [ ] **Step 3: Create the config files and loader**

`api/src/config/repos.config.json` (repo IDs confirmed via REST probe 2026-07-09):

```json
[
  {
    "name": "TT.AskDI",
    "repoId": "1bc795ea-7164-4ac0-830c-8206a584ccb8",
    "devBranch": "development",
    "stagingBranch": "staging"
  },
  {
    "name": "TT.OfficeAddin",
    "repoId": "a3895bd8-d32c-4cc3-b82e-9fe613ac7e8d",
    "devBranch": "dev",
    "stagingBranch": "staging"
  }
]
```

`api/src/config/rules.config.json` (replace entire file):

```json
{
  "requiredStates": ["Verified", "Closed"],
  "requireReleaseTag": true,
  "requireWorkItemReference": true,
  "workItemTypes": ["User Story", "Bug"]
}
```

`api/src/config/index.ts`:

```typescript
import repos from "./repos.config.json";
import rules from "./rules.config.json";

export interface RepoConfig {
  name: string;
  repoId: string;
  devBranch: string;
  stagingBranch: string;
}

export interface RulesConfig {
  requiredStates: string[];
  requireReleaseTag: boolean;
  requireWorkItemReference: boolean;
  workItemTypes: string[];
}

export function loadRepos(): RepoConfig[] {
  return repos as RepoConfig[];
}

export function loadRules(): RulesConfig {
  return rules as RulesConfig;
}
```

Ensure `api/tsconfig.json` `compilerOptions` has `"resolveJsonModule": true` and `"esModuleInterop": true` (add if missing).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx vitest run src/config/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/config
git commit -m "feat(config): repo scope config + D1 workItemTypes rule"
```

---

## Task 3: Release-tag service (port of `is_release_tag` / `release-tags.jq`)

**Files:**
- Modify: `api/src/services/releaseTag.service.ts`
- Test: `api/src/services/releaseTag.service.test.ts`

**Interfaces:**
- Produces:
  - `isReleaseTag(tag: string): boolean`
  - `resolveEpoch(tag: string, now: Date): number` (ms; month-name → nearest year)
  - `classifyTags(tags: string[], now: Date): { hasReleaseTag: boolean; hasCurrentOrFuture: boolean; allPast: boolean }`
  - `activeReleaseTags(tags: string[], now: Date): string[]` (recency window −45d..+60d, sorted chronologically, unique)

- [ ] **Step 1: Write the failing test**

```typescript
// api/src/services/releaseTag.service.test.ts
import { describe, it, expect } from "vitest";
import { isReleaseTag, classifyTags, activeReleaseTags } from "./releaseTag.service";

const NOW = new Date("2026-07-09T00:00:00Z");

describe("releaseTag.service", () => {
  it("recognises ISO and month-name release tags, rejects others", () => {
    expect(isReleaseTag("2026-07-09")).toBe(true);
    expect(isReleaseTag("July 9")).toBe(true);
    expect(isReleaseTag("July 23")).toBe(true);
    expect(isReleaseTag("Ready2Refine")).toBe(false);
    expect(isReleaseTag("PBTeam")).toBe(false);
    expect(isReleaseTag("Julyish 9")).toBe(false);
  });

  it("classifies current-or-future vs past-only", () => {
    expect(classifyTags(["July 23", "SRE"], NOW)).toEqual({
      hasReleaseTag: true, hasCurrentOrFuture: true, allPast: false,
    });
    expect(classifyTags(["June 11"], NOW)).toEqual({
      hasReleaseTag: true, hasCurrentOrFuture: false, allPast: true,
    });
    expect(classifyTags(["Triaged"], NOW)).toEqual({
      hasReleaseTag: false, hasCurrentOrFuture: false, allPast: false,
    });
  });

  it("returns active release tags within the recency window, sorted", () => {
    const tags = ["June 11", "July 9", "July 23", "Triaged", "2025-12-01"];
    expect(activeReleaseTags(tags, NOW)).toEqual(["June 11", "July 9", "July 23"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/services/releaseTag.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// api/src/services/releaseTag.service.ts
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_NAME = new RegExp(`^(${MONTHS.join("|")}) ([0-9]{1,2})$`);
const DAY = 86400_000;

export function isReleaseTag(tag: string): boolean {
  return ISO.test(tag) || MONTH_NAME.test(tag);
}

// Month-name tags carry no year; pick whichever of year-1/year/year+1 is nearest
// to `now` (handles Dec/Jan wraparound). ISO tags resolve directly.
export function resolveEpoch(tag: string, now: Date): number {
  if (ISO.test(tag)) return Date.parse(`${tag}T00:00:00Z`);
  const m = MONTH_NAME.exec(tag);
  if (!m) return NaN;
  const month = MONTHS.indexOf(m[1]); // 0-based
  const day = Number(m[2]);
  const y = now.getUTCFullYear();
  const candidates = [y - 1, y, y + 1].map((yr) => Date.UTC(yr, month, day, 0, 0, 0));
  const t = now.getTime();
  return candidates.reduce((best, c) => (Math.abs(c - t) < Math.abs(best - t) ? c : best));
}

export function classifyTags(
  tags: string[],
  now: Date,
): { hasReleaseTag: boolean; hasCurrentOrFuture: boolean; allPast: boolean } {
  const releaseTags = tags.filter(isReleaseTag);
  if (releaseTags.length === 0) {
    return { hasReleaseTag: false, hasCurrentOrFuture: false, allPast: false };
  }
  // "current" = today or later, with a one-day grace so a tag dated today counts.
  const cutoff = now.getTime() - DAY;
  const hasCurrentOrFuture = releaseTags.some((t) => resolveEpoch(t, now) >= cutoff);
  return { hasReleaseTag: true, hasCurrentOrFuture, allPast: !hasCurrentOrFuture };
}

export function activeReleaseTags(tags: string[], now: Date): string[] {
  const t = now.getTime();
  const unique = Array.from(new Set(tags.filter(isReleaseTag)));
  return unique
    .filter((tag) => {
      const delta = resolveEpoch(tag, now) - t;
      return delta > -45 * DAY && delta < 60 * DAY;
    })
    .sort((a, b) => resolveEpoch(a, now) - resolveEpoch(b, now));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx vitest run src/services/releaseTag.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/releaseTag.service.ts api/src/services/releaseTag.service.test.ts
git commit -m "feat(api): releaseTag service — ISO+month-name parsing, recency window, past-tag classification"
```

---

## Task 4: Linking pure helpers (`parsePrId`, `parseAdoIds`)

**Files:**
- Modify: `api/src/services/linking.service.ts`
- Test: `api/src/services/linking.service.test.ts`

**Interfaces:**
- Produces: `parsePrId(subject: string): number | null`, `parseAdoIds(text: string): string[]` (distinct, sorted).

- [ ] **Step 1: Write the failing test**

```typescript
// api/src/services/linking.service.test.ts
import { describe, it, expect } from "vitest";
import { parsePrId, parseAdoIds } from "./linking.service";

describe("linking pure helpers", () => {
  it("parses the PR id from a squash-merge subject", () => {
    expect(parsePrId("Merged PR 23521: ado-1137466 - Bug ...")).toBe(23521);
    expect(parsePrId("Merged PR #23490: ADO-1165133 Fix")).toBe(23490);
    expect(parsePrId("just a normal commit")).toBeNull();
  });

  it("parses distinct ADO ids in any accepted form, ignores bare numbers", () => {
    expect(parseAdoIds("ado-1137466 - Bug 1137466: title")).toEqual(["1137466"]);
    expect(parseAdoIds("ADO-1160180 and ADO#1162189 and ADO 1155410")).toEqual([
      "1155410", "1160180", "1162189",
    ]);
    expect(parseAdoIds("Merged PR 23521: no ado ref")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/services/linking.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the pure helpers (leave `resolveTicketIds` for Task 7)**

```typescript
// api/src/services/linking.service.ts
// PR marker: "Merged PR 23521" / "Merged PR #23521" (case-insensitive).
export function parsePrId(subject: string): number | null {
  const m = /Merged PR #?(\d+)/i.exec(subject);
  return m ? Number(m[1]) : null;
}

// ADO work-item ids: "ADO-1137466" / "ADO#1137466" / "ADO 1137466" / "ADO1137466",
// case-insensitive, 6–8 digits. Bare numbers (e.g. "Bug 1137466") are NOT matched.
export function parseAdoIds(text: string): string[] {
  const ids = new Set<string>();
  const re = /ADO[-# ]*(\d{6,8})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) ids.add(m[1]);
  return Array.from(ids).sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx vitest run src/services/linking.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/linking.service.ts api/src/services/linking.service.test.ts
git commit -m "feat(api): linking pure helpers — parsePrId + parseAdoIds"
```

---

## Task 5: ADO REST client

**Files:**
- Modify: `api/src/services/ado.service.ts`
- Test: `api/src/services/ado.service.test.ts`

**Interfaces:**
- Produces:
  - `interface RawCommit { commitId: string; comment: string; author: { email: string; name: string } | null }`
  - `interface RawWorkItem { id: number; title: string; state: string; workItemType: string; assignedTo: string | null; tags: string[] }`
  - `commitsBatch(repoId, baseBranch, compareBranch, top?): Promise<RawCommit[]>`
  - `stagingPrIds(repoId, stagingBranch, top?): Promise<Set<number>>`
  - `getPullRequest(repoId, prId): Promise<{ title: string; sourceRefName: string; createdBy: string | null } | null>`
  - `getPullRequestWorkItemIds(repoId, prId): Promise<string[]>`
  - `fetchWorkItems(ids: string[]): Promise<Map<string, RawWorkItem>>`
  - `mapLimit<T,R>(items, limit, fn): Promise<R[]>`
- Consumes: env `ADO_REPOS_ORG`, `ADO_REPOS_PROJECT`, `ADO_REPOS_PAT`, `ADO_WORKITEMS_ORG`, `ADO_WORKITEMS_PROJECT`, `ADO_WORKITEMS_PAT`.

Testing note: ADO calls use native `fetch`; the test stubs `globalThis.fetch`. Auth = `Basic base64(":" + PAT)`.

- [ ] **Step 1: Write the failing test**

```typescript
// api/src/services/ado.service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const OLD_ENV = { ...process.env };

function jsonResponse(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

describe("ado.service", () => {
  beforeEach(() => {
    process.env.ADO_REPOS_ORG = "ThoughtTrace";
    process.env.ADO_REPOS_PROJECT = "ThoughtTrace Core";
    process.env.ADO_REPOS_PAT = "repospat";
    process.env.ADO_WORKITEMS_ORG = "tr-core-ai-data-platforms";
    process.env.ADO_WORKITEMS_PROJECT = "CoCounsel";
    process.env.ADO_WORKITEMS_PAT = "wipat";
  });
  afterEach(() => { process.env = { ...OLD_ENV }; vi.restoreAllMocks(); });

  it("commitsBatch posts base+compare and maps commits", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({ count: 1, value: [{ commitId: "abc123def", comment: "Merged PR 23521: ado-1137466 - x", author: { email: "author@example.com", name: "A" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { commitsBatch } = await import("./ado.service");
    const commits = await commitsBatch("REPOID", "staging", "development", 100);
    expect(commits).toHaveLength(1);
    expect(commits[0].commitId).toBe("abc123def");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/git/repositories/REPOID/commitsBatch");
    expect(url).toContain("ThoughtTrace%20Core");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.itemVersion.version).toBe("staging");
    expect(body.compareVersion.version).toBe("development");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: `Basic ${Buffer.from(":repospat").toString("base64")}`,
    });
  });

  it("fetchWorkItems maps the workitemsbatch response and splits tags", async () => {
    const fetchMock = vi.fn().mockReturnValue(
      jsonResponse({ value: [
        { id: 1165133, fields: { "System.Title": "T", "System.State": "Ready for QA Testing", "System.WorkItemType": "User Story", "System.Tags": "July 23; Ready2Refine", "System.AssignedTo": { uniqueName: "user@example.com" } } },
      ] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchWorkItems } = await import("./ado.service");
    const map = await fetchWorkItems(["1165133"]);
    const wi = map.get("1165133")!;
    expect(wi.workItemType).toBe("User Story");
    expect(wi.tags).toEqual(["July 23", "Ready2Refine"]);
    expect(wi.assignedTo).toBe("user@example.com");
  });

  it("fetchWorkItems returns empty map for no ids without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { fetchWorkItems } = await import("./ado.service");
    expect((await fetchWorkItems([])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/services/ado.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// api/src/services/ado.service.ts
// Server-side ADO REST client for both orgs. Read-only. Auth = Basic ":" + PAT.

const API = "api-version=7.1";

export interface RawCommit {
  commitId: string;
  comment: string;
  author: { email: string; name: string } | null;
}
export interface RawWorkItem {
  id: number;
  title: string;
  state: string;
  workItemType: string;
  assignedTo: string | null;
  tags: string[];
}

function authHeader(pat: string): string {
  return `Basic ${Buffer.from(":" + pat).toString("base64")}`;
}
function reposBase(): { url: string; pat: string } {
  const org = process.env.ADO_REPOS_ORG!;
  const project = encodeURIComponent(process.env.ADO_REPOS_PROJECT!);
  return { url: `https://dev.azure.com/${org}/${project}/_apis`, pat: process.env.ADO_REPOS_PAT! };
}
function workItemsBase(): { url: string; pat: string } {
  const org = process.env.ADO_WORKITEMS_ORG!;
  const project = encodeURIComponent(process.env.ADO_WORKITEMS_PROJECT!);
  return { url: `https://dev.azure.com/${org}/${project}/_apis`, pat: process.env.ADO_WORKITEMS_PAT! };
}

async function req<T>(url: string, pat: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: authHeader(pat), "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ADO ${res.status} ${url.split("?")[0]}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// Bounded-concurrency map — keeps us under the 230s ceiling and gentle on ADO.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function commitsBatch(
  repoId: string, baseBranch: string, compareBranch: string, top = 500,
): Promise<RawCommit[]> {
  const { url, pat } = reposBase();
  const body = {
    itemVersion: { versionType: "branch", version: baseBranch },
    compareVersion: { versionType: "branch", version: compareBranch },
    $top: top,
  };
  const data = await req<{ value: RawCommit[] }>(
    `${url}/git/repositories/${repoId}/commitsBatch?${API}`, pat,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.value ?? [];
}

// PR ids already merged into staging — the squash-safe dedupe layer that
// commitsBatch (pure ancestry, no --cherry-pick) can't provide on its own.
export async function stagingPrIds(repoId: string, stagingBranch: string, top = 1000): Promise<Set<number>> {
  const { url, pat } = reposBase();
  const q = `searchCriteria.itemVersion.version=${encodeURIComponent(stagingBranch)}&searchCriteria.$top=${top}`;
  const data = await req<{ value: { comment: string }[] }>(
    `${url}/git/repositories/${repoId}/commits?${q}&${API}`, pat,
  );
  const ids = new Set<number>();
  for (const c of data.value ?? []) {
    const m = /Merged PR #?(\d+)/i.exec(c.comment ?? "");
    if (m) ids.add(Number(m[1]));
  }
  return ids;
}

export async function getPullRequest(
  repoId: string, prId: number,
): Promise<{ title: string; sourceRefName: string; createdBy: string | null } | null> {
  const { url, pat } = reposBase();
  try {
    const pr = await req<{ title?: string; sourceRefName?: string; createdBy?: { uniqueName?: string } }>(
      `${url}/git/repositories/${repoId}/pullrequests/${prId}?${API}`, pat,
    );
    return { title: pr.title ?? "", sourceRefName: pr.sourceRefName ?? "", createdBy: pr.createdBy?.uniqueName ?? null };
  } catch {
    return null; // PR enrichment is best-effort
  }
}

export async function getPullRequestWorkItemIds(repoId: string, prId: number): Promise<string[]> {
  const { url, pat } = reposBase();
  try {
    const data = await req<{ value: { id: string }[] }>(
      `${url}/git/repositories/${repoId}/pullRequests/${prId}/workitems?${API}`, pat,
    );
    return (data.value ?? []).map((r) => String(r.id));
  } catch {
    return [];
  }
}

export async function fetchWorkItems(ids: string[]): Promise<Map<string, RawWorkItem>> {
  const map = new Map<string, RawWorkItem>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;
  const { url, pat } = workItemsBase();
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200).map(Number);
    const data = await req<{ value: { id: number; fields: Record<string, unknown> }[] }>(
      `${url}/wit/workitemsbatch?${API}`, pat,
      {
        method: "POST",
        body: JSON.stringify({
          ids: chunk,
          fields: ["System.Id", "System.Title", "System.State", "System.WorkItemType", "System.Tags", "System.AssignedTo"],
          errorPolicy: "omit",
        }),
      },
    );
    for (const wi of data.value ?? []) {
      const f = wi.fields;
      const tagsRaw = (f["System.Tags"] as string) ?? "";
      const assigned = f["System.AssignedTo"] as { uniqueName?: string } | undefined;
      map.set(String(wi.id), {
        id: wi.id,
        title: (f["System.Title"] as string) ?? "",
        state: (f["System.State"] as string) ?? "",
        workItemType: (f["System.WorkItemType"] as string) ?? "",
        assignedTo: assigned?.uniqueName ?? null,
        tags: tagsRaw === "" ? [] : tagsRaw.split("; "),
      });
    }
  }
  return map;
}
```

The old `adoGet` export is removed; nothing imports it yet.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx vitest run src/services/ado.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/ado.service.ts api/src/services/ado.service.test.ts
git commit -m "feat(api): ADO REST client (two-org, commitsBatch, workitemsbatch, PR lookups, mapLimit)"
```

---

## Task 6: Diff service — discovery + PR-ID dedupe

**Files:**
- Modify: `api/src/services/diff.service.ts`
- Test: `api/src/services/diff.service.test.ts`

**Interfaces:**
- Consumes: `commitsBatch`, `stagingPrIds` (Task 5), `parsePrId` (Task 4), `RepoConfig` (Task 2).
- Produces:
  - `interface DiscoveredCandidate { key: string; repo: string; prId: number | null; commitId: string; subject: string; author: string | null }`
  - `discoverCandidates(repo: RepoConfig, deps?): Promise<DiscoveredCandidate[]>` — one entry per PR (deduped) plus one per PR-less commit (`key: patch:<sha>`), excluding PR ids already on staging.

`deps` is a test seam: `{ commitsBatch, stagingPrIds }`, defaulting to the real ADO functions.

- [ ] **Step 1: Write the failing test**

```typescript
// api/src/services/diff.service.test.ts
import { it, expect } from "vitest";
import { discoverCandidates } from "./diff.service";
import type { RepoConfig } from "../config";

const repo: RepoConfig = { name: "TT.AskDI", repoId: "R", devBranch: "development", stagingBranch: "staging" };

it("dedupes commits of one PR to a single candidate and drops PRs already on staging", async () => {
  const deps = {
    commitsBatch: async () => [
      { commitId: "c1", comment: "Merged PR 100: ADO-1000001 a", author: { email: "x@example.com", name: "X" } },
      { commitId: "c2", comment: "Merged PR 100: ADO-1000001 a (fixup)", author: { email: "x@example.com", name: "X" } },
      { commitId: "c3", comment: "Merged PR 200: ADO-2000002 b", author: { email: "y@example.com", name: "Y" } },
      { commitId: "c4", comment: "hotfix no pr", author: { email: "z@example.com", name: "Z" } },
    ],
    stagingPrIds: async () => new Set<number>([200]),
  };
  const out = await discoverCandidates(repo, deps);
  expect(out.map((c) => c.key).sort()).toEqual(["patch:c4", "pr:100"]);
  const pr100 = out.find((c) => c.key === "pr:100")!;
  expect(pr100.prId).toBe(100);
  expect(pr100.commitId).toBe("c1"); // first (oldest) commit of the PR
  expect(out.find((c) => c.key === "patch:c4")!.prId).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/services/diff.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// api/src/services/diff.service.ts
import { commitsBatch as realCommitsBatch, stagingPrIds as realStagingPrIds } from "./ado.service";
import { parsePrId } from "./linking.service";
import type { RepoConfig } from "../config";

export interface DiscoveredCandidate {
  key: string; // pr:<id> | patch:<sha>
  repo: string;
  prId: number | null;
  commitId: string;
  subject: string;
  author: string | null;
}

interface Deps {
  commitsBatch: typeof realCommitsBatch;
  stagingPrIds: typeof realStagingPrIds;
}

export async function discoverCandidates(
  repo: RepoConfig,
  deps: Deps = { commitsBatch: realCommitsBatch, stagingPrIds: realStagingPrIds },
): Promise<DiscoveredCandidate[]> {
  const [commits, applied] = await Promise.all([
    deps.commitsBatch(repo.repoId, repo.stagingBranch, repo.devBranch),
    deps.stagingPrIds(repo.repoId, repo.stagingBranch),
  ]);

  // commitsBatch returns newest-first; reverse so the first commit seen for a PR
  // is its oldest — matches the reference's --reverse ordering.
  const ordered = [...commits].reverse();
  const seenPr = new Set<number>();
  const out: DiscoveredCandidate[] = [];

  for (const c of ordered) {
    const subject = (c.comment ?? "").split("\n")[0];
    const prId = parsePrId(subject);
    const author = c.author?.email ?? null;
    if (prId !== null) {
      if (applied.has(prId) || seenPr.has(prId)) continue; // already shipped / already a candidate
      seenPr.add(prId);
      out.push({ key: `pr:${prId}`, repo: repo.name, prId, commitId: c.commitId, subject, author });
    } else {
      out.push({ key: `patch:${c.commitId}`, repo: repo.name, prId: null, commitId: c.commitId, subject, author });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx vitest run src/services/diff.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/diff.service.ts api/src/services/diff.service.test.ts
git commit -m "feat(api): diff service — commitsBatch discovery + squash-safe PR-ID dedupe"
```

---

## Task 7: Linking — resolveTicketIds (subject → PR fallback → PR refs)

**Files:**
- Modify: `api/src/services/linking.service.ts`, `api/src/services/linking.service.test.ts`

**Interfaces:**
- Consumes: `parseAdoIds` (Task 4), `getPullRequest`, `getPullRequestWorkItemIds` (Task 5), `DiscoveredCandidate` (Task 6).
- Produces: `resolveTicketIds(candidate, repoId, deps?): Promise<{ id: string; viaPr: boolean }[]>` — first-hit-wins across the three sources; `viaPr` true when found only via PR title/branch/refs.

- [ ] **Step 1: Add the failing test (append to linking.service.test.ts)**

```typescript
import { resolveTicketIds } from "./linking.service";

describe("resolveTicketIds", () => {
  const base = { repo: "TT.AskDI", commitId: "c1", author: null };

  it("uses commit-subject ids when present (viaPr=false), skips PR fetch", async () => {
    let prFetched = false;
    const deps = {
      getPullRequest: async () => { prFetched = true; return null; },
      getPullRequestWorkItemIds: async () => [],
    };
    const ids = await resolveTicketIds({ ...base, key: "pr:100", prId: 100, subject: "Merged PR 100: ADO-1000001 x" }, "R", deps);
    expect(ids).toEqual([{ id: "1000001", viaPr: false }]);
    expect(prFetched).toBe(false);
  });

  it("falls back to PR title/branch then PR refs (viaPr=true)", async () => {
    const deps = {
      getPullRequest: async () => ({ title: "no ado here", sourceRefName: "refs/heads/fix/ADO-1137466-x", createdBy: null }),
      getPullRequestWorkItemIds: async () => ["9999999"],
    };
    const ids = await resolveTicketIds({ ...base, key: "pr:100", prId: 100, subject: "Merged PR 100: no id" }, "R", deps);
    expect(ids).toEqual([{ id: "1137466", viaPr: true }]);
  });

  it("returns [] for a PR-less commit with no ids", async () => {
    const ids = await resolveTicketIds({ ...base, key: "patch:c1", prId: null, subject: "hotfix" }, "R", {
      getPullRequest: async () => null, getPullRequestWorkItemIds: async () => [],
    });
    expect(ids).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/services/linking.service.test.ts`
Expected: FAIL (`resolveTicketIds` not exported).

- [ ] **Step 3: Implement (append to linking.service.ts)**

```typescript
import { getPullRequest as realGetPr, getPullRequestWorkItemIds as realGetPrWi } from "./ado.service";
import type { DiscoveredCandidate } from "./diff.service";

interface LinkDeps {
  getPullRequest: typeof realGetPr;
  getPullRequestWorkItemIds: typeof realGetPrWi;
}

export async function resolveTicketIds(
  candidate: DiscoveredCandidate,
  repoId: string,
  deps: LinkDeps = { getPullRequest: realGetPr, getPullRequestWorkItemIds: realGetPrWi },
): Promise<{ id: string; viaPr: boolean }[]> {
  // 1. commit subject
  const fromSubject = parseAdoIds(candidate.subject);
  if (fromSubject.length > 0) return fromSubject.map((id) => ({ id, viaPr: false }));

  if (candidate.prId === null) return []; // PR-less + no subject id → no-ticket

  // 2. PR title + source branch
  const pr = await deps.getPullRequest(repoId, candidate.prId);
  if (pr) {
    const fromPr = parseAdoIds(`${pr.title} ${pr.sourceRefName}`);
    if (fromPr.length > 0) return fromPr.map((id) => ({ id, viaPr: true }));
  }

  // 3. PR's linked work items
  const refs = await deps.getPullRequestWorkItemIds(repoId, candidate.prId);
  return refs.map((id) => ({ id, viaPr: true }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx vitest run src/services/linking.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/linking.service.ts api/src/services/linking.service.test.ts
git commit -m "feat(api): linking resolveTicketIds — subject then PR title/branch/refs fallback"
```

---

## Task 8: Rules service — flags, D1 filter, past-tag exclusion, worst-flag rollup

**Files:**
- Modify: `api/src/services/rules.service.ts`
- Test: `api/src/services/rules.service.test.ts`

**Interfaces:**
- Consumes: `RulesConfig` (Task 2), `classifyTags` (Task 3), `Ticket`, `FlagStatus` (Task 1).
- Produces: `evaluate(tickets: Ticket[], rules: RulesConfig, now: Date): { status: FlagStatus; flags: string[]; excluded: boolean }`.
  - Only tickets whose `workItemType` ∈ `rules.workItemTypes` count.
  - `excluded` = has relevant tickets, all past-tag-only (already shipped).
  - `bad-state` if any relevant ticket state ∉ `requiredStates`; else `warning` if any relevant ticket lacks a current-or-future release tag; else `ready`. No relevant tickets → `no-ticket`.

- [ ] **Step 1: Write the failing test**

```typescript
// api/src/services/rules.service.test.ts
import { describe, it, expect } from "vitest";
import { evaluate } from "./rules.service";
import { loadRules } from "../config";
import type { Ticket } from "../types";

const RULES = loadRules();
const NOW = new Date("2026-07-09T00:00:00Z");
const t = (o: Partial<Ticket>): Ticket => ({
  id: "1", title: "x", state: "Verified", workItemType: "User Story",
  assignedTo: null, tags: ["July 23"], viaPr: false, ...o,
});

describe("rules.evaluate", () => {
  it("ready when state ok and current release tag present", () => {
    expect(evaluate([t({})], RULES, NOW)).toMatchObject({ status: "ready", excluded: false });
  });
  it("bad-state when a relevant ticket is not in a required state", () => {
    const r = evaluate([t({ state: "Ready for QA Testing" })], RULES, NOW);
    expect(r.status).toBe("bad-state");
    expect(r.flags.some((f) => f.includes("Ready for QA Testing"))).toBe(true);
  });
  it("warning when no release tag", () => {
    expect(evaluate([t({ tags: ["SRE"] })], RULES, NOW).status).toBe("warning");
  });
  it("no-ticket when only non-US/Bug types are linked", () => {
    expect(evaluate([t({ workItemType: "Task" })], RULES, NOW).status).toBe("no-ticket");
  });
  it("excluded when relevant tickets are all past-tag-only", () => {
    expect(evaluate([t({ tags: ["June 11"] })], RULES, NOW).excluded).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/services/rules.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// api/src/services/rules.service.ts
import type { RulesConfig } from "../config";
import type { FlagStatus, Ticket } from "../types";
import { classifyTags } from "./releaseTag.service";

export { loadRules } from "../config";

export function evaluate(
  tickets: Ticket[],
  rules: RulesConfig,
  now: Date,
): { status: FlagStatus; flags: string[]; excluded: boolean } {
  const relevant = tickets.filter((t) => rules.workItemTypes.includes(t.workItemType));
  if (relevant.length === 0) return { status: "no-ticket", flags: [], excluded: false };

  const flags: string[] = [];
  let worst: FlagStatus = "ready";
  const rank: Record<FlagStatus, number> = { "bad-state": 3, warning: 2, ready: 1, "no-ticket": 0 };
  const bump = (s: FlagStatus) => { if (rank[s] > rank[worst]) worst = s; };

  let allPastOnly = true;
  for (const ticket of relevant) {
    const cls = classifyTags(ticket.tags, now);
    if (!(cls.hasReleaseTag && cls.allPast)) allPastOnly = false;

    if (rules.requiredStates.length && !rules.requiredStates.includes(ticket.state)) {
      flags.push(`❌ ADO-${ticket.id} state is "${ticket.state}" (needs ${rules.requiredStates.join("/")})`);
      bump("bad-state");
    }
    if (rules.requireReleaseTag && !cls.hasCurrentOrFuture) {
      flags.push(`⚠️ ADO-${ticket.id} has no current release tag`);
      bump("warning");
    }
  }

  // A candidate whose relevant tickets are all past-tag-only already shipped in a
  // prior freeze — exclude it from candidacy (discovery-time exclusion, per spec).
  return { status: worst, flags, excluded: allPastOnly };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && npx vitest run src/services/rules.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/services/rules.service.ts api/src/services/rules.service.test.ts
git commit -m "feat(api): rules engine — D1 type filter, state/tag flags, past-tag exclusion, worst-flag rollup"
```

---

## Task 9: Skip service (Azure Table Storage)

**Files:**
- Modify: `api/src/services/skip.service.ts`, `api/package.json` (add `@azure/data-tables`)
- Test: `api/src/services/skip.service.test.ts`

**Interfaces:**
- Produces: `listSkips(deps?)`, `addSkip(entry, deps?)`, `removeSkip(repo, key, deps?)`, `skipKeyFor(candidate)`, `ensureTable(deps?)`.
- `deps` injects a minimal table client for tests (`{ table: { listEntities, upsertEntity, deleteEntity } }`).

- [ ] **Step 1: Install the dependency**

Run: `cd api && npm install @azure/data-tables`

- [ ] **Step 2: Write the failing test**

```typescript
// api/src/services/skip.service.test.ts
import { it, expect } from "vitest";
import { listSkips, addSkip, skipKeyFor } from "./skip.service";
import type { SkipEntry } from "../types";

function fakeTable(rows: Record<string, unknown>[]) {
  return {
    listEntities() {
      return { async *[Symbol.asyncIterator]() { for (const r of rows) yield r; } };
    },
    async upsertEntity(e: Record<string, unknown>) { rows.push(e); },
    async deleteEntity(_pk: string, _rk: string) {},
  };
}

it("skipKeyFor prefers pr:<id>, falls back to patch:<sha>", () => {
  expect(skipKeyFor({ prId: 100, commitId: "abc" })).toBe("pr:100");
  expect(skipKeyFor({ prId: null, commitId: "abc" })).toBe("patch:abc");
});

it("lists mapped skip entries", async () => {
  const table = fakeTable([{
    partitionKey: "TT.AskDI", rowKey: "pr:100", dismissedBy: "user@example.com",
    dismissedAt: "2026-07-09T00:00:00Z", reason: "reverted", kind: "permanent", dismissedForRelease: "July 9",
  }]);
  const out = await listSkips({ table });
  expect(out[0]).toMatchObject({ repo: "TT.AskDI", key: "pr:100", reason: "reverted", kind: "permanent" });
});

it("addSkip writes a row with partition/row keys", async () => {
  const rows: Record<string, unknown>[] = [];
  const entry: SkipEntry = {
    repo: "TT.AskDI", key: "pr:100", dismissedBy: "user@example.com", dismissedAt: "t",
    reason: "held", kind: "hold", dismissedForRelease: "July 23",
  };
  await addSkip(entry, { table: fakeTable(rows) });
  expect(rows[0]).toMatchObject({ partitionKey: "TT.AskDI", rowKey: "pr:100", reason: "held" });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd api && npx vitest run src/services/skip.service.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

```typescript
// api/src/services/skip.service.ts
import { TableClient } from "@azure/data-tables";
import type { SkipEntry } from "../types";

const TABLE = "freezeSkips";

interface TableLike {
  listEntities(): AsyncIterable<Record<string, unknown>>;
  upsertEntity(entity: Record<string, unknown>): Promise<unknown>;
  deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
}
interface Deps { table?: TableLike }

function getTable(deps?: Deps): TableLike {
  if (deps?.table) return deps.table;
  const conn = process.env.SKIP_TABLE_CONNECTION_STRING;
  if (!conn) throw new Error("SKIP_TABLE_CONNECTION_STRING is not set");
  return TableClient.fromConnectionString(conn, TABLE, { allowInsecureConnection: true }) as unknown as TableLike;
}

export function skipKeyFor(candidate: { prId: number | null; commitId: string }): string {
  return candidate.prId !== null ? `pr:${candidate.prId}` : `patch:${candidate.commitId}`;
}

export async function ensureTable(deps?: Deps): Promise<void> {
  if (deps?.table) return;
  const conn = process.env.SKIP_TABLE_CONNECTION_STRING!;
  const client = TableClient.fromConnectionString(conn, TABLE, { allowInsecureConnection: true });
  await client.createTable().catch(() => undefined); // ignore "already exists"
}

export async function listSkips(deps?: Deps): Promise<SkipEntry[]> {
  const table = getTable(deps);
  const out: SkipEntry[] = [];
  for await (const e of table.listEntities()) {
    out.push({
      repo: e.partitionKey as string,
      key: e.rowKey as string,
      dismissedBy: (e.dismissedBy as string) ?? "",
      dismissedAt: (e.dismissedAt as string) ?? "",
      reason: (e.reason as SkipEntry["reason"]) ?? "not-ready",
      reasonText: (e.reasonText as string) || undefined,
      kind: (e.kind as SkipEntry["kind"]) ?? "permanent",
      dismissedForRelease: (e.dismissedForRelease as string) ?? "",
    });
  }
  return out;
}

export async function addSkip(entry: SkipEntry, deps?: Deps): Promise<void> {
  const table = getTable(deps);
  await table.upsertEntity({
    partitionKey: entry.repo,
    rowKey: entry.key,
    dismissedBy: entry.dismissedBy,
    dismissedAt: entry.dismissedAt,
    reason: entry.reason,
    ...(entry.reasonText ? { reasonText: entry.reasonText } : {}),
    kind: entry.kind,
    dismissedForRelease: entry.dismissedForRelease,
  });
}

export async function removeSkip(repo: string, key: string, deps?: Deps): Promise<void> {
  await getTable(deps).deleteEntity(repo, key);
}
```

- [ ] **Step 5: Run tests + commit**

Run: `cd api && npx vitest run src/services/skip.service.test.ts`
Expected: PASS.

```bash
git add api/src/services/skip.service.ts api/src/services/skip.service.test.ts api/package.json api/package-lock.json
git commit -m "feat(api): skip service over Azure Table Storage (pr:/patch: keyed, list/add/remove)"
```

---

## Task 10: Pipeline composition + `GET /api/freeze-candidates`

**Files:**
- Create: `api/src/services/pipeline.ts`, `api/src/services/principal.ts`, `api/src/services/pipeline.test.ts`
- Modify: `api/src/functions/freezeCandidates.ts`

**Interfaces:**
- Produces: `buildCandidates(release, now, deps?): Promise<CandidatesResponse>`; `PipelineDeps`; `getPrincipal(req)`.
  - `PipelineDeps = { repos: RepoConfig[]; discover: (repo) => Promise<DiscoveredCandidate[]>; resolve: (c, repoId) => Promise<{id;viaPr}[]>; fetchWorkItems: (ids) => Promise<Map<string,RawWorkItem>>; listSkips: () => Promise<SkipEntry[]>; rules: RulesConfig }`.

- [ ] **Step 1: Write the failing test (pipeline with injected ADO)**

```typescript
// api/src/services/pipeline.test.ts
import { it, expect } from "vitest";
import { buildCandidates } from "./pipeline";
import { loadRules } from "../config";

const NOW = new Date("2026-07-09T00:00:00Z");

it("assembles candidates, applies skips, splits the no-ticket bucket, computes stats", async () => {
  const deps = {
    repos: [{ name: "TT.AskDI", repoId: "R", devBranch: "development", stagingBranch: "staging" }],
    discover: async () => [
      { key: "pr:100", repo: "TT.AskDI", prId: 100, commitId: "c1", subject: "Merged PR 100: ADO-1000001 a", author: "a@example.com" },
      { key: "pr:101", repo: "TT.AskDI", prId: 101, commitId: "c2", subject: "Merged PR 101: ADO-1000002 b", author: "b@example.com" },
      { key: "patch:c3", repo: "TT.AskDI", prId: null, commitId: "c3", subject: "hotfix", author: "c@example.com" },
    ],
    resolve: async (c: { prId: number | null }) =>
      c.prId === 100 ? [{ id: "1000001", viaPr: false }]
      : c.prId === 101 ? [{ id: "1000002", viaPr: false }]
      : [],
    fetchWorkItems: async () => new Map<string, any>([
      ["1000001", { id: 1000001, title: "A", state: "Verified", workItemType: "User Story", assignedTo: "a@example.com", tags: ["July 23"] }],
      ["1000002", { id: 1000002, title: "B", state: "Active", workItemType: "Bug", assignedTo: "b@example.com", tags: ["SRE"] }],
    ]),
    listSkips: async () => [{ repo: "TT.AskDI", key: "pr:101", dismissedBy: "x", dismissedAt: "t", reason: "held" as const, kind: "hold" as const, dismissedForRelease: "July 23" }],
    rules: loadRules(),
  };
  const res = await buildCandidates("July 23", NOW, deps);
  expect(res.candidates.map((c) => c.key)).toEqual(["pr:100"]); // pr:101 skipped
  expect(res.candidates[0].status).toBe("ready");
  expect(res.noTicket.map((c) => c.key)).toEqual(["patch:c3"]);
  expect(res.stats).toMatchObject({ ready: 1, noTicket: 1 });
  expect(res.availableReleases).toContain("July 23");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/services/pipeline.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `pipeline.ts`**

```typescript
// api/src/services/pipeline.ts
import { loadRepos, loadRules, type RepoConfig, type RulesConfig } from "../config";
import { discoverCandidates, type DiscoveredCandidate } from "./diff.service";
import { resolveTicketIds } from "./linking.service";
import { fetchWorkItems, mapLimit, type RawWorkItem } from "./ado.service";
import { listSkips } from "./skip.service";
import { evaluate } from "./rules.service";
import { activeReleaseTags } from "./releaseTag.service";
import type { CandidatesResponse, FreezeCandidate, SkipEntry, Ticket } from "../types";

export interface PipelineDeps {
  repos: RepoConfig[];
  discover: (repo: RepoConfig) => Promise<DiscoveredCandidate[]>;
  resolve: (c: DiscoveredCandidate, repoId: string) => Promise<{ id: string; viaPr: boolean }[]>;
  fetchWorkItems: (ids: string[]) => Promise<Map<string, RawWorkItem>>;
  listSkips: () => Promise<SkipEntry[]>;
  rules: RulesConfig;
}

function realDeps(): PipelineDeps {
  return {
    repos: loadRepos(),
    discover: (repo) => discoverCandidates(repo),
    resolve: (c, repoId) => resolveTicketIds(c, repoId),
    fetchWorkItems,
    listSkips,
    rules: loadRules(),
  };
}

export async function buildCandidates(
  release: string | undefined,
  now: Date,
  deps: PipelineDeps = realDeps(),
): Promise<CandidatesResponse> {
  const skips = await deps.listSkips();
  const skipKeys = new Set(skips.map((s) => `${s.repo} ${s.key}`));

  const discovered: DiscoveredCandidate[] = [];
  for (const repo of deps.repos) {
    const found = await deps.discover(repo);
    for (const c of found) if (!skipKeys.has(`${c.repo} ${c.key}`)) discovered.push(c);
  }

  const repoIdByName = new Map(deps.repos.map((r) => [r.name, r.repoId]));
  const links = await mapLimit(discovered, 8, async (c) => ({
    candidate: c,
    ids: await deps.resolve(c, repoIdByName.get(c.repo)!),
  }));

  const allIds = Array.from(new Set(links.flatMap((l) => l.ids.map((i) => i.id))));
  const wiMap = await deps.fetchWorkItems(allIds);
  const allTags = Array.from(wiMap.values()).flatMap((w) => w.tags);
  const availableReleases = activeReleaseTags(allTags, now);
  const targetRelease = release ?? availableReleases[0] ?? "";

  const candidates: FreezeCandidate[] = [];
  const noTicket: FreezeCandidate[] = [];

  for (const { candidate, ids } of links) {
    const tickets: Ticket[] = ids.map(({ id, viaPr }) => {
      const wi = wiMap.get(id);
      return {
        id,
        title: wi?.title ?? "(not found)",
        state: wi?.state ?? "",
        workItemType: wi?.workItemType ?? "",
        assignedTo: wi?.assignedTo ?? null,
        tags: wi?.tags ?? [],
        viaPr,
      };
    });
    const result = evaluate(tickets, deps.rules, now);
    if (result.excluded) continue; // past-tag-only → already shipped

    const fc: FreezeCandidate = {
      key: candidate.key,
      repo: candidate.repo,
      prId: candidate.prId,
      commitId: candidate.commitId,
      title: candidate.subject,
      author: candidate.author,
      tickets,
      status: result.status,
      flags: result.flags,
    };
    if (fc.status === "no-ticket") noTicket.push(fc);
    else candidates.push(fc);
  }

  const stats = {
    total: candidates.length,
    ready: candidates.filter((c) => c.status === "ready").length,
    warning: candidates.filter((c) => c.status === "warning").length,
    badState: candidates.filter((c) => c.status === "bad-state").length,
    noTicket: noTicket.length,
  };

  return { release: targetRelease, availableReleases, generatedAt: now.toISOString(), candidates, noTicket, stats };
}
```

- [ ] **Step 4: Implement `principal.ts`**

```typescript
// api/src/services/principal.ts
import type { HttpRequest } from "@azure/functions";

// SWA (and the SWA-CLI emulator) inject the signed-in user as a base64 JSON blob
// in x-ms-client-principal. Absent when running `func start` bare.
export function getPrincipal(req: HttpRequest): { userId: string; userDetails: string } | null {
  const header = req.headers.get("x-ms-client-principal");
  if (!header) return null;
  try {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    return { userId: decoded.userId ?? "", userDetails: decoded.userDetails ?? "" };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Rewrite the function to use the pipeline**

```typescript
// api/src/functions/freezeCandidates.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { buildCandidates } from "../services/pipeline";

export async function freezeCandidates(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const release = req.query.get("release") ?? undefined;
  try {
    return { jsonBody: await buildCandidates(release, new Date()) };
  } catch (err) {
    ctx.error("freezeCandidates failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("freezeCandidates", { methods: ["GET"], authLevel: "anonymous", route: "freeze-candidates", handler: freezeCandidates });
```

- [ ] **Step 6: Run tests + typecheck + commit**

Run: `cd api && npx vitest run && npm run typecheck`
Expected: PASS (all suites).

```bash
git add api/src/services/pipeline.ts api/src/services/principal.ts api/src/services/pipeline.test.ts api/src/functions/freezeCandidates.ts
git commit -m "feat(api): pipeline composition + GET /api/freeze-candidates over real ADO"
```

---

## Task 11: By-id, notify, and skips-list functions

**Files:**
- Create: `api/src/functions/freezeCandidateById.ts`, `api/src/functions/notify.ts`, `api/src/functions/skipList.ts`
- Modify: `api/src/services/notification.service.ts`
- Test: `api/src/services/notification.service.test.ts`

**Interfaces:**
- Produces: `notifyCandidate(candidate, notifyVia): Promise<{ sent: boolean; dryRun: boolean; to: string[] }>`.

- [ ] **Step 1: Write the failing notification test**

```typescript
// api/src/services/notification.service.test.ts
import { it, expect, afterEach, vi } from "vitest";
import type { FreezeCandidate } from "../types";

const candidate: FreezeCandidate = {
  key: "pr:100", repo: "TT.AskDI", prId: 100, commitId: "abc12345", title: "Merged PR 100",
  author: "author@example.com",
  tickets: [{ id: "1000001", title: "T", state: "Active", workItemType: "Bug", assignedTo: "assignee@example.com", tags: [], viaPr: false }],
  status: "bad-state", flags: ["❌ ..."],
};

afterEach(() => { delete process.env.NOTIFY_DRY_RUN; delete process.env.POWER_AUTOMATE_WEBHOOK_URL; vi.restoreAllMocks(); });

it("dedupes recipients and does not POST when NOTIFY_DRY_RUN=1", async () => {
  process.env.NOTIFY_DRY_RUN = "1";
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { notifyCandidate } = await import("./notification.service");
  const r = await notifyCandidate(candidate, "both");
  expect(r.dryRun).toBe(true);
  expect(r.to.sort()).toEqual(["assignee@example.com", "author@example.com"]);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("POSTs the webhook payload when not in dry-run", async () => {
  process.env.POWER_AUTOMATE_WEBHOOK_URL = "https://flow.example/hook";
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, text: async () => "" } as Response);
  vi.stubGlobal("fetch", fetchMock);
  const { notifyCandidate } = await import("./notification.service");
  await notifyCandidate(candidate, "email");
  expect(fetchMock).toHaveBeenCalledOnce();
  const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
  expect(body.to).toContain("author@example.com");
  expect(body.adoTickets[0]).toContain("ADO-1000001");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/services/notification.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `notification.service.ts`**

```typescript
// api/src/services/notification.service.ts
import type { FreezeCandidate, NotifyVia } from "../types";

export async function notifyCandidate(
  candidate: FreezeCandidate,
  notifyVia: NotifyVia,
): Promise<{ sent: boolean; dryRun: boolean; to: string[] }> {
  const recipients = Array.from(
    new Set([candidate.author, ...candidate.tickets.map((t) => t.assignedTo)].filter((x): x is string => !!x)),
  );

  const payload = {
    notifyVia,
    commitHash: candidate.commitId.slice(0, 8),
    commitMessage: candidate.title,
    commitAuthor: candidate.author ?? "",
    to: recipients,
    adoTickets: candidate.tickets.map(
      (t) => `ADO-${t.id}: ${t.title} (State: ${t.state}, Assigned to: ${t.assignedTo ?? "—"})`,
    ),
    flags: candidate.flags,
    dashboardUrl: `${process.env.DASHBOARD_URL ?? ""}/candidates/${candidate.key}`,
  };

  if (process.env.NOTIFY_DRY_RUN === "1") {
    console.log("[notify dry-run]", JSON.stringify(payload));
    return { sent: false, dryRun: true, to: recipients };
  }

  const url = process.env.POWER_AUTOMATE_WEBHOOK_URL;
  if (!url) throw new Error("POWER_AUTOMATE_WEBHOOK_URL is not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`webhook ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { sent: true, dryRun: false, to: recipients };
}
```

- [ ] **Step 4: Implement the three functions**

`api/src/functions/freezeCandidateById.ts`:

```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { buildCandidates } from "../services/pipeline";

export async function freezeCandidateById(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const id = decodeURIComponent(req.params.id);
  try {
    const all = await buildCandidates(req.query.get("release") ?? undefined, new Date());
    const found = [...all.candidates, ...all.noTicket].find((c) => c.key === id);
    return found ? { jsonBody: found } : { status: 404, jsonBody: { error: "not found" } };
  } catch (err) {
    ctx.error("freezeCandidateById failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("freezeCandidateById", { methods: ["GET"], authLevel: "anonymous", route: "freeze-candidates/{id}", handler: freezeCandidateById });
```

`api/src/functions/notify.ts`:

```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { buildCandidates } from "../services/pipeline";
import { notifyCandidate } from "../services/notification.service";
import type { NotifyVia } from "../types";

export async function notify(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const id = decodeURIComponent(req.params.id);
  const { notifyVia = "both" } = (await req.json().catch(() => ({}))) as { notifyVia?: NotifyVia };
  try {
    const all = await buildCandidates(undefined, new Date());
    const candidate = [...all.candidates, ...all.noTicket].find((c) => c.key === id);
    if (!candidate) return { status: 404, jsonBody: { error: "not found" } };
    return { jsonBody: await notifyCandidate(candidate, notifyVia) };
  } catch (err) {
    ctx.error("notify failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("notify", { methods: ["POST"], authLevel: "anonymous", route: "freeze-candidates/{id}/notify", handler: notify });
```

`api/src/functions/skipList.ts`:

```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { listSkips } from "../services/skip.service";
import { buildCandidates } from "../services/pipeline";

export async function skipList(_req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const [skips, all] = await Promise.all([listSkips(), buildCandidates(undefined, new Date())]);
    const live = new Set([...all.candidates, ...all.noTicket].map((c) => `${c.repo} ${c.key}`));
    // Orphans: skipped but no longer in the candidate set (already on staging).
    return { jsonBody: skips.map((s) => ({ ...s, orphan: !live.has(`${s.repo} ${s.key}`) })) };
  } catch (err) {
    ctx.error("skipList failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("skipList", { methods: ["GET"], authLevel: "anonymous", route: "skips", handler: skipList });
```

- [ ] **Step 5: Run tests + typecheck + commit**

Run: `cd api && npx vitest run && npm run typecheck`
Expected: PASS.

```bash
git add api/src/functions/freezeCandidateById.ts api/src/functions/notify.ts api/src/functions/skipList.ts api/src/services/notification.service.ts api/src/services/notification.service.test.ts
git commit -m "feat(api): by-id, notify (Power Automate + dry-run), and skips-list functions"
```

---

## Task 12: Dismiss + un-skip functions

**Files:**
- Create: `api/src/functions/dismiss.ts`, `api/src/functions/unskip.ts`, `api/src/functions/dismiss.test.ts`

**Interfaces:**
- `POST /api/freeze-candidates/{id}/dismiss` body `{ reason, reasonText?, kind, release }`; `id` = candidate `key` (`pr:100`/`patch:<sha>`); repo resolved by finding the candidate.
- `DELETE /api/skips/{key}?repo=<repo>` (repo via query since RowKey isn't unique across partitions).
- The dismiss handler takes an optional `deps` for testability: `{ buildCandidates, addSkip, getPrincipal }`.

- [ ] **Step 1: Write the failing test**

```typescript
// api/src/functions/dismiss.test.ts
import { it, expect } from "vitest";
import { dismissHandler } from "./dismiss";

function req(body: unknown, id: string) {
  return { params: { id }, json: async () => body, headers: { get: () => null } } as any;
}
const ctx = { error: () => {} } as any;

it("writes a skip row for the resolved candidate and returns it", async () => {
  const added: any[] = [];
  const deps = {
    buildCandidates: async () => ({ candidates: [{ key: "pr:100", repo: "TT.AskDI", prId: 100, commitId: "c1" }], noTicket: [], release: "July 9" }),
    addSkip: async (e: any) => { added.push(e); },
    getPrincipal: () => ({ userId: "u", userDetails: "user@example.com" }),
  } as any;
  const res = await dismissHandler(req({ reason: "reverted", kind: "permanent", release: "July 9" }, "pr:100"), ctx, deps);
  expect(res.status ?? 200).toBe(200);
  expect(added[0]).toMatchObject({ repo: "TT.AskDI", key: "pr:100", reason: "reverted", dismissedBy: "user@example.com", dismissedForRelease: "July 9" });
});

it("404s when the candidate is not in the current set", async () => {
  const deps = { buildCandidates: async () => ({ candidates: [], noTicket: [], release: "" }), addSkip: async () => {}, getPrincipal: () => null } as any;
  const res = await dismissHandler(req({ reason: "held", kind: "hold", release: "July 9" }, "pr:999"), ctx, deps);
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && npx vitest run src/functions/dismiss.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `dismiss.ts`**

```typescript
// api/src/functions/dismiss.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { buildCandidates } from "../services/pipeline";
import { addSkip } from "../services/skip.service";
import { getPrincipal } from "../services/principal";
import type { SkipEntry, SkipKind, SkipReason } from "../types";

interface DismissDeps {
  buildCandidates: typeof buildCandidates;
  addSkip: typeof addSkip;
  getPrincipal: typeof getPrincipal;
}

export async function dismissHandler(
  req: HttpRequest,
  ctx: InvocationContext,
  deps: DismissDeps = { buildCandidates, addSkip, getPrincipal },
): Promise<HttpResponseInit> {
  const key = decodeURIComponent(req.params.id);
  const body = (await req.json().catch(() => ({}))) as {
    reason?: SkipReason; reasonText?: string; kind?: SkipKind; release?: string;
  };
  try {
    const all = await deps.buildCandidates(body.release, new Date());
    const candidate = [...all.candidates, ...all.noTicket].find((c) => c.key === key);
    if (!candidate) return { status: 404, jsonBody: { error: "candidate not found" } };
    const principal = deps.getPrincipal(req);
    const entry: SkipEntry = {
      repo: candidate.repo,
      key: candidate.key,
      dismissedBy: principal?.userDetails ?? "local-dev",
      dismissedAt: new Date().toISOString(),
      reason: body.reason ?? "not-ready",
      ...(body.reasonText ? { reasonText: body.reasonText } : {}),
      kind: body.kind ?? "permanent",
      dismissedForRelease: body.release ?? all.release,
    };
    await deps.addSkip(entry);
    return { jsonBody: entry };
  } catch (err) {
    ctx.error("dismiss failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("dismiss", { methods: ["POST"], authLevel: "anonymous", route: "freeze-candidates/{id}/dismiss", handler: (r, c) => dismissHandler(r, c) });
```

- [ ] **Step 4: Implement `unskip.ts`**

```typescript
// api/src/functions/unskip.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { removeSkip } from "../services/skip.service";

export async function unskip(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const key = decodeURIComponent(req.params.key);
  const repo = req.query.get("repo");
  if (!repo) return { status: 400, jsonBody: { error: "repo query param required" } };
  try {
    await removeSkip(repo, key);
    return { status: 204 };
  } catch (err) {
    ctx.error("unskip failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("unskip", { methods: ["DELETE"], authLevel: "anonymous", route: "skips/{key}", handler: unskip });
```

- [ ] **Step 5: Run tests + typecheck + lint + commit**

Run: `cd api && npx vitest run && npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add api/src/functions/dismiss.ts api/src/functions/unskip.ts api/src/functions/dismiss.test.ts
git commit -m "feat(api): dismiss (writes skip row, principal-attributed) + unskip functions"
```

---

## Task 13: Frontend API client + status helpers

**Files:**
- Create: `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`
- Modify: `frontend/src/lib/status.ts`, `frontend/src/lib/status.test.ts`

**Interfaces:**
- `client.ts`: `getCandidates(release?)`, `getSkips()`, `dismiss(key, body)`, `unskip(repo, key)`, `notify(key, notifyVia)`, `cherryPickCommand(candidates)`.
- `status.ts`: `statusLabel(s)`, `statusDot(s)`.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/src/api/client.test.ts
import { it, expect, vi, afterEach } from "vitest";
import { cherryPickCommand, getCandidates } from "./client";
import type { FreezeCandidate } from "../types";

afterEach(() => vi.restoreAllMocks());

it("builds a cherry-pick command from selected candidates in order", () => {
  const cs = [{ commitId: "aaa" }, { commitId: "bbb" }] as FreezeCandidate[];
  expect(cherryPickCommand(cs)).toBe("git cherry-pick aaa bbb");
});

it("getCandidates calls /api/freeze-candidates with the release param", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });
  vi.stubGlobal("fetch", fetchMock);
  await getCandidates("July 9");
  expect(fetchMock.mock.calls[0][0]).toBe("/api/freeze-candidates?release=July%209");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/api/client.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `client.ts`**

```typescript
// frontend/src/api/client.ts
import type { CandidatesResponse, FreezeCandidate, NotifyVia, SkipEntry } from "../types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function getCandidates(release?: string): Promise<CandidatesResponse> {
  const q = release ? `?release=${encodeURIComponent(release)}` : "";
  return json<CandidatesResponse>(await fetch(`/api/freeze-candidates${q}`));
}

export async function getSkips(): Promise<SkipEntry[]> {
  return json<SkipEntry[]>(await fetch("/api/skips"));
}

export async function dismiss(
  key: string,
  body: { reason: string; reasonText?: string; kind: string; release: string },
): Promise<SkipEntry> {
  return json<SkipEntry>(
    await fetch(`/api/freeze-candidates/${encodeURIComponent(key)}/dismiss`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  );
}

export async function unskip(repo: string, key: string): Promise<void> {
  const res = await fetch(`/api/skips/${encodeURIComponent(key)}?repo=${encodeURIComponent(repo)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`${res.status}`);
}

export async function notify(key: string, notifyVia: NotifyVia): Promise<unknown> {
  return json(
    await fetch(`/api/freeze-candidates/${encodeURIComponent(key)}/notify`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notifyVia }),
    }),
  );
}

export function cherryPickCommand(candidates: FreezeCandidate[]): string {
  return `git cherry-pick ${candidates.map((c) => c.commitId).join(" ")}`;
}
```

- [ ] **Step 4: Set `status.ts`**

```typescript
// frontend/src/lib/status.ts
import type { FlagStatus } from "../types";

export function statusLabel(s: FlagStatus): string {
  return { ready: "Ready", warning: "Needs tag", "bad-state": "Wrong state", "no-ticket": "No ticket" }[s];
}
export function statusDot(s: FlagStatus): string {
  return { ready: "dot-green", warning: "dot-amber", "bad-state": "dot-red", "no-ticket": "dot-grey" }[s];
}
```

Set `status.test.ts` to assert `statusLabel("bad-state") === "Wrong state"` and `statusDot("ready") === "dot-green"`.

- [ ] **Step 5: Run tests + typecheck + commit**

Run: `cd frontend && npx vitest run && npm run typecheck`
Expected: PASS.

```bash
git add frontend/src/api frontend/src/lib
git commit -m "feat(frontend): typed API client + status helpers + cherry-pick command"
```

---

## Task 14: Frontend UI — full dashboard

**Files:**
- Create: `frontend/src/components/{StatsBar,ReleasePicker,CandidateRow,CandidateList,NonPrSection,SkipPanel,DismissDialog,NotifyMenu}.tsx`, `frontend/src/components/StatsBar.test.tsx`, `frontend/src/index.css`
- Modify: `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/vite.config.ts`

Install test libs if absent: `cd frontend && npm i -D @testing-library/react @testing-library/jest-dom jsdom`; set `test: { environment: "jsdom", globals: true }` in `vite.config.ts`.

- [ ] **Step 1: Write a representative failing test**

```tsx
// frontend/src/components/StatsBar.test.tsx
import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsBar } from "./StatsBar";

it("renders each stat count", () => {
  render(<StatsBar stats={{ total: 5, ready: 2, warning: 1, badState: 1, noTicket: 1 }} />);
  expect(screen.getByText(/Ready/).textContent).toMatch(/2/);
  expect(screen.getByText(/Wrong state/).textContent).toMatch(/1/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/StatsBar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the components** (full source in one commit)

`StatsBar.tsx`:

```tsx
import type { Stats } from "../types";

export function StatsBar({ stats }: { stats: Stats }) {
  const items = [
    ["Total", stats.total, "dot-grey"],
    ["Ready", stats.ready, "dot-green"],
    ["Needs tag", stats.warning, "dot-amber"],
    ["Wrong state", stats.badState, "dot-red"],
    ["No ticket", stats.noTicket, "dot-grey"],
  ] as const;
  return (
    <div className="statsbar">
      {items.map(([label, n, dot]) => (
        <div className="stat" key={label}>
          <span className={`dot ${dot}`} /> {label}: <strong>{n}</strong>
        </div>
      ))}
    </div>
  );
}
```

`ReleasePicker.tsx`:

```tsx
export function ReleasePicker({
  releases, value, onChange,
}: { releases: string[]; value: string; onChange: (r: string) => void }) {
  return (
    <label className="release-picker">
      Target release{" "}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {releases.length === 0 && <option value="">(none detected)</option>}
        {releases.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
    </label>
  );
}
```

`NotifyMenu.tsx`:

```tsx
import type { NotifyVia } from "../types";
export function NotifyMenu({ onNotify }: { onNotify: (via: NotifyVia) => void }) {
  return (
    <span className="notify-menu">
      Notify:
      <button onClick={() => onNotify("email")}>Email</button>
      <button onClick={() => onNotify("teams")}>Teams</button>
      <button onClick={() => onNotify("both")}>Both</button>
    </span>
  );
}
```

`CandidateRow.tsx`:

```tsx
import { useState } from "react";
import type { FreezeCandidate, NotifyVia } from "../types";
import { statusDot, statusLabel } from "../lib/status";
import { NotifyMenu } from "./NotifyMenu";

export function CandidateRow({
  c, onDismiss, onNotify, onCopyCherryPick,
}: {
  c: FreezeCandidate;
  onDismiss: (c: FreezeCandidate) => void;
  onNotify: (c: FreezeCandidate, via: NotifyVia) => void;
  onCopyCherryPick: (c: FreezeCandidate) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`row status-${c.status}`}>
      <div className="row-main" onClick={() => setOpen((o) => !o)}>
        <span className={`dot ${statusDot(c.status)}`} />
        <span className="badge">{c.repo}</span>
        {c.prId != null ? <span className="pr">PR {c.prId}</span> : <span className="pr muted">no PR</span>}
        <span className="subj">{c.title}</span>
        <span className="flag">{statusLabel(c.status)}</span>
      </div>
      {open && (
        <div className="row-detail">
          <ul className="tickets">
            {c.tickets.map((t) => (
              <li key={t.id} className="ticket">
                <a href={`https://dev.azure.com/tr-core-ai-data-platforms/CoCounsel/_workitems/edit/${t.id}`} target="_blank" rel="noreferrer">ADO-{t.id}</a>{" "}
                <em>{t.workItemType}</em> · {t.state} · {t.title}
                {t.tags.length > 0 && <span className="tags"> [{t.tags.join(", ")}]</span>}
                {t.viaPr && <span className="viapr" title="resolved from PR, not commit">via PR</span>}
              </li>
            ))}
            {c.tickets.length === 0 && <li className="muted">No linked work item</li>}
          </ul>
          {c.flags.length > 0 && <ul className="flags">{c.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
          <div className="row-actions">
            <button onClick={() => onCopyCherryPick(c)}>Copy cherry-pick</button>
            <NotifyMenu onNotify={(via) => onNotify(c, via)} />
            <button onClick={() => onDismiss(c)}>Dismiss…</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

`CandidateList.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { FreezeCandidate, FlagStatus, NotifyVia } from "../types";
import { CandidateRow } from "./CandidateRow";

const ORDER: Record<FlagStatus, number> = { "bad-state": 0, warning: 1, ready: 2, "no-ticket": 3 };

export function CandidateList({
  candidates, onDismiss, onNotify, onCopyCherryPick,
}: {
  candidates: FreezeCandidate[];
  onDismiss: (c: FreezeCandidate) => void;
  onNotify: (c: FreezeCandidate, via: NotifyVia) => void;
  onCopyCherryPick: (c: FreezeCandidate) => void;
}) {
  const [filter, setFilter] = useState<"all" | FlagStatus>("all");
  const rows = useMemo(
    () => candidates
      .filter((c) => filter === "all" || c.status === filter)
      .slice()
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.repo.localeCompare(b.repo)),
    [candidates, filter],
  );
  return (
    <section>
      <div className="filters">
        {(["all", "bad-state", "warning", "ready"] as const).map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {rows.map((c) => (
        <CandidateRow key={`${c.repo}:${c.key}`} c={c} onDismiss={onDismiss} onNotify={onNotify} onCopyCherryPick={onCopyCherryPick} />
      ))}
      {rows.length === 0 && <p className="muted">No candidates. ✅</p>}
    </section>
  );
}
```

`NonPrSection.tsx`:

```tsx
import { useState } from "react";
import type { FreezeCandidate, NotifyVia } from "../types";
import { CandidateRow } from "./CandidateRow";

export function NonPrSection({ items, onDismiss, onNotify, onCopyCherryPick }: {
  items: FreezeCandidate[];
  onDismiss: (c: FreezeCandidate) => void;
  onNotify: (c: FreezeCandidate, via: NotifyVia) => void;
  onCopyCherryPick: (c: FreezeCandidate) => void;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <section className="nonpr">
      <button className="collapse" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} Non-PR / no-ticket ({items.length})
      </button>
      {open && items.map((c) => (
        <CandidateRow key={`${c.repo}:${c.key}`} c={c} onDismiss={onDismiss} onNotify={onNotify} onCopyCherryPick={onCopyCherryPick} />
      ))}
    </section>
  );
}
```

`DismissDialog.tsx`:

```tsx
import { useState } from "react";
import type { FreezeCandidate, SkipKind, SkipReason } from "../types";

const REASONS: SkipReason[] = ["reverted", "superseded-by-later-commit", "held", "shipped-elsewhere", "not-ready"];

export function DismissDialog({ candidate, onConfirm, onCancel }: {
  candidate: FreezeCandidate;
  onConfirm: (body: { reason: SkipReason; reasonText?: string; kind: SkipKind }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<SkipReason>("not-ready");
  const [kind, setKind] = useState<SkipKind>("permanent");
  const [reasonText, setReasonText] = useState("");
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Dismiss {candidate.prId != null ? `PR ${candidate.prId}` : candidate.commitId.slice(0, 8)}</h3>
        <label>Reason
          <select value={reason} onChange={(e) => setReason(e.target.value as SkipReason)}>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>Kind
          <select value={kind} onChange={(e) => setKind(e.target.value as SkipKind)}>
            <option value="permanent">permanent</option>
            <option value="hold">hold (this release only)</option>
          </select>
        </label>
        <label>Note <input value={reasonText} onChange={(e) => setReasonText(e.target.value)} /></label>
        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={() => onConfirm({ reason, kind, reasonText: reasonText || undefined })}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}
```

`SkipPanel.tsx`:

```tsx
import type { SkipEntry } from "../types";

export function SkipPanel({ skips, onUnskip }: { skips: SkipEntry[]; onUnskip: (s: SkipEntry) => void }) {
  return (
    <section className="skip-panel">
      <h2>Skip list ({skips.length})</h2>
      {skips.length === 0 && <p className="muted">Nothing dismissed.</p>}
      <ul>
        {skips.map((s) => (
          <li key={`${s.repo}:${s.key}`} className={s.orphan ? "orphan" : ""}>
            <span className="badge">{s.repo}</span> <code>{s.key}</code> · {s.reason} · {s.kind} · by {s.dismissedBy} for {s.dismissedForRelease}
            {s.orphan && <span className="orphan-tag" title="already on staging"> (orphan)</span>}
            <button onClick={() => onUnskip(s)}>Un-skip</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Compose `App.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import type { CandidatesResponse, FreezeCandidate, NotifyVia, SkipEntry, SkipKind, SkipReason } from "./types";
import * as api from "./api/client";
import { StatsBar } from "./components/StatsBar";
import { ReleasePicker } from "./components/ReleasePicker";
import { CandidateList } from "./components/CandidateList";
import { NonPrSection } from "./components/NonPrSection";
import { SkipPanel } from "./components/SkipPanel";
import { DismissDialog } from "./components/DismissDialog";
import "./index.css";

export function App() {
  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [skips, setSkips] = useState<SkipEntry[]>([]);
  const [release, setRelease] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<FreezeCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async (rel?: string) => {
    setLoading(true); setError(null);
    try {
      const [c, s] = await Promise.all([api.getCandidates(rel), api.getSkips()]);
      setData(c); setSkips(s);
      if (!rel && c.release) setRelease(c.release);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const onCopyCherryPick = (c: FreezeCandidate) => {
    void navigator.clipboard.writeText(api.cherryPickCommand([c]));
    setToast("Cherry-pick command copied");
  };
  const onNotify = async (c: FreezeCandidate, via: NotifyVia) => {
    try { await api.notify(c.key, via); setToast(`Notified via ${via}`); }
    catch (e) { setToast(`Notify failed: ${(e as Error).message}`); }
  };
  const onConfirmDismiss = async (body: { reason: SkipReason; reasonText?: string; kind: SkipKind }) => {
    if (!dismissing) return;
    await api.dismiss(dismissing.key, { ...body, release });
    setDismissing(null);
    await refresh(release);
  };
  const onUnskip = async (s: SkipEntry) => { await api.unskip(s.repo, s.key); await refresh(release); };

  return (
    <main>
      <header>
        <h1>FreezeFrame</h1>
        <ReleasePicker releases={data?.availableReleases ?? []} value={release} onChange={(r) => { setRelease(r); void refresh(r); }} />
        <button onClick={() => void refresh(release)} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </header>
      {error && <p className="error">⚠️ {error}</p>}
      {data && <StatsBar stats={data.stats} />}
      {data && <CandidateList candidates={data.candidates} onDismiss={setDismissing} onNotify={onNotify} onCopyCherryPick={onCopyCherryPick} />}
      {data && <NonPrSection items={data.noTicket} onDismiss={setDismissing} onNotify={onNotify} onCopyCherryPick={onCopyCherryPick} />}
      <SkipPanel skips={skips} onUnskip={onUnskip} />
      {dismissing && <DismissDialog candidate={dismissing} onConfirm={onConfirmDismiss} onCancel={() => setDismissing(null)} />}
      {toast && <div className="toast" onClick={() => setToast(null)}>{toast}</div>}
    </main>
  );
}
```

`index.css` (presentational only — realizes the class names above):

```css
:root { color-scheme: light dark; }
body { font: 14px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; }
main { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
header { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
h1 { margin-right: auto; }
.statsbar { display: flex; gap: 1.25rem; margin: 1rem 0; padding: .6rem .9rem; background: #f4f4f6; border: 1px solid #ddd; border-radius: 6px; }
.dot { display: inline-block; width: .7rem; height: .7rem; border-radius: 50%; margin-right: .3rem; vertical-align: middle; }
.dot-green { background: #2e9b4f; } .dot-amber { background: #e0a400; } .dot-red { background: #c62828; } .dot-grey { background: #9e9e9e; }
.filters { margin: .5rem 0; } .filters button { margin-right: .4rem; } .filters .active { font-weight: 700; }
.row { border: 1px solid #e0e0e0; border-radius: 6px; margin: .35rem 0; }
.row-main { display: flex; gap: .6rem; align-items: center; padding: .5rem .7rem; cursor: pointer; }
.row-main:hover { background: #fafafa; }
.badge { background: #eef; color: #334; padding: .05rem .45rem; border-radius: 4px; font-size: .8em; }
.pr { font-weight: 600; } .subj { flex: 1; color: #444; } .flag { white-space: nowrap; font-weight: 600; }
.status-bad-state { border-left: 4px solid #c62828; } .status-warning { border-left: 4px solid #e0a400; }
.status-ready { border-left: 4px solid #2e9b4f; } .status-no-ticket { border-left: 4px solid #9e9e9e; }
.row-detail { padding: .3rem .9rem .7rem; } .tickets, .flags { margin: .3rem 0; padding-left: 1.1rem; }
.tags { color: #3a3aa0; } .viapr { font-size: .78em; color: #8a5300; background: #fff0d6; border: 1px solid #f0d9a8; padding: 0 .3rem; border-radius: 3px; margin-left: .25rem; }
.row-actions { display: flex; gap: .5rem; align-items: center; margin-top: .4rem; }
.nonpr .collapse { background: none; border: none; font-size: 1em; cursor: pointer; }
.skip-panel { margin-top: 2rem; border-top: 1px solid #ddd; padding-top: 1rem; } .skip-panel li { margin: .25rem 0; } .orphan { opacity: .6; }
.muted { color: #999; } .error { color: #b00; }
.dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; }
.dialog { background: Canvas; padding: 1.2rem; border-radius: 8px; min-width: 320px; display: flex; flex-direction: column; gap: .6rem; }
.dialog label { display: flex; flex-direction: column; gap: .2rem; } .dialog-actions { display: flex; justify-content: flex-end; gap: .5rem; }
.toast { position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: .5rem .9rem; border-radius: 6px; cursor: pointer; }
```

Confirm `main.tsx` renders `<App />` (it already imports `App`). Remove the redundant `import "./index.css"` from `main.tsx` if `App.tsx` imports it (keep one).

- [ ] **Step 5: Run tests + typecheck + build + commit**

Run: `cd frontend && npx vitest run && npm run typecheck && npm run build`
Expected: PASS; `dist/` produced.

```bash
git add frontend/src frontend/vite.config.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): full dashboard UI (stats, release picker, list, non-PR, skip panel, dismiss, notify, cherry-pick)"
```

---

## Task 15: Local loop wiring + real-data verification

**Files:**
- Create: `swa-cli.config.json`, `api/local.settings.json` (gitignored — confirm it is in `.gitignore`)
- Modify: `README.md` if run steps changed

- [ ] **Step 1: Install local tooling (once)**

```bash
npm i -g azure-functions-core-tools@4 @azure/static-web-apps-cli azurite
```

- [ ] **Step 2: Create `swa-cli.config.json`**

```json
{
  "$schema": "https://aka.ms/azure/static-web-apps-cli/schema",
  "configurations": {
    "freeze-frame": {
      "appLocation": "frontend",
      "apiLocation": "api",
      "outputLocation": "dist",
      "appBuildCommand": "npm run build",
      "apiLanguage": "node",
      "apiVersion": "22",
      "run": "npm run dev",
      "appDevserverUrl": "http://localhost:5173"
    }
  }
}
```

- [ ] **Step 3: Create `api/local.settings.json`** (reuse the read-scoped MCP tokens; real Table + webhook pasted by the user at demo time)

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "ADO_REPOS_ORG": "ThoughtTrace",
    "ADO_REPOS_PROJECT": "ThoughtTrace Core",
    "ADO_REPOS_PAT": "<value of $ADO_REPOS_MCP_AUTH_TOKEN>",
    "ADO_WORKITEMS_ORG": "tr-core-ai-data-platforms",
    "ADO_WORKITEMS_PROJECT": "CoCounsel",
    "ADO_WORKITEMS_PAT": "<value of $ADO_MCP_AUTH_TOKEN>",
    "SKIP_TABLE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "POWER_AUTOMATE_WEBHOOK_URL": "",
    "NOTIFY_DRY_RUN": "1",
    "DASHBOARD_URL": "http://localhost:4280"
  }
}
```

For the real working-example, replace `SKIP_TABLE_CONNECTION_STRING` with the `fluffyttisancusfrontend` connection string, set `POWER_AUTOMATE_WEBHOOK_URL`, and flip `NOTIFY_DRY_RUN` to `0`. Azurite (`UseDevelopmentStorage=true`) is the offline fallback for the skip table; the skip service calls `ensureTable()` before first write.

- [ ] **Step 4: Bring up the loop and verify the API serves real data**

```bash
azurite --silent --location /tmp/azurite &        # Table Storage emulator
cd api && npm run build && func start &            # port 7071
cd .. && swa start --config-name freeze-frame &    # port 4280
sleep 8
curl -s "http://localhost:4280/api/freeze-candidates?release=July%2023" | jq '{release, stats, first: .candidates[0].key}'
```

Expected: JSON with real `stats` and at least one candidate key (e.g. `pr:2xxxx`), `generatedAt` set.

- [ ] **Step 5: Run the definition of done**

Run: `/verify-freeze-frame`
Expected: typecheck + lint + test green in both packages; local loop serves `GET /api/freeze-candidates`.

- [ ] **Step 6: Commit**

```bash
git add swa-cli.config.json README.md
git commit -m "chore: local SWA loop config (swa-cli) + run docs; verified real-data /api/freeze-candidates"
```

(Confirm `api/local.settings.json` is git-ignored and NOT staged.)

---

## Task 16: Draft PR to main

**Files:** none (process).

- [ ] **Step 1: Confirm `/verify-freeze-frame` is green** (Task 15 Step 5).

- [ ] **Step 2: Push branch + open the PR** via the `/creating-pull-requests` skill: draft, body says "hackathon POC", target `main`, `AI Generated` label applied. Never merge — the human merges (auto-deploys the SWA).

- [ ] **Step 3: Report the PR URL + the secrets still needed for the live deploy**: `SKIP_TABLE_CONNECTION_STRING`, `POWER_AUTOMATE_WEBHOOK_URL`, and dedicated `ADO_REPOS_PAT` / `ADO_WORKITEMS_PAT` service PATs (the MCP tokens are the developer's personal read PATs and should not back a shared deployment) — all as SWA application settings.

---

## Self-Review

**1. Spec coverage:**
- Commit discovery (cherry-pick + PR-ID dedupe) → Tasks 5, 6. ✅ (Limitation noted: REST `commitsBatch` is pure-ancestry; PR-ID + applied-PR-id dedupe substitutes for `--cherry-pick` patch-equivalence; the skip list absorbs the tail.)
- Linking (subject → PR title/branch → PR refs, `viaPr`) → Tasks 4, 7. ✅
- Release-tag parsing (ISO/month-name/wrap/recency/past-exclusion) → Task 3, applied in Tasks 8/10. ✅
- Rule engine (state + tag, D1 type filter, worst-flag) → Task 8. ✅
- Skip list (Table Storage, pr:/patch:, dismiss/list/unskip, orphan marking, principal) → Tasks 9, 10, 11, 12. ✅
- Non-PR / no-ticket bucket → Task 10 (split), Task 14 (collapsed UI). ✅
- Target release selection (picker, default nearest) → Tasks 10, 14. ✅
- Notifications (Power Automate, dry-run, recipient dedupe) → Task 11. ✅
- Frontend (list+badge, stats, expand, filter/sort, release picker, notify, skip panel, dismiss, non-PR, cherry-pick) → Tasks 13, 14. ✅
- Config/secrets, local loop (SWA CLI + func + Azurite), verify → Task 15. ✅
- Deploy via PR to main → Task 16. ✅
- D3 date-range and inline ADO-state editing → intentionally deferred (Phase 2), per spec refinement. ✅

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". `index.css` is fully specified. Synthetic test emails use `@example.com`.

**3. Type consistency:** `FreezeCandidate`, `Ticket`, `SkipEntry`, `CandidatesResponse`, `Stats`, `NotifyVia` used consistently. `buildCandidates(release, now, deps?)` stable across Tasks 10–12. `skipKeyFor`, `resolveTicketIds`, `discoverCandidates`, `evaluate`, `notifyCandidate` names match definitions. Skip composite identity is consistently `` `${repo} ${key}` ``.

---

## Execution note

This plan front-loads the load-bearing backend logic (discovery, dedupe, linking, rules) with real-data-shaped tests, then composes functions, then the UI, then wires the live loop. Each task is independently testable and committed. The three integration secrets (Table connection string, webhook URL, deployed-app service PATs) are needed only at Tasks 15–16; every prior task runs against injected deps or the developer's read-scoped tokens.
