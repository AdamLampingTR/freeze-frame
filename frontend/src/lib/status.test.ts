import { describe, it, expect } from "vitest";
import { statusColor } from "./status";

describe("statusColor", () => {
  it("maps each status to its color", () => {
    expect(statusColor("ready")).toBe("green");
    expect(statusColor("warning")).toBe("amber");
    expect(statusColor("bad-state")).toBe("red");
    expect(statusColor("no-ticket")).toBe("gray");
  });
});
