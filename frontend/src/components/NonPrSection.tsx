import { useState } from "react";
import type { FreezeCandidate, NotifyVia } from "../types";
import { CandidateRow } from "./CandidateRow";

export function NonPrSection({
  items,
  onDismiss,
  onNotify,
  onCopyCherryPick,
}: {
  items: FreezeCandidate[];
  onDismiss: (c: FreezeCandidate) => void;
  onNotify: (c: FreezeCandidate, via: NotifyVia) => void;
  onCopyCherryPick: (c: FreezeCandidate) => void;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <section className="nonpr">
      <button className="collapse" onClick={() => setOpen((o) => !o)}>
        {open ? "▾" : "▸"} Non-PR / no-ticket ({items.length})
      </button>
      {open &&
        items.map((c) => (
          <CandidateRow
            key={`${c.repo}:${c.key}`}
            c={c}
            onDismiss={onDismiss}
            onNotify={onNotify}
            onCopyCherryPick={onCopyCherryPick}
          />
        ))}
    </section>
  );
}
