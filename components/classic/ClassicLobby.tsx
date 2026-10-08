"use client";
// components/classic/ClassicLobby.tsx — filone «classic», lobby (#CLASSIC-LOBBY-1008)
//
// La Home in stile Roobet — la STRUTTURA, non il brand. Dall'alto:
//   1. tre banner (i nostri tre ingressi: board, live, storico);
//   2. la barra di tab (Featured · In-Play · Starting Soon · All Sports) con la
//      ricerca a destra;
//   3. la striscia degli sport (Popular, Football, Tennis: quelli che il
//      prodotto serve, niente sport finti per riempire la riga);
//   4. la fascia «in evidenza», un carosello orizzontale di schede;
//   5. «Where our estimate differs most» (l'ex «Top opportunities», con la
//      protezione dei 15 punti);
//   6. le partite per CATEGORIA: sport → lega, gruppi ripiegabili.
//
// SEPARAZIONE SENZA CORNICI. Nessun bordo, nessuna ombra: i blocchi si
// staccano con lo spazio e con due toni di fondo (pagina `--am-bg` < barra e
// intestazioni di lega `--am-panel`), e la scheda è la lastra blu. È la
// regola 1 di REGOLE-CLASSIC.md e il modo in cui Roobet e Stake separano.
//
// RAIL SINISTRO (stile Stake) — NON c'è, per scelta: la barra alta del sito
// ha già Home · Live · Football · Tennis · Tools, e questa lobby aggiunge tab
// e striscia sport. Un rail sarebbe la QUARTA via parallela per la stessa
// scelta con due soli sport: è esattamente ciò che refs/STRUTTURA-BIG.md (f)
// segnala come confuso su Stake.
//
// LA SCHEDA. Non è di questo file: arriva da `renderCard`, cioè la funzione
// della lobby di oggi (app/app/page.tsx → HomeLobby) che monta PredictionCard
// con il suo gating, la watchlist e l'apertura della scheda partita. È il
// punto di unione con il filone `card` (direzione A «Slab»): quando la card
// cambia, qui non cambia niente.

import { useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import type { LobbyItem, LobbySectionId } from "@/lib/ui/lobby";
import {
  dedupeLobby, differsMostItems, featuredItems, groupBySportLeague, matchesDateFilter, matchesQuery, scopeLobby,
  UNNAMED_LEAGUE, type DateFilter, type LeagueCountry, type LobbyTab, type SportFilter,
} from "@/lib/classic/lobby-model";
import { differsBy, footballBooks } from "@/lib/classic/card-view";
import { abbinaQuotaPartner } from "@/lib/fp-odds-join";
import { useClassicPrices } from "@/components/classic/ClassicContext";
import { classicCopy, fill, type ClassicCopy } from "@/lib/classic/lobby-copy";
import { ClassicBanners, type ClassicBanner } from "@/components/classic/ClassicBanners";
import { IconChevronDown, IconChevronRight, IconClose, IconFootball, IconSearch, IconStar, IconTennis } from "@/components/ui/icons";
import "./classic-lobby.css";

export type ClassicLobbyProps = {
  lang: string;
  tz: string;
  football: LobbyItem[];
  tennis: LobbyItem[];
  /** True finché il board non è arrivato: la lobby tiene la sua geometria e
   *  dice che sta caricando, invece di dire «nessuna partita». */
  loading?: boolean;
  /** La scheda di oggi (HomeLobby.renderCard). Il secondo argomento è la
   *  fascia di provenienza: decide il badge «Starts in…» e il tracking. */
  renderCard: (item: LobbyItem, section: LobbySectionId) => ReactNode;
  banners: { board: Pick<ClassicBanner, "href" | "onClick" | "image">; live: Pick<ClassicBanner, "href" | "onClick" | "image">; record: Pick<ClassicBanner, "href" | "onClick" | "image"> };
  /** Ciò che chiude la Home (fascia Pro, FAQ): lo decide il desk. */
  tail?: ReactNode;
  /** Per i test: l'ora «adesso». */
  now?: number;
  /** #CLASSIC-INT-1008 — la ricerca è controllata dal desk (la stessa query
   *  della topbar, che sulla Home a flag acceso non c'è): una sola fonte.
   *  Senza, la lobby tiene la sua (test, uso isolato). */
  query?: string;
  onQueryChange?: (q: string) => void;
};

/** Quanti gruppi di lega restano aperti per sport al primo render. Il resto è
 *  una pila di intestazioni — nome, paese, contatore — che si scorre in un
 *  colpo d'occhio e si apre a richiesta (Stake fa lo stesso nel rail). */
const OPEN_PER_SPORT = 3;

function countryLabel(c: LeagueCountry | null, lang: string, copy: ClassicCopy): string | null {
  if (!c) return null;
  if ("key" in c) return copy[c.key];
  try {
    return new Intl.DisplayNames([lang, "en"], { type: "region" }).of(c.iso) ?? c.iso;
  } catch {
    return c.iso;
  }
}

/** La sigla del fuso («CEST», «GMT+2»), per dichiarare UN fuso per la vista. */
function tzAbbr(tz: string, lang: string, now: number): string {
  try {
    const part = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : lang, { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date(now)).find((p) => p.type === "timeZoneName");
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

const TABS: { id: LobbyTab; key: keyof ClassicCopy }[] = [
  { id: "featured", key: "tabFeatured" },
  { id: "inplay", key: "tabInPlay" },
  { id: "soon", key: "tabSoon" },
  { id: "all", key: "tabAll" },
];

export function ClassicLobby({ lang, tz, football, tennis, loading = false, renderCard, banners, tail, now: nowProp, query: queryProp, onQueryChange }: ClassicLobbyProps) {
  const copy = classicCopy(lang);
  const [tab, setTab] = useState<LobbyTab>("featured");
  const [sport, setSport] = useState<SportFilter>("popular");
  const [when, setWhen] = useState<DateFilter>("all");
  const [ownQuery, setOwnQuery] = useState("");
  const controlled = onQueryChange != null;
  const query = controlled ? (queryProp ?? "") : ownQuery;
  const setQuery = controlled ? onQueryChange : setOwnQuery;
  // Chi scrive nella topbar da un'altra tab viene portato sulla Home (page.tsx),
  // dove quel campo non c'è: il campo si smonta e il fuoco cade sul <body>.
  // Qui lo si riprende, così si continua a scrivere senza perdere il filo. Un
  // ritorno alla Home da un clic in nav lascia il fuoco sul bottone: niente furto.
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = searchRef.current;
    if (el && el.value && document.activeElement === document.body) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);
  // Aperto/chiuso deciso dall'utente, per id di gruppo. Chi non c'è segue la
  // regola di default (i primi OPEN_PER_SPORT aperti).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  // «Adesso» si fissa al montaggio e si aggiorna ogni minuto: `Date.now()`
  // dentro un useMemo è impuro (il compilatore React lo rifiuta) e farebbe
  // cambiare i gruppi a ogni render.
  const [tick, setTick] = useState(() => nowProp ?? Date.now());
  useEffect(() => {
    if (nowProp != null) return;
    const id = window.setInterval(() => setTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [nowProp]);
  const now = nowProp ?? tick;

  // #CLASSIC-FIX2-1008 (A1) — una riga per partita: coppia non ordinata ±48 h (tennis ±36 h).
  const all = useMemo(() => dedupeLobby([...football, ...tennis]), [football, tennis]);
  const searched = useMemo(() => all.filter((it) => matchesQuery(it, query)), [all, query]);

  // I contatori della striscia contano ciò che la tab attiva mostrerebbe, con
  // LO STESSO filtro della lista (#CLASSIC-FIX2-1008 A3: scopeLobby). «All
  // Sports» è l'elenco intero: lì «Popular» non restringe.
  const scoped = useMemo(() => scopeLobby(searched, tab, sport, now), [searched, tab, sport, now]);
  const sportCounts = scoped.counts;
  const hiddenByPopular = tab !== "all" ? scoped.hidden : 0;
  const tabScoped = scoped.list;
  const sportScoped = tabScoped;
  const dateFilterOn = tab === "featured" || tab === "all";
  const listed = useMemo(
    () => (dateFilterOn ? tabScoped.filter((it) => matchesDateFilter(it, when, tz, now)) : tabScoped),
    [tabScoped, dateFilterOn, when, tz, now],
  );
  const blocks = useMemo(() => groupBySportLeague(listed), [listed]);

  const featured = useMemo(() => (tab === "featured" ? featuredItems(sportScoped, now) : []), [tab, sportScoped, now]);
  // #CLASSIC-FIX2-1008 (M2) — lo scarto della fascia è quello che la scheda mostra: con le
  // stesse quote partner della Slab (nessuna, dove i link sono bloccati).
  const prices = useClassicPrices();
  const differs = useMemo(() => {
    if (tab !== "featured") return [];
    const gapOf = (it: LobbyItem) => {
      const fp = prices.booksBlocked ? null : abbinaQuotaPartner(it.data.home, it.data.away, it.data.startsAt, prices.fpOdds, prices.fpIndex).quota;
      return differsBy(it.data, footballBooks(fp, it.data.home, it.data.away));
    };
    return differsMostItems(sportScoped, now, undefined, gapOf);
  }, [tab, sportScoped, now, prices]);

  const whenCounts = useMemo(() => ({
    all: tabScoped.length,
    live: tabScoped.filter((it) => matchesDateFilter(it, "live", tz, now)).length,
    today: tabScoped.filter((it) => matchesDateFilter(it, "today", tz, now)).length,
    tomorrow: tabScoped.filter((it) => matchesDateFilter(it, "tomorrow", tz, now)).length,
  }), [tabScoped, tz, now]);

  // ── Tab: pattern ARIA tablist, frecce sinistra/destra, Home/End ─────────
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (ev: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let j = -1;
    if (ev.key === "ArrowRight") j = (i + 1) % TABS.length;
    else if (ev.key === "ArrowLeft") j = (i - 1 + TABS.length) % TABS.length;
    else if (ev.key === "Home") j = 0;
    else if (ev.key === "End") j = TABS.length - 1;
    if (j < 0) return;
    ev.preventDefault();
    setTab(TABS[j].id);
    tabRefs.current[j]?.focus();
  };

  // ── Carosello: frecce che scorrono di una «pagina» ──────────────────────
  const railRef = useRef<HTMLUListElement | null>(null);
  const scrollRail = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  };

  const isOpen = (groupId: string, indexInSport: number) =>
    toggled[groupId] ?? (indexInSport < OPEN_PER_SPORT || query.trim() !== "");

  const sportLabel = (s: string) => (s === "football" ? copy.football : s === "tennis" ? copy.tennis : s);
  // #CLASSIC-FIX2-1008 (QA M1, React #418) — la sigla del fuso dipende dall'orologio del
  // browser: il server (UTC su Vercel) scriveva «Times in UTC», il client «CEST» → testo
  // diverso all'idratazione. Si scrive solo dopo il montaggio, come ClassicTzNote.
  const [tzName, setTzName] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- il fuso del client esiste solo dopo il montaggio
  useEffect(() => setTzName(tzAbbr(tz, lang, now)), [tz, lang, now]);

  const bannerList: ClassicBanner[] = [
    { id: "board", title: copy.b1Title, sub: copy.b1Sub, cta: copy.b1Cta, ...banners.board },
    { id: "live", title: copy.b2Title, sub: copy.b2Sub, cta: copy.b2Cta, ...banners.live },
    { id: "record", title: copy.b3Title, sub: copy.b3Sub, cta: copy.b3Cta, more: { href: "/tools", label: copy.b3Tools }, ...banners.record },
  ];

  const emptyText = loading ? copy.loading
    : query.trim() ? fill(copy.emptySearch, { q: query.trim() })
    : tab === "inplay" ? copy.emptyLive
    : tab === "soon" ? copy.emptySoon
    : copy.emptyFilter;

  const sectionFor = (s: string): LobbySectionId => (tab === "soon" ? "soon" : s === "tennis" ? "tennis" : "football");

  return (
    <div className="brc-lobby" data-testid="classic-lobby" data-loading={loading}>
      <ClassicBanners banners={bannerList} label={copy.bannersLabel} />

      {/* ── 2 · tab + ricerca ─────────────────────────────────────────── */}
      <div className="brc-bar">
        <div className="brc-tabs" role="tablist" aria-label={copy.tabsLabel}>
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`brc-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="brc-panel"
              tabIndex={tab === t.id ? 0 : -1}
              className="brc-tab"
              onClick={() => setTab(t.id)}
              onKeyDown={(ev) => onTabKey(ev, i)}
            >
              {copy[t.key]}
            </button>
          ))}
        </div>
        <div className="brc-search" role="search">
          <IconSearch size={16} />
          <label className="brc-sr" htmlFor="brc-search-input">{copy.searchLabel}</label>
          <input
            id="brc-search-input"
            ref={searchRef}
            type="search"
            className="brc-search__input"
            placeholder={copy.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button type="button" className="brc-search__clear" onClick={() => setQuery("")} aria-label={copy.clearSearch}>
              <IconClose size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── 3 · striscia sport ─────────────────────────────────────────── */}
      <div className="brc-sports" role="group" aria-label={copy.sportsLabel}>
        {([
          { id: "popular", label: copy.popular, icon: <IconStar size={20} />, n: sportCounts.popular },
          { id: "football", label: copy.football, icon: <IconFootball size={20} />, n: sportCounts.football },
          { id: "tennis", label: copy.tennis, icon: <IconTennis size={20} />, n: sportCounts.tennis },
        ] as const).map((s) => (
          <button
            key={s.id}
            type="button"
            className="brc-sport"
            aria-pressed={sport === s.id}
            onClick={() => setSport(s.id)}
          >
            <span className="brc-sport__icon">{s.icon}</span>
            <span className="brc-sport__label">{s.label}</span>
            <span className="brc-sport__n">{loading ? "–" : s.n}</span>
          </button>
        ))}
      </div>

      <div id="brc-panel" role="tabpanel" aria-labelledby={`brc-tab-${tab}`} className="brc-panel">
        {/* ── 4 · in evidenza ──────────────────────────────────────────── */}
        {/* Mentre il board è in volo la fascia c'è già, con la sua intestazione
            e quattro lastre vuote all'altezza di una scheda: quando arrivano i
            dati le schede prendono il loro posto e niente sotto si sposta
            (misurato: senza, CLS 0,14 a 1440). */}
        {loading && tab === "featured" && (
          <section className="brc-sec" aria-labelledby="brc-featured-h" aria-busy="true">
            <header className="brc-sec__head">
              <div>
                <h2 id="brc-featured-h" className="brc-sec__title">{copy.featuredTitle}</h2>
                <p className="brc-sec__hint">{copy.featuredHint}</p>
              </div>
            </header>
            <ul className="brc-rail brc-rail--skeleton" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <li key={i} className="brc-rail__item"><span className="brc-slab" /></li>)}
            </ul>
          </section>
        )}
        {featured.length > 0 && (
          <section className="brc-sec" aria-labelledby="brc-featured-h">
            <header className="brc-sec__head">
              <div>
                <h2 id="brc-featured-h" className="brc-sec__title">{copy.featuredTitle}</h2>
                <p className="brc-sec__hint">{copy.featuredHint}</p>
              </div>
              <div className="brc-rail-nav">
                <button type="button" className="brc-icon-btn" onClick={() => scrollRail(-1)} aria-label={copy.prev}>
                  <IconChevronRight size={18} style={{ transform: "scaleX(-1)" }} />
                </button>
                <button type="button" className="brc-icon-btn" onClick={() => scrollRail(1)} aria-label={copy.next}>
                  <IconChevronRight size={18} />
                </button>
              </div>
            </header>
            <ul className="brc-rail" ref={railRef} data-testid="classic-featured">
              {featured.map((it) => (
                <li key={it.key} className="brc-rail__item">{renderCard(it, it.data.isLive ? "live" : "top")}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── 5 · dove la stima si discosta di più ─────────────────────── */}
        {differs.length > 0 && (
          <section className="brc-sec" aria-labelledby="brc-differs-h" data-testid="classic-differs">
            <header className="brc-sec__head">
              <div>
                <h2 id="brc-differs-h" className="brc-sec__title">{copy.differsTitle}</h2>
                <p className="brc-sec__hint">{copy.differsHint}</p>
              </div>
            </header>
            <ul className="brc-grid">
              {differs.map((it) => <li key={it.key}>{renderCard(it, "top")}</li>)}
            </ul>
          </section>
        )}

        {/* ── 6 · per categoria: sport → lega ──────────────────────────── */}
        <section className="brc-sec brc-sec--leagues" aria-labelledby="brc-leagues-h">
          <header className="brc-sec__head">
            <div>
              <h2 id="brc-leagues-h" className="brc-sec__title">{copy.leaguesTitle}</h2>
              <p className="brc-sec__hint">{copy.leaguesHint}{tzName && <> {fill(copy.timesIn, { tz: tzName })}.</>}</p>
            </div>
          </header>

          {dateFilterOn && (
            <div className="brc-when" role="group" aria-label={copy.filterLabel}>
              {(["all", "live", "today", "tomorrow"] as const).map((f) => (
                <button key={f} type="button" className="brc-chip" aria-pressed={when === f} onClick={() => setWhen(f)}>
                  {copy[f === "all" ? "fAll" : f === "live" ? "fLive" : f === "today" ? "fToday" : "fTomorrow"]}
                  <span className="brc-chip__n">{loading ? "–" : whenCounts[f]}</span>
                </button>
              ))}
            </div>
          )}

          {blocks.length === 0 ? (
            <p className="brc-empty" role="status">{emptyText}</p>
          ) : blocks.map((block) => (
            <div key={block.sport} className="brc-sport-block">
              <h3 className="brc-sport-block__title">
                {block.sport === "tennis" ? <IconTennis size={18} /> : <IconFootball size={18} />}
                {sportLabel(block.sport)}
                <span className="brc-count">{block.count}</span>
              </h3>
              {block.groups.map((g, gi) => {
                const open = isOpen(g.id, gi);
                const regionId = `brc-g-${g.id.replace(/[^a-z0-9]+/gi, "-")}`;
                const country = countryLabel(g.country, lang, copy);
                const meta = [country, g.circuit].filter(Boolean).join(" · ");
                return (
                  <div key={g.id} className="brc-group" data-open={open}>
                    <h4 className="brc-group__h">
                      <button
                        type="button"
                        className="brc-group__toggle"
                        aria-expanded={open}
                        aria-controls={open ? regionId : undefined}
                        onClick={() => setToggled((s) => ({ ...s, [g.id]: !open }))}
                      >
                        <span className="brc-group__titles">
                          <span className="brc-group__name">
                            {g.league === UNNAMED_LEAGUE ? (g.sport === "tennis" ? copy.otherTournaments : copy.otherLeagues) : g.league}
                          </span>
                          {meta && <span className="brc-group__meta">{meta}</span>}
                        </span>
                        <span className="brc-group__counts">
                          {g.liveCount > 0 && <span className="brc-live">{fill(copy.liveN, { n: g.liveCount })}</span>}
                          <span className="brc-count" aria-label={fill(copy.matchesN, { n: g.items.length })}>{g.items.length}</span>
                        </span>
                        <IconChevronDown size={16} className="brc-group__chev" />
                      </button>
                    </h4>
                    {open && (
                      <ul id={regionId} className="brc-grid">
                        {g.items.map((it) => <li key={it.key}>{renderCard(it, sectionFor(g.sport))}</li>)}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {hiddenByPopular > 0 && !loading && (
            <p className="brc-more">
              {fill(copy.moreInAll, { n: hiddenByPopular })}{" "}
              <button type="button" className="brc-link" onClick={() => { setTab("all"); }}>{copy.seeAllSports} →</button>
            </p>
          )}
        </section>
      </div>

      {tail}
    </div>
  );
}
