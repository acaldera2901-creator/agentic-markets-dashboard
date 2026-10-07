// lib/v3c/tape.ts (#REDESIGN-V3C fidelity) — il tape «open → now» della riga
// della board, come nel prototipo: la quota dell'esito guida a GRADINI, dai dati
// veri di partner_price_history (stesse serie del grafico della pagina partita,
// stessa linea principale = il book con più catture), e la stima come prezzo
// equo da quando è stata calcolata. Puro e testato: niente interpolazione,
// niente punto d'apertura inventato; meno di due catture = nessun tape.
import { estimateShown } from "./fixdata2";
import type { V3BoardMatch, V3BoardTennisMatch } from "./contracts";
import type { PartnerPriceRow } from "./board";
import { partnerSeries } from "./line-movement";
import { tennisMlSeries } from "./tennis";
import { leadOutcome, tennisLead } from "./board-view";
import { tapeLines, type TapeKey } from "./match-view";

/** pts: [t 0–100 sulla finestra prima→ultima cattura, quota]; fairT: da dove parte la linea della stima. */
export type RowTape = { pts: [number, number][]; fair: number | null; fairT: number; from: number; to: number; n: number };

/** Ore di storia lette per il tape della board (il tape lo dichiara nell'intestazione). */
export const TAPE_HOURS = 72;
const MAX_PTS = 16;

/**
 * Riduce a ≤ max punti tenendo la forma a gradini: la finestra è divisa in
 * `max − 1` tratti uguali e di ciascuno resta l'ULTIMA cattura (il prezzo in
 * vigore alla fine del tratto). Prima e ultima cattura restano sempre.
 */
export function stepSample(points: readonly { t: number; v: number }[], max = MAX_PTS): { t: number; v: number }[] {
  if (points.length <= max) return [...points];
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = Math.max(t1 - t0, 1);
  const buckets = new Map<number, { t: number; v: number }>();
  for (const p of points.slice(1, -1)) buckets.set(Math.min(max - 3, Math.floor(((p.t - t0) / span) * (max - 2))), p);
  return [points[0], ...[...buckets.entries()].sort(([a], [b]) => a - b).map(([, p]) => p), points[points.length - 1]];
}

export function buildTape(line: { points: readonly { t: number; v: number }[] } | undefined, fairP: number | null, fairFromMs: number | null): RowTape | null {
  if (!line || line.points.length < 2) return null;
  const pts = stepSample(line.points);
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const span = Math.max(t1 - t0, 1);
  const pos = (t: number) => Math.round(Math.min(100, Math.max(0, ((t - t0) / span) * 100)) * 10) / 10;
  const fair = fairP != null && fairP > 0 && fairP < 1 ? Math.round((1 / fairP) * 100) / 100 : null;
  return {
    pts: pts.map((p) => [pos(p.t), p.v]),
    fair,
    fairT: fair != null && fairFromMs != null && Number.isFinite(fairFromMs) ? pos(fairFromMs) : 0,
    from: line.points[0].v,
    to: line.points[line.points.length - 1].v,
    n: line.points.length,
  };
}

/** Tape della riga di calcio: esito guida della board, stima servita come prezzo equo da `estimate_as_of`. */
export function footballTape(m: V3BoardMatch, rows: PartnerPriceRow[]): RowTape | null {
  const lead = leadOutcome(m);
  const lines = tapeLines(partnerSeries(m, rows), lead.outcome as TapeKey);
  // fixdata2 N3: no fair-price line where the estimate is not shown (no market, or far from the best price)
  return buildTape(lines[0], m.blend && estimateShown(m) ? lead.estimate_p : null, Date.parse(m.estimate_as_of));
}

/** Tape della riga di tennis: lato in evidenza (favorito del mercato). ui3: nel tennis non diamo la stima, quindi nessuna linea della stima. */
export function tennisTape(m: V3BoardTennisMatch, rows: PartnerPriceRow[]): RowTape | null {
  const lead = tennisLead(m);
  const lines = tapeLines(tennisMlSeries({ home: m.player1, away: m.player2 }, rows), lead.side as TapeKey);
  return buildTape(lines[0], null, null);
}
