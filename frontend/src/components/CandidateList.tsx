import { useMemo, useState } from "react";
import type { FreezeCandidate, NotifyVia } from "../types";
import { CandidateRow } from "./CandidateRow";

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
  const [repo, setRepo] = useState<"all" | string>("all");

  const repos = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.repo))).sort(),
    [candidates],
  );

  const rows = useMemo(
    () =>
      candidates
        .filter((c) => repo === "all" || c.repo === repo)
        // Chronological (oldest first) — matches the order commits are applied
        // in a cherry-pick, and gives a stable list that doesn't jump around by
        // severity. ISO date strings sort lexicographically = chronologically.
        .slice()
        .sort((a, b) => a.committedDate.localeCompare(b.committedDate)),
    [candidates, repo],
  );

  return (
    <section>
      {repos.length > 1 && (
        <div className="filters">
          <span className="filter-label">Repo:</span>
          <button className={repo === "all" ? "active" : ""} onClick={() => setRepo("all")}>
            all
          </button>
          {repos.map((r) => (
            <button key={r} className={repo === r ? "active" : ""} onClick={() => setRepo(r)}>
              {r}
            </button>
          ))}
        </div>
      )}
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
