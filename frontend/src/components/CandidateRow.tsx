import { useState } from "react";
import type { FreezeCandidate, NotifyVia } from "../types";
import { statusDot, statusLabel } from "../lib/status";
import { NotifyMenu } from "./NotifyMenu";

export function CandidateRow({
  c,
  onDismiss,
  onNotify,
  onCopyCherryPick,
}: {
  c: FreezeCandidate;
  onDismiss: (c: FreezeCandidate) => void;
  onNotify: (c: FreezeCandidate, via: NotifyVia) => void;
  onCopyCherryPick: (c: FreezeCandidate) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`row status-${c.status}${c.matchesRelease ? " matches" : ""}`}
      title={c.matchesRelease ? "tagged for the selected release" : undefined}
    >
      <div className="row-main" onClick={() => setOpen((o) => !o)}>
        <span className={`dot ${statusDot(c.status)}`} />
        <span className="badge">{c.repo}</span>
        {c.prId != null ? (
          <span className="pr">PR {c.prId}</span>
        ) : (
          <span className="pr muted">no PR</span>
        )}
        <span className="subj">{c.title}</span>
        {c.releaseTags.map((t) => (
          <span
            key={t}
            className={`reltag${c.matchesRelease ? " reltag-match" : ""}`}
          >
            {t}
          </span>
        ))}
        <span className="flag">{statusLabel(c.status)}</span>
      </div>
      {open && (
        <div className="row-detail">
          <ul className="tickets">
            {c.tickets.map((t) => (
              <li key={t.id} className="ticket">
                <a
                  href={`https://dev.azure.com/tr-core-ai-data-platforms/CoCounsel/_workitems/edit/${t.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  ADO-{t.id}
                </a>{" "}
                <em>{t.workItemType}</em> · {t.state} · {t.title}
                {t.tags.length > 0 && (
                  <span className="tags"> [{t.tags.join(", ")}]</span>
                )}
                {t.viaPr && (
                  <span className="viapr" title="resolved from PR, not commit">
                    via PR
                  </span>
                )}
              </li>
            ))}
            {c.tickets.length === 0 && (
              <li className="muted">No linked work item</li>
            )}
          </ul>
          {c.flags.length > 0 && (
            <ul className="flags">
              {c.flags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <div className="row-actions">
            <button onClick={() => onCopyCherryPick(c)}>
              Copy cherry-pick
            </button>
            <NotifyMenu onNotify={(via) => onNotify(c, via)} />
            <button onClick={() => onDismiss(c)}>Dismiss…</button>
          </div>
        </div>
      )}
    </div>
  );
}
