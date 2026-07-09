// Server-side ADO REST client for both orgs. Read-only. Auth = Basic ":" + PAT.
// Repos/PRs live in the ThoughtTrace org; work items in tr-core-ai-data-platforms.

const API = "api-version=7.1";

export interface RawCommit {
  commitId: string;
  comment: string;
  author: { email: string; name: string } | null;
}
export interface RawWorkItem {
  id: number;
  title: string;
  state: string;
  workItemType: string;
  assignedTo: string | null;
  tags: string[];
}

function authHeader(pat: string): string {
  return `Basic ${Buffer.from(":" + pat).toString("base64")}`;
}
function reposBase(): { url: string; pat: string } {
  const org = process.env.ADO_REPOS_ORG!;
  const project = encodeURIComponent(process.env.ADO_REPOS_PROJECT!);
  return {
    url: `https://dev.azure.com/${org}/${project}/_apis`,
    pat: process.env.ADO_REPOS_PAT!,
  };
}
function workItemsBase(): { url: string; pat: string } {
  const org = process.env.ADO_WORKITEMS_ORG!;
  const project = encodeURIComponent(process.env.ADO_WORKITEMS_PROJECT!);
  return {
    url: `https://dev.azure.com/${org}/${project}/_apis`,
    pat: process.env.ADO_WORKITEMS_PAT!,
  };
}

async function req<T>(
  url: string,
  pat: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(pat),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `ADO ${res.status} ${url.split("?")[0]}: ${text.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

// Bounded-concurrency map — keeps us under the 230s ceiling and gentle on ADO.
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

export async function commitsBatch(
  repoId: string,
  baseBranch: string,
  compareBranch: string,
  top = 500,
): Promise<RawCommit[]> {
  const { url, pat } = reposBase();
  const body = {
    itemVersion: { versionType: "branch", version: baseBranch },
    compareVersion: { versionType: "branch", version: compareBranch },
    $top: top,
  };
  const data = await req<{ value: RawCommit[] }>(
    `${url}/git/repositories/${repoId}/commitsBatch?${API}`,
    pat,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.value ?? [];
}

// PR ids already merged into staging — the squash-safe dedupe layer that
// commitsBatch (pure ancestry, no --cherry-pick) can't provide on its own.
export async function stagingPrIds(
  repoId: string,
  stagingBranch: string,
  top = 1000,
): Promise<Set<number>> {
  const { url, pat } = reposBase();
  const q = `searchCriteria.itemVersion.version=${encodeURIComponent(stagingBranch)}&searchCriteria.$top=${top}`;
  const data = await req<{ value: { comment: string }[] }>(
    `${url}/git/repositories/${repoId}/commits?${q}&${API}`,
    pat,
  );
  const ids = new Set<number>();
  for (const c of data.value ?? []) {
    const m = /Merged PR #?(\d+)/i.exec(c.comment ?? "");
    if (m) ids.add(Number(m[1]));
  }
  return ids;
}

export async function getPullRequest(
  repoId: string,
  prId: number,
): Promise<{
  title: string;
  sourceRefName: string;
  createdBy: string | null;
} | null> {
  const { url, pat } = reposBase();
  try {
    const pr = await req<{
      title?: string;
      sourceRefName?: string;
      createdBy?: { uniqueName?: string };
    }>(`${url}/git/repositories/${repoId}/pullrequests/${prId}?${API}`, pat);
    return {
      title: pr.title ?? "",
      sourceRefName: pr.sourceRefName ?? "",
      createdBy: pr.createdBy?.uniqueName ?? null,
    };
  } catch {
    return null; // PR enrichment is best-effort
  }
}

export async function getPullRequestWorkItemIds(
  repoId: string,
  prId: number,
): Promise<string[]> {
  const { url, pat } = reposBase();
  try {
    const data = await req<{ value: { id: string }[] }>(
      `${url}/git/repositories/${repoId}/pullRequests/${prId}/workitems?${API}`,
      pat,
    );
    return (data.value ?? []).map((r) => String(r.id));
  } catch {
    return [];
  }
}

export async function fetchWorkItems(
  ids: string[],
): Promise<Map<string, RawWorkItem>> {
  const map = new Map<string, RawWorkItem>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;
  const { url, pat } = workItemsBase();
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200).map(Number);
    const data = await req<{
      value: { id: number; fields: Record<string, unknown> }[];
    }>(`${url}/wit/workitemsbatch?${API}`, pat, {
      method: "POST",
      body: JSON.stringify({
        ids: chunk,
        fields: [
          "System.Id",
          "System.Title",
          "System.State",
          "System.WorkItemType",
          "System.Tags",
          "System.AssignedTo",
        ],
        errorPolicy: "omit",
      }),
    });
    for (const wi of data.value ?? []) {
      const f = wi.fields;
      const tagsRaw = (f["System.Tags"] as string) ?? "";
      const assigned = f["System.AssignedTo"] as
        { uniqueName?: string } | undefined;
      map.set(String(wi.id), {
        id: wi.id,
        title: (f["System.Title"] as string) ?? "",
        state: (f["System.State"] as string) ?? "",
        workItemType: (f["System.WorkItemType"] as string) ?? "",
        assignedTo: assigned?.uniqueName ?? null,
        tags: tagsRaw === "" ? [] : tagsRaw.split("; "),
      });
    }
  }
  return map;
}
