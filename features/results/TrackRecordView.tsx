"use client";

import { useTrackRecord } from "./use-track-record";
import type { TrackRow } from "./use-track-record";
import { Crest, SportIcon } from "@/components/ui";
import { OutcomeBadge } from "@/features/feed/PickCard";

function kickoffLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
}

function TrackRowItem({ row }: { row: TrackRow }) {
  return (
    <div style={{
      background: "var(--am-panel)", border: "1px solid var(--am-line)", borderRadius: 14,
      padding: "13px 14px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted)" }}>
          <SportIcon sport={row.sport} /> {row.competition} · {kickoffLabel(row.kickoff)}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <Crest team={row.homeTeam} sport={row.sport} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{row.homeTeam}</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted-2)" }}>VS</span>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{row.awayTeam}</span>
          <Crest team={row.awayTeam} sport={row.sport} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        {row.finalScore && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, letterSpacing: "-.02em" }}>
            {row.finalScore}
          </span>
        )}
        {row.result && <OutcomeBadge result={row.result} />}
      </div>

      {!row.locked && row.decision ? (
        <div style={{ fontSize: 13, color: "var(--am-muted)" }}>
          Pronostico: <strong style={{ color: "var(--am-text)" }}>{row.decision}</strong>
        </div>
      ) : row.locked ? (
        <div style={{ fontSize: 12, color: "var(--am-muted)" }}>
          <span aria-hidden="true">🔒</span> Sblocca per vedere il pronostico.
        </div>
      ) : null}
    </div>
  );
}

export function TrackRecordView() {
  const { history, stats, loading, error } = useTrackRecord();

  let body: React.ReactNode;
  if (loading) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Caricamento…</p>;
  } else if (error) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Qualcosa è andato storto. Riprova.</p>;
  } else if (history.length === 0) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Nessun risultato ancora.</p>;
  } else {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 4px" }}>
        {history.map((row) => <TrackRowItem key={row.id} row={row} />)}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--am-bg)" }}>
      <header style={{ padding: "16px 16px 8px", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>
          Come sono andati i nostri pronostici — risultati reali, niente cherry-picking
        </h1>
      </header>

      {!loading && !error && (
        <section style={{
          maxWidth: 480, width: "100%", margin: "0 auto", padding: "8px 16px 18px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 4,
        }}>
          {stats && stats.winRate ? (
            <>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 44, fontWeight: 800, letterSpacing: "-.02em", color: "var(--am-coral)" }}>
                {stats.winRate}
              </span>
              <span style={{ fontSize: 13, color: "var(--am-muted)" }}>
                {stats.total} pick conclusi · {stats.won} corretti
              </span>
            </>
          ) : (
            <span style={{ fontSize: 14, color: "var(--am-muted)", padding: "8px 0" }}>
              Ancora pochi risultati per una percentuale affidabile.
            </span>
          )}
        </section>
      )}

      <main style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>{body}</main>

      <footer style={{ padding: "12px 16px", textAlign: "center", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: "var(--am-muted-2)", margin: 0 }}>
          18+ · Gioco responsabile. Le previsioni sono stime statistiche del modello, non garanzia di vincita.
        </p>
      </footer>
    </div>
  );
}
