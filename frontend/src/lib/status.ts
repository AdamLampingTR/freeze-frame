import type { FlagStatus } from "../types";

export function statusColor(status: FlagStatus): string {
  switch (status) {
    case "ready":
      return "green";
    case "warning":
      return "amber";
    case "bad-state":
      return "red";
    case "no-ticket":
      return "gray";
  }
}
