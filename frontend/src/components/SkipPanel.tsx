import type { SkipEntry } from "../types";

export function SkipPanel({
  skips,
  onUnskip,
}: {
  skips: SkipEntry[];
  onUnskip: (s: SkipEntry) => void;
}) {
  return (
    <section className="skip-panel">
      <h2>Skip list ({skips.length})</h2>
      {skips.length === 0 && <p className="muted">Nothing dismissed.</p>}
      <ul>
        {skips.map((s) => (
          <li key={`${s.repo}:${s.key}`} className={s.orphan ? "orphan" : ""}>
            <span className="badge">{s.repo}</span> <code>{s.key}</code> · {s.reason} · {s.kind} · by{" "}
            {s.dismissedBy} for {s.dismissedForRelease}
            {s.orphan && (
              <span className="orphan-tag" title="already on staging">
                {" "}
                (orphan)
              </span>
            )}
            <button onClick={() => onUnskip(s)}>Un-skip</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
