import type { FlagStatus } from "../types";
// Stub — rule engine (tag + state + release). Agent implements per rules.config.json.
export function overallStatus(_flags: FlagStatus[]): FlagStatus {
  throw new Error("not implemented: overallStatus");
}
