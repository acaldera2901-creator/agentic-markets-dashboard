import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FOOTBALL_LEDGER_MODEL_VERSION,
  FOOTBALL_LEDGER_SOURCE_TABLE,
  LEDGER_MIRROR_CONFLICT,
  isLedgerFkRejection,
  ledgerMirrorRow,
  sealedOrphansSql,
} from "./pick-ledger-mirror";

// #LEDGER-MIRROR-0831 — il registro sigillato promette che ogni pick sigillato
// ha il suo esito nella chiusura. Misurato su produzione il 31/08: 88 pick
// sigillati con la partita iniziata da piu' di sei ore e NESSUNA riga di
// chiusura, dal 27/06 al 29/08. Due vie di chiusura scrivevano la riga servita
// e non il mirror.
//
// Il difetto era un'ASSENZA — una scrittura che non c'era — e un'assenza in
// review sembra niente. Per questo i test qui sotto leggono i SORGENTI (TS e
// Python) invece di fidarsi dell'occhio, come agent-roster.test.ts e
// adapter-refresh-parity.test.ts.
//
// NB co-locato sotto lib/ di proposito: vitest.config.ts `include` e'
// {app,lib,components,features}/**/*.test.ts, un file in tests/ non girerebbe.

const ROOT = join(__dirname, "..");
const leggi = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("la chiave della chiusura non deve divergere fra TS e Python", () => {
  it("il model_version del lato Python e' lo STESSO della costante TS", () => {
    // La FK di pick_settlement e' su (source_table, source_id, model_version).
    // Se le due parti scrivono versioni diverse, l'insert viene rifiutato con un
    // 23503 che il chiamante scarta come "atteso": il registro perde righe e
    // nessuno se ne accorge. E' esattamente la forma del difetto del 31/08.
    const py = leggi("agents/result_settlement.py");
    const versioni = [...py.matchAll(/model_version=\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(versioni.length).toBeGreaterThan(0);
    for (const v of versioni) expect(v).toBe(FOOTBALL_LEDGER_MODEL_VERSION);
  });

  it("il source_table del lato Python e' lo STESSO della costante TS", () => {
    const py = leggi("agents/result_settlement.py");
    const tabelle = [...py.matchAll(/source_table=\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(tabelle.length).toBeGreaterThan(0);
    for (const t of tabelle) expect(t).toBe(FOOTBALL_LEDGER_SOURCE_TABLE);
  });

  it("il cron non riscrive la chiave a mano: la prende dal modulo", () => {
    // Tre copie a mano erano il motivo per cui la chiave POTEVA divergere.
    const cron = leggi("app/api/cron/settle/route.ts");
    expect(cron).toContain('from "@/lib/pick-ledger-mirror"');
    expect(cron).not.toContain(`"${FOOTBALL_LEDGER_MODEL_VERSION}"`);
    expect(cron).not.toContain(`onConflict: "${LEDGER_MIRROR_CONFLICT}"`);
  });
});

describe("ogni via che chiude una riga servita scrive anche il mirror", () => {
  it("lo step E del cron, dopo aver messo 'unresolved', scrive in pick_settlement", () => {
    // Il difetto originale: questo step chiudeva la riga servita
    // (result='unresolved', is_historical=TRUE) e lasciava il pick sigillato
    // senza chiusura — 60 delle 88 orfane. La guardia e' strutturale perche' la
    // regressione sarebbe di nuovo un'assenza.
    const cron = leggi("app/api/cron/settle/route.ts");
    const stepE = cron.slice(cron.indexOf('result: "unresolved"'));
    expect(stepE).not.toBe("");
    expect(stepE).toContain('ledgerMirrorRow({');
    expect(stepE).toContain('result: "unresolved"');
    expect(stepE).toContain('from("pick_settlement")');
  });

  it("il ramo void-abbandonata del Python chiama record_pick_settlement", () => {
    // 17 delle 88 orfane. Il comportamento e' verificato in
    // tests/test_unified_void_ledger_mirror.py; qui si guarda che la chiamata
    // esista nel ramo, cosi' una rimozione non passa in silenzio.
    const py = leggi("agents/result_settlement.py");
    const i = py.indexOf("_should_void_abandoned(row)");
    expect(i).toBeGreaterThan(-1);
    const ramo = py.slice(i, i + 2500);
    expect(ramo).toContain("record_pick_settlement(");
    expect(ramo).toContain('result="void"');
  });

  it("gli scarti della FK si CONTANO, non si ignorano", () => {
    // Scartare il 23503 senza contarlo rende «atteso» e «chiave sbagliata»
    // indistinguibili: e' il motivo per cui la perdita e' durata due mesi.
    const cron = leggi("app/api/cron/settle/route.ts");
    expect(cron).toContain("isLedgerFkRejection");
    expect(cron).toContain("ledger_fk_skipped");
    expect(cron).not.toContain('psErr.code !== "23503"');
  });
});

describe("la riga di chiusura non inventa mai niente", () => {
  it("closing_odds e' null anche per una chiusura con punteggio", () => {
    // Al 31/08 non esiste una quota di chiusura agganciabile ai nostri pick:
    // 8 partite coperte in 30 giorni dalla sola fonte ammessa nel prodotto, e
    // nessuna delle 8 e' in pick_ledger. Un CLV scritto qui sarebbe inventato.
    const r = ledgerMirrorRow({
      sourceId: "espn:401896770",
      result: "won",
      outcome: "HOME",
      finalScore: "2-1",
    });
    expect(r.closing_odds).toBeNull();
  });

  it("senza punteggio, outcome e final_score restano null e non stringhe vuote", () => {
    // Una stringa vuota si legge come «lo sappiamo e non c'e' niente»; null si
    // legge come «non lo sappiamo». Sul registro pubblico la differenza conta.
    const r = ledgerMirrorRow({ sourceId: "espn:1", result: "unresolved" });
    expect(r.outcome).toBeNull();
    expect(r.final_score).toBeNull();
    expect(r.result).toBe("unresolved");
  });

  it("la chiave e' completa: le tre colonne della FK, sempre", () => {
    const r = ledgerMirrorRow({ sourceId: "oddsapi:abc", result: "void" });
    expect(r.source_table).toBe(FOOTBALL_LEDGER_SOURCE_TABLE);
    expect(r.model_version).toBe(FOOTBALL_LEDGER_MODEL_VERSION);
    expect(r.source_id).toBe("oddsapi:abc");
  });

  it("il bersaglio di conflitto elenca esattamente le colonne dell'indice UNIQUE", () => {
    // pick_settlement_pick_key (source_table, source_id, model_version).
    expect(LEDGER_MIRROR_CONFLICT.split(",")).toEqual([
      "source_table",
      "source_id",
      "model_version",
    ]);
  });
});

describe("il conteggio delle orfane", () => {
  it("il join e' sulle TRE colonne della FK, non su due", () => {
    // Con due colonne il numero e' giusto solo finche' model_version e'
    // uniforme (lo e' oggi: misurato). Il giorno che non lo e', un join a due
    // colonne considererebbe chiusa una riga chiusa da un ALTRO modello, e il
    // conteggio mentirebbe verso il basso — cioe' proprio nel verso che
    // nasconde il difetto.
    const sql = sealedOrphansSql();
    expect(sql).toContain("s.source_table  = l.source_table");
    expect(sql).toContain("s.source_id     = l.source_id");
    expect(sql).toContain("s.model_version = l.model_version");
    expect(sql).toContain("s.id IS NULL");
  });

  it("la grazia e' un parametro e finisce davvero nell'SQL", () => {
    expect(sealedOrphansSql(6)).toContain("INTERVAL '6 hours'");
    expect(sealedOrphansSql(48)).toContain("INTERVAL '48 hours'");
  });
});

describe("isLedgerFkRejection", () => {
  it("riconosce solo il 23503", () => {
    expect(isLedgerFkRejection("23503")).toBe(true);
    // 23505 e' la violazione di UNIQUE: NON e' assorbibile allo stesso modo.
    expect(isLedgerFkRejection("23505")).toBe(false);
    expect(isLedgerFkRejection(null)).toBe(false);
    expect(isLedgerFkRejection(undefined)).toBe(false);
  });
});
