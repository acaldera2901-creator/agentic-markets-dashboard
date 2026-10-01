import { NextRequest, NextResponse } from "next/server";
import { syncTennisPredictionsToUnified } from "@/lib/tennis-adapter";
import { ingestPartnerTennis } from "@/lib/partner-fixtures";
import { registraPrezziPartner } from "@/lib/partner-prezzi";
import { emptySyncReport, type SyncReport } from "@/lib/publication-gate";
import { verifyBearer } from "@/lib/admin-auth";

export const maxDuration = 300;

// #REFRESH-1001 — margine lasciato a fine giro: oltre `maxDuration - MARGINE`
// lo step prezzi non apre blocchi nuovi, cosi' la route risponde invece di
// essere uccisa dalla piattaforma.
const MARGINE_S = 30;

// #REFRESH2-1001 — budget per fase. Misurato sul giro delle 16:00 del 01/10
// (timestamp delle righe scritte): calcio ~133 s di calcolo + ~70 s di sync
// (200 righe una per una), ingest partner ~37 s, sync tennis ~60 s e ancora in
// corso a 300 s. In serie non ci stanno; il ramo tennis non dipende dal calcio
// (tabelle diverse), quindi gira IN PARALLELO e non aspetta piu' il suo tempo.
const INGEST_S = 90;

type Fase = { ms: number; stato: "ok" | "errore" | "saltata" };
const SALTATA = Symbol("saltata");

// Race `fn` against `scadenza`: past it the phase is logged as skipped and the
// route moves on (the promise is left running, not cancelled) instead of being
// killed by the platform at maxDuration with a silent 504.
async function conScadenza<T>(
  nome: string,
  scadenza: number,
  fasi: Record<string, Fase>,
  fn: () => Promise<T>,
): Promise<T | typeof SALTATA> {
  const t0 = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scaduta = new Promise<typeof SALTATA>((r) => {
    timer = setTimeout(() => r(SALTATA), Math.max(0, scadenza - t0));
  });
  try {
    const lavoro = fn();
    // A late rejection after a skip must not become an unhandled rejection.
    lavoro.catch(() => {});
    const esito = await Promise.race([lavoro, scaduta]);
    fasi[nome] = { ms: Date.now() - t0, stato: esito === SALTATA ? "saltata" : "ok" };
    if (esito === SALTATA) console.error(`[refresh] ${nome} SALTATA per scadenza dopo ${Date.now() - t0} ms`);
    return esito;
  } catch (e) {
    fasi[nome] = { ms: Date.now() - t0, stato: "errore" };
    throw e;
  } finally {
    clearTimeout(timer);
    console.log(`[refresh] ${nome} ${fasi[nome]?.stato} in ${fasi[nome]?.ms} ms`);
  }
}

// Vercel Cron calls GET with Authorization: Bearer <CRON_SECRET>.
// One scheduled job keeps unified_predictions populated for every sport:
//   1. football: recompute the model + sync (POST /api/predictions)
//   2. tennis:   sync the ESPN-fed tennis_predictions into unified_predictions
export async function GET(req: NextRequest) {
  // Default-deny + constant-time: a missing CRON_SECRET must never leave the
  // trigger open. `auth` is reused below to forward the bearer to /api/predictions.
  const avvio = Date.now();
  const auth = req.headers.get("authorization");
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const scadenza = avvio + (maxDuration - MARGINE_S) * 1000;
  const fasi: Record<string, Fase> = {};

  // ── 1. Football ──────────────────────────────────────────────────────────
  // Runs in its own function (POST /api/predictions, own maxDuration): a skip
  // here only stops waiting for it, it does not stop it.
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.get("host")}`;
  let football: unknown = null;
  let footballError: unknown = null;
  const calcio = conScadenza("football", scadenza, fasi, async () => {
    const resp = await fetch(`${base}/api/predictions`, {
      method: "POST",
      headers: auth ? { Authorization: auth } : {},
    });
    football = await resp.json();
    if (!resp.ok) footballError = { status: resp.status, detail: football };
  }).then(
    (esito) => { if (esito === SALTATA) footballError = "SALTATA per scadenza"; },
    (e) => { footballError = String(e); },
  );

  // ── 2. Tennis ────────────────────────────────────────────────────────────
  // Independent of football: even when club football is between seasons, tennis
  // keeps the board populated. A tennis failure must not fail the whole cron.
  let tennisReport: SyncReport = emptySyncReport();
  let tennisError: unknown = null;
  let partner: unknown = null;
  let partnerError: unknown = null;
  let prezzi: unknown = null;
  let prezziError: unknown = null;

  const ramoTennis = (async () => {
  // #PARTNER-INGEST-0911 — le partite dei partner PRIMA del sync, cosi' quelle
  // nuove entrano nello stesso giro invece di aspettare il successivo.
  //
  // Perche' qui e perche' in questo ordine: `ingestPartnerTennis` deposita in
  // `tennis_predictions` le partite che i book hanno e noi no (misurato l'11/09:
  // 81 future contro le 11 pubblicate), e `syncTennisPredictionsToUnified`
  // legge proprio da li'. Invertendo l'ordine il board le vedrebbe due ore
  // dopo, senza nessun guadagno.
  //
  // In un try suo: un partner che non risponde non deve impedire il sync delle
  // partite che abbiamo gia'. E' la stessa regola per cui il tennis ha un try
  // separato dal calcio — un guasto resta dove nasce.
  // #REFRESH2-1001 — l'ingest ha un budget suo: se lo sfora il sync tennis
  // parte lo stesso, con le partite che ci sono gia'.
  try {
    const esito = await conScadenza("ingest", Math.min(avvio + INGEST_S * 1000, scadenza), fasi, () => ingestPartnerTennis());
    if (esito === SALTATA) partnerError = "SALTATA per scadenza";
    else partner = esito;
  } catch (e) {
    partnerError = String(e);
  }

  try {
    const esito = await conScadenza("tennis", scadenza, fasi, () => syncTennisPredictionsToUnified());
    if (esito === SALTATA) tennisError = "SALTATA per scadenza";
    else tennisReport = esito;
  } catch (e) {
    tennisError = String(e);
  }

  // #PREZZI-STORIA-0911 — un'istantanea dei prezzi partner a ogni giro.
  //
  // E' l'impianto che rende misurabile l'edge, e oggi non c'era: sei test sui
  // segnali, uno solo concludibile, perche' `odds_snapshots` ha 16 milioni di
  // righe e quasi nessuna sulle partite che pubblichiamo (il CLV agganciava 17
  // pick su 74). Il feed lo leggiamo GIA' qui sopra per l'ingest: registrarne
  // il prezzo costa una scrittura, non una richiesta in piu'.
  //
  // In un try suo, come gli altri: una misura che non riesce non deve impedire
  // al board di aggiornarsi. Un impianto di misura che rompe cio' che misura
  // e' peggio di nessun impianto.
  //
  // #REFRESH-1001 — DOPO il sync tennis, e con una scadenza. Misurato il 30/09:
  // da 12:00 UTC le scritture di questo step finivano sempre a :05:32, cioe'
  // al maxDuration, e il sync tennis che veniva dopo non partiva piu' (0 righe
  // tennis future in unified_predictions). Il board non deve dipendere dal
  // tempo che avanza a una misura.
  try {
    const esito = await conScadenza("prezzi", scadenza, fasi, () => registraPrezziPartner(Date.now(), scadenza));
    if (esito === SALTATA) prezziError = "SALTATA per scadenza";
    else prezzi = esito;
  } catch (e) {
    prezziError = String(e);
  }
  })();

  await Promise.all([calcio, ramoTennis]);

  return NextResponse.json({
    ok: !footballError || tennisReport.synced > 0,
    football: footballError ? { error: footballError } : football,
    tennis: { ...tennisReport, ...(tennisError ? { error: tennisError } : {}) },
    partner: partnerError ? { error: partnerError } : partner,
    prezzi: prezziError ? { error: prezziError } : prezzi,
    fasi,
  });
}
