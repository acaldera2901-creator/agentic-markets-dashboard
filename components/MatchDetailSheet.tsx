"use client";

// #CARD-REDESIGN-V2 — Scheda info partita "la nostra prediction, evidenziata".
// Presentazionale: riceve dati GIÀ risolti (stringhe/quote) dalla card, così non
// dipende dagli helper interni di app/page.tsx. Icone SVG su misura (no emoji).
// La schedina è componibile lato client: le chip PICK (rec) sono pre-inserite;
// solo le legs con quota reale moltiplicano la quota combinata (i soft = stima).
import { useMemo, useState } from "react";

export type MdsChip = {
  id: string;
  mkt: string;
  sel: string;
  prob?: string | null;
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
  labels: {
    schedina: string;
    quotaComb: string;
    quotaOne: string;
    touch: string;
    apri: string;
    apriMulti: string;
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
  const allChips = useMemo(() => data.groups.flatMap((g) => g.chips), [data.groups]);
  const [selected, setSelected] = useState<string[]>(() => allChips.filter((c) => c.rec).map((c) => c.id));

  const legs = selected.map((id) => allChips.find((c) => c.id === id)).filter(Boolean) as MdsChip[];
  const priced = legs.filter((l) => !l.est && l.q && l.q > 1);
  const combined = priced.reduce((acc, l) => acc * (l.q as number), 1);
  const [expanded, setExpanded] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const ctaLabel = priced.length > 1 ? data.labels.apriMulti : data.labels.apri;
  const countLabel = legs.length === 1 ? data.labels.selOne : data.labels.selMany;

  return (
    <div className="mds">
      <svg className="mds-defs" aria-hidden="true">
        <defs>
          <symbol id="mds-trophy" viewBox="0 0 24 24"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" /><path d="M9.5 15h5M12 13v4M9 20h6M10 17h4" /></symbol>
          <symbol id="mds-result" viewBox="0 0 24 24"><path d="M6 3v18" /><path d="M6 4h11l-2.5 3.5L17 11H6" /></symbol>
          <symbol id="mds-goal" viewBox="0 0 24 24"><path d="M3 20V8h18v12" /><path d="M3 13h18M8.5 8v12M15.5 8v12" /></symbol>
          <symbol id="mds-boot" viewBox="0 0 24 24"><path d="M4 6h5l2 5 6 1.2A3 3 0 0 1 20 15v3H4Z" /><path d="M4 18h16" /></symbol>
          <symbol id="mds-flag" viewBox="0 0 24 24"><path d="M6 21V4" /><path d="M6 5c3.5-2 6.5 2 10 0v7c-3.5 2-6.5-2-10 0" /></symbol>
          <symbol id="mds-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>
          <symbol id="mds-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></symbol>
          <symbol id="mds-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
          <symbol id="mds-star" viewBox="0 0 24 24"><path d="M12 3l2.5 5.5L20 9.3l-4 4 1 6-5-2.8L7 19.3l1-6-4-4 5.5-.8Z" fill="currentColor" stroke="none" /></symbol>
          <symbol id="mds-arrow" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></symbol>
          <symbol id="mds-ticket" viewBox="0 0 24 24"><path d="M4 7h16v4a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4Z" /><path d="M13 7v13" /></symbol>
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

      {/* MARKET GROUPS */}
      {data.groups.map((g) => (
        <div className="mds-grp" key={g.key}>
          <div className="mds-grph">
            <span className="mds-gt"><Ico id={g.icon} />{g.title}</span>
            {g.meta && <span className="mds-gmeta">{g.meta}</span>}
            <span className={`mds-src ${g.src.kind}`}>{g.src.label}</span>
          </div>
          <div className="mds-chips">
            {g.chips.map((c) => {
              const on = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`mds-chip${c.rec ? " rec" : ""}${on ? " on" : ""}`}
                  onClick={() => toggle(c.id)}
                >
                  {c.rec && <span className="mds-pickbadge"><Ico id="star" />pick</span>}
                  {on && <span className="mds-tick"><Ico id="check" /></span>}
                  <span className="mds-cl">{c.sel}</span>
                  <span className="mds-cm">
                    {c.prob && <span className="mds-p">{c.prob}</span>}
                    <span className={`mds-q${c.est ? " est" : ""}`}>{c.est ? "stima" : (c.q ? c.q.toFixed(2) : "–")}</span>
                    {c.value && <span className="mds-cv">{c.value}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {g.note && <p className="mds-note">{g.note}</p>}
        </div>
      ))}

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
          <a
            className={`mds-cta${legs.length === 0 ? " disabled" : ""}`}
            href={legs.length ? data.matchUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={legs.length === 0}
          >
            {ctaLabel}<Ico id="arrow" />
          </a>
        </div>
        <p className="mds-disc">{data.labels.disc}</p>
      </div>

      <p className="mds-side">{data.labels.side}</p>
    </div>
  );
}
