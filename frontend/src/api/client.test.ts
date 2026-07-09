import { it, expect, vi, afterEach } from "vitest";
import { cherryPickCommand, getCandidates } from "./client";
import type { FreezeCandidate } from "../types";

afterEach(() => {
  vi.restoreAllMocks();
});

it("builds a cherry-pick command from selected candidates in order", () => {
  const cs = [{ commitId: "aaa" }, { commitId: "bbb" }] as FreezeCandidate[];
  expect(cherryPickCommand(cs)).toBe("git cherry-pick aaa bbb");
});

it("getCandidates calls /api/freeze-candidates with the release param", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });
  vi.stubGlobal("fetch", fetchMock);
  await getCandidates("July 9");
  expect(fetchMock.mock.calls[0][0]).toBe(
    "/api/freeze-candidates?release=July%209",
  );
});
