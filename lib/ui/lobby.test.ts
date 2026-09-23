import { describe, it, expect } from "vitest";
import { buildLobbySections, lobbyCounts, lobbyKey, startingSoonLabel, LOBBY_ROW_CAP } from "./lobby";
import type { LobbyItem } from "./lobby";
import type { PredictionCardData } from "./prediction-card";

const NOW = Date.parse("2026-09-21T12:00:00Z");
const inMinutes = (m: number) => new Date(NOW + m * 60000).toISOString();

function item(over: Partial<PredictionCardData> & { id: string }): LobbyItem {
  const data: PredictionCardData = {
    sport: "football", league: "PL", home: "A", away: "B",
    startsAt: inMinutes(600), isLive: false, pick: "A to win",
    modelPct: 60, marketPct: 50, edgePct: 10, locked: false,
    ...over,
  };
  return { data, key: lobbyKey(data) };
}

describe("startingSoonLabel", () => {
  it("minuti sotto l'ora, ore e minuti sopra", () => {
    expect(startingSoonLabel(inMinutes(40), NOW)).toBe("Starts in 40 min");
    expect(startingSoonLabel(inMinutes(130), NOW)).toBe("Starts in 2h 10m");
    expect(startingSoonLabel(inMinutes(120), NOW)).toBe("Starts in 2h");
  });
  it("niente etichetta oltre la finestra, a partita iniziata o su data invalida", () => {
    expect(startingSoonLabel(inMinutes(400), NOW)).toBeNull();
    expect(startingSoonLabel(inMinutes(-5), NOW)).toBeNull();
    expect(startingSoonLabel("non-una-data", NOW)).toBeNull();
  });
});

describe("buildLobbySections", () => {
  it("non rende una sezione vuota: zero dati, zero sezioni", () => {
    expect(buildLobbySections({ football: [], tennis: [], now: NOW })).toEqual([]);
  });

  it("tiene l'ordine del brief fra le sezioni che hanno righe", () => {
    const secs = buildLobbySections({
      football: [item({ id: "f1", isLive: true }), item({ id: "f2", edgePct: 12 })],
      tennis: [item({ id: "t1", sport: "tennis", edgePct: 9 })],
      now: NOW,
    });
    expect(secs.map((s) => s.id)).toEqual(["top", "live", "edge", "football", "tennis"]);
  });

  it("Top Opportunities ordina per edge e scarta live e partite già iniziate", () => {
    const secs = buildLobbySections({
      football: [
        item({ id: "low", edgePct: 2 }),
        item({ id: "high", edgePct: 20 }),
        item({ id: "live", edgePct: 30, isLive: true }),
        item({ id: "past", edgePct: 40, startsAt: inMinutes(-30) }),
      ],
      tennis: [],
      now: NOW,
    });
    const top = secs.find((s) => s.id === "top")!;
    expect(top.items.map((i) => i.data.id)).toEqual(["high", "low"]);
  });

  it("senza prezzo di mercato una riga non entra in Top né in High Edge", () => {
    const secs = buildLobbySections({
      football: [item({ id: "nomarket", marketPct: null, edgePct: null })],
      tennis: [],
      now: NOW,
    });
    expect(secs.find((s) => s.id === "top")).toBeUndefined();
    expect(secs.find((s) => s.id === "edge")).toBeUndefined();
    // resta comunque visibile nella sezione del suo sport
    expect(secs.find((s) => s.id === "football")!.items).toHaveLength(1);
  });

  // #RESTYLING-0921 round 2: una riga CHIUSA porta model, mercato ed edge veri
  // (nasconde solo la pick), quindi ha tutti i requisiti per stare in Top e in
  // High Edge. Escluderla lasciava la Home di un anonimo senza le due fasce che
  // spiegano il prodotto — il bug segnalato da QA sul round 1.
  it("una riga chiusa con un edge reale entra in Top e in High Edge", () => {
    const secs = buildLobbySections({
      football: [
        item({ id: "locked", edgePct: 30, locked: true }),
        item({ id: "open", edgePct: 20 }),
      ],
      tennis: [],
      now: NOW,
    });
    expect(secs.find((s) => s.id === "top")!.items.map((i) => i.data.id)).toEqual(["locked", "open"]);
  });

  // #RESTYLING-0921 round 10 — da quando «Esplora tutto» non esiste più, le
  // viste Football e Tennis sono l'UNICO posto dove sta l'elenco completo: una
  // riga tagliata lì è una riga che nessuno può più raggiungere.
  it("la fascia sport è un assaggio in Home e l'elenco intero nella sua vista", () => {
    const rows = Array.from({ length: LOBBY_ROW_CAP + 4 }, (_, i) => item({ id: `f${i}` }));
    const home = buildLobbySections({ football: rows, tennis: [], now: NOW });
    expect(home.find((s) => s.id === "football")!.items).toHaveLength(LOBBY_ROW_CAP);
    const full = buildLobbySections({ football: rows, tennis: [], now: NOW, fullSportLists: true });
    expect(full.find((s) => s.id === "football")!.items).toHaveLength(rows.length);
  });

  it("High Edge non ripete ciò che è già in Top", () => {
    const rows = Array.from({ length: LOBBY_ROW_CAP + 2 }, (_, i) =>
      item({ id: `f${i}`, edgePct: 30 - i }),
    );
    const secs = buildLobbySections({ football: rows, tennis: [], now: NOW });
    const topKeys = secs.find((s) => s.id === "top")!.items.map((i) => i.key);
    const edgeKeys = secs.find((s) => s.id === "edge")!.items.map((i) => i.key);
    expect(topKeys).toHaveLength(LOBBY_ROW_CAP);
    expect(edgeKeys.some((k) => topKeys.includes(k))).toBe(false);
  });

  it("Starting Soon prende solo la finestra e ordina per orario", () => {
    const secs = buildLobbySections({
      football: [
        item({ id: "later", startsAt: inMinutes(150) }),
        item({ id: "sooner", startsAt: inMinutes(20) }),
        item({ id: "tomorrow", startsAt: inMinutes(900) }),
      ],
      tennis: [],
      now: NOW,
    });
    const soon = secs.find((s) => s.id === "soon")!;
    expect(soon.items.map((i) => i.data.id)).toEqual(["sooner", "later"]);
  });

  it("la watchlist compare solo con chiavi salvate che esistono ancora nel board", () => {
    const f1 = item({ id: "f1" });
    const noSaved = buildLobbySections({ football: [f1], tennis: [], now: NOW });
    expect(noSaved.find((s) => s.id === "watchlist")).toBeUndefined();

    const saved = buildLobbySections({
      football: [f1], tennis: [], now: NOW,
      saved: new Set([f1.key, "football:sparita"]),
    });
    expect(saved.find((s) => s.id === "watchlist")!.items.map((i) => i.key)).toEqual([f1.key]);
  });

  it("la chiave distingue calcio e tennis con lo stesso id", () => {
    expect(lobbyKey(item({ id: "1" }).data)).toBe("football:1");
    expect(lobbyKey(item({ id: "1", sport: "tennis" }).data)).toBe("tennis:1");
  });
});

// #RESTYLING-0921 round 2 — i numeri delle pill dell'hero.
describe("lobbyCounts", () => {
  it("conta le righe che ESISTONO, non quelle che una fascia mostra", () => {
    // edgePct: 1 = sotto EDGE_HIGH_PP, così le righe che servono a contare live
    // e imminenza non finiscono anche nel conteggio dell'edge.
    const rows = [
      item({ id: "l1", isLive: true, edgePct: 1 }),
      item({ id: "l2", isLive: true, edgePct: 1 }),
      item({ id: "s1", startsAt: inMinutes(40), edgePct: 1 }),
      item({ id: "s2", startsAt: inMinutes(170), edgePct: 1 }),
      item({ id: "far", startsAt: inMinutes(600), edgePct: 1 }),
      ...Array.from({ length: LOBBY_ROW_CAP + 3 }, (_, i) => item({ id: `e${i}`, edgePct: 12 })),
    ];
    const c = lobbyCounts(rows, NOW);
    expect(c.live).toBe(2);
    expect(c.soon).toBe(2);
    // Oltre il cap della fascia: la pill dice il totale vero.
    expect(c.highEdge).toBe(LOBBY_ROW_CAP + 3);
  });

  it("una riga live non è «a breve», e senza mercato non è «edge alto»", () => {
    const c = lobbyCounts([
      item({ id: "live-soon", isLive: true, startsAt: inMinutes(10), edgePct: 1 }),
      item({ id: "nomarket", marketPct: null, edgePct: null }),
    ], NOW);
    expect(c).toEqual({ live: 1, soon: 0, highEdge: 0 });
  });
});
