import { NextRequest, NextResponse } from "next/server";
import { syncTennisPredictionsToUnified } from "@/lib/tennis-adapter";

export const maxDuration = 300;

// Vercel Cron calls GET with Authorization: Bearer <CRON_SECRET>.
// One scheduled job keeps unified_predictions populated for every sport:
//   1. football: recompute the model + sync (POST /api/predictions)
//   2. tennis:   sync the ESPN-fed tennis_predictions into unified_predictions
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
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
  let tennisSynced = 0;
  let tennisError: unknown = null;
  try {
    tennisSynced = await syncTennisPredictionsToUnified();
  } catch (e) {
    tennisError = String(e);
  }

  return NextResponse.json({
    ok: !footballError || tennisSynced > 0,
    football: footballError ? { error: footballError } : football,
    tennis: { synced: tennisSynced, ...(tennisError ? { error: tennisError } : {}) },
  });
}
