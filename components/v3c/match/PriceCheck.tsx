"use client";
// components/v3c/match/PriceCheck.tsx (#REDESIGN-V3C F4)
// Il price check: l'utente sceglie una partita della board (o nessuna) e
// digita — o riempie con un clic — le quote del suo book. Subito: probabilità
// implicita, margine del book, margine tolto e, se c'è una partita di calcio, la
// nostra stima accanto con il gap (tennis2: nel tennis solo dove c'è la stima basata su Elo, non sigillata — gap
// attenuato, nessun verdetto «più alto/più basso», niente EV/Kelly; altrove solo il mercato). Poi la striscia EV · Kelly · convertitore con i
// prezzi digitati, poi (solo con una partita) dove il prezzo è migliore.
// Nessun input finisce nel markup come HTML: sono valori di <input>.
import Link from "next/link";
import { useState } from "react";
import type { Outcome, V3BookPrice } from "@/lib/v3c/contracts";
import { dayShort, gapText, isFlatGap, timeHM } from "@/lib/v3c/board-view";
import { useLocalTimeZone, useV3cCopy } from "@/lib/v3c/lang.client";
import { TzNote } from "../guide/TzNote";
import { matchCopyFor } from "@/lib/v3c/match-copy";
import { bookList, checkPrices, checkedAt, gapDirection, matchHref, parsePrice, pricesAsInputs, toolStrip, type V3BookLink } from "@/lib/v3c/match-view";
import { Fascia } from "../Fascia";
import { Nastro } from "../Nastro";
import { PartnerBlock } from "./PartnerBlock";
import { ToolStrip } from "./ToolStrip";
import "../tennis2.css";
import { v3cLang, v3cLocale } from "@/lib/v3c/copy";
import type { ModelGuardLevel } from "@/lib/v3c/fixdata";
import { PRICE_MAX, PRICE_MIN, inputProblem } from "@/lib/v3c/fixdata";
import { fixdataCopyFor } from "@/lib/v3c/fixdata-copy";
import { fixui2CopyFor } from "@/lib/v3c/fixui2-copy";

/** tennis2: estimate_p nel tennis = la stima basata su Elo (0,1·Elo + 0,9·mercato) dove c'è, altrimenti null (solo mercato). */
export type PcOutcome = { outcome: Outcome; market_price: number | null; estimate_p: number | null; book_prices: V3BookPrice[] };
/** tennis2: `tnElo` = partita tennis con estimate_kind 'elo_blend_unsealed'; `gapHidden` = |Elo − mercato| > 25 pp */
export type PcMatch = { id: string; sport: "football" | "tennis"; home: string; away: string; kickoff: string; league: string | null; blend: boolean; outcomes: PcOutcome[]; links: V3BookLink[]; tnElo?: boolean; gapHidden?: boolean;
  /** fixdata B5: the model sanity guard of the match (lib/v3c/fixdata.ts); not «ok» → no EV, Kelly or stake */
  guard?: ModelGuardLevel };

const fmt2 = (n: number | null) => (n == null ? "" : n.toFixed(2));

/** The market prices of the match (the «Market price» chip: a reference, not a price a book necessarily offers). */
function marketPrices(m: PcMatch): string[] {
  return m.outcomes.map((o) => fmt2(o.market_price ?? o.book_prices[0]?.price ?? null));
}

/**
 * fixui2 N4: what the price check opens on. A match → the prices of a connected book that quotes every outcome
 * (a price somebody actually offers), else empty boxes and «Enter the price you see» — never the composite market
 * price, which no book may offer (QA-2: 5.00 when the best book paid 4.50, «EV +5%»). No match → the sample of the
 * maths, unless the page was asked for a match it cannot open (N6): then empty.
 */
function startPrices(m: PcMatch | null, empty = false): string[] {
  if (!m) return empty ? ["", "", ""] : ["2.15", "3.20", "3.50"];
  const f = fillers(m)[0];
  return f ? f.prices.map((p) => p.toFixed(2)) : m.outcomes.map(() => "");
}

/** I book che hanno una quota per tutti e tre gli esiti: «riempi con i prezzi di X». */
function fillers(m: PcMatch | null): { key: string; name: string; prices: number[] }[] {
  if (!m) return [];
  const names = new Map<string, string>();
  for (const o of m.outcomes) for (const b of o.book_prices) names.set(b.bookmaker, b.name);
  const out: { key: string; name: string; prices: number[] }[] = [];
  for (const [key, name] of names) {
    const ps = m.outcomes.map((o) => o.book_prices.find((b) => b.bookmaker === key)?.price ?? null);
    if (ps.every((p) => p != null)) out.push({ key, name, prices: ps as number[] });
  }
  return out;
}

export function PriceCheck({ matches, initialId, partners, landing = [], notListed = false }: { matches: PcMatch[]; initialId: string | null; partners: boolean; landing?: V3BookLink[]; /** fixui2 N6: ?m= named a match the list cannot open */ notListed?: boolean }) {
  const { lang, t } = useV3cCopy();
  const c = matchCopyFor(lang);
  const tz = useLocalTimeZone();
  const locale = v3cLocale(lang);
  const [id, setId] = useState<string>(initialId ?? "");
  const m = matches.find((x) => x.id === id) ?? null;
  const x2 = fixui2CopyFor(lang);
  const [raw, setRaw] = useState<string[]>(() => startPrices(m, notListed));
  // fixui2 N6: the «not in the price check» note stays until the visitor picks something
  const [missing, setMissing] = useState(notListed);

  // la stima (colonne, nastro) nel calcio e nel tennis con l'Elo fresco; verdetto «più alto/più basso» ed EV/Kelly solo nel calcio
  const tnEst = m != null && m.sport === "tennis" && m.tnElo === true && m.outcomes.every((o) => o.estimate_p != null);
  const withEst = m != null && (m.sport === "football" || tnEst);
  const tnGapHidden = tnEst && m?.gapHidden === true;
  const labels = m ? (m.sport === "tennis" ? [m.home, m.away] : [m.home, t.board.draw, m.away]) : c.pc.outcomes;
  const parsed = raw.map(parsePrice);
  // senza partita il terzo prezzo è facoltativo (mercati a due esiti)
  const used = m ? parsed : parsed.filter((p, i) => i < 2 || raw[i].trim() !== "");
  const estimates = withEst ? m.outcomes.map((o) => (o.estimate_p == null ? null : o.estimate_p * 100)) : [];
  const chk = checkPrices(used, estimates);
  // fixui2 N4: nothing typed yet is a state, not an error
  const blank = raw.slice(0, labels.length).every((x) => x.trim() === "");

  function choose(next: string) {
    setId(next);
    setMissing(false);
    const nm = matches.find((x) => x.id === next) ?? null;
    setRaw(startPrices(nm));
    try {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set("m", next);
      else url.searchParams.delete("m");
      window.history.replaceState(null, "", url);
    } catch {
      /* la URL è una comodità */
    }
  }

  // tennis: nessun gap a guidare → l'esito in evidenza è il favorito del prezzo (quota più bassa)
  const li = m?.sport === "tennis" && chk ? used.reduce<number>((best, p, i) => ((p as number) < (used[best] as number) ? i : best), 0) : (chk?.lead ?? 0);
  const leadPrice = used[li] ?? null;
  const E = withEst && estimates[li] != null ? Math.round(estimates[li] as number) : null;
  const g = chk?.gaps[li] ?? null;
  const strip =
    chk && leadPrice != null
      ? withEst && !tnEst && E != null && (m?.guard ?? "ok") === "ok"
        ? toolStrip([
            { slug: "ev-calculator", values: { price: leadPrice, prob: E } },
            // fixui2 N4: Kelly as a fraction only — no «€x of a €500 bankroll» (the bankroll is the visitor's, in the tool)
            { slug: "kelly-criterion", values: { price: leadPrice, prob: E } },
            { slug: "odds-converter", values: { price: leadPrice } },
          ])
        : toolStrip([
            { slug: "margin-calculator", values: pricesAsInputs(used) },
            { slug: "probability-calculator", values: pricesAsInputs(used) },
            { slug: "odds-converter", values: { price: leadPrice } },
          ])
      : null;
  const books = m && chk ? bookList(m.outcomes[li].book_prices, [...m.links, ...landing]) : [];
  const checked = checkedAt(books);
  const fills = fillers(m);

  return (
    <>
      <Fascia
        tab={c.pc.tab}
        title={c.pc.title}
        meta={
          <>
            {m ? (
              <b>
                {m.home} — {m.away}
              </b>
            ) : null}
            <span>{m?.sport === "tennis" ? t.tennis.winner : "1X2"}</span>
            <span>{c.pc.hint}</span>
            <TzNote />
          </>
        }
      />
      <div className="v3c-pc-pick">
        <label>
          <span className="v3c-lab">{c.pc.choose}</span>
          <select value={id} onChange={(e) => choose(e.target.value)}>
            <option value="">{c.pc.noMatch}</option>
            {matches.map((x) => (
              <option key={x.id} value={x.id}>
                {dayShort(x.kickoff, tz, locale)} {timeHM(x.kickoff, tz, locale)} · {x.home} — {x.away}
              </option>
            ))}
          </select>
        </label>
        {m ? (
          <div className="v3c-pc-fill" role="group" aria-label={c.pc.fill}>
            <span className="v3c-lab">{c.pc.fill}</span>
            <button type="button" className="v3c-chip" onClick={() => setRaw(marketPrices(m))}>
              {c.pc.useMarket}
            </button>
            {fills.map((f) => (
              <button key={f.key} type="button" className="v3c-chip" onClick={() => setRaw(f.prices.map((p) => p.toFixed(2)))}>
                {c.pc.useBook(f.name)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {missing ? (
        <p className="v3c-small v3c-pc-missing" role="status" data-pc="not-listed">
          {x2.notListed}
        </p>
      ) : null}
      <p className="v3c-lab v3c-pc-enter" id="v3c-pc-enter">
        {x2.enterPrice}
      </p>
      <form aria-labelledby="v3c-pc-enter" className="v3c-tf v3c-pc-form" style={{ "--n": labels.length === 2 ? 2 : 3 } as React.CSSProperties} onSubmit={(e) => e.preventDefault()}>
        {labels.map((l, i) => (
          <label key={i}>
            <span className="v3c-lab">{l}</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="1.01"
              name={`p${i + 1}`}
              value={raw[i] ?? ""}
              aria-invalid={raw[i]?.trim() !== "" && inputProblem("price", parsePrice(raw[i])) != null}
              onChange={(e) => setRaw((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </label>
        ))}
      </form>

      <section className="v3c-pc-res" aria-live="polite">
        {!chk && blank ? (
          <p className="v3c-pc-empty" data-pc="empty">
            {x2.emptyPrices}
          </p>
        ) : !chk ? (
          <p className="v3c-pc-err">
            {c.pc.invalid} {fixdataCopyFor(lang).toolErrRange(new Intl.NumberFormat(locale).format(PRICE_MIN), new Intl.NumberFormat(locale).format(PRICE_MAX))}
          </p>
        ) : (
          <>
            {withEst && !tnEst && E != null && g != null ? (
              (() => {
                const v = c.pc.verdict(labels[li], (leadPrice as number).toFixed(2), chk.noVig[li].toFixed(0), E, Math.abs(g).toFixed(1), gapDirection(g));
                return (
                  <p className="v3c-pc-verdict">
                    <b>{v.lead}</b>
                    {v.body[0]}
                    <span className="v3c-m">{v.body[1]}</span>
                    {v.body[2]}
                    <mark>{v.body[3]}</mark>
                    {v.body[4]}
                  </p>
                );
              })()
            ) : (
              <p className="v3c-pc-verdict">{c.pc.verdictNoEst(`${chk.sum.toFixed(1)}%`, `${chk.margin.toFixed(1)}%`)}</p>
            )}
            <table className="v3c-pc-t" lang={v3cLang(lang)}>
              <thead>
                <tr>
                  <th className="v3c-lab">{c.outcome}</th>
                  <th className="v3c-lab v3c-ra">{c.pc.yourPrice}</th>
                  <th className="v3c-lab v3c-ra v3c-pc-c-imp">{c.pc.implied}</th>
                  <th className="v3c-lab v3c-ra">{c.pc.noVig}</th>
                  {withEst ? <th className="v3c-lab v3c-ra">{c.estimate}</th> : null}
                  {withEst ? <th className="v3c-lab v3c-ra">{c.gap}</th> : null}
                </tr>
              </thead>
              <tbody>
                {used.map((p, i) => (
                  <tr key={i} className={m && i === li ? "v3c-pc-lead" : undefined}>
                    <td>{labels[i]}</td>
                    <td className="v3c-ra v3c-num">{(p as number).toFixed(2)}</td>
                    <td className="v3c-ra v3c-num v3c-pc-c-imp">{chk.implied[i].toFixed(1)}%</td>
                    <td className="v3c-ra v3c-num v3c-m">{chk.noVig[i].toFixed(0)}%</td>
                    {withEst ? (
                      <td className="v3c-ra v3c-num">
                        {tnEst ? (estimates[i] == null ? "—" : `${Math.round(estimates[i] as number)}%`) : <mark>{estimates[i] == null ? "—" : `${Math.round(estimates[i] as number)}%`}</mark>}
                      </td>
                    ) : null}
                    {withEst ? (
                      <td className={["v3c-ra", "v3c-num", tnEst ? "v3c-g-tn" : isFlatGap(chk.gaps[i]) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>
                        {tnGapHidden ? "—" : `${gapText(chk.gaps[i])} pp`}
                      </td>
                    ) : null}
                  </tr>
                ))}
                <tr className="v3c-pc-tot">
                  <td>{c.pc.total}</td>
                  <td />
                  <td className="v3c-ra v3c-pc-c-imp">{chk.sum.toFixed(1)}%</td>
                  <td className="v3c-ra">{chk.margin < 0 ? c.pc.under : c.pc.kept(`${chk.margin.toFixed(1)}%`)}</td>
                  {withEst ? <td /> : null}
                  {withEst ? <td /> : null}
                </tr>
              </tbody>
            </table>
            {withEst && E != null && !tnGapHidden ? <Nastro className={tnEst ? "v3c-gl-tn" : undefined} market={Math.round(chk.noVig[li])} estimate={E} gap={g} marketLabel={c.market} estimateLabel={c.estimate} inLineLabel={t.board.inLine} gapLabel={t.board.gapWord} /> : null}
            <p className="v3c-fine">{tnEst ? c.pc.fineTennisElo : withEst ? c.pc.fine : m ? c.pc.fineTennis : c.pc.fineNoEst}</p>
            {tnEst ? <p className="v3c-fine v3c-tn-caveat">{tnGapHidden ? `${t.tennis.caveat} ${t.tennis.gapHidden}.` : t.tennis.caveat}</p> : null}
            {m && (m.guard ?? "ok") !== "ok" ? <p className="v3c-fine v3c-guard-note" data-guard={m.guard}>{m.guard === "market_only" ? fixdataCopyFor(lang).marketOnly : fixdataCopyFor(lang).noValue}</p> : null}
          </>
        )}
      </section>

      {strip ? (
        <ToolStrip
          title={c.pc.strip}
          all={c.allTools}
          items={strip}
          lang={lang}
        />
      ) : null}

      {m && chk ? (
        <div className="v3c-sec">
          {leadPrice != null && books.some((b) => b.price != null) && books.every((b) => b.price == null || b.price <= leadPrice) ? (
            <p className="v3c-small" style={{ marginBottom: 10 }}>
              {c.pc.youBeat(leadPrice.toFixed(2))}
            </p>
          ) : null}
          <PartnerBlock id="v3c-pc-p" title={c.pc.partnerTitle} label={labels[li]} books={books} checked={checked ? timeHM(checked, tz, locale) : null} partners={partners} surface="price_check" c={c} age={t.foot.age} timeOf={(iso) => timeHM(iso, tz, locale)} />
          <p className="v3c-small" style={{ marginTop: 10 }}>
            <Link href={matchHref(m.id)}>{c.pc.openMatch}</Link>
          </p>
        </div>
      ) : null}

      <section className="v3c-sec" aria-labelledby="v3c-pc-why">
        <h2 className="v3c-t-sec" id="v3c-pc-why">
          {c.pc.whyTitle}
        </h2>
        <p className="v3c-explain" style={{ marginTop: 8 }}>
          {m?.sport === "tennis" ? c.pc.whyBodyTennis : c.pc.whyBody}
        </p>
      </section>
    </>
  );
}
