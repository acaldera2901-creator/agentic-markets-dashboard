"use client";
import {useSiteNavigation} from "./SiteNavigationContext";
import {readLobbyDestination} from "@/lib/classic/site-navigation";
import {trackEvent} from "@/lib/track-event";
// components/classic/ClassicLobby.tsx — filone «classic», lobby (#CLASSIC-LOBBY-1008 · #CLASSIC-ROOBET-1013)
//
// La Home con la STRUTTURA di Roobet — presa per intero, decisione di Andrea
// del 13/10 — ma coi dati, i token, il logo e i banner BetRedge. Dall'alto:
//   0. il rail sinistro: sezioni del board, sport, altre destinazioni (desktop);
//   1. tre banner affiancati (i nostri tre ingressi: board, live, storico);
//   2. la barra di tab (Featured · In-Play · Starting Soon · All Sports) con la
//      ricerca a destra, e sotto la riga delle icone sport;
//   3. la fila di chip delle leghe presenti oggi (Premier League, Serie A…);
//   4. «Featured»: un carosello orizzontale di schede (scroll-snap, frecce);
//   5. «Where our estimate differs most»: lo STESSO carosello (novità rispetto a
//      Roobet, voluta da Andrea), con lo stesso trattamento delle schede;
//   6. l'elenco per lega: titolo di lega ripiegabile, righe partita con ora e
//      squadre a sinistra, colonna 1X2 a destra con la miglior quota partner per
//      esito, «See all» in fondo a ogni lega.
//
// SEPARAZIONE SENZA CORNICI (REGOLE-CLASSIC 1): la lobby si stacca con lo
// spazio e con due toni di fondo (pagina `--am-bg` < barra, rail e intestazioni
// `--am-panel`). L'unico bordo è quello sottile bianco-freddo della scheda,
// deciso col PDF del 12/10.
//
// LA SCHEDA non è di questo file: arriva da `renderCard`, cioè la funzione della
// lobby di oggi (app/app/page.tsx → HomeLobby) che monta PredictionCard con il
// suo gating, la watchlist e l'apertura della scheda partita. Le RIGHE per lega
// invece sono qui (ClassicRow): il desk passa solo `rowLink` — dove porta la
// riga, se è chiusa, cosa succede al clic — così gating e tracking restano suoi.

import { useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import type { LobbyItem, LobbySectionId } from "@/lib/ui/lobby";
import {
  countryLabel, dedupeLobby, differsMostItems, featuredItems, groupBySportLeague, leagueChips, matchesDateFilter, matchesQuery, ROWS_PER_LEAGUE, scopeLobby,
  UNNAMED_LEAGUE, type DateFilter, type LobbyTab, type SportFilter,
} from "@/lib/classic/lobby-model";
import { differsBy, footballBooks } from "@/lib/classic/card-view";
import { abbinaQuotaPartner } from "@/lib/fp-odds-join";
import { useClassicPrices } from "@/components/classic/ClassicContext";
import { classicCopy, fill, type ClassicCopy } from "@/lib/classic/lobby-copy";
import { ClassicBanners, type ClassicBanner } from "@/components/classic/ClassicBanners";
import { ClassicRow, type ClassicRowLink } from "@/components/classic/ClassicRow";
import { IconChevronDown, IconChevronRight, IconClose, IconSearch } from "@/components/ui/icons";
import { ClassicIcon } from "@/components/classic/ClassicIcon";
import "./classic-lobby.css";

type BannerSlot = Pick<ClassicBanner, "href" | "onClick" | "image">;

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
  /** #CLASSIC-ROOBET-1013 — la riga per lega: dove porta, se è chiusa, cosa fa
   *  al clic. Lo decide il desk (gating, modal in pagina, tracking). Senza
   *  (test, uso isolato) la riga è un link alla rotta della partita. */
  rowLink?: (item: LobbyItem) => ClassicRowLink;
  banners: { board: BannerSlot; live: BannerSlot; record: BannerSlot };
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
 *  colpo d'occhio e si apre a richiesta (Roobet fa lo stesso). */
const OPEN_PER_SPORT = 3;

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

// #CLASSIC-ASSET-1013 — le icone del rail sono il set 3D di casa (ClassicIcon):
// la bandierina lime = in evidenza, il fulmine = live, l'orologio = a breve,
// la casa = tutto il board (QA BUG-3: il tabellone a 20 px sembrava un barile).
const TABS: { id: LobbyTab; key: keyof ClassicCopy; icon: ReactNode }[] = [
  { id: "featured", key: "tabFeatured", icon: <ClassicIcon name="market-soft" /> },
  { id: "inplay", key: "tabInPlay", icon: <ClassicIcon name="classic-live" /> },
  { id: "soon", key: "tabSoon", icon: <ClassicIcon name="menu-history" /> },
  { id: "all", key: "tabAll", icon: <ClassicIcon name="classic-home" /> },
];

/** Sport → icona 3D. Il calcio è il pallone già in prod (menu-prediction), il
 *  tennis la pallina e «popolari» la stella, fatte nello stesso stile. */
const SPORT_ICON = { popular: "classic-popular", football: "menu-prediction", tennis: "classic-tennis" } as const;

/** Il carosello: schede affiancate, scroll-snap, frecce di una «pagina» sul
 *  desktop, swipe sul telefono. Featured e «differs most» lo condividono. */
function Rail({ id, title, hint, items, section, renderCard, copy, testId, busy }: {
  id: string; title: string; hint: string; items: LobbyItem[]; section: (it: LobbyItem) => LobbySectionId;
  renderCard: ClassicLobbyProps["renderCard"]; copy: ClassicCopy; testId: string; busy?: boolean;
}) {
  const railRef = useRef<HTMLUListElement | null>(null);
  const scrollRail = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <section className="brc-sec" aria-labelledby={`${id}-h`} aria-busy={busy || undefined} data-testid={testId}>
      <header className="brc-sec__head">
        <div>
          <h2 id={`${id}-h`} className="brc-sec__title">{title}</h2>
          <p className="brc-sec__hint">{hint}</p>
        </div>
        {!busy && (
          <div className="brc-rail-nav">
            <button type="button" className="brc-icon-btn" onClick={() => scrollRail(-1)} aria-label={copy.prev}>
              <IconChevronRight size={18} style={{ transform: "scaleX(-1)" }} />
            </button>
            <button type="button" className="brc-icon-btn" onClick={() => scrollRail(1)} aria-label={copy.next}>
              <IconChevronRight size={18} />
            </button>
          </div>
        )}
      </header>
      {busy ? (
        // Mentre il board è in volo la fascia c'è già, con quattro lastre vuote
        // all'altezza di una scheda: quando arrivano i dati niente sotto si sposta.
        <ul className="brc-rail brc-rail--skeleton" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <li key={i} className="brc-rail__item"><span className="brc-slab" /></li>)}
        </ul>
      ) : (
        <ul className="brc-rail" ref={railRef}>
          {items.map((it) => (
            <li key={it.key} className="brc-rail__item">{renderCard(it, section(it))}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ClassicLobby({ lang, tz, football, tennis, loading = false, renderCard, rowLink, banners, tail, now: nowProp, query: queryProp, onQueryChange }: ClassicLobbyProps) {
  const sharedNavigation = useSiteNavigation();
  const copy = classicCopy(lang);
  const [tab, setTab] = useState<LobbyTab>("featured");
  const [sport, setSport] = useState<SportFilter>("popular");
  useEffect(() => {
    const target=readLobbyDestination(window.location.search);
    // URL filters are applied after hydration, just like the desk view links.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(target.board);setSport(target.filter);
  }, []);
  const [when, setWhen] = useState<DateFilter>("all");
  const [league, setLeague] = useState<string | null>(null);
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
  // «See all» per lega: le righe oltre ROWS_PER_LEAGUE si aprono a richiesta.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
  const dated = useMemo(
    () => (dateFilterOn ? tabScoped.filter((it) => matchesDateFilter(it, when, tz, now)) : tabScoped),
    [tabScoped, dateFilterOn, when, tz, now],
  );
  // i chip delle leghe si calcolano PRIMA del filtro di lega: il chip attivo
  // resta visibile, e «All» dice quante righe ci sono in tutto
  const chips = useMemo(() => leagueChips(groupBySportLeague(dated)), [dated]);
  const leagueOn = league != null && chips.some((ch) => ch.id === league);
  const listed = useMemo(() => (leagueOn ? dated.filter((it) => `${it.data.sport}:${it.data.league?.trim() || UNNAMED_LEAGUE}` === league) : dated), [dated, leagueOn, league]);
  const blocks = useMemo(() => groupBySportLeague(listed), [listed]);
  const liveTotal = useMemo(() => searched.filter((it) => it.data.isLive).length, [searched]);

  const reportNavigation=sharedNavigation?.report;
  useEffect(()=>{
    reportNavigation?.({board:tab,filter:sport,loading,live:liveTotal,popular:sportCounts.popular,football:sportCounts.football,tennis:sportCounts.tennis});
  },[reportNavigation,tab,sport,loading,liveTotal,sportCounts.popular,sportCounts.football,sportCounts.tennis]);
  useEffect(()=>()=>reportNavigation?.(null),[reportNavigation]);

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

  const isOpen = (groupId: string, indexInSport: number) =>
    toggled[groupId] ?? (indexInSport < OPEN_PER_SPORT || query.trim() !== "" || leagueOn);

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

  const linkFor = (it: LobbyItem): ClassicRowLink => rowLink ? rowLink(it) : { href: `/predictions?match=${encodeURIComponent(it.key)}`, locked: it.data.locked === true };
  const pickTab = (t: LobbyTab) => { trackEvent("nav_click",{meta:{surface:"classic-lobby",view:t}}); setTab(t); setLeague(null); };
  const pickSport = (s: SportFilter) => { trackEvent("tab_click",{meta:{surface:"classic-lobby",sport:s}}); setSport(s); setLeague(null); };
  const liveSide = (ev: MouseEvent<HTMLAnchorElement>) => banners.live.onClick?.(ev);

  return (
    <div className="brc-lobby" data-testid="classic-lobby" data-loading={loading}>
      {/* ── 0 · il rail sinistro (desktop): sezioni, sport, altre destinazioni ── */}
      {!sharedNavigation && <nav className="brc-side" aria-label={copy.sideLabel}>
        {/* le intestazioni sono etichette in maiuscoletto: senza icona, l'icona
            sta sulle voci (destinazioni), non sui titoli di gruppo */}
        <p className="brc-side__h">{copy.sideBoard}</p>
        <ul className="brc-side__list">
          {TABS.map((t) => (
            <li key={t.id}>
              <button type="button" className="brc-side__item" aria-current={tab === t.id ? "true" : undefined} onClick={() => pickTab(t.id)}>
                {t.icon}<span>{copy[t.key]}</span>
                {t.id === "inplay" && liveTotal > 0 && <span className="brc-live brc-side__n">{liveTotal}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="brc-side__h">{copy.sportsLabel}</p>
        <ul className="brc-side__list">
          {([
            { id: "popular", label: copy.popular, n: sportCounts.popular },
            { id: "football", label: copy.football, n: sportCounts.football },
            { id: "tennis", label: copy.tennis, n: sportCounts.tennis },
          ] as const).map((s) => (
            <li key={s.id}>
              <button type="button" className="brc-side__item" aria-current={sport === s.id ? "true" : undefined} onClick={() => pickSport(s.id)}>
                <ClassicIcon name={SPORT_ICON[s.id]} /><span>{s.label}</span><span className="brc-count brc-side__n">{loading ? "–" : s.n}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="brc-side__h">{copy.sideMore}</p>
        <ul className="brc-side__list">
          <li><a className="brc-side__item" href={banners.live.href} onClick={liveSide}><ClassicIcon name="classic-live" /><span>{copy.sideLive}</span></a></li>
          <li><Link className="brc-side__item" href={banners.record.href}><ClassicIcon name="market-result" /><span>{copy.sideRecord}</span></Link></li>
          <li><Link className="brc-side__item" href="/tools"><ClassicIcon name="menu-tools" /><span>{copy.b3Tools}</span></Link></li>
          <li><Link className="brc-side__item" href="/partners"><ClassicIcon name="menu-partner" /><span>{copy.sidePartners}</span></Link></li>
        </ul>
      </nav>}

      <div className="brc-main">
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
              onClick={() => pickTab(t.id)}
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
          { id: "popular", label: copy.popular, n: sportCounts.popular },
          { id: "football", label: copy.football, n: sportCounts.football },
          { id: "tennis", label: copy.tennis, n: sportCounts.tennis },
        ] as const).map((s) => (
          <button
            key={s.id}
            type="button"
            className="brc-sport"
            aria-pressed={sport === s.id}
            onClick={() => pickSport(s.id)}
          >
            <span className="brc-sport__icon"><ClassicIcon name={SPORT_ICON[s.id]} size={32} /></span>
            <span className="brc-sport__label">{s.label}</span>
            <span className="brc-sport__n">{loading ? "–" : s.n}</span>
          </button>
        ))}
      </div>

      {/* ── 3b · i chip delle leghe di oggi ────────────────────────────── */}
      {chips.length > 0 && (
        <div className="brc-leagues" role="group" aria-label={copy.leaguesLabel} data-testid="classic-league-chips">
          <button type="button" className="brc-chip" aria-pressed={!leagueOn} onClick={() => setLeague(null)}>
            {copy.chipAll}<span className="brc-chip__n">{dated.length}</span>
          </button>
          {chips.map((ch) => (
            <button key={ch.id} type="button" className="brc-chip" aria-pressed={leagueOn && league === ch.id} onClick={() => setLeague(leagueOn && league === ch.id ? null : ch.id)}>
              {ch.code && <span className="brc-chip__cc" aria-hidden="true">{ch.code}</span>}
              {ch.league}
            </button>
          ))}
        </div>
      )}

      <div id="brc-panel" role="tabpanel" aria-labelledby={`brc-tab-${tab}`} className="brc-panel">
        {/* ── 4 · in evidenza: carosello ──────────────────────────────── */}
        {tab === "featured" && (loading || featured.length > 0) && (
          <Rail id="brc-featured" title={copy.featuredTitle} hint={copy.featuredHint} items={featured} busy={loading}
            section={(it) => (it.data.isLive ? "live" : "top")} renderCard={renderCard} copy={copy} testId="classic-featured" />
        )}

        {/* ── 5 · dove la stima si discosta di più: lo stesso carosello ── */}
        {differs.length > 0 && (
          <Rail id="brc-differs" title={copy.differsTitle} hint={copy.differsHint} items={differs}
            section={() => "top"} renderCard={renderCard} copy={copy} testId="classic-differs" />
        )}

        {/* ── 6 · per lega: intestazione ripiegabile, righe, «See all» ── */}
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
                <ClassicIcon name={block.sport === "tennis" ? "classic-tennis" : "menu-prediction"} size={20} />
                {sportLabel(block.sport)}
                <span className="brc-count">{block.count}</span>
              </h3>
              {block.groups.map((g, gi) => {
                const open = isOpen(g.id, gi);
                const regionId = `brc-g-${g.id.replace(/[^a-z0-9]+/gi, "-")}`;
                const country = countryLabel(g.country, lang, copy);
                const meta = [country, g.circuit].filter(Boolean).join(" · ");
                const full = expanded[g.id] === true;
                const rows = full ? g.items : g.items.slice(0, ROWS_PER_LEAGUE);
                const more = g.items.length - rows.length;
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
                        {/* l'intestazione della colonna mercato (Roobet: «1x2» sulla riga del titolo) */}
                        {open && <span className="brc-group__mkt" aria-hidden="true">{g.sport === "tennis" ? copy.mktWinner : copy.mkt1x2}</span>}
                        <IconChevronDown size={16} className="brc-group__chev" />
                      </button>
                    </h4>
                    {open && (
                      <div id={regionId} className="brc-list">
                        <ul className="brc-rows">
                          {rows.map((it) => <ClassicRow key={it.key} item={it} link={linkFor(it)} lang={lang} tz={tz} now={now} copy={copy} />)}
                        </ul>
                        {(more > 0 || full) && (
                          <button type="button" className="brc-seeall" aria-expanded={full} aria-controls={regionId} onClick={() => setExpanded((s) => ({ ...s, [g.id]: !full }))}>
                            {full ? copy.showLess : fill(copy.seeAll, { n: g.items.length })}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {hiddenByPopular > 0 && !loading && (
            <p className="brc-more">
              {fill(copy.moreInAll, { n: hiddenByPopular })}{" "}
              <button type="button" className="brc-link" onClick={() => { pickTab("all"); }}>{copy.seeAllSports} →</button>
            </p>
          )}
        </section>
      </div>

      {tail}
      </div>
    </div>
  );
}
