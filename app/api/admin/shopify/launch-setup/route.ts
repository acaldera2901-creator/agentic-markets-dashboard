// #LAUNCH-SETUP-0805 — one-off gated che crea nello store i selling plan di
// lancio e la variante Weekly a metà prezzo, e ritorna i 4 id pronti per le
// env. Sta sotto /api/admin/* col gate condiviso (ADMIN_SECRET, fail-closed):
// senza bearer valido risponde 401 e non tocca lo store. È idempotente, quindi
// una seconda chiamata per sbaglio ritorna gli stessi id senza creare doppioni.
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { adminGql, isShopifyAdminConfigured } from "@/lib/shopify-admin";
import { ensureLaunchSetup, readLaunchSetupEnv } from "@/lib/shopify-launch-setup";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isShopifyAdminConfigured()) {
    // Messaggio esplicito: la causa tipica è che mancano le credenziali Admin
    // (SHOPIFY_ADMIN_TOKEN oppure SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET).
    return NextResponse.json({ error: "shopify admin not configured" }, { status: 503 });
  }
  try {
    const result = await ensureLaunchSetup(adminGql, readLaunchSetupEnv());
    return NextResponse.json(result);
  } catch (e) {
    // Fail-loud: qui non ci sono soldi in volo, ma un errore a metà (2 gruppi
    // su 3 creati) deve essere visibile — alla chiamata successiva l'idempotenza
    // riprende da dove si era fermata.
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
