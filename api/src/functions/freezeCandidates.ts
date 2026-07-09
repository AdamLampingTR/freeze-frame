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
    flags: [],
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
