import { describe, it, expect } from "vitest";
import {
  normalizeEmbedRef,
  resolveEmbedMode,
  clampEmbedLimit,
  toEmbedRows,
  EMBED_MAX_LIMIT,
} from "@/lib/embed-feed";

// Righe minime nella forma di `unified_predictions` (solo i campi che l'embed legge).
const row = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  sport: "tennis",
  competition: "ATP Cincinnati",
  home_team: "Sinner",
  away_team: "Alcaraz",
  starts_at: "2026-08-24T18:00:00Z",
  market: "match_winner",
  pick: "Sinner",
  confidence_score: 0.71,
  edge_percent: 1.2,
  ...over,
});

describe("normalizeEmbedRef", () => {
  it("accetta un codice valido e lo normalizza in maiuscolo", () => {
    expect(normalizeEmbedRef("sergio")).toBe("SERGIO");
    expect(normalizeEmbedRef(" maven30 ")).toBe("MAVEN30");
  });

  it("rifiuta i codici malformati invece di troncarli", () => {
    expect(normalizeEmbedRef("A")).toBeNull();                       // troppo corto
    expect(normalizeEmbedRef("A".repeat(21))).toBeNull();            // troppo lungo, MAI troncato
    expect(normalizeEmbedRef("bad ref!")).toBeNull();                // caratteri fuori regex
    expect(normalizeEmbedRef(null)).toBeNull();
  });
});

describe("resolveEmbedMode", () => {
  it("è teaser per default: un ref sconosciuto non apre nulla", () => {
    expect(resolveEmbedMode("SCONOSCIUTO", "SERGIO,PARTNER2")).toBe("teaser");
    expect(resolveEmbedMode(null, "SERGIO")).toBe("teaser");
    expect(resolveEmbedMode("SERGIO", undefined)).toBe("teaser");
    expect(resolveEmbedMode("SERGIO", "")).toBe("teaser");
  });

  it("apre solo per i ref nell'allowlist del server", () => {
    expect(resolveEmbedMode("SERGIO", "SERGIO,PARTNER2")).toBe("open");
    expect(resolveEmbedMode("PARTNER2", " sergio , partner2 ")).toBe("open");
  });
});

describe("clampEmbedLimit", () => {
  it("clampa fuori range e degrada i valori non numerici al default", () => {
    expect(clampEmbedLimit("0")).toBe(1);
    expect(clampEmbedLimit("99")).toBe(EMBED_MAX_LIMIT);
    expect(clampEmbedLimit("3")).toBe(3);
    expect(clampEmbedLimit("abc")).toBe(3);
    expect(clampEmbedLimit(null)).toBe(3);
  });
});

describe("toEmbedRows", () => {
  const rows = [
    row({ id: "t1", sport: "tennis", pick: "Sinner", confidence_score: 0.74 }),
    row({ id: "t2", sport: "tennis", pick: "Rune", confidence_score: 0.66 }),
    row({ id: "f1", sport: "football", home_team: "Inter", away_team: "Milan", market: "1x2", pick: "Inter", confidence_score: 0.58 }),
    row({ id: "f2", sport: "football", home_team: "Roma", away_team: "Lazio", market: "1x2", pick: "Roma", confidence_score: 0.55 }),
  ];

  it("teaser: esattamente UNA riga sbloccata per sport, le altre restano visibili ma senza pick", () => {
    const out = toEmbedRows(rows, "teaser", 6, "it");
    const unlocked = out.filter((r) => !r.locked);
    expect(unlocked.map((r) => r.id).sort()).toEqual(["f1", "t1"]);
    expect(out).toHaveLength(4);
    // la riga bloccata mostra il match ma non la decisione né la confidence
    const locked = out.find((r) => r.id === "t2")!;
    expect(locked.homeTeam).toBe("Sinner");
    expect(locked.decision).toBeNull();
    expect(locked.confidence).toBeNull();
  });

  it("open: tutte le righe portano la decisione", () => {
    const out = toEmbedRows(rows, "open", 6, "it");
    expect(out.every((r) => !r.locked)).toBe(true);
    expect(out.every((r) => r.decision && r.decision.length > 0)).toBe(true);
  });

  it("rispetta il limite tenendo davanti le righe sbloccate", () => {
    const out = toEmbedRows(rows, "teaser", 2, "it");
    expect(out).toHaveLength(2);
    expect(out.every((r) => !r.locked)).toBe(true);
  });

  it("marca la top pick e converte la confidence in percentuale intera", () => {
    const out = toEmbedRows(rows, "teaser", 6, "it");
    const top = out.find((r) => r.id === "t1")!;
    expect(top.topPick).toBe(true);
    expect(top.confidence).toBe(74);
  });

  it("serve i match sotto floor (pick null) senza inventare una decisione", () => {
    const out = toEmbedRows([row({ id: "x1", pick: null, confidence_score: 0.52 })], "open", 6, "it");
    expect(out).toHaveLength(1);
    expect(out[0].decision).toBeNull();
    expect(out[0].locked).toBe(false);
  });

  it("localizza la decisione: italiano dal board, inglese senza italiano dentro", () => {
    const it = toEmbedRows([row({ id: "f9", sport: "football", home_team: "Inter", away_team: "Milan", market: "1x2", pick: "Inter" })], "open", 6, "it");
    expect(it[0].decision).toBe("Vince l'Inter");
    const en = toEmbedRows([row({ id: "f9", sport: "football", home_team: "Inter", away_team: "Milan", market: "1x2", pick: "Inter" })], "open", 6, "en");
    expect(en[0].decision).toBe("Inter to win");
  });
});
