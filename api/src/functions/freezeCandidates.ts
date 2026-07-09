import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { buildCandidates } from "../services/pipeline";

export async function freezeCandidates(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const release = req.query.get("release") ?? undefined;
  try {
    return { jsonBody: await buildCandidates(release, new Date()) };
  } catch (err) {
    ctx.error("freezeCandidates failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("freezeCandidates", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "freeze-candidates",
  handler: freezeCandidates,
});
