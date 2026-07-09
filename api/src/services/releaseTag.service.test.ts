import { describe, it, expect } from "vitest";
import {
  isReleaseTag,
  classifyTags,
  activeReleaseTags,
} from "./releaseTag.service";

const NOW = new Date("2026-07-09T00:00:00Z");

describe("releaseTag.service", () => {
  it("recognises ISO and month-name release tags, rejects others", () => {
    expect(isReleaseTag("2026-07-09")).toBe(true);
    expect(isReleaseTag("July 9")).toBe(true);
    expect(isReleaseTag("July 23")).toBe(true);
    expect(isReleaseTag("Ready2Refine")).toBe(false);
    expect(isReleaseTag("PBTeam")).toBe(false);
    expect(isReleaseTag("Julyish 9")).toBe(false);
  });

  it("classifies current-or-future vs past-only", () => {
    expect(classifyTags(["July 23", "SRE"], NOW)).toEqual({
      hasReleaseTag: true,
      hasCurrentOrFuture: true,
      allPast: false,
    });
    expect(classifyTags(["June 11"], NOW)).toEqual({
      hasReleaseTag: true,
      hasCurrentOrFuture: false,
      allPast: true,
    });
    expect(classifyTags(["Triaged"], NOW)).toEqual({
      hasReleaseTag: false,
      hasCurrentOrFuture: false,
      allPast: false,
    });
  });

  it("returns active release tags within the recency window, sorted", () => {
    const tags = ["June 11", "July 9", "July 23", "Triaged", "2025-12-01"];
    expect(activeReleaseTags(tags, NOW)).toEqual([
      "June 11",
      "July 9",
      "July 23",
    ]);
  });
});
