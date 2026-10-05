"use client";
// components/v3c/dev/DsShowcase.tsx (#REDESIGN-V3C F1)
// Il catalogo vivo del design system: ogni componente con i dati d'esempio
// (SAMPLE, da lib/v3c/sample.ts — l'unica fonte). Serve a guardare, misurare
// e rompere: non è una pagina di prodotto. Le pagine vere arrivano da F3.
import Link from "next/link";
import { toolPath } from "@/lib/tools/registry";
import { BENCH_SLUGS, SAMPLE, SAMPLE_BOOKS, SAMPLE_MATCH, SAMPLE_TEAMS, SAMPLE_TENNIS, SAMPLE_TOOLS, benchExample, bestBook, leadOutcome, sampleTool } from "@/lib/v3c/sample";
import { formatSigned, gapPp } from "@/lib/v3c/scale";
import { BenchTool } from "../BenchTool";
import { BottomNav, V3C_NAV } from "../BottomNav";
import { BookMark, ChipPartner } from "../ChipPartner";
import { Fascia } from "../Fascia";
import { Monogramma, Monogrammi, ToolMark } from "../Monogramma";
import { Nastro } from "../Nastro";
import { Sigillo } from "../Sigillo";
import { Tape } from "../Tape";
import { ThemeToggle, V3cShell, type V3cMode } from "../V3cShell";
import { Board } from "../board/Board";
import { BoardError, BoardSkeleton } from "../board/BoardStates";
import type { V3BoardResponse, V3DaySummary } from "@/lib/v3c/contracts";

// F3 · gli stati della board con un payload SAMPLE nella forma del contratto v3.board.1
// (stessi numeri di SAMPLE_MATCH, link "#"): vuoto a cascata, errore, scheletro.
const DS_NOW = "2026-10-10T12:00:00.000Z";
const dsBook = (price: number) => ({ bookmaker: "fortuneplay", name: "NorthBet (sample)", price, captured_at: DS_NOW, source: "live_feed" as const, url: "#" });
const DS_BOARD: V3BoardResponse = {
  contract: "v3.board.1",
  generated_at: DS_NOW,
  window_days: 10,
  matches: [
    {
      id: "ds-gen-fio",
      sport: "football",
      league: "ITA",
      competition: "Serie A",
      kickoff: "2026-10-10T15:00:00.000Z",
      home: "Genoa",
      away: "Fiorentina",
      market: "1X2",
      margin_removed: 0.063,
      blend: { model: 0.3, market: 0.7 },
      estimate_as_of: "2026-10-10T11:40:00.000Z",
      sealed_at: "2026-10-10T09:02:00.000Z",
      focus: "home",
      outcomes: SAMPLE_MATCH.outcomes.map((o) => ({
        outcome: o.key as "home" | "draw" | "away",
        market_price: o.price,
        market_p: o.market / 100,
        model_p: null,
        estimate_p: o.estimate / 100,
        edge_pp: o.estimate - o.market,
        book_prices: [dsBook(o.prices.NB)],
        best_price: dsBook(o.prices.NB),
      })),
    },
  ],
  tennis: [],
  coverage: { tennis: { matches: 0, with_book_price: {}, from_model: 0, from_market: 0 }, matches: 1, with_market: 1, sealed: 1, with_book_price: {}, excluded: [], book_price_max_age_min: 150, books_from_history: [] },
  notes: [],
};
const DS_EMPTY: V3BoardResponse = { ...DS_BOARD, matches: [], tennis: [] };
const dsDay = (won: number, lost: number): V3DaySummary => ({ settled: won + lost, won, lost, other: 0, expected_wins: null, limited_sample: true });
const DS_YDAY = { day: "2026-10-09", football: dsDay(3, 2), tennis: dsDay(0, 0) };

type Props = { initialMode: V3cMode; fontClass: string; flagOn: boolean };

const SWATCHES: { name: string; v: string; role: string }[] = [
  { name: "paper", v: "--v3c-paper", role: "sfondo" },
  { name: "panel", v: "--v3c-panel", role: "pannello" },
  { name: "paper-2", v: "--v3c-paper-2", role: "traccia" },
  { name: "ink", v: "--v3c-ink", role: "testo, gap" },
  { name: "ink-2", v: "--v3c-ink-2", role: "testo secondario" },
  { name: "ink-3", v: "--v3c-ink-3", role: "fine print" },
  { name: "navy", v: "--v3c-navy", role: "fascia" },
  { name: "sky", v: "--v3c-sky", role: "mercato" },
  { name: "lime-hl", v: "--v3c-lime-hl", role: "LED, stima (mark)" },
  { name: "lime", v: "--v3c-lime", role: "stima (testo)" },
  { name: "royal", v: "--v3c-royal", role: "azione" },
  { name: "live", v: "--v3c-live", role: "live" },
];

const TAPE_POINTS = [
  { t: 0, v: 2.02 }, { t: 16, v: 2.02 }, { t: 16, v: 2.05 }, { t: 40, v: 2.05 }, { t: 40, v: 2.08 }, { t: 58, v: 2.08 },
  { t: 58, v: 2.1 }, { t: 84, v: 2.1 }, { t: 84, v: 2.14 }, { t: 92, v: 2.14 }, { t: 92, v: 2.15 }, { t: 100, v: 2.15 },
];

function Sec({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="v3c-ds-sec" aria-labelledby={`ds-${id}`}>
      <div className="v3c-sec-h">
        <h2 className="v3c-t-sec" id={`ds-${id}`}>
          {title}
        </h2>
        <em className="v3c-tag v3c-tag-sample">{SAMPLE}</em>
      </div>
      {note ? <p className="v3c-explain">{note}</p> : null}
      {children}
    </section>
  );
}

export function DsShowcase({ initialMode, fontClass, flagOn }: Props) {
  const m = SAMPLE_MATCH;
  const lead = leadOutcome(m.outcomes);
  const connected = SAMPLE_BOOKS.filter((b) => b.feed);
  const best = bestBook(lead);
  const fair = 100 / lead.estimate;
  const margin = benchExample("margin-calculator").output;

  return (
    <V3cShell initialMode={initialMode} fontClass={fontClass}>
      {(mode, toggle) => (
        <>
          <header className="v3c-top">
            <div className="v3c-wrap">
              <Link className="v3c-t-row" href="/dev/ds" aria-label="BetRedge — design system">
                BetRedge
              </Link>
              <nav className="v3c-nav" aria-label="Primary">
                {V3C_NAV.map((n) => (
                  <Link key={n.key} href={n.href} aria-current={n.key === "board" ? "page" : undefined}>
                    {n.key === "price" ? "Price check" : n.label}
                  </Link>
                ))}
                <Link href="/blog">News</Link>
                <Link href="/plans">Pro</Link>
              </nav>
              <div className="v3c-top-r">
                <a className="v3c-ghost" href={`/dev/flag?set=${flagOn ? "off" : "on"}&to=/dev/ds`}>
                  flag {flagOn ? "on" : "off"}
                </a>
                <ThemeToggle mode={mode} onToggle={toggle} />
              </div>
            </div>
          </header>

          <main className="v3c-wrap">
            <Fascia
              tab="Design system · v3c"
              title="The bench"
              meta={
                <>
                  <b>F1 · components</b>
                  <span>every number on this page is {SAMPLE}</span>
                  <Sigillo sealedAt={m.sealedAt} hash={m.hash} />
                </>
              }
            />
            <p className="v3c-lede">
              Market price, our estimate next to it, the sealed record. One grammar from the 30 px row to the match page: fascia, scoreboard numbers, monogram,
              two-point scale, seal.
            </p>

            <Sec id="colour" title="Colour · four roles, fixed" note="Sky = market. Lime highlighter = estimate. Royal = the user’s action. Ink = gap and text. Club colours live only in the monogram band. Contrast is measured in lib/v3c/tokens.test.ts.">
              <div className="v3c-ds-swatches">
                {SWATCHES.map((s) => (
                  <div className="v3c-ds-sw" key={s.name}>
                    <i style={{ background: `var(${s.v})` }} />
                    <span>
                      {s.name} <code>{s.v}</code>
                    </span>
                    <span className="v3c-fine">{s.role}</span>
                  </div>
                ))}
              </div>
            </Sec>

            <Sec id="type" title="Type · three levers beyond size" note="Big Shoulders (opsz 72) for headings and names. Archivo for text at width 100 and for numbers at width 75 / 800 — condensed like a scoreboard and tabular. JetBrains Mono only for the hash.">
              <div className="v3c-ds-grid v3c-ds-grid-2">
                <div>
                  <p className="v3c-t-page">Saturday 10 October</p>
                  <p className="v3c-t-match" style={{ marginTop: 12 }}>
                    Genoa <span className="v3c-vs">—</span> Fiorentina
                  </p>
                  <p className="v3c-t-sec" style={{ marginTop: 12 }}>
                    What moved a price today
                  </p>
                  <p className="v3c-t-row" style={{ marginTop: 12 }}>
                    Rayo Vallecano — Athletic Club
                  </p>
                  <p className="v3c-lab" style={{ marginTop: 12 }}>
                    Market % · <b>estimate</b> · gap in points
                  </p>
                  <p className="v3c-explain" style={{ marginTop: 12 }}>
                    Market %: average of 7 books, margin removed. Estimate: 70% market, 30% model. <b>Gap</b>: estimate − market, in points.
                  </p>
                  <p className="v3c-fine" style={{ marginTop: 8 }}>
                    Analysis, not advice. BetRedge is not a bookmaker and takes no bets.
                  </p>
                </div>
                <div>
                  <span className="v3c-lab">Scoreboard numbers · tabular (0000 = 1111)</span>
                  <p className="v3c-n-score" style={{ marginTop: 10 }}>
                    0000
                    <br />
                    1111
                  </p>
                  <p className="v3c-n-score" style={{ marginTop: 10 }}>
                    <span className="v3c-m">{lead.market}</span>
                    <i>%</i> → <mark>{lead.estimate}</mark>
                    <i>%</i>
                  </p>
                  <div className="v3c-ds-row">
                    <span className="v3c-n-xl">
                      {formatSigned(gapPp(lead.market, lead.estimate))}
                      <small> pp</small>
                    </span>
                    <span className="v3c-num">{lead.price.toFixed(2)}</span>
                    <span className="v3c-num v3c-m">{lead.market}%</span>
                    <mark className="v3c-num">{lead.estimate}%</mark>
                    <span className="v3c-num v3c-g-flat">{formatSigned(-1)} pp</span>
                  </div>
                </div>
              </div>
            </Sec>

            <Sec id="fascia" title="Fascia · the lower third" note="LED lime on top, the lockup’s cut on the right, a royal tab for context, the seal in white on navy. Opens every page; here with a match title.">
              <div className="v3c-ds-row" style={{ alignItems: "center" }}>
                <Monogrammi home={m.home} away={m.away} size="lg" />
                <span className="v3c-small">
                  {m.league} · {m.date} · {m.time} · {m.venue}
                </span>
              </div>
              <Fascia
                as="h2"
                id="ds-fascia-match"
                tab={`${m.league.split(" · ")[0]} · ${m.time}`}
                title={
                  <>
                    {m.home.name} <span className="v3c-vs">—</span> {m.away.name}
                  </>
                }
                meta={
                  <>
                    <b>3 outcomes</b>
                    <span>prices as of {m.pricesAsOf}</span>
                    <Sigillo sealedAt={m.sealedAt} hash={m.hash} />
                  </>
                }
              />
            </Sec>

            <Sec id="monogram" title="Monogram · a code on a card" note="Original monograms: the code on a neutral card, club colours only in the 4 px band and marked “to verify” until legal confirms. Tennis: initials and nation, no band. Tools share the grammar with a royal band. No real or generated crests, ever.">
              <div className="v3c-ds-row">
                {([SAMPLE_TEAMS.gen, SAMPLE_TEAMS.fio, SAMPLE_TEAMS.ray, SAMPLE_TEAMS.ath] as const).map((t) => (
                  <Monogramma key={t.name} team={t} />
                ))}
                <Monogramma team={SAMPLE_TEAMS.gen} size="lg" />
                <Monogramma team={{ name: "Unknown Town" }} />
              </div>
              <div className="v3c-ds-row">
                {([SAMPLE_TEAMS.alc, SAMPLE_TEAMS.run, SAMPLE_TEAMS.sin] as const).map((t) => (
                  <Monogramma key={t.name} team={t} />
                ))}
                <Monogramma team={SAMPLE_TEAMS.sin} size="lg" />
              </div>
              <div className="v3c-ds-row">
                {SAMPLE_TOOLS.map((t) => (
                  <ToolMark key={t.slug} sigla={t.sigla} name={t.name} />
                ))}
                <ToolMark sigla="EV" name="EV calculator" size="lg" />
              </div>
            </Sec>

            <Sec id="scale" title="Scale · two points, one declared window" note="Market and estimate on the same scale, the window written at both ends, the gap in points. Under 1.5 pp the row says “in line” and goes grey. Replaces the Price Temp.">
              <div className="v3c-ds-grid v3c-ds-grid-3">
                <div>
                  <span className="v3c-lab">{lead.label} · football</span>
                  <Nastro market={lead.market} estimate={lead.estimate} />
                </div>
                <div>
                  <span className="v3c-lab">Draw · in line</span>
                  <Nastro market={m.outcomes[1].market} estimate={m.outcomes[1].estimate} />
                </div>
                <div>
                  <span className="v3c-lab">{SAMPLE_TENNIS.outcomes[0].label} · tennis</span>
                  <Nastro market={SAMPLE_TENNIS.outcomes[0].market} estimate={SAMPLE_TENNIS.outcomes[0].estimate} />
                </div>
              </div>
            </Sec>

            <Sec id="tape" title="Tape · a price moves in steps" note="The market price as steps (sky), the estimate’s fair price from the seal to now (lime). Draws once; under prefers-reduced-motion it does not animate.">
              <div className="v3c-ds-row">
                <Tape points={TAPE_POINTS} fair={fair} sealT={70} draw />
                <Tape points={TAPE_POINTS} fair={fair} sealT={70} width={240} height={64} draw />
                <span className="v3c-small">
                  2.02 → 2.15 since opening · fair {fair.toFixed(2)} at {lead.estimate}%
                </span>
              </div>
            </Sec>

            <Sec id="seal" title="Seal · the proof" note="Sealed to the public ledger at the time shown; the hash is the first and last characters of the row. The only monospace in the system.">
              <div className="v3c-ds-row">
                <Sigillo sealedAt={m.sealedAt} hash={m.hash} />
                <Sigillo sealedAt="09:02 UTC" hash="7d02ab9e" label="sealed" />
                <span className="v3c-fine">An invalid hash renders nothing: no fake proof.</span>
              </div>
            </Sec>

            <Sec id="partner" title="Partner chip · logo and price" note="One chip per row, after the reading. rel=“nofollow sponsored”, aria-label says it is an affiliate link. Only books with a live feed show a price or can be best; the others appear by name only.">
              <div className="v3c-ds-row">
                {connected.map((b) => (
                  <ChipPartner key={b.code} book={b} price={lead.prices[b.code]} href="#" sample />
                ))}
                {SAMPLE_BOOKS.filter((b) => !b.feed).map((b) => (
                  <span key={b.code} className="v3c-small">
                    <BookMark book={b} /> {b.name} · landing only, no price shown
                  </span>
                ))}
              </div>
              <div className="v3c-partner" style={{ marginTop: 16, maxWidth: 560 }}>
                <div className="v3c-p-head">
                  <h3 className="v3c-t-sec">Where the price is best</h3>
                  <span className="v3c-small">
                    {lead.label} · {connected.length} connected books · checked {m.pricesAsOf}
                  </span>
                </div>
                <div className="v3c-p-best">
                  <BookMark book={best} size="lg" />
                  <div className="v3c-p-num">
                    <span className="v3c-lab">Best price · {best.name}</span>
                    <span className="v3c-n-xl">{lead.prices[best.code].toFixed(2)}</span>
                  </div>
                  <a className="v3c-btn v3c-btn-cta" href="#" rel="nofollow sponsored" data-partner={best.code}>
                    Go to {best.name} <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <p className="v3c-fine">
                  <span className="v3c-age">18+</span> Affiliate links · {SAMPLE} names
                </p>
              </div>
            </Sec>

            <Sec id="bench" title="Bench · the four most-used tools" note="Price check as the big piece, four tools as fillets, each with “input → result” computed on today’s board with lib/betting-math. The tool speaks the board’s language.">
              <div className="v3c-bench" style={{ marginTop: 14 }}>
                <div className="v3c-bench-h">
                  <div>
                    <span className="v3c-lab">The bench · 11 tools · free, no sign-in</span>
                    <h3 className="v3c-t-sec">Do the maths on any price</h3>
                  </div>
                  <Link className="v3c-ghost" href="/tools">
                    All 11 tools →
                  </Link>
                </div>
                <div className="v3c-bench-g">
                  <Link className="v3c-bench-pc" href="/price-check">
                    <ToolMark sigla="3→1" name="Price check" />
                    <span className="v3c-tr-t">
                      <b className="v3c-t-row">Price check</b>
                      <span className="v3c-tr-l">Type the three prices from your book. Margin, market probability, our estimate next to it.</span>
                    </span>
                    <span className="v3c-pc-ex">
                      <span className="v3c-in">{m.outcomes.map((o) => o.price.toFixed(2)).join(" · ")}</span>
                      <span className="v3c-arr" aria-hidden="true">
                        →
                      </span>
                      <span className="v3c-out">
                        margin <b className="v3c-num">{margin}</b> · {lead.label} <b className="v3c-num v3c-m">{lead.market}%</b> vs <mark className="v3c-num">{lead.estimate}%</mark>
                      </span>
                    </span>
                    <span className="v3c-btn v3c-btn-line v3c-btn-s">Check a price</span>
                  </Link>
                  {BENCH_SLUGS.map((slug) => {
                    const t = sampleTool(slug);
                    return <BenchTool key={slug} slug={slug} sigla={t.sigla} name={t.name} line={t.line} href={toolPath(slug, "en")} example={benchExample(slug)} />;
                  })}
                </div>
                <p className="v3c-fine">
                  Examples use {m.home.name} — {m.away.name} from today’s board. Each tool takes your numbers and ends on the board, not a paywall.
                </p>
              </div>
              <div style={{ marginTop: 28 }}>
                <span className="v3c-lab">Hub row · all 11</span>
                <div style={{ borderTop: "1px solid var(--v3c-line-2)", marginTop: 8 }}>
                  {SAMPLE_TOOLS.map((t) => (
                    <BenchTool key={t.slug} variant="hub" slug={t.slug} sigla={t.sigla} name={t.name} line={t.line} href={toolPath(t.slug, "en")} example={benchExample(t.slug)} />
                  ))}
                </div>
              </div>
            </Sec>

            <Sec id="controls" title="Controls · one royal action per screen" note="The CTA carries the lockup’s cut. Everything else is a line button, a chip or a ghost link. Filters are chips with aria-pressed.">
              <div className="v3c-ds-row">
                <a className="v3c-btn v3c-btn-cta" href="#">
                  Go to {best.name} <span aria-hidden="true">↗</span>
                </a>
                <a className="v3c-btn v3c-btn-line" href="#">
                  Check a price
                </a>
                <a className="v3c-btn v3c-btn-line v3c-btn-s" href="#">
                  Small
                </a>
                <a className="v3c-ghost" href="#">
                  All news →
                </a>
              </div>
              <div className="v3c-chips" role="group" aria-label="Sport" style={{ marginTop: 14 }}>
                <button type="button" className="v3c-chip" aria-pressed="true">
                  All <small>8</small>
                </button>
                <button type="button" className="v3c-chip" aria-pressed="false">
                  Football <small>6</small>
                </button>
                <button type="button" className="v3c-chip" aria-pressed="false">
                  Tennis <small>2</small>
                </button>
              </div>
            </Sec>

            <Sec id="states" title="Board states · F3" note="SAMPLE payload in the v3.board.1 shape. Empty for a filter: the cascade (no live → biggest gap today → next up with countdown → yesterday’s review). Nothing on the board. Error with retry. Skeleton with the geometry of the real rows.">
              <div className="v3c-ds-grid">
                <Board board={DS_BOARD} surface="home" partners={false} nowIso={DS_NOW} yesterday={DS_YDAY} initialFilters={{ sport: "tennis" }} frozenNow />
                <Board board={DS_EMPTY} surface="home" partners={false} nowIso={DS_NOW} yesterday={DS_YDAY} frozenNow />
                <BoardError />
                <BoardSkeleton rows={2} />
              </div>
            </Sec>

            <Sec id="nav" title="Bottom nav · five fixed voices" note="Board · Tools · Price · Record · Books. Visible under 821 px, fixed at the bottom; the current voice carries the royal rule on top. On desktop the same voices sit in the top bar.">
              <p className="v3c-small v3c-only-d">Resize under 821 px to see it. Glyphs are drawn at stroke 1.5, square caps — not a kit.</p>
              <p className="v3c-small v3c-only-m">It is the bar at the bottom of this screen.</p>
            </Sec>

            <footer className="v3c-foot">
              <div className="v3c-disc">
                <span className="v3c-age">18+</span>
                <span>Analysis, not advice. BetRedge is not a bookmaker and takes no bets.</span>
                <span>Football estimates are 70% market, 30% model.</span>
                <span>Partner links are commercial affiliates.</span>
              </div>
            </footer>
          </main>

          <BottomNav current="board" />
          <div className="v3c-sample-badge" aria-hidden="true">
            Sample data · design system
          </div>
        </>
      )}
    </V3cShell>
  );
}
