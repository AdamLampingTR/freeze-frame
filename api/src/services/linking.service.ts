// Commit/PR → work-item linking. Pure subject/PR parsers plus resolveTicketIds
// (added in a later slice), which layers the subject → PR-title/branch → PR-refs
// fallback (first hit wins).

// PR marker: "Merged PR 23521" / "Merged PR #23521" (case-insensitive).
export function parsePrId(subject: string): number | null {
  const m = /Merged PR #?(\d+)/i.exec(subject);
  return m ? Number(m[1]) : null;
}

// ADO work-item ids: "ADO-1137466" / "ADO#1137466" / "ADO 1137466" / "ADO1137466",
// case-insensitive, 6–8 digits. Bare numbers (e.g. "Bug 1137466") are NOT matched.
export function parseAdoIds(text: string): string[] {
  const ids = new Set<string>();
  const re = /ADO[-# ]*(\d{6,8})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) ids.add(m[1]);
  return Array.from(ids).sort();
}
