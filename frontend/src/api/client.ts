import type {
  CandidatesResponse,
  FreezeCandidate,
  NotifyVia,
  SkipEntry,
} from "../types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function getCandidates(
  release?: string,
): Promise<CandidatesResponse> {
  const q = release ? `?release=${encodeURIComponent(release)}` : "";
  return json<CandidatesResponse>(await fetch(`/api/freeze-candidates${q}`));
}

export async function getSkips(): Promise<SkipEntry[]> {
  return json<SkipEntry[]>(await fetch("/api/skips"));
}

export async function dismiss(
  key: string,
  body: { reason: string; reasonText?: string; kind: string; release: string },
): Promise<SkipEntry> {
  return json<SkipEntry>(
    await fetch(`/api/freeze-candidates/${encodeURIComponent(key)}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function unskip(repo: string, key: string): Promise<void> {
  const res = await fetch(
    `/api/skips/${encodeURIComponent(key)}?repo=${encodeURIComponent(repo)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`${res.status}`);
}

export async function notify(
  key: string,
  notifyVia: NotifyVia,
): Promise<unknown> {
  return json(
    await fetch(`/api/freeze-candidates/${encodeURIComponent(key)}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyVia }),
    }),
  );
}

export function cherryPickCommand(candidates: FreezeCandidate[]): string {
  return `git cherry-pick ${candidates.map((c) => c.commitId).join(" ")}`;
}
