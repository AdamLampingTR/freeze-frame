import { useMemo, useState } from "react";
import type { FreezeCandidate, FlagStatus, NotifyVia } from "../types";
import { CandidateRow } from "./CandidateRow";

const ORDER: Record<FlagStatus, number> = {
  "bad-state": 0,
  warning: 1,
  ready: 2,
  "no-ticket": 3,
};

export function CandidateList({
  candidates,
  onDismiss,
  onNotify,
  onCopyCherryPick,
}: {
  candidates: FreezeCandidate[];
  onDismiss: (c: FreezeCandidate) => void;
  onNotify: (c: FreezeCandidate, via: NotifyVia) => void;
  onCopyCherryPick: (c: FreezeCandidate) => void;
}) {
  const [filter, setFilter] = useState<"all" | FlagStatus>("all");
  const rows = useMemo(
    () =>
      candidates
        .filter((c) => filter === "all" || c.status === filter)
        .slice()
        .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.repo.localeCompare(b.repo)),
    [candidates, filter],
  );
  return (
    <section>
      <div className="filters">
        {(["all", "bad-state", "warning", "ready"] as const).map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      {rows.map((c) => (
        <CandidateRow
          key={`${c.repo}:${c.key}`}
          c={c}
          onDismiss={onDismiss}
          onNotify={onNotify}
          onCopyCherryPick={onCopyCherryPick}
        />
      ))}
      {rows.length === 0 && <p className="muted">No candidates. ✅</p>}
    </section>
  );
}
