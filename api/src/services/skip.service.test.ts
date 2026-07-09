import { it, expect } from "vitest";
import { listSkips, addSkip, skipKeyFor } from "./skip.service";
import type { SkipEntry } from "../types";

function fakeTable(rows: Record<string, unknown>[]) {
  return {
    listEntities() {
      return {
        async *[Symbol.asyncIterator]() {
          for (const r of rows) yield r;
        },
      };
    },
    async upsertEntity(e: Record<string, unknown>) {
      rows.push(e);
    },
    async deleteEntity(_pk: string, _rk: string) {},
  };
}

it("throws a clear error (not an opaque SDK toLowerCase crash) when the connection string is unset", async () => {
  const prev = process.env.SKIP_TABLE_CONNECTION_STRING;
  delete process.env.SKIP_TABLE_CONNECTION_STRING;
  try {
    await expect(listSkips()).rejects.toThrow(
      "SKIP_TABLE_CONNECTION_STRING is not set",
    );
  } finally {
    if (prev !== undefined) process.env.SKIP_TABLE_CONNECTION_STRING = prev;
  }
});

it("skipKeyFor prefers pr:<id>, falls back to patch:<sha>", () => {
  expect(skipKeyFor({ prId: 100, commitId: "abc" })).toBe("pr:100");
  expect(skipKeyFor({ prId: null, commitId: "abc" })).toBe("patch:abc");
});

it("lists mapped skip entries", async () => {
  const table = fakeTable([
    {
      partitionKey: "TT.AskDI",
      rowKey: "pr:100",
      dismissedBy: "user@example.com",
      dismissedAt: "2026-07-09T00:00:00Z",
      reason: "reverted",
      kind: "permanent",
      dismissedForRelease: "July 9",
    },
  ]);
  const out = await listSkips({ table });
  expect(out[0]).toMatchObject({
    repo: "TT.AskDI",
    key: "pr:100",
    reason: "reverted",
    kind: "permanent",
  });
});

it("addSkip writes a row with partition/row keys", async () => {
  const rows: Record<string, unknown>[] = [];
  const entry: SkipEntry = {
    repo: "TT.AskDI",
    key: "pr:100",
    dismissedBy: "user@example.com",
    dismissedAt: "t",
    reason: "held",
    kind: "hold",
    dismissedForRelease: "July 23",
  };
  await addSkip(entry, { table: fakeTable(rows) });
  expect(rows[0]).toMatchObject({
    partitionKey: "TT.AskDI",
    rowKey: "pr:100",
    reason: "held",
  });
});
