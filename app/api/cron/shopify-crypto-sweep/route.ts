import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { isShopifyCryptoConfigured } from "@/lib/shopify";
import { closeStalePendingCryptoOrders, isShopifyAdminConfigured } from "@/lib/shopify-admin";

export const dynamic = "force-dynamic";

// #SHOPIFY-CRYPTO-2 — un ordine crypto nasce NON pagato: chi non completa il
// pagamento lascia un ordine aperto per sempre. Senza questa pulizia i report e
// il pannello ordini di Shopify si riempiono di pendenti fantasma, e diventa
// impossibile distinguere "nessuno ha pagato" da "un pagamento è andato perso".
// Chiude (non cancella) i pendenti crypto più vecchi di 24h: lo storico resta,
// e un pagamento in ritardo si recupera a mano.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isShopifyCryptoConfigured() || !isShopifyAdminConfigured()) {
    return NextResponse.json({ skipped: "crypto rail not configured" });
  }

  const gateway = process.env.SHOPIFY_CRYPTO_GATEWAY_NAME as string;
  try {
    const { closed, errors } = await closeStalePendingCryptoOrders(gateway, 24);
    if (closed.length > 0) console.log(`[shopify/crypto-sweep] chiusi: ${closed.join(", ")}`);
    for (const e of errors) console.error(`[shopify/crypto-sweep] ${e}`);
    return NextResponse.json({ closed: closed.length, errors });
  } catch (e) {
    console.error("[shopify/crypto-sweep] failed:", String(e));
    return NextResponse.json({ error: "sweep failed" }, { status: 500 });
  }
}
