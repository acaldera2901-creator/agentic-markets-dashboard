"use client";

import { useLeaderboard } from "./use-leaderboard";
import type { LbRow } from "./use-leaderboard";

// CRITICAL: sotto questa soglia la % di sistema è statisticamente inaffidabile — nascondi, non arrotondare.
const MIN_SYSTEM_SETTLED = 30;

function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  return (
    <span
      data-top3={isTop3 ? "true" : undefined}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: "50%",
        fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 800,
        background: isTop3 ? "var(--am-coral)" : "var(--am-panel)",
        color: isTop3 ? "var(--am-bg)" : "var(--am-muted)",
        border: isTop3 ? "none" : "1px solid var(--am-line)",
        flexShrink: 0,
      }}
    >
      {rank}
    </span>
  );
}

function LeaderboardRowItem({ row }: { row: LbRow }) {
  return (
    <div style={{
      background: "var(--am-panel)", border: "1px solid var(--am-line)", borderRadius: 14,
      padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <RankBadge rank={row.rank} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--am-muted)" }}>
          <span>{row.betsWon}/{row.betsTotal}</span>
          {row.hitRate != null && <> · <span>{typeof row.hitRate === "number" ? `${row.hitRate}%` : row.hitRate}</span></>}
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, letterSpacing: "-.02em", color: "var(--am-coral)" }}>
        {row.points}
      </span>
    </div>
  );
}

export function LeaderboardView() {
  const { entries, systemHitRate, systemSettled, loading, error } = useLeaderboard();

  let body: React.ReactNode;
  if (loading) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Caricamento…</p>;
  } else if (error) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Qualcosa è andato storto. Riprova.</p>;
  } else if (entries.length === 0) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Nessun risultato in classifica ancora.</p>;
  } else {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
        {entries.map((row) => <LeaderboardRowItem key={row.rank} row={row} />)}
      </div>
    );
  }

  const showSystemRate = !loading && !error && systemSettled >= MIN_SYSTEM_SETTLED && systemHitRate != null;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--am-bg)" }}>
      <header style={{ padding: "16px 16px 8px", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Classifica</h1>
      </header>

      {!loading && !error && (
        <section style={{
          maxWidth: 480, width: "100%", margin: "0 auto", padding: "8px 16px 18px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 4,
        }}>
          {showSystemRate ? (
            <>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 44, fontWeight: 800, letterSpacing: "-.02em", color: "var(--am-coral)" }}>
                {systemHitRate}%
              </span>
              <span style={{ fontSize: 13, color: "var(--am-muted)" }}>hit-rate di sistema</span>
            </>
          ) : (
            <span style={{ fontSize: 14, color: "var(--am-muted)", padding: "8px 0" }}>
              Dati insufficienti per una percentuale di sistema affidabile.
            </span>
          )}
        </section>
      )}

      <main style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>{body}</main>

      <footer style={{ padding: "12px 16px", textAlign: "center", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: "var(--am-muted-2)", margin: 0 }}>
          18+ · Gioco responsabile. Punti e hit-rate sono statistiche di gioco, non guadagni.
        </p>
      </footer>
    </div>
  );
}
