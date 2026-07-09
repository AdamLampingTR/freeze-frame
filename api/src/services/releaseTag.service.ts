// Port of Jared's is_release_tag / release-tags.jq — recognise ISO and month-name
// release tags, resolve month-name to nearest year (Dec/Jan wrap), classify current
// vs past, and list active tags within a recency window.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_NAME = new RegExp(`^(${MONTHS.join("|")}) ([0-9]{1,2})$`);
const DAY = 86400_000;

export function isReleaseTag(tag: string): boolean {
  return ISO.test(tag) || MONTH_NAME.test(tag);
}

// Month-name tags carry no year; pick whichever of year-1/year/year+1 is nearest
// to `now` (handles Dec/Jan wraparound). ISO tags resolve directly.
export function resolveEpoch(tag: string, now: Date): number {
  if (ISO.test(tag)) return Date.parse(`${tag}T00:00:00Z`);
  const m = MONTH_NAME.exec(tag);
  if (!m) return NaN;
  const month = MONTHS.indexOf(m[1]); // 0-based
  const day = Number(m[2]);
  const y = now.getUTCFullYear();
  const candidates = [y - 1, y, y + 1].map((yr) =>
    Date.UTC(yr, month, day, 0, 0, 0),
  );
  const t = now.getTime();
  return candidates.reduce((best, c) =>
    Math.abs(c - t) < Math.abs(best - t) ? c : best,
  );
}

export function classifyTags(
  tags: string[],
  now: Date,
): { hasReleaseTag: boolean; hasCurrentOrFuture: boolean; allPast: boolean } {
  const releaseTags = tags.filter(isReleaseTag);
  if (releaseTags.length === 0) {
    return { hasReleaseTag: false, hasCurrentOrFuture: false, allPast: false };
  }
  // "current" = today or later, with a one-day grace so a tag dated today counts.
  const cutoff = now.getTime() - DAY;
  const hasCurrentOrFuture = releaseTags.some(
    (t) => resolveEpoch(t, now) >= cutoff,
  );
  return {
    hasReleaseTag: true,
    hasCurrentOrFuture,
    allPast: !hasCurrentOrFuture,
  };
}

// Active release tags within the recency window, deduped by resolved date so a
// single freeze tagged in both forms (`2026-07-23` and `July 23`) collapses to
// one picker option. Keeps the first-seen spelling for each date.
export function activeReleaseTags(tags: string[], now: Date): string[] {
  const t = now.getTime();
  const byEpoch = new Map<number, string>();
  for (const tag of tags) {
    if (!isReleaseTag(tag)) continue;
    const epoch = resolveEpoch(tag, now);
    const delta = epoch - t;
    if (delta > -45 * DAY && delta < 60 * DAY && !byEpoch.has(epoch)) {
      byEpoch.set(epoch, tag);
    }
  }
  return Array.from(byEpoch.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, tag]) => tag);
}

// True iff two release tags name the same freeze (same resolved date), robust
// to ISO vs month-name spelling.
export function sameRelease(a: string, b: string, now: Date): boolean {
  if (!isReleaseTag(a) || !isReleaseTag(b)) return false;
  return resolveEpoch(a, now) === resolveEpoch(b, now);
}
