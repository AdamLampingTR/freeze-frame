import { describe, it, expect } from "vitest";
import { statusColor, statusLabel, statusDot, combinedStatusLabel } from "./status";

describe("statusColor", () => {
  it("maps each status to its color", () => {
    expect(statusColor("ready")).toBe("green");
    expect(statusColor("warning")).toBe("amber");
    expect(statusColor("bad-state")).toBe("red");
    expect(statusColor("no-ticket")).toBe("gray");
  });
});

describe("statusLabel / statusDot", () => {
  it("maps status to a human label and dot class", () => {
    expect(statusLabel("bad-state")).toBe("Wrong state");
    expect(statusLabel("ready")).toBe("Ready");
    expect(statusDot("ready")).toBe("dot-green");
    expect(statusDot("bad-state")).toBe("dot-red");
  });
});

describe("combinedStatusLabel", () => {
  it("joins multiple statuses, worst first", () => {
    expect(combinedStatusLabel(["bad-state", "warning"])).toBe(
      "Wrong state / Needs tag",
    );
  });
  it("returns the single label when only one status applies", () => {
    expect(combinedStatusLabel(["ready"])).toBe("Ready");
  });
});
