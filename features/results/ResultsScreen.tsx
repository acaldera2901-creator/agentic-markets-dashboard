"use client";

import { TrackRecordView } from "./TrackRecordView";
import { LeaderboardView } from "./LeaderboardView";
import { BottomNav } from "@/features/feed/BottomNav";

export function ResultsScreen() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--am-bg)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 12px", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <strong style={{ fontSize: 18, letterSpacing: "-.01em" }}>BetRedge</strong>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--am-muted)" }}>Risultati</span>
      </header>

      <main style={{ flex: 1, maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--am-muted)", padding: "8px 16px 0" }}>
            Track record
          </h2>
          <TrackRecordView />
        </section>

        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--am-muted)", padding: "8px 16px 0" }}>
            Classifica
          </h2>
          <LeaderboardView />
        </section>
      </main>

      <footer style={{ padding: "12px 16px", textAlign: "center", maxWidth: 480, width: "100%", margin: "0 auto" }}>
        <p style={{ fontSize: 11, color: "var(--am-muted-2)", margin: 0 }}>
          18+ · Gioco responsabile. Le previsioni sono stime statistiche del modello, non garanzia di vincita.
        </p>
      </footer>

      <BottomNav active="risultati" />
    </div>
  );
}
