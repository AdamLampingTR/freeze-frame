// Stub — Table Storage skip list, keyed pr:<id> / patch:<hash>.
export interface SkipEntry {
  key: string;
  repo: string;
  dismissedBy: string;
  dismissedAt: string;
  reason: string;
  kind: "permanent" | "hold";
  dismissedForRelease: string;
}
export async function readSkips(): Promise<SkipEntry[]> {
  throw new Error("not implemented: readSkips");
}
