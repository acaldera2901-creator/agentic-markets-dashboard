"use client";
// components/classic/ClassicLeagueGroups.tsx — #CLASSIC-PAGES-1014
//
// Le pagine sport del filone classic (Calcio, Tennis, e ogni sport che verrà):
// lo SCHEMA DI DIVISIONE del riferimento di Andrea (asset-classic-final/
// _riferimenti/schema-leghe-accordion.png) — un'intestazione per lega con nome,
// paese, contatore e chevron, apribile e richiudibile una per una, «Vedi tutte
// (N)» oltre le prime schede — ma dentro ogni gruppo le NOSTRE schede
// (renderCard → ClassicSlab, le stesse della lobby), in griglia sul desktop e
// in swipe sul telefono. Il riferimento è lo schema, non le righe.
//
// UN SOLO COMPONENTE PER TUTTI GLI SPORT: non sa cos'è il calcio o il tennis,
// sa solo raggruppare per `data.league` con le regole di lobby-model
// (lib/classic/league-groups.ts). Chi lo monta passa le righe già filtrate e
// ordinate dalla pagina (competizione, superficie, ordinamento, sbloccate
// davanti) e la funzione che disegna la scheda col suo gating.
//
// Niente `role="region"` sui pannelli: con dieci-venti leghe sarebbero
// altrettanti landmark (la pratica ARIA lo sconsiglia oltre i sei). Resta
// `aria-expanded` + `aria-controls` sul bottone, e la tastiera: frecce su/giù,
// Home/End fra le intestazioni.
import { Fragment, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { LobbyItem } from "@/lib/ui/lobby";
import { classicCopy, fill } from "@/lib/classic/lobby-copy";
import { countryLabel, UNNAMED_LEAGUE } from "@/lib/classic/lobby-model";
import { CARDS_PER_LEAGUE, defaultOpenIds, groupLeagues } from "@/lib/classic/league-groups";
import { IconChevronDown } from "@/components/ui/icons";
import "./classic-leagues.css";

export type ClassicLeagueGroupsProps = {
  /** Le righe della pagina, già filtrate e ordinate: l'ordine dentro un
   *  gruppo è quello ricevuto. */
  items: LobbyItem[];
  lang: string;
  /** La scheda (gating, watchlist, apertura in pagina: lo decide chi monta). */
  renderCard: (item: LobbyItem) => ReactNode;
  /** Ricerca o filtro di competizione attivi → tutti i gruppi aperti: chi
   *  cerca «Genoa» non deve aprire la Serie A per trovarlo. */
  forceOpen?: boolean;
  /** Ciò che sta sopra i gruppi (la riga della quota «incluse oggi»). */
  lead?: ReactNode;
  /** UN banner di casa (HouseBanner, già montato da chi conosce audience e
   *  sport) in una riga sua, a tutta larghezza: vedi adSlotAfter. */
  ad?: ReactNode;
  /** L'immagine del creativo, per il fondo della fascia (sfocato e scurito):
   *  il creativo è 16:9, la fascia no — il fondo è lo stesso stadio allungato,
   *  non un colore inventato. Senza, la fascia è il pannello del tema. */
  adBackdrop?: string;
};

/** Dopo quale lega (indice 0-based) sta il banner di casa — Andrea 14/10: UNO
 *  per pagina, mai uno per lega. Fra la 2ª e la 3ª (sotto i due gruppi aperti
 *  di default); con meno di tre leghe, dopo l'ultima. Nessuna lega → nessuno. */
export function adSlotAfter(nGroups: number): number {
  if (nGroups <= 0) return -1;
  return nGroups >= 3 ? 1 : nGroups - 1;
}

export function ClassicLeagueGroups({ items, lang, renderCard, forceOpen = false, lead, ad, adBackdrop }: ClassicLeagueGroupsProps) {
  const copy = classicCopy(lang);
  const baseId = useId();
  const groups = useMemo(() => groupLeagues(items), [items]);
  const defaults = useMemo(() => defaultOpenIds(groups), [groups]);
  // Aperto/chiuso deciso dall'utente, per id di gruppo. Chi non c'è segue la
  // regola di default (i gruppi più grandi, e quelli live).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  // «Vedi tutte» per gruppo: le schede oltre CARDS_PER_LEAGUE si aprono a richiesta.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const headRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const adAfter = ad ? adSlotAfter(groups.length) : -1;

  const isOpen = (id: string) => toggled[id] ?? (forceOpen || defaults.has(id));

  const onHeadKey = (ev: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let j = -1;
    if (ev.key === "ArrowDown") j = (i + 1) % groups.length;
    else if (ev.key === "ArrowUp") j = (i - 1 + groups.length) % groups.length;
    else if (ev.key === "Home") j = 0;
    else if (ev.key === "End") j = groups.length - 1;
    if (j < 0) return;
    ev.preventDefault();
    headRefs.current[j]?.focus();
  };

  return (
    <div className="clg" data-testid="classic-league-groups" data-groups={groups.length}>
      {lead}
      {groups.map((g, gi) => {
        const open = isOpen(g.id);
        const slug = g.id.replace(/[^a-z0-9]+/gi, "-");
        const panelId = `${baseId}-p-${slug}`;
        const headId = `${baseId}-h-${slug}`;
        const country = countryLabel(g.country, lang, copy);
        const meta = [country, g.circuit].filter(Boolean).join(" · ");
        const full = expanded[g.id] === true;
        const shown = full ? g.items : g.items.slice(0, CARDS_PER_LEAGUE);
        const more = g.items.length - shown.length;
        const name = g.league === UNNAMED_LEAGUE ? (g.sport === "tennis" ? copy.otherTournaments : copy.otherLeagues) : g.league;
        return (
          <Fragment key={g.id}>
          <section className="clg-g" data-open={open} data-testid="classic-league-group" aria-labelledby={headId}>
            <h3 className="clg-g__h">
              <button
                type="button"
                id={headId}
                ref={(el) => { headRefs.current[gi] = el; }}
                className="clg-g__toggle"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setToggled((s) => ({ ...s, [g.id]: !open }))}
                onKeyDown={(ev) => onHeadKey(ev, gi)}
              >
                <span className="clg-g__titles">
                  <span className="clg-g__name">{name}</span>
                  {meta && <span className="clg-g__meta">{meta}</span>}
                </span>
                <span className="clg-g__counts">
                  {g.liveCount > 0 && <span className="clg-live">{fill(copy.liveN, { n: g.liveCount })}</span>}
                  <span className="clg-g__n" aria-label={fill(copy.matchesN, { n: g.items.length })}>{g.items.length}</span>
                </span>
                <IconChevronDown size={18} className="clg-g__chev" />
              </button>
            </h3>
            {open && (
              <div id={panelId} className="clg-g__body">
                <ul className="clg-cards">
                  {shown.map((it) => <li key={it.key}>{renderCard(it)}</li>)}
                </ul>
                {(more > 0 || full) && (
                  <button
                    type="button"
                    className="clg-more"
                    aria-expanded={full}
                    aria-controls={panelId}
                    onClick={() => setExpanded((s) => ({ ...s, [g.id]: !full }))}
                  >
                    {full ? copy.showLess : fill(copy.seeAll, { n: g.items.length })}
                  </button>
                )}
              </div>
            )}
          </section>
          {gi === adAfter && (
            <div
              className="clg-ad"
              data-testid="classic-league-ad"
              style={adBackdrop ? ({ "--clg-ad-bg": `url("${adBackdrop}")` } as CSSProperties) : undefined}
            >
              {ad}
            </div>
          )}
          </Fragment>
        );
      })}
    </div>
  );
}
