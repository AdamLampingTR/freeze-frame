import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { buildCandidates } from "../services/pipeline";
import { notifyCandidate } from "../services/notification.service";
import type { NotifyVia } from "../types";

export async function notify(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const id = decodeURIComponent(req.params.id);
  const { notifyVia = "both" } = (await req.json().catch(() => ({}))) as {
    notifyVia?: NotifyVia;
  };
  try {
    const all = await buildCandidates(undefined, new Date());
    const candidate = [...all.candidates, ...all.noTicket].find(
      (c) => c.key === id,
    );
    if (!candidate) return { status: 404, jsonBody: { error: "not found" } };
    return { jsonBody: await notifyCandidate(candidate, notifyVia) };
  } catch (err) {
    ctx.error("notify failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("notify", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "freeze-candidates/{id}/notify",
  handler: notify,
});
