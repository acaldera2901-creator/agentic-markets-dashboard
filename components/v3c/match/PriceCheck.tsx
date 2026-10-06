"use client";
// components/v3c/match/PriceCheck.tsx (#REDESIGN-V3C F4)
// Il price check: l'utente sceglie una partita della board (o nessuna) e
// digita — o riempie con un clic — le quote del suo book. Subito: probabilità
// implicita, margine del book, margine tolto e, se c'è una partita, la nostra
// stima accanto con il gap. Poi la striscia EV · Kelly · convertitore con i
// prezzi digitati, poi (solo con una partita) dove il prezzo è migliore.
// Nessun input finisce nel markup come HTML: sono valori di <input>.
import Link from "next/link";
import { useState } from "react";
import type { Outcome, V3BookPrice } from "@/lib/v3c/contracts";
import { dayShort, gapText, isFlatGap, timeHM } from "@/lib/v3c/board-view";
import { useLocalTimeZone, useV3cCopy } from "@/lib/v3c/lang.client";
import { matchCopyFor } from "@/lib/v3c/match-copy";
import { bookList, checkPrices, checkedAt, gapDirection, matchHref, parsePrice, pricesAsInputs, toolStrip, type V3BookLink } from "@/lib/v3c/match-view";
import { Fascia } from "../Fascia";
import { Nastro } from "../Nastro";
import { PartnerBlock } from "./PartnerBlock";
import { ToolStrip } from "./ToolStrip";
import { v3cLang, v3cLocale } from "@/lib/v3c/copy";

export type PcOutcome = { outcome: Outcome; market_price: number | null; estimate_p: number; book_prices: V3BookPrice[] };
export type PcMatch = { id: string; home: string; away: string; kickoff: string; league: string | null; blend: boolean; outcomes: PcOutcome[]; links: V3BookLink[] };

const fmt2 = (n: number | null) => (n == null ? "" : n.toFixed(2));

function startPrices(m: PcMatch | null): string[] {
  if (!m) return ["2.15", "3.20", "3.50"];
  return m.outcomes.map((o) => fmt2(o.market_price ?? o.book_prices[0]?.price ?? null));
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

export function PriceCheck({ matches, initialId, partners, landing = [] }: { matches: PcMatch[]; initialId: string | null; partners: boolean; landing?: V3BookLink[] }) {
  const { lang, t } = useV3cCopy();
  const c = matchCopyFor(lang);
  const tz = useLocalTimeZone();
  const locale = v3cLocale(lang);
  const [id, setId] = useState<string>(initialId ?? "");
  const m = matches.find((x) => x.id === id) ?? null;
  const [raw, setRaw] = useState<string[]>(() => startPrices(m));
  // polish: il Kelly in percentuale + importo su un bankroll che l'utente può cambiare (500 di partenza)
  const [bankRaw, setBankRaw] = useState("500");
  const bankN = Number(bankRaw.replace(",", "."));
  const bank = Number.isFinite(bankN) && bankN > 0 ? bankN : 500;

  const labels = m ? [m.home, t.board.draw, m.away] : c.pc.outcomes;
  const parsed = raw.map(parsePrice);
  // senza partita il terzo prezzo è facoltativo (mercati a due esiti)
  const used = m ? parsed : parsed.filter((p, i) => i < 2 || raw[i].trim() !== "");
  const estimates = m ? m.outcomes.map((o) => o.estimate_p * 100) : [];
  const chk = checkPrices(used, estimates);

  function choose(next: string) {
    setId(next);
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

  const li = chk?.lead ?? 0;
  const leadPrice = used[li] ?? null;
  const E = m ? Math.round(estimates[li]) : null;
  const g = chk?.gaps[li] ?? null;
  const strip =
    chk && leadPrice != null
      ? m && E != null
        ? toolStrip([
            { slug: "ev-calculator", values: { price: leadPrice, prob: E } },
            { slug: "kelly-criterion", values: { price: leadPrice, prob: E, bank } },
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
            <span>1X2</span>
            <span>{c.pc.hint}</span>
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
            <button type="button" className="v3c-chip" onClick={() => setRaw(startPrices(m))}>
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
      <form className="v3c-tf v3c-pc-form" style={{ "--n": 3 } as React.CSSProperties} onSubmit={(e) => e.preventDefault()}>
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
              aria-invalid={raw[i]?.trim() !== "" && !(parsePrice(raw[i]) != null && (parsePrice(raw[i]) as number) > 1)}
              onChange={(e) => setRaw((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </label>
        ))}
      </form>

      <section aria-live="polite">
        {!chk ? (
          <p className="v3c-pc-err">{c.pc.invalid}</p>
        ) : (
          <>
            {m && E != null && g != null ? (
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
                  {m ? <th className="v3c-lab v3c-ra">{c.estimate}</th> : null}
                  {m ? <th className="v3c-lab v3c-ra">{c.gap}</th> : null}
                </tr>
              </thead>
              <tbody>
                {used.map((p, i) => (
                  <tr key={i} className={m && i === li ? "v3c-pc-lead" : undefined}>
                    <td>{labels[i]}</td>
                    <td className="v3c-ra v3c-num">{(p as number).toFixed(2)}</td>
                    <td className="v3c-ra v3c-num v3c-pc-c-imp">{chk.implied[i].toFixed(1)}%</td>
                    <td className="v3c-ra v3c-num v3c-m">{chk.noVig[i].toFixed(0)}%</td>
                    {m ? (
                      <td className="v3c-ra v3c-num">
                        <mark>{Math.round(estimates[i])}%</mark>
                      </td>
                    ) : null}
                    {m ? <td className={["v3c-ra", "v3c-num", isFlatGap(chk.gaps[i]) ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>{gapText(chk.gaps[i])} pp</td> : null}
                  </tr>
                ))}
                <tr className="v3c-pc-tot">
                  <td>{c.pc.total}</td>
                  <td />
                  <td className="v3c-ra v3c-pc-c-imp">{chk.sum.toFixed(1)}%</td>
                  <td className="v3c-ra">{chk.margin < 0 ? c.pc.under : c.pc.kept(`${chk.margin.toFixed(1)}%`)}</td>
                  {m ? <td /> : null}
                  {m ? <td /> : null}
                </tr>
              </tbody>
            </table>
            {m && E != null ? <Nastro market={Math.round(chk.noVig[li])} estimate={E} gap={g} marketLabel={c.market} estimateLabel={c.estimate} inLineLabel={t.board.inLine} gapLabel={t.board.gapWord} /> : null}
            <p className="v3c-fine">{m ? c.pc.fine : c.pc.fineNoEst}</p>
          </>
        )}
      </section>

      {strip ? (
        <ToolStrip
          title={c.pc.strip}
          all={c.allTools}
          items={strip}
          lang={lang}
          bank={
            m && E != null ? (
              <label className="v3c-pc-bank">
                <span className="v3c-lab">{c.pc.bankroll}</span>
                <input type="number" inputMode="decimal" min="1" step="10" value={bankRaw} onChange={(e) => setBankRaw(e.target.value)} />
              </label>
            ) : null
          }
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
          {c.pc.whyBody}
        </p>
      </section>
    </>
  );
}
