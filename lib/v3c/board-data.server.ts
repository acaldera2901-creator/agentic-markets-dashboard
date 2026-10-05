// lib/v3c/board-data.server.ts (#REDESIGN-V3C F3)
// I dati delle due pagine di prodotto (/ e /predictions) lato server: la STESSA
// funzione di GET /api/v3/board (board-service) e di /api/v3/yesterday, senza
// un giro HTTP. `cache()` deduplica nella stessa richiesta: la fascia e la board
// leggono un payload solo.
import { cache } from "react";
import { headers } from "next/headers";
import { envFlagOn } from "@/lib/redesign-flag";
import { GEO_BLOCKED_COUNTRIES } from "@/lib/sportsbooks";
import { buildBoardResponse } from "./board-service";
import type { V3BoardResponse, V3YesterdayResponse } from "./contracts";
import { fetchSealedDay } from "./queries";
import { buildYesterday, yesterdayUtc } from "./yesterday";

/**
 * Le pagine di prodotto v3c si accendono SOLO con la variabile d'ambiente, non
 * con il cookie di override di /dev/flag. Due ragioni:
 *  1. la board v3c mostra stima e gap di ogni partita, che oggi sono gated per
 *     piano (F8, gated): con il cookie chiunque in produzione la vedrebbe — è
 *     la stessa regola di lib/v3c/guard.ts per /api/v3/*;
 *  2. a flag spento la pagina non chiama né cookies() né headers(): resta
 *     statica e IDENTICA a oggi, anche nel modo di essere servita.
 */
export function v3cProductOn(): boolean {
  return envFlagOn(process.env.NEXT_PUBLIC_REDESIGN);
}

export type BoardResult = { ok: true; data: V3BoardResponse } | { ok: false };
export type YesterdayResult = { ok: true; data: V3YesterdayResponse } | { ok: false };

export const getBoard = cache(async (): Promise<BoardResult> => {
  try {
    return { ok: true, data: await buildBoardResponse(new Date()) };
  } catch (e) {
    console.error("[v3c/board page]", String(e));
    return { ok: false };
  }
});

export const getYesterday = cache(async (): Promise<YesterdayResult> => {
  const now = new Date();
  const y = yesterdayUtc(now);
  try {
    return { ok: true, data: buildYesterday(await fetchSealedDay(y.from, y.to), y.day, now) };
  } catch (e) {
    console.error("[v3c/yesterday page]", String(e));
    return { ok: false };
  }
});

/** I link partner si mostrano solo fuori dai paesi bloccati (stessa lista di /api/geo-books). */
export async function partnersAllowed(): Promise<boolean> {
  const h = await headers();
  const country = (h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "").trim().toUpperCase();
  return !GEO_BLOCKED_COUNTRIES.has(country);
}
