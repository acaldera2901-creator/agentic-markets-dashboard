"use client";

// World Cup slice of the main board. Consumes /api/v2/predictions — the route
// projects per-session server-side (lib/access-projection.ts), so this
// component renders exactly what the viewer is entitled to: locked rows keep
// the same blur + CTA pattern as the main board (classes from globals.css),
// the publication gate stays untouched. Zero new gate logic (Track B promise).
import { useEffect, useState } from "react";
import Link from "next/link";

type ProjectedRow = {
  id: string;
  event_name?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  league?: string | null;
  starts_at?: string | null;
  locked: boolean;
  pick?: string | null;
  market?: string | null;
  confidence_score?: number | null;
  is_paper?: boolean;
  signal_type?: string | null;
};

const kickFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});

export default function WcBoard() {
  const [rows, setRows] = useState<ProjectedRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/v2/predictions?competition=World Cup&sport=football")
      .then((r) => r.json())
      .then((d) => { if (alive) setRows(d.predictions || []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <div className="book-empty">Loading World Cup board…</div>;
  if (!rows.length) {
    return (
      <div className="book-empty">
        First World Cup signals publish when markets open — kickoff June 11.
      </div>
    );
  }

  return (
    <div className="wc-board-grid">
      {rows.map((p) => (
        <div key={p.id} className="glass-card wc-board-card">
          <div className="eyebrow">
            {p.league || "World Cup"}
            {p.is_paper ? " · paper" : ""}
          </div>
          <div className="wc-board-match">
            {p.home_team && p.away_team ? `${p.home_team} vs ${p.away_team}` : p.event_name}
          </div>
          <div className="wc-fixture-meta">
            {p.starts_at ? `${kickFmt.format(new Date(p.starts_at))} UTC` : ""}
          </div>
          {p.locked ? (
            <Link href="/" className="card-lock-overlay wc-lock" role="button">
              <span className="blurred">▒▒ PICK ▒▒▒ · ▒▒%</span>
              <span className="locked-cta">Sign in to reveal pick &amp; confidence</span>
            </Link>
          ) : (
            <div className="wc-board-pick">
              <strong>{p.pick || "—"}</strong>
              {typeof p.confidence_score === "number" ? (
                <span> · confidence {(p.confidence_score * 100).toFixed(0)}%</span>
              ) : null}
              {p.market ? <span className="wc-fixture-meta"> · {p.market}</span> : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
