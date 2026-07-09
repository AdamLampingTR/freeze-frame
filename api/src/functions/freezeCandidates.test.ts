import { describe, it, expect, vi } from "vitest";

vi.mock("../services/pipeline", () => ({
  buildCandidates: vi.fn(),
}));

import { freezeCandidates } from "./freezeCandidates";
import { buildCandidates } from "../services/pipeline";

function req(release?: string) {
  return { query: { get: () => release ?? null } } as never;
}
const ctx = { error: () => {} } as never;

describe("GET /api/freeze-candidates", () => {
  it("returns the pipeline response body", async () => {
    const body = {
      release: "July 23",
      candidates: [],
      noTicket: [],
      stats: {},
    };
    vi.mocked(buildCandidates).mockResolvedValueOnce(body as never);
    const res = await freezeCandidates(req("July 23"), ctx);
    expect(res.jsonBody).toEqual(body);
  });

  it("returns 502 when the pipeline throws", async () => {
    vi.mocked(buildCandidates).mockRejectedValueOnce(new Error("ADO 401"));
    const res = await freezeCandidates(req(), ctx);
    expect(res.status).toBe(502);
    expect((res.jsonBody as { error: string }).error).toContain("ADO 401");
  });
});
