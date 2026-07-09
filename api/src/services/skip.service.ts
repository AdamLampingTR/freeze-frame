import { TableClient } from "@azure/data-tables";
import type { SkipEntry } from "../types";

const TABLE = "freezeSkips";

interface TableLike {
  listEntities(): AsyncIterable<Record<string, unknown>>;
  upsertEntity(entity: Record<string, unknown>): Promise<unknown>;
  deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
}
interface Deps {
  table?: TableLike;
}

// Single guarded read of the connection string — a missing app setting must
// surface as this clear message, not the opaque "Cannot read properties of
// undefined (reading 'toLowerCase')" the Table SDK throws on an undefined
// connection string.
function connString(): string {
  const conn = process.env.SKIP_TABLE_CONNECTION_STRING;
  if (!conn) throw new Error("SKIP_TABLE_CONNECTION_STRING is not set");
  return conn;
}

// Single construction path so the guard and options can't drift between callers
// (that divergence — a guard in getTable, a bare `!` in ensureTable — is what
// produced the toLowerCase crash).
function newTableClient(): TableClient {
  return TableClient.fromConnectionString(connString(), TABLE, {
    allowInsecureConnection: true,
  });
}

function getTable(deps?: Deps): TableLike {
  if (deps?.table) return deps.table;
  return newTableClient() as unknown as TableLike;
}

// Key on PR-ID (`pr:<id>`); fall back to `patch:<sha>` for PR-less commits.
// The skip-list design calls for `git patch-id --stable` here so a rebased /
// cherry-picked commit stays dismissed, but managed Functions have a read-only
// filesystem and cannot run git (see .claude/rules/api.md), so patch-id is not
// computable server-side. Documented compromise: PR-less skips key on the raw
// commit SHA, with the known limitation that a re-applied commit gets a new SHA
// and would resurface. PR-keyed skips (the common case) are unaffected.
export function skipKeyFor(candidate: {
  prId: number | null;
  commitId: string;
}): string {
  return candidate.prId !== null
    ? `pr:${candidate.prId}`
    : `patch:${candidate.commitId}`;
}

export async function ensureTable(deps?: Deps): Promise<void> {
  if (deps?.table) return;
  await newTableClient()
    .createTable()
    .catch(() => undefined); // ignore "already exists"
}

export async function listSkips(deps?: Deps): Promise<SkipEntry[]> {
  await ensureTable(deps);
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
  await ensureTable(deps);
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

export async function removeSkip(
  repo: string,
  key: string,
  deps?: Deps,
): Promise<void> {
  await getTable(deps).deleteEntity(repo, key);
}
