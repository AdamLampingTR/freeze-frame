// Stub — Power Automate webhook. Honors NOTIFY_DRY_RUN.
export async function notify(_commitId: string): Promise<{ sentTo: string[] }> {
  throw new Error("not implemented: notify");
}
