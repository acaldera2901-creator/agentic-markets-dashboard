"use client";

// World Cup slice of the main board, at parity with the home card. Consumes
// /api/v2/predictions — the route projects per-session server-side
// (lib/access-projection.ts), so this component renders exactly what the viewer
// is entitled to: anonymous gets the blurred lock + CTA, base/free-PotD gets the
// pick + why, premium additionally gets the Deep Analysis panel (form, venue,
// squad, lambdas, market). Zero new gate logic — every field arrives already
// projected; missing fields just don't render (fail-soft).
import { useEffect, useState } from "react";
import Link from "next/link";

type WcEnrichment = {
  kind?: string;
  form_home?: { w: number; d: number; l: number; gf: number; ga: number; last?: string[]; played?: number } | null;
  form_away?: { w: number; d: number; l: number; gf: number; ga: number; last?: string[]; played?: number } | null;
  venue?: {
    travel_km_home?: number | null; travel_km_away?: number | null;
    rest_days_home?: number | null; rest_days_away?: number | null;
    tz_shift_home?: number | null; tz_shift_away?: number | null;
    host_advantage?: string | null;
  } | null;
  squad?: {
    injuries_home?: string[]; injuries_away?: string[];
    revealed_home?: boolean; revealed_away?: boolean;
  } | null;
  lambdas?: { home?: number | null; away?: number | null } | null;
  matches?: { home?: number | null; away?: number | null } | null;
  market?: { p_home?: number; p_draw?: number; p_away?: number } | null;
  group?: string | null;
  model?: string | null;
};

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
  edge_percent?: number | null;    // paid-tier; real only for promoted signal rows
  explanation?: string | null;
  notes?: string | null;           // JSON: { p_home, p_draw, p_away, odds_home?, odds_draw?, odds_away? }
  enrichment?: WcEnrichment | null; // premium-only (projection-gated)
  // Real affiliate target attached by withAffiliate on unlocked rows.
  affiliate?: { url: string; bookmaker?: string; bonus?: string } | null;
};

const kickFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});

type WcProbs = {
  home: number; draw: number; away: number;
  odds_home: number | null; odds_draw: number | null; odds_away: number | null;
};

function parseProbs(notes?: string | null): WcProbs | null {
  if (!notes) return null;
  try {
    const n = JSON.parse(notes);
    if (typeof n.p_home === "number" && typeof n.p_draw === "number" && typeof n.p_away === "number") {
      return {
        home: n.p_home, draw: n.p_draw, away: n.p_away,
        // Real 3-way market odds only present on rows with a matched market.
        odds_home: typeof n.odds_home === "number" ? n.odds_home : null,
        odds_draw: typeof n.odds_draw === "number" ? n.odds_draw : null,
        odds_away: typeof n.odds_away === "number" ? n.odds_away : null,
      };
    }
  } catch {
    /* fail-soft */
  }
  return null;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmtForm = (f?: { w: number; d: number; l: number } | null) =>
  f ? `${f.w}W-${f.d}D-${f.l}L` : null;

function ProbRow({ label, value, picked, odds }: { label: string; value: number; picked: boolean; odds?: number | null }) {
  return (
    <div className={`wc-prob-row${picked ? " picked" : ""}`}>
      <span className="wc-prob-label">{label}</span>
      <div className="wc-prob-bar">
        <div className="wc-prob-fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="wc-prob-pct">{pct(value)}</span>
      {typeof odds === "number" && (
        <span className="wc-prob-pct" style={{ opacity: 0.6, minWidth: "3.2em" }}>@{odds.toFixed(2)}</span>
      )}
    </div>
  );
}

function DeepAnalysis({ e, home, away }: { e: WcEnrichment; home: string; away: string }) {
  const v = e.venue || {};
  const sq = e.squad || {};
  const injH = sq.injuries_home?.length ?? 0;
  const injA = sq.injuries_away?.length ?? 0;
  const hasTravel =
    typeof v.travel_km_home === "number" || typeof v.travel_km_away === "number";
  const hasRest =
    typeof v.rest_days_home === "number" || typeof v.rest_days_away === "number";

  return (
    <div className="deep-analysis-panel">
      <div className="da-header">
        <span className="da-badge">⚡ Pro</span>
        <span className="da-title">Deep Analysis</span>
      </div>
      {(e.form_home || e.form_away) && (
        <div className="da-row">
          <span className="da-label">📈 Form</span>
          <span className="da-value">
            {home.split(" ")[0]} {fmtForm(e.form_home) ?? "–"} · {away.split(" ")[0]} {fmtForm(e.form_away) ?? "–"}
          </span>
        </div>
      )}
      {(typeof e.lambdas?.home === "number" || typeof e.lambdas?.away === "number") && (
        <div className="da-row">
          <span className="da-label">λ xG rate</span>
          <span className="da-value">
            {e.lambdas?.home?.toFixed(2) ?? "–"} vs {e.lambdas?.away?.toFixed(2) ?? "–"}
          </span>
        </div>
      )}
      {hasTravel && (
        <div className="da-row">
          <span className="da-label">✈️ Travel</span>
          <span className="da-value">
            {typeof v.travel_km_home === "number" ? `${v.travel_km_home}km` : "–"} vs{" "}
            {typeof v.travel_km_away === "number" ? `${v.travel_km_away}km` : "–"}
          </span>
        </div>
      )}
      {hasRest && (
        <div className="da-row">
          <span className="da-label">🛌 Rest</span>
          <span className="da-value">
            {typeof v.rest_days_home === "number" ? `${v.rest_days_home}d` : "–"} vs{" "}
            {typeof v.rest_days_away === "number" ? `${v.rest_days_away}d` : "–"}
          </span>
        </div>
      )}
      {v.host_advantage && (
        <div className="da-row">
          <span className="da-label">🏟️ Host edge</span>
          <span className="da-value">{v.host_advantage}</span>
        </div>
      )}
      {(injH > 0 || injA > 0) && (
        <div className="da-row">
          <span className="da-label">🚑 Injuries</span>
          <span className="da-value">H:{injH} · A:{injA}</span>
        </div>
      )}
      {e.market && typeof e.market.p_home === "number" && (
        <div className="da-row">
          <span className="da-label">💹 Market</span>
          <span className="da-value">
            H:{pct(e.market.p_home)} D:{pct(e.market.p_draw ?? 0)} A:{pct(e.market.p_away ?? 0)}
          </span>
        </div>
      )}
      {(typeof e.matches?.home === "number" || typeof e.matches?.away === "number") && (
        <div className="da-row">
          <span className="da-label">🗃️ Sample</span>
          <span className="da-value">
            {e.matches?.home ?? "–"} vs {e.matches?.away ?? "–"} matches
          </span>
        </div>
      )}
    </div>
  );
}

function WcCard({ p }: { p: ProjectedRow }) {
  const [showWhy, setShowWhy] = useState(false);
  const home = p.home_team || "Home";
  const away = p.away_team || "Away";
  const probs = parseProbs(p.notes);
  const pick = p.pick || null;
  const isSignal = p.signal_type === "signal";
  const model = p.enrichment?.model || "Poisson";
  const e = p.enrichment;
  const lambdas = e?.lambdas;
  const matches = e?.matches;
  const hasWhyExtras = Boolean(
    e && (e.form_home || e.form_away ||
      typeof lambdas?.home === "number" || typeof lambdas?.away === "number" ||
      typeof matches?.home === "number" || typeof matches?.away === "number")
  );

  return (
    <div className="glass-card wc-board-card">
      {/* Header — World Cup badge mirrors the football league badge */}
      <div className="eyebrow">
        World Cup
        {p.league && p.league !== "World Cup" ? ` · ${p.league}` : ""}
        {p.is_paper ? " · paper" : ""}
      </div>
      <div className="wc-board-match">
        {p.home_team && p.away_team ? `${home} vs ${away}` : p.event_name}
      </div>
      <div className="wc-fixture-meta">
        {p.starts_at ? `${kickFmt.format(new Date(p.starts_at))} UTC` : ""}
        {/* #LIVE-1: match in corso — la card resta visibile fino al settlement */}
        {p.starts_at && new Date(p.starts_at).getTime() < Date.now() && (
          <span style={{ marginLeft: 8, color: "#f87171" }}>● LIVE</span>
        )}
      </div>

      {p.locked ? (
        <Link href="/" className="card-lock-overlay wc-lock" role="button">
          <span className="blurred">▒▒ PICK ▒▒▒ · ▒▒%</span>
          <span className="locked-cta">Sign in to reveal pick &amp; confidence</span>
        </Link>
      ) : (
        <>
          {/* Probability bars — 3-way with real market odds when present */}
          {probs && (
            <div className="wc-prob-block">
              <ProbRow label="HOME" value={probs.home} picked={pick === "HOME"} odds={probs.odds_home} />
              <ProbRow label="DRAW" value={probs.draw} picked={pick === "DRAW"} odds={probs.odds_draw} />
              <ProbRow label="AWAY" value={probs.away} picked={pick === "AWAY"} odds={probs.odds_away} />
            </div>
          )}

          {/* Pick + confidence */}
          <div className="wc-board-pick">
            <strong>{pick || "—"}</strong>
            {typeof p.confidence_score === "number" ? (
              <span> · confidence {Math.round(p.confidence_score)}%</span>
            ) : null}
          </div>

          {/* Footer — Why toggle · model · edge (signal rows only) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", paddingTop: "0.4rem", borderTop: "1px solid rgba(255,255,255,0.06)", fontFamily: "monospace", fontSize: "0.7rem" }}>
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}
            >
              {showWhy ? "Hide why" : "Why"}
            </button>
            <span style={{ opacity: 0.45 }}>{model}</span>
            {isSignal && typeof p.edge_percent === "number" ? (
              <span style={{ padding: "0.1rem 0.4rem", borderRadius: "0.35rem", border: "1px solid", borderColor: p.edge_percent > 0 ? "rgba(74,222,128,0.4)" : "rgba(148,163,184,0.3)", color: p.edge_percent > 0 ? "#4ade80" : "#94a3b8" }}>
                {p.edge_percent > 0 ? "+" : ""}{p.edge_percent.toFixed(1)}%
              </span>
            ) : pick && probs ? (
              <span style={{ padding: "0.1rem 0.4rem", borderRadius: "0.35rem", border: "1px solid rgba(148,163,184,0.3)", color: "#94a3b8" }}>
                {pct(probs[pick.toLowerCase() as "home" | "draw" | "away"])}
              </span>
            ) : null}
          </div>

          {/* Place Bet — same behavior as the football card on the home
              board: routes to the Partners tab (the home's onBetNow does
              setTab("partners")). When a real affiliate link exists on the
              row it wins; otherwise the deep-link. Never a fake target. */}
          <a
            href={p.affiliate?.url || "/?tab=partners"}
            {...(p.affiliate?.url
              ? { target: "_blank", rel: "nofollow sponsored noopener" }
              : {})}
            style={{
              display: "block", width: "100%", marginTop: "0.35rem", padding: "0.45rem 0",
              borderRadius: "0.55rem", border: "1px solid rgba(74,222,128,0.3)",
              background: "rgba(74,222,128,0.08)", color: "#4ade80", textAlign: "center",
              fontFamily: "monospace", fontSize: "0.72rem", letterSpacing: "0.06em",
              textDecoration: "none",
            }}
          >
            Place Bet →
          </a>

          {/* Inline Why — real explanation + enrichment-derived rows */}
          {showWhy && (p.explanation || hasWhyExtras) && (
            <div style={{ paddingTop: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {p.explanation && <p className="wc-why">{p.explanation}</p>}
              {e && (e.form_home || e.form_away) && (
                <div className="da-row">
                  <span className="da-label">📈 Form</span>
                  <span className="da-value">{home.split(" ")[0]} {fmtForm(e.form_home) ?? "–"} · {away.split(" ")[0]} {fmtForm(e.form_away) ?? "–"}</span>
                </div>
              )}
              {(typeof lambdas?.home === "number" || typeof lambdas?.away === "number") && (
                <div className="da-row">
                  <span className="da-label">λ xG rate</span>
                  <span className="da-value">{lambdas?.home?.toFixed(2) ?? "–"} vs {lambdas?.away?.toFixed(2) ?? "–"}</span>
                </div>
              )}
              {(typeof matches?.home === "number" || typeof matches?.away === "number") && (
                <div className="da-row">
                  <span className="da-label">🗃️ Sample</span>
                  <span className="da-value">{matches?.home ?? "–"} vs {matches?.away ?? "–"} matches</span>
                </div>
              )}
            </div>
          )}

          {/* Deep Analysis — premium-only (projection-gated) */}
          {e ? (
            <DeepAnalysis e={e} home={home} away={away} />
          ) : (
            <div className="deep-analysis-locked">
              <span>⚡</span>
              <span>Deep analysis available with Signal Desk Pro (49.50 USDT/month)</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function WcBoard() {
  const [rows, setRows] = useState<ProjectedRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/v2/predictions?competition=World Cup&sport=football", {
      credentials: "same-origin",
    })
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
      {rows.map((p) => <WcCard key={p.id} p={p} />)}
    </div>
  );
}
