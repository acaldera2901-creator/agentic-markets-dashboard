// components/v3c/final3.test.tsx (#REDESIGN-V3C final3) — banner colore, FAQ senza fattori tennis,
// «More on today's board» della pagina tennis.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { V3BoardTennisMatch } from "@/lib/v3c/contracts";
import { V3C_BANNER_COPY } from "@/lib/v3c/banner-copy";
import { V3C_HOME_FAQ } from "@/lib/v3c/home-faq";
import { ColourBanner, BANNER_HREF } from "./banners/ColourBanner";
import { MatchView, type MoreRow } from "./match/MatchView";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

describe("ColourBanner", () => {
  it("titoli ≤ 8 parole in tutte le 11 lingue", () => {
    const long = Object.entries(V3C_BANNER_COPY).flatMap(([l, d]) => Object.entries(d).filter(([, v]) => words(v.title) > 8).map(([k]) => `${l}.${k}`));
    expect(long).toEqual([]);
  });
  it("SVG inline di default: niente immagini, un link (non un bottone) con l'href interno", () => {
    const html = renderToStaticMarkup(<ColourBanner theme="tennis" />);
    expect(html).toContain("<svg");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<button");
    expect(html).toContain(`href="${BANNER_HREF.tennis.replace("&", "&amp;")}"`);
    expect(text(html)).toContain("Tennis: the market price, read clearly");
    // gli id dei pattern sono unici per tema e forma
    expect(html).toContain('id="cb-tennis-w-n"');
    expect(html).toContain('id="cb-tennis-m-n"');
  });
  it("GEN: <picture> AVIF → WebP → PNG, lazy, alt vuoto, width/height espliciti", () => {
    const html = renderToStaticMarkup(<ColourBanner theme="record" gen />);
    expect(html.indexOf("image/avif")).toBeLessThan(html.indexOf("image/webp"));
    expect(html).toMatch(/<img[^>]+loading="lazy"/);
    expect(html).toMatch(/<img[^>]+alt=""/);
    expect(html).toMatch(/<img[^>]+width="1600"[^>]+height="400"/);
    expect(html).not.toContain("<svg");
  });
  it("lingua passata dalla pagina (hub tool localizzato)", () => {
    expect(text(renderToStaticMarkup(<ColourBanner theme="pro" lang="it" />))).toContain("Scopri cosa aggiunge Pro");
  });
  it("i link Tennis/Calcio aprono la board filtrata, Live il gruppo live", () => {
    expect(BANNER_HREF.tennis).toBe("/predictions?sport=tennis");
    expect(BANNER_HREF.calcio).toBe("/predictions?sport=football");
    expect(BANNER_HREF.live).toBe("/predictions#live");
  });
});

describe("FAQ: Pro non aggiunge fattori tennis", () => {
  it("nessuna lingua cita servizio/risposta o superficie fra i fattori di Pro", () => {
    const all = JSON.stringify(V3C_HOME_FAQ);
    expect(all).not.toMatch(/serve and return|surface|servizio e risposta|superficie|Aufschlag|Belag|nawierzchnia|покрытие|underlag|zemin|ondergrond/i);
  });
});

describe("pagina tennis: «More on today's board»", () => {
  const TN = {
    id: "tennis:t1", sport: "tennis", tournament: "ATP Shanghai", kickoff: "2099-10-10T16:00:00.000Z", player1: "Jannik Sinner", player2: "Ben Shelton",
    market: "ML", model_version: "elo_surface_v4", probability_kind: "model", is_our_model: true, temperature: null, margin_removed: 0.05,
    market_source: { bookmaker: "fortuneplay", as_of: "2099-10-10T09:00:00.000Z" }, model_as_of: null, estimate_as_of: "2099-10-10T09:00:00.000Z",
    sealed_at: null, focus: "p1", surfaced_pick: "p1", gap_market: null, gap_null_reason: null,
    sides: [
      { side: "p1", player: "Jannik Sinner", market_price: 1.56, market_p: 0.64, model_p: 0.8, estimate_p: 0.77, sealed_p: null, market_p_at_seal: null, gap_pp: 13, book_prices: [], best_price: null },
      { side: "p2", player: "Ben Shelton", market_price: 2.78, market_p: 0.36, model_p: 0.2, estimate_p: 0.23, sealed_p: null, market_p_at_seal: null, gap_pp: -13, book_prices: [], best_price: null },
    ],
  } as unknown as V3BoardTennisMatch;
  const more: MoreRow[] = [
    { sport: "tennis", id: "tennis:t2", home: "Carlos Alcaraz", away: "Holger Rune", kickoff: "2099-10-10T18:00:00.000Z", league: "ATP Shanghai", gap: null, leadName: "Carlos Alcaraz", price: 1.3, market: 0.73, estimate: null },
  ];
  it("righe tennis con il mercato; niente intestazioni Estimate e Gap", () => {
    const html = renderToStaticMarkup(<MatchView kind="tennis" m={TN} series={[]} events={[]} partners={false} links={[]} more={more} />);
    const t = text(html);
    expect(t).toContain("Carlos Alcaraz — Holger Rune");
    expect(t).toContain("73");
    const block = html.slice(html.indexOf("v3c-mt-more"));
    expect(text(block)).not.toMatch(/Estimate|Gap/);
  });
  it("nessuna riga tennis → nessun blocco", () => {
    const html = renderToStaticMarkup(<MatchView kind="tennis" m={TN} series={[]} events={[]} partners={false} links={[]} more={[]} />);
    expect(html).not.toContain("v3c-mt-more");
  });
});
