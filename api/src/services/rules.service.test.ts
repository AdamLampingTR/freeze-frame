import { describe, it, expect } from "vitest";
import { evaluate } from "./rules.service";
import { loadRules } from "../config";
import type { Ticket } from "../types";

const RULES = loadRules();
const NOW = new Date("2026-07-09T00:00:00Z");
const t = (o: Partial<Ticket>): Ticket => ({
  id: "1",
  title: "x",
  state: "Verified",
  workItemType: "User Story",
  assignedTo: null,
  tags: ["July 23"],
  viaPr: false,
  ...o,
});

describe("rules.evaluate", () => {
  it("ready when state ok and current release tag present", () => {
    expect(evaluate([t({})], RULES, NOW)).toMatchObject({
      status: "ready",
      excluded: false,
    });
  });
  it("bad-state when a relevant ticket is not in a required state", () => {
    const r = evaluate([t({ state: "Ready for QA Testing" })], RULES, NOW);
    expect(r.status).toBe("bad-state");
    expect(r.flags.some((f) => f.includes("Ready for QA Testing"))).toBe(true);
  });
  it("warning when no release tag", () => {
    expect(evaluate([t({ tags: ["SRE"] })], RULES, NOW).status).toBe("warning");
  });
  it("no-ticket when only non-US/Bug types are linked", () => {
    expect(evaluate([t({ workItemType: "Task" })], RULES, NOW).status).toBe(
      "no-ticket",
    );
  });
  it("excluded when relevant tickets are all past-tag-only", () => {
    expect(evaluate([t({ tags: ["June 11"] })], RULES, NOW).excluded).toBe(
      true,
    );
  });
});
