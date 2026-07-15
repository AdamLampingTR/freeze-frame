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

export function statusLabel(status: FlagStatus): string {
  return {
    ready: "Ready",
    warning: "Needs tag",
    "bad-state": "Wrong state",
    "no-ticket": "No ticket",
  }[status];
}

export function statusDot(status: FlagStatus): string {
  return {
    ready: "dot-green",
    warning: "dot-amber",
    "bad-state": "dot-red",
    "no-ticket": "dot-grey",
  }[status];
}

export function combinedStatusLabel(statuses: FlagStatus[]): string {
  return statuses.map(statusLabel).join(" / ");
}
