import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { buildCandidates } from "../services/pipeline";

export async function freezeCandidateById(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const id = decodeURIComponent(req.params.id);
  try {
    const all = await buildCandidates(
      req.query.get("release") ?? undefined,
      new Date(),
    );
    const found = [...all.candidates, ...all.noTicket].find(
      (c) => c.key === id,
    );
    return found
      ? { jsonBody: found }
      : { status: 404, jsonBody: { error: "not found" } };
  } catch (err) {
    ctx.error("freezeCandidateById failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("freezeCandidateById", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "freeze-candidates/{id}",
  handler: freezeCandidateById,
});
