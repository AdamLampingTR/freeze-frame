import type { RulesConfig } from "../config";
import type { FlagStatus, Ticket } from "../types";
import { classifyTags } from "./releaseTag.service";

export { loadRules } from "../config";

// Evaluate a candidate's tickets: only User Story / Bug (D1) count. Wrong state →
// bad-state; no current-or-future release tag → warning; else ready. No relevant
// ticket → no-ticket. `excluded` = all relevant tickets are past-tag-only (already
// shipped in a prior freeze — drop from candidacy, per the spec's discovery-time
// past-tag exclusion).
export function evaluate(
  tickets: Ticket[],
  rules: RulesConfig,
  now: Date,
): { status: FlagStatus; flags: string[]; excluded: boolean } {
  const relevant = tickets.filter((t) =>
    rules.workItemTypes.includes(t.workItemType),
  );
  if (relevant.length === 0) {
    // requireWorkItemReference gates whether a missing US/Bug link is surfaced:
    // true (the default) routes the candidate to the no-ticket bucket; false
    // treats a reference-less candidate as ready (no work item required).
    return {
      status: rules.requireWorkItemReference ? "no-ticket" : "ready",
      flags: [],
      excluded: false,
    };
  }

  const flags: string[] = [];
  let worst: FlagStatus = "ready";
  const rank: Record<FlagStatus, number> = {
    "bad-state": 3,
    warning: 2,
    ready: 1,
    "no-ticket": 0,
  };
  const bump = (s: FlagStatus) => {
    if (rank[s] > rank[worst]) worst = s;
  };

  let allPastOnly = true;
  for (const ticket of relevant) {
    const cls = classifyTags(ticket.tags, now);
    if (!(cls.hasReleaseTag && cls.allPast)) allPastOnly = false;

    if (
      rules.requiredStates.length &&
      !rules.requiredStates.includes(ticket.state)
    ) {
      flags.push(
        `❌ ADO-${ticket.id} state is "${ticket.state}" (needs ${rules.requiredStates.join("/")})`,
      );
      bump("bad-state");
    }
    if (rules.requireReleaseTag && !cls.hasCurrentOrFuture) {
      flags.push(`⚠️ ADO-${ticket.id} has no current release tag`);
      bump("warning");
    }
  }

  return { status: worst, flags, excluded: allPastOnly };
}
