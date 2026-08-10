// lib/x-posts.test.ts — #X-PIPELINE-0810
//
// Il post su X è pubblico, permanente e indicizzato: gli errori che questo file
// impedisce sono i tre che non si possono ritirare — una promessa di esito, un
// post rifiutato da X per lunghezza, e un post vuoto in un giorno senza partite.

import { describe, it, expect } from "vitest";
import {
  composeDay,
  tweetLength,
  fitsTweet,
  findBannedClaims,
  dayCostUsd,
  postCostUsd,
  X_POST_MAX_WEIGHTED,
  X_URL_WEIGHT,
  MIN_FAVORITE_PCT,
  type XPrediction,
  type XSlot,
} from "./x-posts";

const KICKOFF = "2026-08-10T19:45:00.000Z";

function pred(over: Partial<XPrediction> = {}): XPrediction {
  return {
    id: "p1",
    sport: "football",
    competition: "Bundesliga",
    home: "Bayern",
    away: "Leipzig",
    favorite: "Bayern",
    modelPct: 61,
    marketPct: 55,
    edgePct: 6,
    startsAtUtc: KICKOFF,
    ...over,
  };
}

const FIVE: XPrediction[] = [
  pred(),
  pred({ id: "p2", sport: "tennis", competition: "ATP Cincinnati", home: "Sinner", away: "Alcaraz", favorite: "Sinner", modelPct: 58, marketPct: 54, edgePct: 4, startsAtUtc: "2026-08-10T17:00:00.000Z" }),
  pred({ id: "p3", competition: "Serie A", home: "Inter", away: "Roma", favorite: "Inter", modelPct: 54, marketPct: 57, edgePct: -3, startsAtUtc: "2026-08-10T18:30:00.000Z" }),
  pred({ id: "p4", competition: "Premier League", home: "Arsenal", away: "Everton", favorite: "Arsenal", modelPct: 63, marketPct: 60, edgePct: 3, startsAtUtc: "2026-08-10T14:00:00.000Z" }),
  pred({ id: "p5", sport: "tennis", competition: "WTA Cincinnati", home: "Swiatek", away: "Gauff", favorite: "Swiatek", modelPct: 71, marketPct: 55, edgePct: 16, startsAtUtc: "2026-08-10T20:30:00.000Z" }),
];

const FULL_DAY = {
  dayUtc: "2026-08-10",
  predictions: FIVE,
  halftimeMatch: pred({ halftimeScore: "1-0" }),
  fulltimeMatch: pred({ finalScore: "2-0", favoriteWon: true }),
};

describe("tweetLength — la lunghezza che decide X, non String#length", () => {
  it("conta ogni URL 23 caratteri, non la sua lunghezza vera", () => {
    const short = "https://a.co";
    const long = "https://betredge.com/app?utm_source=x&utm_medium=organic&utm_campaign=daily";
    expect(long.length).toBeGreaterThan(X_URL_WEIGHT);
    expect(tweetLength(short)).toBe(X_URL_WEIGHT);
    expect(tweetLength(long)).toBe(X_URL_WEIGHT);
    expect(tweetLength(`ab ${long}`)).toBe(3 + X_URL_WEIGHT);
  });

  it("conta due URL separatamente", () => {
    expect(tweetLength("https://a.co https://b.co")).toBe(X_URL_WEIGHT * 2 + 1);
  });

  it("conta le emoji 2 (twitter-text v3), non 1", () => {
    // Il bug che questo test previene: 275 caratteri con sei emoji sono 281
    // pesati e X li rifiuta. Nessun test di String#length lo vede.
    expect(tweetLength("⚽")).toBe(2);
    expect(tweetLength("🤖")).toBe(2);
    expect(tweetLength("✅")).toBe(2);
    expect(tweetLength("a")).toBe(1);
    expect(tweetLength("·")).toBe(1); // U+00B7, dentro il range da 1
    expect(tweetLength("—")).toBe(1); // U+2014, dentro il range 8208–8223
  });

  it("è stabile su chiamate ripetute (nessun lastIndex che si porta dietro)", () => {
    const text = "vedi https://betredge.com/app";
    expect(tweetLength(text)).toBe(tweetLength(text));
    expect(fitsTweet(text)).toBe(true);
    expect(fitsTweet(text)).toBe(true);
  });
});

describe("findBannedClaims", () => {
  it("becca le promesse di esito", () => {
    expect(findBannedClaims("This is a sure bet tonight")).toContain("sure bet");
    expect(findBannedClaims("Bayern WILL WIN 2-0")).toContain("will win");
    expect(findBannedClaims("we beat the market every week")).toContain("beat the market");
    expect(findBannedClaims("profitto garantito")).toContain("profitto garantito");
  });

  it("non becca un readout onesto", () => {
    expect(findBannedClaims("Bayern: model 61% · market 55% · gap +6 pts")).toEqual([]);
  });
});

describe("composeDay — le cinque fasi", () => {
  const { posts, skipped } = composeDay(FULL_DAY);

  it("compone tutte e cinque le fasi del deck", () => {
    expect(posts.map((p) => p.slot)).toEqual(
      expect.arrayContaining<XSlot>([
        "morning_top5",
        "afternoon_gap",
        "prematch_card",
        "halftime_update",
        "fulltime_result",
      ])
    );
    expect(posts).toHaveLength(5);
    expect(skipped).toEqual([]);
  });

  it("nessun post promette un esito", () => {
    for (const p of posts) {
      expect(findBannedClaims(p.text), `${p.slot}: ${p.text}`).toEqual([]);
    }
  });

  it("nessun post supera i 280 pesati", () => {
    for (const p of posts) {
      expect(p.weightedLength, `${p.slot} (${p.weightedLength})`).toBeLessThanOrEqual(X_POST_MAX_WEIGHTED);
      expect(p.weightedLength).toBe(tweetLength(p.text));
    }
  });

  it("ogni post porta il disclaimer e il link al sito", () => {
    for (const p of posts) {
      expect(p.text, p.slot).toContain("not advice. 18+");
      expect(p.hasUrl, p.slot).toBe(true);
      expect(p.text, p.slot).toContain("https://betredge.com/app");
    }
  });

  it("solo il prematch porta la probability card", () => {
    expect(posts.filter((p) => p.media === "probability_card").map((p) => p.slot)).toEqual([
      "prematch_card",
    ]);
  });

  it("il prematch è a T−15, l'intervallo a T+60, il finale a T+115", () => {
    const at = (slot: XSlot) => posts.find((p) => p.slot === slot)!.scheduledAtUtc;
    expect(at("prematch_card")).toBe("2026-08-10T13:45:00.000Z"); // primo kickoff 14:00
    expect(at("halftime_update")).toBe("2026-08-10T20:45:00.000Z");
    expect(at("fulltime_result")).toBe("2026-08-10T21:40:00.000Z");
  });

  it("i post escono in ordine di orario", () => {
    const times = posts.map((p) => p.scheduledAtUtc);
    expect([...times].sort()).toEqual(times);
  });

  it("il top 5 nomina i cinque favoriti col loro %", () => {
    const top = posts.find((p) => p.slot === "morning_top5")!;
    for (const p of FIVE) expect(top.text, p.favorite).toContain(p.favorite);
    expect(top.text).toContain("71%"); // Swiatek, la più alta
  });

  it("il post del pomeriggio sceglie il gap più ampio in valore assoluto", () => {
    const gap = posts.find((p) => p.slot === "afternoon_gap")!;
    expect(gap.text).toContain("Swiatek"); // |+16| batte tutti
    expect(gap.text).toContain("gap +16 pts");
    // Deviazione dal deck dichiarata: readout, non "highest value bet". La
    // parola va cercata come PAROLA: "betredge.com" contiene "bet" e un
    // toContain("bet") boccia il nostro stesso dominio.
    expect(gap.text).not.toMatch(/\bbets?\b/i);
  });

  it("il gap negativo mantiene il segno (non diventa un valore assoluto)", () => {
    const only = composeDay({ dayUtc: "2026-08-10", predictions: [pred({ edgePct: -7.4, marketPct: 68 })] });
    const gap = only.posts.find((p) => p.slot === "afternoon_gap")!;
    expect(gap.text).toContain("gap -7.4 pts");
  });

  it("il finale dice se la chiamata era giusta, non se una scommessa ha vinto", () => {
    const ft = posts.find((p) => p.slot === "fulltime_result")!;
    expect(ft.text).toContain("2-0");
    expect(ft.text).toContain("correct");
    expect(ft.text.toUpperCase()).not.toContain("WON");
  });

  it("il finale sbagliato lo dice", () => {
    const { posts: p2 } = composeDay({
      ...FULL_DAY,
      fulltimeMatch: pred({ finalScore: "0-2", favoriteWon: false }),
    });
    expect(p2.find((p) => p.slot === "fulltime_result")!.text).toContain("missed");
  });
});

describe("i giorni in cui NON si pubblica", () => {
  it("nessuna predizione ⇒ zero post, cinque motivi", () => {
    const { posts, skipped } = composeDay({ dayUtc: "2026-08-10", predictions: [] });
    expect(posts).toEqual([]);
    expect(skipped).toHaveLength(5);
    expect(skipped.filter((s) => s.reason === "no_predictions")).toHaveLength(3);
    expect(skipped.map((s) => s.slot)).toContain("morning_top5");
  });

  it("nessuna predizione ⇒ nessun post con testo vuoto o lista vuota", () => {
    const { posts } = composeDay({ dayUtc: "2026-08-10", predictions: [] });
    // Il modo in cui questo si rompe è una lista vuota sotto un'intestazione:
    // "🤖 Top 5 AI predictions — 10 Aug" da solo, seguito dal link.
    expect(posts.some((p) => p.text.trim().length === 0)).toBe(false);
    expect(posts.length).toBe(0);
  });

  it("senza mercato non si inventa un gap: la fascia pomeridiana salta", () => {
    const { posts, skipped } = composeDay({
      dayUtc: "2026-08-10",
      predictions: [pred({ marketPct: null, edgePct: null })],
    });
    expect(posts.map((p) => p.slot)).not.toContain("afternoon_gap");
    expect(skipped).toContainEqual({ slot: "afternoon_gap", reason: "no_market_comparison" });
    // Il prematch resta, col solo % del modello.
    const pre = posts.find((p) => p.slot === "prematch_card")!;
    expect(pre.text).toContain("model 61%");
    expect(pre.text).not.toContain("market");
  });

  it("senza card renderizzata il prematch salta invece di uscire nudo", () => {
    const { posts, skipped } = composeDay({ ...FULL_DAY, cardAvailable: false });
    expect(posts.map((p) => p.slot)).not.toContain("prematch_card");
    expect(skipped).toContainEqual({ slot: "prematch_card", reason: "no_card" });
  });

  it("nessuna partita in corso / conclusa ⇒ intervallo e finale saltano", () => {
    const { posts, skipped } = composeDay({ dayUtc: "2026-08-10", predictions: FIVE });
    expect(posts.map((p) => p.slot)).not.toContain("halftime_update");
    expect(skipped).toContainEqual({ slot: "halftime_update", reason: "no_live_match" });
    expect(skipped).toContainEqual({ slot: "fulltime_result", reason: "no_settled_match" });
  });
});

describe("il favorito non è il pick (difetto trovato sui dati veri del 2026-08-10)", () => {
  // Sui dati reali il mapper pick→favorito stava per pubblicare
  // "⚽ Västerås SK 22%" sotto l'intestazione "Top 5 AI predictions": il 22% è la
  // probabilità di una SELEZIONE underdog, non un'affermazione su chi vince. In
  // un mercato 1/X/2 l'esito più probabile non può stare sotto ~33,3%.
  it("una probabilità sotto il floor non entra in nessuna fascia", () => {
    const underdog = pred({ favorite: "Västerås SK", modelPct: 22, marketPct: 25, edgePct: -3 });
    const { posts, skipped } = composeDay({
      dayUtc: "2026-08-10",
      predictions: [underdog],
      halftimeMatch: { ...underdog, halftimeScore: "1-0" },
      fulltimeMatch: { ...underdog, finalScore: "2-0", favoriteWon: true },
    });
    expect(posts).toEqual([]);
    expect(skipped.every((s) => s.reason === "no_eligible_favorite")).toBe(true);
    expect(MIN_FAVORITE_PCT).toBe(34);
  });

  it("un giorno di soli underdog si distingue da un giorno senza partite", () => {
    const a = composeDay({ dayUtc: "2026-08-10", predictions: [pred({ modelPct: 22 })] });
    const b = composeDay({ dayUtc: "2026-08-10", predictions: [] });
    expect(a.skipped[0].reason).toBe("no_eligible_favorite");
    expect(b.skipped[0].reason).toBe("no_predictions");
  });

  it("il favorito legittimo di un 1X2 al 36% resta pubblicabile", () => {
    // Il floor non deve bocciare un favorito vero di un mercato a tre vie.
    const { posts } = composeDay({ dayUtc: "2026-08-10", predictions: [pred({ modelPct: 36 })] });
    expect(posts.find((p) => p.slot === "morning_top5")!.text).toContain("36%");
  });

  it("gli underdog escono dal top list ma i favoriti dello stesso giorno restano", () => {
    const { posts } = composeDay({
      dayUtc: "2026-08-10",
      predictions: [...FIVE, pred({ id: "dog", favorite: "Västerås SK", modelPct: 22 })],
    });
    const top = posts.find((p) => p.slot === "morning_top5")!;
    expect(top.text).not.toContain("Västerås");
    expect(top.text).toContain("Swiatek");
  });
});

describe("nomi lunghi", () => {
  it("cinque nomi lunghissimi restano dentro i 280 senza troncare un nome", () => {
    const long = FIVE.map((p, i) =>
      pred({
        id: `long-${i}`,
        home: "Borussia Mönchengladbach",
        away: "Eintracht Frankfurt Fußball",
        favorite: "Borussia Mönchengladbach",
        modelPct: 55 + i,
        startsAtUtc: p.startsAtUtc,
      })
    );
    const { posts } = composeDay({ dayUtc: "2026-08-10", predictions: long });
    const top = posts.find((p) => p.slot === "morning_top5")!;
    expect(top.weightedLength).toBeLessThanOrEqual(X_POST_MAX_WEIGHTED);
    expect(top.text).toContain("Borussia Mönchengladbach");
    expect(top.text).not.toContain("…");
    // La scala di riduzione ha tolto il DETTAGLIO (l'avversario), non pezzi di
    // nome e non righe: cinque voci restano cinque voci, e l'intestazione dice 5.
    expect(top.text).not.toContain(" v Eintracht");
    expect(top.text).toContain("Top 5 AI predictions");
    expect(top.text.split("\n").filter((l) => l.startsWith("⚽"))).toHaveLength(5);
  });

  it("ogni post di ogni fase resta dentro i 280 anche coi nomi lunghi", () => {
    const long = pred({
      home: "Borussia Mönchengladbach",
      away: "Eintracht Frankfurt Fußball",
      favorite: "Borussia Mönchengladbach",
      competition: "Deutsche Fußball Bundesliga",
      halftimeScore: "1-1",
      finalScore: "2-2",
      favoriteWon: false,
    });
    const { posts } = composeDay({
      dayUtc: "2026-08-10",
      predictions: [long],
      halftimeMatch: long,
      fulltimeMatch: long,
    });
    expect(posts).toHaveLength(5);
    for (const p of posts) {
      expect(p.weightedLength, `${p.slot}: ${p.text}`).toBeLessThanOrEqual(X_POST_MAX_WEIGHTED);
    }
  });
});

describe("costo, ai prezzi pay-per-usage letti il 2026-08-10", () => {
  it("un post con link costa 0,20 $, uno senza 0,015 $", () => {
    expect(postCostUsd({ hasUrl: true })).toBe(0.2);
    expect(postCostUsd({ hasUrl: false })).toBe(0.015);
  });

  it("la giornata da cinque post — tutti con link — costa 1,00 $", () => {
    const { posts } = composeDay(FULL_DAY);
    expect(posts).toHaveLength(5);
    expect(dayCostUsd(posts)).toBeCloseTo(1.0, 6);
    // 5 post/giorno per 30 giorni = 30 $/mese: è la cifra che decide il budget.
    expect(dayCostUsd(posts) * 30).toBeCloseTo(30, 6);
  });
});
