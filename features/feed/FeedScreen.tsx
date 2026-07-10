"use client";

import { usePicks } from "./use-picks";
import { selectPickOfDay } from "./select-pick-of-day";
import { PickCard } from "./PickCard";
import { BottomNav } from "./BottomNav";

export function FeedScreen() {
  const { picks, loading, error } = usePicks();

  let body: React.ReactNode;
  if (loading) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Caricamento dei pick di oggi…</p>;
  } else if (error) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Qualcosa è andato storto. Riprova.</p>;
  } else if (picks.length === 0) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Nessun pick per oggi. Torna più tardi.</p>;
  } else {
    const podId = selectPickOfDay(picks);
    const ordered = podId
      ? [...picks.filter((p) => p.id === podId), ...picks.filter((p) => p.id !== podId)]
      : picks;
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 4px" }}>
        {ordered.map((p) => <PickCard key={p.id} pick={p} pickOfDay={p.id === podId} />)}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--am-bg)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 12px" }}>
        <strong style={{ fontSize: 18, letterSpacing: "-.01em" }}>BetRedge</strong>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--am-muted)" }}>Oggi</span>
      </header>
      <main style={{ flex: 1 }}>{body}</main>
      <footer style={{ padding: "12px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "var(--am-muted-2)", margin: 0 }}>
          18+ · Gioco responsabile. Le previsioni sono stime statistiche del modello, non garanzia di vincita.
        </p>
      </footer>
      <BottomNav active="oggi" />
    </div>
  );
}
