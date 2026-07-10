import { useState } from "react";
import type { FreezeCandidate, SkipKind, SkipReason } from "../types";

const REASONS: SkipReason[] = [
  "reverted",
  "superseded-by-later-commit",
  "held",
  "shipped-elsewhere",
  "not-ready",
];

export function DismissDialog({
  candidate,
  onConfirm,
  onCancel,
}: {
  candidate: FreezeCandidate;
  onConfirm: (body: {
    reason: SkipReason;
    reasonText?: string;
    kind: SkipKind;
  }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<SkipReason>("not-ready");
  const [kind, setKind] = useState<SkipKind>("permanent");
  const [reasonText, setReasonText] = useState("");
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>
          Dismiss{" "}
          {candidate.prId != null
            ? `PR ${candidate.prId}`
            : candidate.commitId.slice(0, 8)}
        </h3>
        <label>
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as SkipReason)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kind
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as SkipKind)}
          >
            <option value="permanent">permanent</option>
            <option value="hold">hold (this release only)</option>
          </select>
        </label>
        <label>
          Note
          <textarea
            rows={5}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() =>
              onConfirm({ reason, kind, reasonText: reasonText || undefined })
            }
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
