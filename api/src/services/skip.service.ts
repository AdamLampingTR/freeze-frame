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

function getTable(deps?: Deps): TableLike {
  if (deps?.table) return deps.table;
  const conn = process.env.SKIP_TABLE_CONNECTION_STRING;
  if (!conn) throw new Error("SKIP_TABLE_CONNECTION_STRING is not set");
  return TableClient.fromConnectionString(conn, TABLE, {
    allowInsecureConnection: true,
  }) as unknown as TableLike;
}

// Key on PR-ID (`pr:<id>`); fall back to `patch:<sha>` for PR-less commits —
// never the raw SHA alone at the semantic level (squash/re-merge changes it).
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
