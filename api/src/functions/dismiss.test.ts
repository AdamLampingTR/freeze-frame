import { it, expect } from "vitest";
import { dismissHandler } from "./dismiss";

function req(body: unknown, id: string) {
  return {
    params: { id },
    json: async () => body,
    headers: { get: () => null },
  } as never;
}
const ctx = { error: () => {} } as never;

it("writes a skip row for the resolved candidate and returns it", async () => {
  const added: unknown[] = [];
  const deps = {
    buildCandidates: async () => ({
      candidates: [
        { key: "pr:100", repo: "TT.AskDI", prId: 100, commitId: "c1" },
      ],
      noTicket: [],
      release: "July 9",
    }),
    addSkip: async (e: unknown) => {
      added.push(e);
    },
    getPrincipal: () => ({ userId: "u", userDetails: "user@example.com" }),
  } as never;
  const res = await dismissHandler(
    req({ reason: "reverted", kind: "permanent", release: "July 9" }, "pr:100"),
    ctx,
    deps,
  );
  expect(res.status ?? 200).toBe(200);
  expect(added[0]).toMatchObject({
    repo: "TT.AskDI",
    key: "pr:100",
    reason: "reverted",
    dismissedBy: "user@example.com",
    dismissedForRelease: "July 9",
  });
});

it("404s when the candidate is not in the current set", async () => {
  const deps = {
    buildCandidates: async () => ({
      candidates: [],
      noTicket: [],
      release: "",
    }),
    addSkip: async () => {},
    getPrincipal: () => null,
  } as never;
  const res = await dismissHandler(
    req({ reason: "held", kind: "hold", release: "July 9" }, "pr:999"),
    ctx,
    deps,
  );
  expect(res.status).toBe(404);
});
