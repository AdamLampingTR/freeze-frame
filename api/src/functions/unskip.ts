import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { removeSkip } from "../services/skip.service";

// repo comes via query because the skip RowKey (pr:<id>|patch:<sha>) is only
// unique within a repo partition, not globally.
export async function unskip(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const key = decodeURIComponent(req.params.key);
  const repo = req.query.get("repo");
  if (!repo)
    return { status: 400, jsonBody: { error: "repo query param required" } };
  try {
    await removeSkip(repo, key);
    return { status: 204 };
  } catch (err) {
    ctx.error("unskip failed", err);
    return { status: 502, jsonBody: { error: (err as Error).message } };
  }
}

app.http("unskip", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "skips/{key}",
  handler: unskip,
});
