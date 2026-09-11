import { NextRequest, NextResponse } from "next/server";
import { syncTennisPredictionsToUnified } from "@/lib/tennis-adapter";
import { ingestPartnerTennis } from "@/lib/partner-fixtures";
import { emptySyncReport, type SyncReport } from "@/lib/publication-gate";
import { verifyBearer } from "@/lib/admin-auth";

export const maxDuration = 300;

// Vercel Cron calls GET with Authorization: Bearer <CRON_SECRET>.
// One scheduled job keeps unified_predictions populated for every sport:
//   1. football: recompute the model + sync (POST /api/predictions)
//   2. tennis:   sync the ESPN-fed tennis_predictions into unified_predictions
export async function GET(req: NextRequest) {
  // Default-deny + constant-time: a missing CRON_SECRET must never leave the
  // trigger open. `auth` is reused below to forward the bearer to /api/predictions.
  const auth = req.headers.get("authorization");
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── 1. Football ──────────────────────────────────────────────────────────
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.get("host")}`;
  let football: unknown = null;
  let footballError: unknown = null;
  try {
    const resp = await fetch(`${base}/api/predictions`, {
      method: "POST",
      headers: auth ? { Authorization: auth } : {},
    });
    football = await resp.json();
    if (!resp.ok) footballError = { status: resp.status, detail: football };
  } catch (e) {
    footballError = String(e);
  }

  // ── 2. Tennis ────────────────────────────────────────────────────────────
  // Independent of football: even when club football is between seasons, tennis
  // keeps the board populated. A tennis failure must not fail the whole cron.
  let tennisReport: SyncReport = emptySyncReport();
  let tennisError: unknown = null;
  let partner: unknown = null;
  let partnerError: unknown = null;

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
  try {
    partner = await ingestPartnerTennis();
  } catch (e) {
    partnerError = String(e);
  }

  try {
    tennisReport = await syncTennisPredictionsToUnified();
  } catch (e) {
    tennisError = String(e);
  }

  return NextResponse.json({
    ok: !footballError || tennisReport.synced > 0,
    football: footballError ? { error: footballError } : football,
    tennis: { ...tennisReport, ...(tennisError ? { error: tennisError } : {}) },
    partner: partnerError ? { error: partnerError } : partner,
  });
}
