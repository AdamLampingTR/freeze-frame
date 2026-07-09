import type { FreezeCandidate } from "../types";
// Stub — cherry-pick + PR-ID dedupe over ADO REST.
export async function discoverCandidates(
  _repo: string,
  _release: string,
): Promise<FreezeCandidate[]> {
  throw new Error("not implemented: discoverCandidates");
}
