import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { buildCandidates } from "../services/pipeline";
import { addSkip } from "../services/skip.service";
import { getPrincipal } from "../services/principal";
import type { SkipEntry, SkipKind, SkipReason } from "../types";

interface DismissDeps {
  buildCandidates: typeof buildCandidates;
  addSkip: typeof addSkip;
  getPrincipal: typeof getPrincipal;
}

// `id` is the candidate key (pr:<id> | patch:<sha>). We resolve it against the
// current candidate set to recover its repo (the skip PartitionKey) and to
// reject stale keys. dismissedBy comes from the SWA principal (falls back to
// "local-dev" when running the Function bare, without the SWA-CLI in front).
export async function dismissHandler(
  req: HttpRequest,
  ctx: InvocationContext,
  deps: DismissDeps = { buildCandidates, addSkip, getPrincipal },
): Promise<HttpResponseInit> {
  const key = decodeURIComponent(req.params.id);
  const body = (await req.json().catch(() => ({}))) as {
    reason?: SkipReason;
    reasonText?: string;
    kind?: SkipKind;
    release?: string;
  };
  try {
    const all = await deps.buildCandidates(body.release, new Date());
    const candidate = [...all.candidates, ...all.noTicket].find(
      (c) => c.key === key,
    );
    if (!candidate)
      return { status: 404, jsonBody: { error: "candidate not found" } };
    const principal = deps.getPrincipal(req);
    const entry: SkipEntry = {
      repo: candidate.repo,
      key: candidate.key,
      dismissedBy: principal?.userDetails ?? "local-dev",
      dismissedAt: new Date().toISOString(),
      reason: body.reason ?? "not-ready",
      ...(body.reasonText ? { reasonText: body.reasonText } : {}),
      kind: body.kind ?? "permanent",
      dismissedForRelease: body.release ?? all.release,
    };
    await deps.addSkip(entry);
    return { jsonBody: entry };
  } catch (err) {
    ctx.error("dismiss failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("dismiss", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "freeze-candidates/{id}/dismiss",
  handler: (r, c) => dismissHandler(r, c),
});
