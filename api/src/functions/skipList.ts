import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { listSkips } from "../services/skip.service";
import { discoveredKeys } from "../services/pipeline";

export async function skipList(
  _req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    // Orphans are detected against the pre-skip-filter discovery set: a dismissed
    // PR still in dev-not-staging is live; one that has landed on staging drops
    // out of discovery and is flagged orphan.
    const [skips, live] = await Promise.all([listSkips(), discoveredKeys()]);
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
