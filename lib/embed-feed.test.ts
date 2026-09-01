import { describe, it, expect } from "vitest";
import {
  isRefBlocked,
  normalizeEmbedRef,
  resolveEmbedMode,
  clampEmbedLimit,
  toEmbedRows,
  EMBED_MAX_LIMIT,
} from "@/lib/embed-feed";
import { showcaseAllowance } from "@/lib/access-projection";

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
  confidence_score: 71,
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
    row({ id: "t1", sport: "tennis", pick: "Sinner", confidence_score: 74 }),
    row({ id: "t2", sport: "tennis", home_team: "Rune", away_team: "Zverev", pick: "Rune", confidence_score: 66 }),
    row({ id: "f1", sport: "football", home_team: "Inter", away_team: "Milan", market: "1x2", pick: "Inter", confidence_score: 58 }),
    row({ id: "f2", sport: "football", home_team: "Roma", away_team: "Lazio", market: "1x2", pick: "Roma", confidence_score: 55 }),
  ];

  it("teaser: esattamente UNA riga sbloccata per sport, le altre restano visibili ma senza pick", () => {
    const out = toEmbedRows(rows, "teaser", 6, "it");
    const unlocked = out.filter((r) => !r.locked);
    expect(unlocked.map((r) => r.id).sort()).toEqual(["f1", "t1"]);
    expect(out).toHaveLength(4);
    // la riga bloccata mostra il match ma non la decisione né la confidence
    const locked = out.find((r) => r.id === "t2")!;
    expect(locked.homeTeam).toBe("Rune");
    expect(locked.decision).toBeNull();
    expect(locked.confidence).toBeNull();
  });

  it("il tetto del teaser NON segue la quota del piano free (#FREE-BASE-DAILY-QUOTA-0831)", () => {
    // Il teaser proietta con `state="free"`: era una scorciatoia per "apri la
    // prima e copri il resto". Quando il free è passato da 1 a 3 pick per sport,
    // quella scorciatoia avrebbe aperto il widget sul sito del partner senza che
    // nessuno lo avesse deciso. Il widget ha un tetto suo: resta a 1.
    expect(showcaseAllowance("free")).toBe(3);
    const out = toEmbedRows(rows, "teaser", 6, "it");
    expect(out.filter((r) => !r.locked && r.sport === "tennis")).toHaveLength(1);
    expect(out.filter((r) => !r.locked && r.sport === "football")).toHaveLength(1);
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

  it("fra le sbloccate mette davanti quelle con una direzione reale", () => {
    const out = toEmbedRows([
      row({ id: "s1", sport: "tennis", pick: null, confidence_score: 71 }),
      row({ id: "s2", sport: "football", home_team: "Viking", away_team: "Aalesund", market: "1x2", pick: "Viking", confidence_score: 66 }),
    ], "teaser", 6, "it");
    expect(out.map((r) => r.id)).toEqual(["s2", "s1"]);
    // il gate resta quello della vetrina: entrambe sono top-1 del proprio sport
    expect(out.every((r) => !r.locked)).toBe(true);
  });

  it("marca la top pick e converte la confidence in percentuale intera", () => {
    const out = toEmbedRows(rows, "teaser", 6, "it");
    const top = out.find((r) => r.id === "t1")!;
    expect(top.topPick).toBe(true);
    expect(top.confidence).toBe(74);
  });

  it("serve i match sotto floor (pick null) senza inventare una DIREZIONE", () => {
    const out = toEmbedRows([row({ id: "x1", pick: null, confidence_score: 52 })], "open", 6, "it");
    expect(out).toHaveLength(1);
    expect(out[0].locked).toBe(false);
    // nessuna squadra nominata: la card dice che non c'è un favorito, non chi vince
    expect(out[0].decision).not.toMatch(/Sinner|Alcaraz/);
    expect(out[0].decision).toBe("Nessun favorito netto");
  });

  it("legge la confidence nella scala del DB (0-100) e regge anche 0-1", () => {
    // MISURATO il 2026-08-24: unified_predictions tiene confidence_score in
    // 0-100 (min 34, max 79). Moltiplicarlo per 100 stampava "7100%" nel
    // widget di un partner. Si accettano entrambe le scale: due pipeline
    // scrivono su questa tabella e la prossima potrebbe usare l'altra.
    const cento = toEmbedRows([row({ id: "c1", confidence_score: 71 })], "open", 6, "it");
    expect(cento[0].confidence).toBe(71);
    const uno = toEmbedRows([row({ id: "c2", confidence_score: 0.71 })], "open", 6, "it");
    expect(uno[0].confidence).toBe(71);
    // niente percentuali impossibili, mai
    for (const r of [...cento, ...uno]) expect(r.confidence!).toBeLessThanOrEqual(100);
  });

  it("dice «nessun favorito netto» invece di un trattino quando non c'è pick", () => {
    // Il feed del sito (features/feed) usa la stessa etichetta: il widget non
    // può essere piu' povero della card che promuove.
    const it0 = toEmbedRows([row({ id: "n1", pick: null })], "open", 6, "it");
    expect(it0[0].decision).toBe("Nessun favorito netto");
    const en0 = toEmbedRows([row({ id: "n1", pick: null })], "open", 6, "en");
    expect(en0[0].decision).toBe("No clear favourite");
  });

  it("non mostra la stessa partita due volte quando due fonti la scrivono diversa", () => {
    // Su tre righe dentro il sito di un partner un doppione è un terzo del
    // widget, e le due copie possono portare verdetti diversi. Si riusa
    // l'identità del board (#DUP-FIXTURES-0821); vince la riga più fresca.
    const out = toEmbedRows([
      row({ id: "d1", sport: "football", home_team: "BK Häcken", away_team: "Saint-Étienne", market: "1x2", pick: "BK Häcken", confidence_score: 57, updated_at: "2026-08-24T09:00:00Z" }),
      row({ id: "d2", sport: "football", home_team: "BK Hacken", away_team: "Saint Etienne", market: "1x2", pick: "BK Hacken", confidence_score: 58, updated_at: "2026-08-24T10:00:00Z" }),
    ], "open", 6, "it");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("d2"); // la più fresca
  });

  it("LIMITE NOTO: due sigle d'identità diverse restano due card", () => {
    // "Tigre" e "CA Tigre BA" sopravvivono entrambe, come sul board: togliere
    // una sigla corta significherebbe fondere club realmente diversi. Il test
    // fissa il comportamento perché sia una scelta e non una sorpresa.
    const out = toEmbedRows([
      row({ id: "e1", sport: "football", home_team: "Tigre", away_team: "Central Córdoba", market: "1x2", pick: "Tigre", confidence_score: 57 }),
      row({ id: "e2", sport: "football", home_team: "CA Tigre BA", away_team: "Central Córdoba (Santiago del Estero)", market: "1x2", pick: null, confidence_score: 57 }),
    ], "open", 6, "it");
    expect(out).toHaveLength(2);
  });

  it("localizza la decisione: italiano dal board, inglese senza italiano dentro", () => {
    const it = toEmbedRows([row({ id: "f9", sport: "football", home_team: "Inter", away_team: "Milan", market: "1x2", pick: "Inter" })], "open", 6, "it");
    expect(it[0].decision).toBe("Vince l'Inter");
    const en = toEmbedRows([row({ id: "f9", sport: "football", home_team: "Inter", away_team: "Milan", market: "1x2", pick: "Inter" })], "open", 6, "en");
    expect(en[0].decision).toBe("Inter to win");
  });
});

describe("segnaposto e blocklist (#WIDGET-TRUTH-0824)", () => {
  it("il segnaposto della guida NON è un'attribuzione", () => {
    // MISURATO: 'YOUR-CODE' passa la regex, quindi chi copia lo snippet dalla
    // guida senza sostituirlo manderebbe le iscrizioni a un codice fantasma —
    // e sembrerebbe funzionare. Nel DB ci sono già due referred_by orfani.
    expect(normalizeEmbedRef("YOUR-CODE")).toBeNull();
    expect(normalizeEmbedRef("your-code")).toBeNull();
    expect(normalizeEmbedRef("YOURCODE")).toBeNull();
    expect(normalizeEmbedRef("PARTNER-CODE")).toBeNull();
    // un codice vero resta valido
    expect(normalizeEmbedRef("SERGIOBETR")).toBe("SERGIOBETR");
  });

  it("un codice nella blocklist spegne il widget, non lo declassa", () => {
    // La guida partner promette che possiamo disattivare il widget per un
    // codice: deve essere vero nel codice, non solo nel PDF.
    expect(isRefBlocked("CATTIVO", "CATTIVO,ALTRO")).toBe(true);
    expect(isRefBlocked("cattivo", " cattivo ")).toBe(true);
    expect(isRefBlocked("SERGIOBETR", "CATTIVO")).toBe(false);
    expect(isRefBlocked(null, "CATTIVO")).toBe(false);
    expect(isRefBlocked("CATTIVO", undefined)).toBe(false);
  });

  it("un ref bloccato non ottiene comunque la versione aperta", () => {
    // Difesa in profondità: se un codice finisce in tutte e due le liste,
    // vince lo spegnimento.
    expect(resolveEmbedMode("CATTIVO", "CATTIVO")).toBe("open"); // l'allowlist da sola direbbe open…
    expect(isRefBlocked("CATTIVO", "CATTIVO")).toBe(true);       // …ma la route spegne prima di servire
  });
});
