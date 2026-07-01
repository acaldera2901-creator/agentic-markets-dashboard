"use client";

// #CARD-REDESIGN-V2 — Scheda info partita "la nostra prediction, evidenziata".
// Presentazionale: riceve dati GIÀ risolti (stringhe/quote) dalla card, così non
// dipende dagli helper interni di app/page.tsx. Icone SVG su misura (no emoji).
// La schedina è componibile lato client: le chip PICK (rec) sono pre-inserite;
// solo le legs con quota reale moltiplicano la quota combinata (i soft = stima).
import { useEffect, useMemo, useState } from "react";
import { MarketIcon } from "./MarketIcon";
import { joinFpWithModel } from "../lib/market-join";
import type { ExtraMarket } from "../lib/poisson-model";

const MARKET_ICON: Record<string, "result" | "goals" | "scorer" | "soft"> = {
  result: "result", goal: "goals", boot: "scorer", flag: "soft",
};

export type MdsChip = {
  id: string;
  mkt: string;
  sel: string;
  prob?: string | null;
  /** true = `prob` è la probabilità IMPLICITA dal mercato (de-vig), non la nostra
   * stima da modello → mostrata con marcatore "mkt" per onestà. */
  probMkt?: boolean;
  q?: number | null;
  value?: string | null;
  est?: boolean;
  rec?: boolean;
};
export type MdsGroup = {
  key: string;
  icon: "result" | "goal" | "boot" | "flag";
  title: string;
  meta?: string;
  src: { kind: "fp" | "us" | "est"; label: string };
  chips: MdsChip[];
  note?: string;
};
export type MdsData = {
  league: string;
  when: string;
  home: string;
  away: string;
  hero: {
    flag: string;
    pick: string;
    read: string;
    confDots: number;
    quotaLabel: string;
    quota: string | null;
    value: string | null;
  };
  groups: MdsGroup[];
  matchUrl: string;
  fpMatchId?: number | null;
  /** our model markets (enrichment.extra_markets) — used to attach a real
   * prediction + edge to every FortunePlay "Altri mercati" outcome we can model. */
  extraMarkets?: ExtraMarket[];
  moreLabel?: string;
  // #MULTIBOOK-1: book disponibili per questa partita (deep-link per-book con stag).
  // Se >1 la bet-bar mostra una CTA per book ("Apri su {book}"); scelta del bookmaker.
  books?: { name: string; matchUrl: string }[];
  labels: {
    schedina: string;
    quotaComb: string;
    quotaOne: string;
    touch: string;
    apri: string;
    apriMulti: string;
    openBook?: string; // "Apri su {book}" (multi-book)
    disc: string;
    side: string;
    selOne: string;
    selMany: string;
  };
};

function Ico({ id }: { id: string }) {
  return (
    <svg className="mds-ico" viewBox="0 0 24 24" aria-hidden="true">
      <use href={`#mds-${id}`} />
    </svg>
  );
}

export function MatchDetailSheet({ data }: { data: MdsData }) {
  // #FORTUNEPLAY-LIVE-ODDS-2: tutti i mercati FortunePlay, fetch SOLO all'apertura
  // (per-partita, cache lato server) → sezione "Altri mercati" collassabile.
  const [extraGroups, setExtraGroups] = useState<MdsGroup[]>([]);
  const [showExtra, setShowExtra] = useState(false);
  useEffect(() => {
    const id = data.fpMatchId;
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/fortuneplay-match?id=${id}`, { credentials: "same-origin" });
        if (!r.ok) return;
        const d = await r.json();
        const mk: Array<{ name: string; line: number | null; outcomes: Array<{ label: string; odds: number }> }> = d.markets ?? [];
        if (!alive || !mk.length) return;
        const iconFor = (n: string): MdsGroup["icon"] =>
          /corner|card|foul/i.test(n) ? "flag" : /goal/i.test(n) ? "goal" : "result";
        // Ogni esito ha una probabilità: modello dove lo abbiamo (gol-derivati) con
        // edge; altrimenti probabilità IMPLICITA di mercato (de-vig delle quote),
        // etichettata come "mkt" (mai spacciata per edge nostro).
        const joined = joinFpWithModel(mk, data.extraMarkets ?? [], data.home, data.away);
        const predBy = new Map<string, { p: number; edge: number | null; source: "model" | "market" }>();
        for (const jm of joined)
          for (const o of jm.outcomes) predBy.set(`${jm.name}|${jm.line}|${o.label}`, { p: o.p, edge: o.edge, source: o.source });
        // Unisci le linee dello stesso mercato (es. Total Goals 0.5/1.5/2.5/…) in UN
        // gruppo: le chip Over/Under di tutte le linee vanno a capo compatte, senza
        // moltiplicare le intestazioni e allungare la scheda.
        const byName = new Map<string, typeof mk>();
        for (const m of mk) {
          const arr = byName.get(m.name);
          if (arr) arr.push(m); else byName.set(m.name, [m]);
        }
        const groups: MdsGroup[] = [...byName.entries()].map(([name, entries], gi) => {
          const multi = entries.length > 1;
          return {
            key: `x-${gi}`,
            icon: iconFor(name),
            title: name + (!multi && entries[0].line != null ? ` ${entries[0].line}` : ""),
            src: { kind: "fp", label: "FortunePlay" },
            chips: entries.flatMap((m, ei) =>
              m.outcomes.map((o, oi) => {
                const pr = predBy.get(`${m.name}|${m.line}|${o.label}`);
                return {
                  id: `x-${gi}-${ei}-${oi}`,
                  mkt: name + (m.line != null ? ` ${m.line}` : ""),
                  sel: o.label,
                  q: o.odds,
                  prob: pr ? `${Math.round(pr.p * 100)}%` : null,
                  probMkt: pr ? pr.source === "market" : false,
                  value: pr && pr.edge != null && pr.edge >= 0.05 ? `+${Math.round(pr.edge * 100)}%` : null,
                };
              })),
          };
        });
        setExtraGroups(groups);
      } catch { /* degrada: nessun mercato extra */ }
    })();
    return () => { alive = false; };
  }, [data.fpMatchId]);

  const poolChips = useMemo(() => [...data.groups, ...extraGroups].flatMap((g) => g.chips), [data.groups, extraGroups]);
  const [selected, setSelected] = useState<string[]>(() => data.groups.flatMap((g) => g.chips).filter((c) => c.rec).map((c) => c.id));

  const legs = selected.map((id) => poolChips.find((c) => c.id === id)).filter(Boolean) as MdsChip[];
  const priced = legs.filter((l) => !l.est && l.q && l.q > 1);
  const combined = priced.reduce((acc, l) => acc * (l.q as number), 1);
  const [expanded, setExpanded] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const ctaLabel = priced.length > 1 ? data.labels.apriMulti : data.labels.apri;
  const countLabel = legs.length === 1 ? data.labels.selOne : data.labels.selMany;

  const renderGroup = (g: MdsGroup) => (
    <div className="mds-grp" key={g.key}>
      <div className="mds-grph">
        <span className="mds-gt"><MarketIcon name={MARKET_ICON[g.icon] ?? "result"} size={18} className="mds-mkico" />{g.title}</span>
        {g.meta && <span className="mds-gmeta">{g.meta}</span>}
        <span className={`mds-src ${g.src.kind}`}>{g.src.label}</span>
      </div>
      <div className="mds-chips">
        {g.chips.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button key={c.id} type="button" className={`mds-chip${c.rec ? " rec" : ""}${on ? " on" : ""}`} onClick={() => toggle(c.id)}>
              {c.rec && <span className="mds-pickbadge"><Ico id="star" />pick</span>}
              {on && <span className="mds-tick"><Ico id="check" /></span>}
              <span className="mds-cl">{c.sel}</span>
              <span className="mds-cm">
                {c.prob && (
                  <span
                    className={`mds-p${c.probMkt ? " mkt" : ""}`}
                    title={c.probMkt ? "Probabilità implicita dal mercato (quote de-viggate) — non è una nostra stima da modello" : "Nostra stima dal modello"}
                  >
                    {c.prob}{c.probMkt ? " mkt" : ""}
                  </span>
                )}
                <span className={`mds-q${c.est ? " est" : ""}`}>{c.est ? "stima" : (c.q ? c.q.toFixed(2) : "–")}</span>
                {c.value && <span className="mds-cv">{c.value}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {g.note && <p className="mds-note">{g.note}</p>}
    </div>
  );

  return (
    <div className="mds">
      <svg className="mds-defs" aria-hidden="true">
        {/* Icon set su misura — Maven Studio (art-director), 2026-07-01. Line-style
            24-grid, stroke ereditato da .mds-ico; star piena (badge PICK). */}
        <defs>
          <symbol id="mds-trophy" viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" /><path d="M12 14v3M9 20h6M10 20a2 2 0 0 1 4 0" /></symbol>
          <symbol id="mds-result" viewBox="0 0 24 24"><path d="M6 3v18" /><path d="M6 4h12v9H6" /><path d="M6 8.5h12M12 4v9" /></symbol>
          <symbol id="mds-goal" viewBox="0 0 24 24"><path d="M4 6h16v12H4Z" /><path d="M4 10h16M4 14h16M8 6v12M12 6v12M16 6v12" strokeWidth="1" /><circle cx="12" cy="14" r="2.2" /></symbol>
          <symbol id="mds-boot" viewBox="0 0 24 24"><path d="M3 8h8l3 3 5 1a3 3 0 0 1 3 3v2H5a2 2 0 0 1-2-2V8Z" /><path d="M6 20v1M10 20v1M14 20v1M18 20v1" /></symbol>
          <symbol id="mds-flag" viewBox="0 0 24 24"><path d="M6 3v18" /><path d="M6 4h11l-3 3.5L17 11H6" /></symbol>
          <symbol id="mds-ticket" viewBox="0 0 24 24"><path d="M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7Z" /><path d="M10 6v2M10 11v2M10 16v2" strokeDasharray="0.1 3.2" /></symbol>
          <symbol id="mds-check" viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 6.5" /></symbol>
          <symbol id="mds-x" viewBox="0 0 24 24"><path d="M6 6 18 18M18 6 6 18" /></symbol>
          <symbol id="mds-chev" viewBox="0 0 24 24"><path d="M6 9.5 12 15.5 18 9.5" /></symbol>
          <symbol id="mds-star" viewBox="0 0 24 24"><path d="M12 3.2l2.55 5.36 5.7.72-4.2 3.98 1.08 5.74L12 16.2l-5.13 2.8 1.08-5.74-4.2-3.98 5.7-.72Z" fill="currentColor" stroke="none" /></symbol>
          <symbol id="mds-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6.5 19 12 13 17.5" /></symbol>
        </defs>
      </svg>

      {/* HERO */}
      <div className="mds-hero">
        <div className="mds-htop">
          <span className="mds-comp"><Ico id="trophy" />{data.league}</span>
          <span className="mds-when">{data.when}</span>
        </div>
        <div className="mds-fx">{data.home}<span className="mds-vs">v</span>{data.away}</div>
        <div className="mds-call">
          <div className="mds-pick">
            <span className="mds-flagtag"><Ico id="star" />{data.hero.flag}</span>
            <span className="mds-pk">{data.hero.pick}</span>
            <span className="mds-rd">{data.hero.read}
              <span className="mds-dots">{[0, 1, 2, 3].map((i) => <span key={i} className={`mds-d${i < data.hero.confDots ? " on" : ""}`} />)}</span>
            </span>
          </div>
          {data.hero.quota && (
            <div className="mds-hq">
              <span className="mds-qlab">{data.hero.quotaLabel}</span>
              <span className="mds-qn">{data.hero.quota}</span>
              {data.hero.value && <span className="mds-val">{data.hero.value}</span>}
            </div>
          )}
        </div>
      </div>

      {/* MARKET GROUPS (modello + FortunePlay base) */}
      {data.groups.map(renderGroup)}

      {/* ALTRI MERCATI FortunePlay (fetch on-open, collassabile) */}
      {extraGroups.length > 0 && (
        <div className="mds-grp mds-more">
          <button type="button" className={`mds-more-btn${showExtra ? " open" : ""}`} onClick={() => setShowExtra((v) => !v)}>
            <span className="mds-gt"><MarketIcon name="betslip" size={18} className="mds-mkico" />{data.moreLabel ?? "Altri mercati FortunePlay"} <span className="mds-more-n">{extraGroups.length}</span></span>
            <span className="mds-chevw"><Ico id="chev" /></span>
          </button>
          {showExtra && <div className="mds-more-body">{extraGroups.map(renderGroup)}</div>}
        </div>
      )}

      {/* STICKY BET BAR */}
      <div className="mds-betbar">
        {expanded && legs.length > 0 && (
          <div className="mds-legs">
            {legs.map((l) => (
              <div className="mds-leg" key={l.id}>
                <div className="mds-ls">
                  <span className="mds-lsel">{l.sel}</span>
                  <span className="mds-lmkt">{l.mkt}</span>
                </div>
                {l.est ? <span className="mds-lq est">STIMA</span> : <span className="mds-lq">{l.q ? l.q.toFixed(2) : "–"}</span>}
                <button type="button" className="mds-rm" aria-label="rimuovi" onClick={() => toggle(l.id)}><Ico id="x" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="mds-bar">
          <button type="button" className={`mds-info${expanded ? " open" : ""}`} onClick={() => legs.length && setExpanded((e) => !e)}>
            <span className="mds-k">{legs.length ? countLabel.replace("{n}", String(legs.length)) : data.labels.schedina}</span>
            <span className="mds-row">
              <span className="mds-cmb">{priced.length ? combined.toFixed(2) : "—"}</span>
              <span className="mds-qsuf">{priced.length ? (priced.length > 1 ? data.labels.quotaComb : data.labels.quotaOne) : data.labels.touch}</span>
              {legs.length > 0 && <span className="mds-chevw"><Ico id="chev" /></span>}
            </span>
          </button>
          {/* #MULTIBOOK-1: una CTA per book se >1 (scelta bookmaker), altrimenti singola */}
          {data.books && data.books.length > 1 ? (
            <div className="mds-ctas">
              {data.books.map((b) => (
                <a
                  key={b.name}
                  className={`mds-cta${legs.length === 0 ? " disabled" : ""}`}
                  href={legs.length ? b.matchUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={legs.length === 0}
                >
                  {(data.labels.openBook ?? "Apri su {book}").replace("{book}", b.name)}<Ico id="arrow" />
                </a>
              ))}
            </div>
          ) : (
            <a
              className={`mds-cta${legs.length === 0 ? " disabled" : ""}`}
              href={legs.length ? data.matchUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={legs.length === 0}
            >
              {ctaLabel}<Ico id="arrow" />
            </a>
          )}
        </div>
        <p className="mds-disc">{data.labels.disc}</p>
      </div>

      <p className="mds-side">{data.labels.side}</p>
    </div>
  );
}
