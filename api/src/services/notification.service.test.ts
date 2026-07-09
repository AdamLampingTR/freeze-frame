import { it, expect, afterEach, vi } from "vitest";
import { notifyCandidate } from "./notification.service";
import type { FreezeCandidate } from "../types";

const candidate: FreezeCandidate = {
  key: "pr:100",
  repo: "TT.AskDI",
  prId: 100,
  commitId: "abc12345",
  committedDate: "2026-07-01T00:00:00Z",
  title: "Merged PR 100",
  author: "author@example.com",
  tickets: [
    {
      id: "1000001",
      title: "T",
      state: "Active",
      workItemType: "Bug",
      assignedTo: "assignee@example.com",
      tags: [],
      viaPr: false,
    },
  ],
  status: "bad-state",
  flags: ["❌ ..."],
};

afterEach(() => {
  delete process.env.NOTIFY_DRY_RUN;
  delete process.env.POWER_AUTOMATE_WEBHOOK_URL;
  vi.restoreAllMocks();
});

it("dedupes recipients and does not POST when NOTIFY_DRY_RUN=1", async () => {
  process.env.NOTIFY_DRY_RUN = "1";
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const r = await notifyCandidate(candidate, "both");
  expect(r.dryRun).toBe(true);
  expect(r.to.sort()).toEqual(["assignee@example.com", "author@example.com"]);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("POSTs the webhook payload when not in dry-run", async () => {
  process.env.POWER_AUTOMATE_WEBHOOK_URL = "https://flow.example/hook";
  const fetchMock = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => "",
    } as Response);
  vi.stubGlobal("fetch", fetchMock);
  await notifyCandidate(candidate, "email");
  expect(fetchMock).toHaveBeenCalledOnce();
  const body = JSON.parse(
    (fetchMock.mock.calls[0][1] as RequestInit).body as string,
  );
  expect(body.to).toContain("author@example.com");
  expect(body.adoTickets[0]).toContain("ADO-1000001");
});
