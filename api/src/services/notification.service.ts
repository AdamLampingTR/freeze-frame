import type { FreezeCandidate, NotifyVia } from "../types";

// Manual per-candidate notify → Power Automate webhook (fans out to Outlook +
// Teams). Recipients = commit author + ADO assignees, deduped. NOTIFY_DRY_RUN=1
// logs instead of POSTing so dev runs never page real people.
export async function notifyCandidate(
  candidate: FreezeCandidate,
  notifyVia: NotifyVia,
): Promise<{ sent: boolean; dryRun: boolean; to: string[] }> {
  const recipients = Array.from(
    new Set(
      [candidate.author, ...candidate.tickets.map((t) => t.assignedTo)].filter(
        (x): x is string => !!x,
      ),
    ),
  );

  const payload = {
    notifyVia,
    commitHash: candidate.commitId.slice(0, 8),
    commitMessage: candidate.title,
    commitAuthor: candidate.author ?? "",
    to: recipients,
    adoTickets: candidate.tickets.map(
      (t) =>
        `ADO-${t.id}: ${t.title} (State: ${t.state}, Assigned to: ${t.assignedTo ?? "—"})`,
    ),
    flags: candidate.flags,
    dashboardUrl: `${process.env.DASHBOARD_URL ?? ""}/candidates/${candidate.key}`,
  };

  if (process.env.NOTIFY_DRY_RUN === "1") {
    console.log("[notify dry-run]", JSON.stringify(payload));
    return { sent: false, dryRun: true, to: recipients };
  }

  const url = process.env.POWER_AUTOMATE_WEBHOOK_URL;
  if (!url) throw new Error("POWER_AUTOMATE_WEBHOOK_URL is not set");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok)
    throw new Error(
      `webhook ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  return { sent: true, dryRun: false, to: recipients };
}
