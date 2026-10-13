"use client";
// components/classic/ClassicRow.tsx — #CLASSIC-ROOBET-1013 · la riga partita per lega
//
// La riga dell'elenco per lega di Roobet: a sinistra data/ora (o LIVE col
// minuto) e le due squadre impilate con lo stemma; a destra la colonna del
// mercato — 1·X·2 (calcio) o 1·2 (tennis) — con la MIGLIOR quota per esito fra
// i book partner, ogni casella un link affiliato vero al book (tracciato
// `partner_click`, rel=sponsored). In mezzo il nostro numero, con la stessa
// etichetta onesta della scheda (stima / mercato / modello / Elo).
//
// Il chip «1 · logo · 3.53» è lo stesso della scheda (OddsChip): sulla riga
// aperta la cella della pick ha il prezzo in lime; sulla riga chiusa nessuna
// cella è segnata (la pick è ciò che il Pro compra). Senza prezzo partner (geo
// bloccata, nessun book, partita iniziata) la colonna non inventa niente: dice
// «No partner price» e resta il link all'analisi.
import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { Crest } from "@/components/ui/Crest";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { IconChevronRight, IconLock } from "@/components/ui/icons";
import type { LobbyItem } from "@/lib/ui/lobby";
import { formatPct, splitLiveScore } from "@/lib/ui/prediction-card";
import { useClassicPrices } from "@/components/classic/ClassicContext";
import { OddsChip, PartnerFallback, fallbackPartners } from "@/components/classic/ClassicSlab";
import { classicCopy as cardCopy } from "@/lib/classic/copy";
import { bestCells, classicViewFor, footballBooks, tennisBooks, tennisOddsFor } from "@/lib/classic/card-view";
import { hasStarted } from "@/lib/classic/guard";
import { abbinaQuotaPartner } from "@/lib/fp-odds-join";
import { rowWhen } from "@/lib/classic/lobby-model";
import type { ClassicCopy } from "@/lib/classic/lobby-copy";

/** Ciò che il desk sa di una riga e la lobby no: dove porta, se è chiusa, cosa
 *  succede al clic (apre la scheda in pagina senza navigare). */
export type ClassicRowLink = {
  href: string;
  locked: boolean;
  onOpen?: (ev: MouseEvent<HTMLAnchorElement>) => void;
};

type Props = {
  item: LobbyItem;
  link: ClassicRowLink;
  lang: string;
  tz: string;
  now: number;
  copy: ClassicCopy;
};

export function ClassicRow({ item, link, lang, tz, now, copy }: Props) {
  const d = item.data;
  const c = cardCopy(lang);
  const prices = useClassicPrices();
  const [mounted] = useState(() => new Date(now));
  const live = d.isLive;
  const started = live || hasStarted(d.startsAt, mounted);
  const score = live ? splitLiveScore(d.liveScoreLabel) : null;
  const { view, labels, leadIdx } = classicViewFor(d, prices, started, mounted);
  const kind = view?.kind ?? (d.probabilitySource === "market" ? "market_only" : "estimate");
  const big = view ? view.bigPct : d.modelPct;
  const ours = kind === "estimate" || kind === "protected" || kind === "elo_blend" || kind === "model_only";
  const shortLabel = kind === "market_only" ? copy.rowMarket : kind === "model_only" ? copy.rowModel : kind === "elo_blend" ? copy.rowElo : copy.rowEstimate;

  // La colonna del mercato: il miglior prezzo per OGNI esito (anche sulla riga
  // aperta, dove la scheda mostra solo la pick). Partita iniziata: niente.
  let cells = view?.cells ?? [];
  if (!started && !prices.booksBlocked && cells.length === 0 && view) {
    if (d.classic?.sport === "football") {
      const fp = abbinaQuotaPartner(d.home, d.away, d.startsAt, prices.fpOdds, prices.fpIndex).quota;
      cells = bestCells(footballBooks(fp, d.home, d.away), labels);
    } else if (d.classic?.sport === "tennis") {
      cells = bestCells(tennisBooks(tennisOddsFor(prices.fpOdds, d.home, d.away, d.startsAt), d.home, d.away), labels);
    }
  }
  const fallback = fallbackPartners(prices).length > 0;
  const when = rowWhen(d.startsAt, tz, lang, now, { today: copy.fToday, tomorrow: copy.fTomorrow });
  const title = `${d.home} vs ${d.away}`;

  return (
    <li className="brc-row" data-live={live || undefined} data-locked={link.locked || undefined} data-testid="classic-row">
      <Link href={link.href} className="brc-row__main" onClick={link.onOpen} aria-label={`${copy.openMatch}: ${title}`}>
        <span className="brc-row__when">
          {live ? <LiveBadge minute={d.liveMinute} /> : <span>{when ?? d.kickoffLabel ?? ""}</span>}
        </span>
        <span className="brc-row__teams">
          <span className="brc-row__team">
            <Crest team={d.home} sport={d.sport} size={20} role="home" className="brc-row__crest" />
            <span className="brc-row__name" title={d.home}>{d.home}</span>
            {score && <span className="brc-row__score" aria-hidden="true">{score.home.map((x) => (x === "" ? "–" : x)).join(" ")}</span>}
          </span>
          <span className="brc-row__team">
            <Crest team={d.away} sport={d.sport} size={20} role="away" className="brc-row__crest" />
            <span className="brc-row__name" title={d.away}>{d.away}</span>
            {score && <span className="brc-row__score" aria-hidden="true">{score.away.map((x) => (x === "" ? "–" : x)).join(" ")}</span>}
          </span>
          {score && <span className="brc-sr">Live score {d.liveScoreLabel}</span>}
        </span>
        {big != null && kind !== "no_price" && (
          <span className="brc-row__est" data-ours={ours || undefined}>
            <span className="brc-row__est-n">{formatPct(big)}<span className="brc-row__est-pc">%</span></span>
            <span className="brc-row__est-k">{link.locked ? <IconLock size={10} stroke={2} /> : null}{shortLabel}</span>
          </span>
        )}
        <IconChevronRight size={16} className="brc-row__chev" />
      </Link>
      <span className="brc-row__mkt" aria-label={copy.bestOdds} data-fallback={cells.length === 0 && fallback ? "" : undefined}>
        {cells.length > 0
          ? <>
              {cells.map((cell, i) => <OddsChip key={cell.label} cell={cell} surface="lobby-row" c={c} pick={!link.locked && leadIdx === i} />)}
              {/* «AD·18+» una volta per riga, non dentro ognuna delle tre caselle (a 390 non ci stava) */}
              <span className="cl-odd-ad brc-row__ad" aria-hidden="true">{c.ad}</span>
            </>
          : fallback
            // #CLASSIC-ROOBET-1013 round 2 — senza prezzo partner, o a partita
            // iniziata: i loghi di tre partner con il link di atterraggio
            ? <PartnerFallback surface="lobby-row" c={c} lang={lang} />
            : <span className="brc-row__nomkt">{started ? c.pricesRemoved : c.noPartnerPrice}</span>}
      </span>
    </li>
  );
}
