import { describe, it, expect } from "vitest";
import { freezeCandidates, MOCK_CANDIDATES } from "./freezeCandidates";

describe("GET /api/freeze-candidates (mock)", () => {
  it("returns the mock candidate array", async () => {
    const res = await freezeCandidates({} as never, {} as never);
    expect(res.jsonBody).toEqual(MOCK_CANDIDATES);
  });
});
