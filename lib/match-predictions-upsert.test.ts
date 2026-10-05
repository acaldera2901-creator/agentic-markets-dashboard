// @vitest-environment node
// lib/match-predictions-upsert.test.ts — #RECORD-ATOMICO-0930: l'upsert di
// match_predictions eseguito su un Postgres vero (PGlite), con la stessa stringa
// che dbQuery manda a exec_sql (interpolate di lib/db.ts). Copre le tre regole
// di lib/match-predictions-upsert.ts e il difetto che la #477 ripara.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { interpolate } from "@/lib/db";
import { MATCH_PREDICTIONS_UPSERT_SQL } from "@/lib/match-predictions-upsert";

// Le colonne che l'upsert tocca, come in
// supabase/migrations/20260524000000_initial_schema.sql.
const SCHEMA = `CREATE TABLE match_predictions (
  id SERIAL PRIMARY KEY,
  match_id VARCHAR NOT NULL UNIQUE,
  league VARCHAR NOT NULL,
  league_name VARCHAR NOT NULL,
  home_team VARCHAR NOT NULL,
  away_team VARCHAR NOT NULL,
  kickoff TIMESTAMPTZ NOT NULL,
  p_home FLOAT NOT NULL,
  p_draw FLOAT NOT NULL,
  p_away FLOAT NOT NULL,
  lambda_home FLOAT,
  lambda_away FLOAT,
  odds_home FLOAT,
  odds_draw FLOAT,
  odds_away FLOAT,
  edge FLOAT,
  best_selection VARCHAR,
  model_matches INT,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  enrichment JSONB
)`;

type Round = {
  kickoff?: string;
  p?: [number, number, number];
  odds?: [number, number, number] | null;
  edge?: number | null;
  pick?: string | null;
  enrichment?: Record<string, unknown>;
  timeConfirmed?: boolean;
};

// Stesso ordine di parametri di computeAndStore (app/api/predictions/route.ts).
function params(r: Round): unknown[] {
  const [ph, pd, pa] = r.p ?? [0.5, 0.3, 0.2];
  const odds = r.odds === undefined ? [1.9, 3.5, 4.2] : r.odds;
  return [
    "m1", "SA", "Serie A", "Inter", "Milan", r.kickoff ?? "2026-10-10T18:45:00.000Z",
    ph, pd, pa, 1.6, 1.1,
    odds?.[0] ?? null, odds?.[1] ?? null, odds?.[2] ?? null,
    r.edge === undefined ? 0.04 : r.edge, r.pick === undefined ? "HOME" : r.pick, 12,
    JSON.stringify(r.enrichment ?? { round: 1 }),
    r.timeConfirmed ?? true,
  ];
}

type Row = {
  kickoff: Date;
  p_home: number;
  p_away: number;
  odds_home: number | null;
  edge: number | null;
  best_selection: string | null;
  enrichment: Record<string, unknown>;
  computed_at: Date;
};

let db: PGlite;

async function upsert(r: Round) {
  await db.exec(interpolate(MATCH_PREDICTIONS_UPSERT_SQL, params(r)));
}

async function row(): Promise<Row> {
  const res = await db.query<Row>(
    "SELECT kickoff, p_home, p_away, odds_home, edge, best_selection, enrichment, computed_at FROM match_predictions WHERE match_id='m1'"
  );
  expect(res.rows).toHaveLength(1);
  return res.rows[0];
}

// computed_at viene da NOW(): lo si porta indietro per vedere chi lo rinnova.
async function ageRow() {
  await db.exec("UPDATE match_predictions SET computed_at = NOW() - interval '3 hours'");
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SCHEMA);
});

afterEach(async () => {
  await db.close();
});

describe("upsert match_predictions (#RECORD-ATOMICO-0930)", () => {
  it("prima scrittura: inserisce la riga intera", async () => {
    await upsert({});
    const r = await row();
    expect(r.p_home).toBe(0.5);
    expect(r.odds_home).toBe(1.9);
    expect(r.best_selection).toBe("HOME");
  });

  it("giro con quote nuove: tripla, quote, edge e pick cambiano insieme", async () => {
    await upsert({});
    await upsert({ p: [0.25, 0.25, 0.5], odds: [3.8, 3.4, 1.95], edge: 0.02, pick: "AWAY", enrichment: { round: 2 } });
    const r = await row();
    expect(r.p_away).toBe(0.5);
    expect(r.odds_home).toBe(3.8);
    expect(r.edge).toBe(0.02);
    expect(r.best_selection).toBe("AWAY");
    expect(r.enrichment).toEqual({ round: 2 });
  });

  it("riga tornata non affidabile (quote ci sono, pick no): la pick vecchia NON resta", async () => {
    // Il difetto del COALESCE: best_selection null veniva ignorato e restava
    // HOME, accanto a una tripla che non la giustificava piu'.
    await upsert({});
    await upsert({ p: [0.25, 0.25, 0.5], edge: null, pick: null, enrichment: { reliability: "insufficient_data" } });
    const r = await row();
    expect(r.p_away).toBe(0.5);
    expect(r.edge).toBeNull();
    expect(r.best_selection).toBeNull();
  });

  it("giro senza quote su una riga che le aveva: il record resta quello di prima, intero", async () => {
    await upsert({});
    await ageRow();
    const before = await row();
    // Senza prezzo la tripla e' il solo modello (non blendata), niente edge/pick.
    await upsert({ p: [0.25, 0.25, 0.5], odds: null, edge: null, pick: null, enrichment: { round: 2 } });
    const r = await row();
    expect(r.p_home).toBe(0.5);
    expect(r.p_away).toBe(0.2);
    expect(r.odds_home).toBe(1.9);
    expect(r.edge).toBe(0.04);
    expect(r.best_selection).toBe("HOME");
    expect(r.enrichment).toEqual({ round: 1 });
    // la freschezza dice che il dato e' dell'ultimo giro col prezzo
    expect(r.computed_at.getTime()).toBe(before.computed_at.getTime());
  });

  it("giro senza quote: il kickoff confermato si aggiorna comunque (rinvio)", async () => {
    await upsert({});
    await upsert({ odds: null, edge: null, pick: null, kickoff: "2026-10-11T16:00:00.000Z" });
    const r = await row();
    expect(r.kickoff.toISOString()).toBe("2026-10-11T16:00:00.000Z");
    expect(r.best_selection).toBe("HOME");
  });

  it("riga che il prezzo non l'ha mai avuto: il giro senza quote la aggiorna", async () => {
    await upsert({ odds: null, edge: null, pick: null });
    await ageRow();
    const before = await row();
    await upsert({ p: [0.4, 0.3, 0.3], odds: null, edge: null, pick: null, enrichment: { round: 2 } });
    const r = await row();
    expect(r.p_home).toBe(0.4);
    expect(r.odds_home).toBeNull();
    expect(r.enrichment).toEqual({ round: 2 });
    expect(r.computed_at.getTime()).toBeGreaterThan(before.computed_at.getTime());
  });

  it("dopo un giro senza quote, il primo giro col prezzo riscrive tutto", async () => {
    await upsert({});
    await upsert({ odds: null, edge: null, pick: null });
    await upsert({ p: [0.25, 0.25, 0.5], odds: [3.8, 3.4, 1.95], edge: 0.02, pick: "AWAY" });
    const r = await row();
    expect(r.odds_home).toBe(3.8);
    expect(r.best_selection).toBe("AWAY");
  });

  it("kickoff: un orario confermato sostituisce il precedente", async () => {
    await upsert({});
    await upsert({ kickoff: "2026-10-10T16:00:00.000Z" });
    expect((await row()).kickoff.toISOString()).toBe("2026-10-10T16:00:00.000Z");
  });

  it("kickoff: il segnaposto di mezzanotte non confermato non sovrascrive l'orario", async () => {
    await upsert({});
    await upsert({ kickoff: "2026-10-10T00:00:00.000Z", timeConfirmed: false });
    expect((await row()).kickoff.toISOString()).toBe("2026-10-10T18:45:00.000Z");
  });

  it("la stringa regge l'incapsulamento di exec_sql (SELECT ... FROM (<stmt>) t)", async () => {
    // exec_sql prova prima il wrapper e, fallito perche' e' una scrittura, esegue
    // lo statement nudo: il wrapper deve fallire per la ragione giusta (data-
    // modifying in FROM), non per un commento che si mangia la parentesi.
    const stmt = interpolate(MATCH_PREDICTIONS_UPSERT_SQL, params({}));
    await expect(db.exec(`SELECT * FROM (${stmt}) t`)).rejects.toThrow(/syntax error at or near "INTO"/);
  });
});
