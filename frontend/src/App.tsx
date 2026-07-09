import { useCallback, useEffect, useState } from "react";
import type {
  CandidatesResponse,
  FreezeCandidate,
  NotifyVia,
  SkipEntry,
  SkipKind,
  SkipReason,
} from "./types";
import * as api from "./api/client";
import { StatsBar } from "./components/StatsBar";
import { ReleasePicker } from "./components/ReleasePicker";
import { CandidateList } from "./components/CandidateList";
import { NonPrSection } from "./components/NonPrSection";
import { SkipPanel } from "./components/SkipPanel";
import { DismissDialog } from "./components/DismissDialog";
import "./index.css";

export function App() {
  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [skips, setSkips] = useState<SkipEntry[]>([]);
  const [release, setRelease] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<FreezeCandidate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async (rel?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [c, s] = await Promise.all([api.getCandidates(rel), api.getSkips()]);
      setData(c);
      setSkips(s);
      if (!rel && c.release) setRelease(c.release);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCopyCherryPick = (c: FreezeCandidate) => {
    void navigator.clipboard?.writeText(api.cherryPickCommand([c]));
    setToast("Cherry-pick command copied");
  };
  const onNotify = async (c: FreezeCandidate, via: NotifyVia) => {
    try {
      await api.notify(c.key, via);
      setToast(`Notified via ${via}`);
    } catch (e) {
      setToast(`Notify failed: ${(e as Error).message}`);
    }
  };
  const onConfirmDismiss = async (body: {
    reason: SkipReason;
    reasonText?: string;
    kind: SkipKind;
  }) => {
    if (!dismissing) return;
    await api.dismiss(dismissing.key, { ...body, release });
    setDismissing(null);
    await refresh(release);
  };
  const onUnskip = async (s: SkipEntry) => {
    await api.unskip(s.repo, s.key);
    await refresh(release);
  };

  return (
    <main>
      <header>
        <h1>FreezeFrame</h1>
        <ReleasePicker
          releases={data?.availableReleases ?? []}
          value={release}
          onChange={(r) => {
            setRelease(r);
            void refresh(r);
          }}
        />
        <button onClick={() => void refresh(release)} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>
      {error && <p className="error">⚠️ {error}</p>}
      {data && <StatsBar stats={data.stats} />}
      {data && (
        <CandidateList
          candidates={data.candidates}
          onDismiss={setDismissing}
          onNotify={onNotify}
          onCopyCherryPick={onCopyCherryPick}
        />
      )}
      {data && (
        <NonPrSection
          items={data.noTicket}
          onDismiss={setDismissing}
          onNotify={onNotify}
          onCopyCherryPick={onCopyCherryPick}
        />
      )}
      <SkipPanel skips={skips} onUnskip={onUnskip} />
      {dismissing && (
        <DismissDialog
          candidate={dismissing}
          onConfirm={onConfirmDismiss}
          onCancel={() => setDismissing(null)}
        />
      )}
      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </main>
  );
}
