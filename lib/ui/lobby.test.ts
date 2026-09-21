import { describe, it, expect } from "vitest";
import { buildLobbySections, lobbyKey, startingSoonLabel, LOBBY_ROW_CAP } from "./lobby";
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

  it("senza prezzo di mercato o se chiusa, una riga non entra in Top né in High Edge", () => {
    const secs = buildLobbySections({
      football: [
        item({ id: "nomarket", marketPct: null, edgePct: null }),
        item({ id: "locked", edgePct: 30, locked: true }),
      ],
      tennis: [],
      now: NOW,
    });
    expect(secs.find((s) => s.id === "top")).toBeUndefined();
    expect(secs.find((s) => s.id === "edge")).toBeUndefined();
    // restano comunque visibili nella sezione del loro sport
    expect(secs.find((s) => s.id === "football")!.items).toHaveLength(2);
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
