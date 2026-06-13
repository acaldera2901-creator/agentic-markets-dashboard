"use client";

// #BACKTEST-2025-1 — clearly-labelled 2025 backtest panel. Renders SIMULATION
// results (walk-forward, no look-ahead) served from /api/backtest-2025. Kept
// visually + structurally separate from the live track record.
import { useEffect, useState } from "react";

type FootStats = {
  matches: number; won: number; lost: number; hit_rate: number;
  roi_pct: number | null; avg_clv_pct: number | null; beat_close_pct: number | null;
};
type TenStats = { matches: number; won: number; lost: number; hit_rate: number; brier: number | null };
type Summary = {
  disclaimer: string;
  football: { method: string; overall: FootStats; per_league: Record<string, FootStats>;
    sample: { date: string; competition: string; home: string; away: string; pick: string; result: string; won: boolean; odds: number | null; clv: number | null }[]; };
  tennis: { method: string; overall: TenStats; per_tour: Record<string, TenStats>;
    sample: { date: string; competition: string; tour: string; surface: string; favored: string; winner: string; won: boolean; p_favored: number }[]; };
};

const C = { card: "#15161a", line: "#26282f", sub: "#8b8d96", coral: "#ff5a4d", green: "#3ecf8e", txt: "#e8e8ea" };
const pct = (v: number | null, suffix = "%") => (v == null ? "—" : `${v}${suffix}`);

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", minWidth: 96 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: tone ?? C.txt, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 10, letterSpacing: 1, color: C.sub, textTransform: "uppercase", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function Backtest2025Panel() {
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch("/api/backtest-2025").then((r) => r.json()).then(setData).catch(() => setErr(true));
  }, []);
  if (err) return null;
  if (!data) return null;

  const f = data.football.overall;
  const t = data.tennis.overall;

  return (
    <section style={{ marginTop: 32, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, background: "rgba(255,90,77,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: C.coral, textTransform: "uppercase" }}>
          Backtest 2025
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: C.sub, border: `1px solid ${C.line}`, borderRadius: 99, padding: "2px 8px", textTransform: "uppercase" }}>
          Simulazione
        </span>
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: C.sub, margin: "10px 0 18px", maxWidth: 720 }}>
        {data.disclaimer}
      </p>

      {/* Football */}
      <div style={{ fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 8 }}>
        Calcio · top-5 leghe <span style={{ color: C.sub, fontWeight: 400 }}>({f.matches} match)</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <Stat label="Hit rate" value={pct(f.hit_rate)} tone={C.coral} />
        <Stat label="ROI" value={pct(f.roi_pct)} tone={(f.roi_pct ?? 0) >= 0 ? C.green : C.coral} />
        <Stat label="CLV medio" value={pct(f.avg_clv_pct)} />
        <Stat label="Batte la chiusura" value={pct(f.beat_close_pct)} />
        <Stat label="Vinte / perse" value={`${f.won}/${f.lost}`} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.sub, marginBottom: 18 }}>
        {Object.entries(data.football.per_league).map(([lg, s]) => (
          <span key={lg}>{lg}: <b style={{ color: C.txt }}>{s.hit_rate}%</b> · ROI {pct(s.roi_pct)}</span>
        ))}
      </div>

      {/* Tennis */}
      <div style={{ fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 8 }}>
        Tennis · ATP + WTA <span style={{ color: C.sub, fontWeight: 400 }}>({t.matches} match)</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <Stat label="Hit rate" value={pct(t.hit_rate)} tone={C.coral} />
        <Stat label="Brier" value={t.brier == null ? "—" : String(t.brier)} />
        <Stat label="ROI / CLV" value="N/D" />
        <Stat label="Vinte / perse" value={`${t.won}/${t.lost}`} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.sub, marginBottom: 6 }}>
        {Object.entries(data.tennis.per_tour).map(([tour, s]) => (
          <span key={tour}>{tour}: <b style={{ color: C.txt }}>{s.hit_rate}%</b> · Brier {s.brier}</span>
        ))}
      </div>
      <p style={{ fontSize: 10.5, color: C.sub, marginTop: 14, fontStyle: "italic" }}>
        Metodo: {data.football.method}. Fonte tennis senza quote → ROI/CLV non calcolabili.
      </p>
    </section>
  );
}
