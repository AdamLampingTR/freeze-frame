import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listSkips } from "../services/skip.service";
import { buildCandidates } from "../services/pipeline";

export async function skipList(
  _req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const [skips, all] = await Promise.all([
      listSkips(),
      buildCandidates(undefined, new Date()),
    ]);
    const live = new Set(
      [...all.candidates, ...all.noTicket].map((c) => `${c.repo} ${c.key}`),
    );
    // Orphans: skipped but no longer in the candidate set (already on staging).
    return {
      jsonBody: skips.map((s) => ({
        ...s,
        orphan: !live.has(`${s.repo} ${s.key}`),
      })),
    };
  } catch (err) {
    ctx.error("skipList failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("skipList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "skips",
  handler: skipList,
});
