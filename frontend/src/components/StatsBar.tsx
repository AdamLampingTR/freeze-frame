import type { Stats } from "../types";

export function StatsBar({ stats }: { stats: Stats }) {
  const items = [
    ["Total", stats.total, "dot-grey"],
    ["Ready", stats.ready, "dot-green"],
    ["Needs tag", stats.warning, "dot-amber"],
    ["Wrong state", stats.badState, "dot-red"],
    ["No ticket", stats.noTicket, "dot-grey"],
  ] as const;
  return (
    <div className="statsbar">
      {items.map(([label, n, dot]) => (
        <div className="stat" key={label}>
          <span className={`dot ${dot}`} /> {label}: <strong>{n}</strong>
        </div>
      ))}
    </div>
  );
}
