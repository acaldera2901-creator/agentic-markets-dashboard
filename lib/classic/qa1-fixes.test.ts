// #CLASSIC-FIX2-1008 — i casi di QA-CLASSIC-1 (preview 3e59dbb7, 08/10) riprodotti coi numeri
// veri di /api/tennis, /api/predictions e /api/fortuneplay-odds di quel giro. Nessuna rete.
import { afterEach, describe, expect, it } from "vitest";
import type { LobbyItem } from "@/lib/ui/lobby";
import { classicTennisView, differsBy, type ClassicBook } from "./card-view";
import { dedupeLobby, differsMostItems, scopeLobby } from "./lobby-model";
import { parseUtcMs, tennisEstimate } from "./tennis-estimate";

const book = (key: string, prices: (number | null)[]): ClassicBook => ({ key, name: key, url: `https://example.test/${key}`, prices });
const NOW = new Date("2026-10-08T15:30:00Z");

describe("B1 · tennis «Market only» del feed partner = il de-vig servito, non 1/quota/1,05", () => {
  const partner = { started: false, modelVersion: "partner-market-v1", tournament: "Partner feed", eloAsOf: null, now: NOW };
  it("Mertens–Swiatek: 77,8 (API model_prob, de-vig di 4,10/1,17), non 81", () => {
    const books = [book("fortuneplay", [4.1, 1.17]), book("ybets", [4.42, 1.17])];
    const v = classicTennisView({ ...partner, player1: "Elise Mertens", player2: "Iga Swiatek", pLead: 0.778, oddsLead: 1.17, books });
    expect(v.kind).toBe("market_only");
    expect(v.bigPct!).toBeCloseTo(77.8, 6);
    expect(v.bigPct).toBe(v.marketPct);
    // il vecchio numero: 1/1,17/1,05 = 81,4
    expect(Math.round(v.bigPct!)).not.toBe(81);
  });
  it("Cerundolo–Alcaraz: 89,8, non 93", () => {
    const v = classicTennisView({ ...partner, player1: "Juan Manuel Cerundolo", player2: "Carlos Alcaraz", pLead: 0.8982, oddsLead: 1.02, books: [] });
    expect(v.kind).toBe("market_only");
    expect(v.bigPct!).toBeCloseTo(89.82, 6);
  });
  it("senza il numero servito: de-vig per book (come nel calcio), mai il margine fisso", () => {
    const v = classicTennisView({ ...partner, player1: "Elise Mertens", player2: "Iga Swiatek", pLead: null, oddsLead: 1.17, books: [book("fortuneplay", [4.1, 1.17])] });
    const fav = (1 / 1.17) / (1 / 1.17 + 1 / 4.1);
    expect(v.kind).toBe("market_only");
    expect(v.marketFrom).toBe("partners");
    expect(v.bigPct!).toBeCloseTo(fav * 100, 6);
    expect(v.bigPct!).toBeCloseTo(77.8, 0);
  });
});

// ─── A1 ──────────────────────────────────────────────────────────────────────
let seq = 0;
function row(sport: "football" | "tennis", home: string, away: string, startsAt: string, extra: Partial<LobbyItem["data"]> = {}): LobbyItem {
  const id = `r${++seq}`;
  const data = { id, sport, home, away, startsAt, isLive: false, league: null, pick: null, modelPct: 50, marketPct: 50, edgePct: 0, ...extra } as LobbyItem["data"];
  return { data, key: `${sport}:${id}` };
}

describe("A1 · una riga per partita (coppia non ordinata, ±48 h; tennis ±36 h, anche ESPN contro feed partner)", () => {
  it("Mertens–Swiatek: resta la riga ESPN (China Open 11:00Z), cade quella del feed partner (03:00Z)", () => {
    const partnerRow = row("tennis", "Elise Mertens", "Iga Swiatek", "2026-10-09T03:00:00Z", { probabilitySource: "market" });
    const espn = row("tennis", "Elise Mertens", "Iga Swiatek", "2026-10-09T11:00:00Z", { league: "China Open", probabilitySource: "model" });
    const out = dedupeLobby([partnerRow, espn]);
    expect(out.map((r) => r.key)).toEqual([espn.key]);
  });
  it("nomi con i token invertiti e giocatori a ruoli scambiati sono la stessa coppia", () => {
    const a = row("tennis", "Zheng Qinwen", "Elina Svitolina", "2026-10-09T05:00:00Z", { probabilitySource: "market" });
    const b = row("tennis", "Elina Svitolina", "Qinwen Zheng", "2026-10-09T09:00:00Z", { probabilitySource: "model" });
    expect(dedupeLobby([a, b]).map((r) => r.key)).toEqual([b.key]);
  });
  it("tennis oltre 36 h: due partite diverse, restano tutte e due", () => {
    const a = row("tennis", "A B", "C D", "2026-10-09T03:00:00Z");
    const b = row("tennis", "C D", "A B", "2026-10-10T16:00:00Z");
    expect(dedupeLobby([a, b])).toHaveLength(2);
  });
  it("Shamrock–Drogheda (gio 19:00Z / ven 19:00Z) e Qingdao–Beijing (ven / sab): una riga ciascuna", () => {
    const rows = [
      row("football", "Shamrock Rovers", "Drogheda United", "2026-10-08T19:00:00+00:00"),
      row("football", "Qingdao Hainiu FC", "Beijing FC", "2026-10-09T11:35:00+00:00"),
      row("football", "Shamrock Rovers", "Drogheda United", "2026-10-09T19:00:00+00:00"),
      row("football", "Qingdao Hainiu FC", "Beijing FC", "2026-10-10T11:30:00+00:00"),
      row("football", "Como", "Roma", "2026-10-10T16:00:00Z"),
    ];
    const out = dedupeLobby(rows);
    expect(out.map((r) => r.data.home)).toEqual(["Shamrock Rovers", "Qingdao Hainiu FC", "Como"]);
    expect(out.map((r) => r.data.startsAt)).toEqual(["2026-10-08T19:00:00+00:00", "2026-10-09T11:35:00+00:00", "2026-10-10T16:00:00Z"]);
  });
  it("calcio a 7 giorni (andata e ritorno): due partite", () => {
    const a = row("football", "Lens", "Lyon", "2026-10-09T18:45:00Z");
    const b = row("football", "Lyon", "Lens", "2026-10-16T18:45:00Z");
    expect(dedupeLobby([a, b])).toHaveLength(2);
  });
  it("il calcio non si confonde col tennis e l'ordine d'uscita è quello d'entrata", () => {
    const f = row("football", "A", "B", "2026-10-09T10:00:00Z");
    const t1 = row("tennis", "X Y", "Z W", "2026-10-09T10:00:00Z", { probabilitySource: "market" });
    const t2 = row("tennis", "Z W", "X Y", "2026-10-09T12:00:00Z", { probabilitySource: "model" });
    expect(dedupeLobby([t1, f, t2]).map((r) => r.key)).toEqual([f.key, t2.key]);
  });
});

// ─── A2 ──────────────────────────────────────────────────────────────────────
describe("A2 · computed_at senza fuso = UTC, lo stesso tipo di scheda in ogni fuso", () => {
  const ORIGINAL_TZ = process.env.TZ;
  afterEach(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });
  const NAIVE = "2026-10-08T12:01:00.492886"; // come lo serve /api/tennis
  const elo = {
    started: false, modelVersion: "elo_surface_v4_features_odds", tournament: "China Open", player1: "Elise Mertens", player2: "Iga Swiatek",
    p: [0.31, 0.69] as [number, number], odds: [4.1, 1.17] as [number, number], leadIdx: 1 as const, books: [],
  };
  for (const tz of ["Europe/Rome", "UTC", "America/New_York", "Asia/Tokyo"]) {
    it(`${tz}: stesso istante, stessa età dell'Elo, stessa scheda`, () => {
      process.env.TZ = tz;
      expect(parseUtcMs(NAIVE)).toBe(Date.UTC(2026, 9, 8, 12, 1, 0, 492));
      // 4 h dopo il computed_at: dentro le 6 h in ogni fuso
      const at = new Date("2026-10-08T16:01:00Z");
      const est = tennisEstimate({ tournament: "China Open", player1: "A", player2: "B", model_version: "elo_surface_v4_features_odds", market_p1: 0.7, market_p2: 0.3, elo_p1: 0.6, elo_p2: 0.4, elo_as_of: NAIVE }, at);
      expect(est.elo_age_min).toBe(240);
      expect(classicTennisView({ ...elo, eloAsOf: NAIVE, now: at }).kind).toBe("elo_blend");
      // 6 h 30 dopo: fuori in ogni fuso (a New York prima valeva ancora per 4 h in più)
      expect(classicTennisView({ ...elo, eloAsOf: NAIVE, now: new Date("2026-10-08T18:31:00Z") }).kind).toBe("market_only");
    });
  }
  it("un orario CON fuso resta quello che dice", () => {
    expect(parseUtcMs("2026-10-08T12:00:00+02:00")).toBe(Date.UTC(2026, 9, 8, 10));
    expect(parseUtcMs("2026-10-08T12:00:00Z")).toBe(Date.UTC(2026, 9, 8, 12));
    expect(parseUtcMs(null)).toBeNaN();
  });
  it("sanità del test: Date.parse da solo dipende dal fuso (Tokyo ≠ UTC)", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(Date.parse(NAIVE)).not.toBe(Date.UTC(2026, 9, 8, 12, 1, 0, 492));
  });
});

// ─── A3 ──────────────────────────────────────────────────────────────────────
describe("A3 · contatore e lista della striscia sport usano lo stesso filtro", () => {
  const T0 = Date.parse("2026-10-08T15:30:00Z");
  const at = (h: number) => new Date(T0 + h * 3600_000).toISOString();
  // come l'08/10: le leghe top giocano stasera tardi, nelle prossime 3 h solo tennis senza torneo + 1 calcio minore
  const rows = [
    row("football", "Inter", "Milan", at(5), { league: "Serie A" }),
    row("football", "HJK", "VPS", at(1), { league: "Veikkausliiga" }),
    ...Array.from({ length: 19 }, (_, i) => row("tennis", `P${i} A`, `Q${i} B`, at(0.5 + i * 0.1))),
  ];
  it("Starting Soon · Popular: il contatore è il numero di schede mostrate, e non è vuota", () => {
    const s = scopeLobby(rows, "soon", "popular", T0);
    expect(s.counts.popular).toBe(20);
    expect(s.list).toHaveLength(s.counts.popular);
    expect(s.hidden).toBe(0);
  });
  it("ogni sport e ogni tab: contatore = lista", () => {
    for (const tab of ["featured", "inplay", "soon", "all"] as const) {
      for (const sport of ["popular", "football", "tennis"] as const) {
        const s = scopeLobby(rows, tab, sport, T0);
        expect(s.list.length, `${tab}/${sport}`).toBe(s.counts[sport]);
      }
    }
  });
  it("Featured · Popular restringe alle leghe top e dice quante ne lascia fuori, della stessa tab", () => {
    const s = scopeLobby(rows, "featured", "popular", T0);
    expect(s.list.map((r) => r.data.home)).toEqual(["Inter"]);
    expect(s.hidden).toBe(20);
  });
});

// ─── M2 ──────────────────────────────────────────────────────────────────────
describe("M2 · «differs most» per lo scarto mostrato, con le quote partner", () => {
  // /api/predictions 08/10 (righe chiuse, nessuna quota servita) e /api/fortuneplay-odds dello stesso giro
  const lens = row("football", "Racing Club de Lens", "Olympique Lyonnais", "2026-10-09T18:45:00+00:00", {
    edgePct: null, classic: { sport: "football", estLead: 0.518014401937904, oddsLead: null },
  } as Partial<LobbyItem["data"]>);
  const lensBooks = [book("fortuneplay", [2.42, 3.69, 2.73]), book("ybets", [2.38, 3.61, 2.68])];
  it("Lens–Lione: +12,5 con i book partner (prima fuori: senza book era «No price yet»)", () => {
    expect(differsBy(lens.data)).toBeNull();
    expect(differsBy(lens.data, lensBooks)!).toBeCloseTo(12.5, 1);
  });
  it("ordine = |scarto mostrato| decrescente, non edgePct", () => {
    const mk = (edgePct: number) => row("football", `H${edgePct}`, `A${edgePct}`, "2026-10-09T18:00:00Z", { edgePct, classic: { sport: "football" } } as Partial<LobbyItem["data"]>);
    const items = [mk(9), mk(1), mk(5), lens];
    const shown: Record<string, number> = { [items[0].key]: 3.9, [items[1].key]: 2.3, [items[2].key]: 4.1, [lens.key]: 12.5 };
    const out = differsMostItems(items, Date.parse("2026-10-08T15:30:00Z"), 6, (it) => shown[it.key] ?? null);
    expect(out.map((r) => r.key)).toEqual([lens.key, items[2].key, items[0].key, items[1].key]);
  });
});
