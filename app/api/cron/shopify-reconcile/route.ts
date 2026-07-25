import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { verifyBearer } from "@/lib/admin-auth";
import { activateShopifyPlan } from "@/lib/plan-grant";
import { resolveOrderFromVariant } from "@/lib/shopify";
import { opsAlert } from "@/lib/ops-alert";

export const dynamic = "force-dynamic";

// Gemella di paygate-reconcile, per il rail Shopify. Serve perché un ordine PAGATO
// può restare senza piano e Shopify non ritenta in eterno: il caso reale è l'utente
// che paga e si registra DOPO (il profilo non esiste ancora al momento del webhook,
// activateShopifyPlan ritorna null), oppure un errore DB transitorio sul grant.
// Senza questo cron quei pagamenti restavano orfani con recupero solo manuale.
//
// Ri-tenta gli eventi 'unresolved' recenti usando identifier+variant registrati
// dal webhook. Idempotente e self-healing: appena il profilo esiste, il piano
// viene concesso e l'evento passa a 'granted'. Cron-secret gated.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const events = await dbQuery<{ event_id: string; identifier: string | null; variant_id: string | null }>(
    `SELECT event_id, identifier, variant_id
       FROM shopify_events
      WHERE status = 'unresolved'
        AND event_type = 'orders/paid'
        AND processed_at > NOW() - INTERVAL '30 days'
      ORDER BY processed_at ASC
      LIMIT 100`
  );

  let granted = 0;
  let stillUnresolved = 0;
  const errors: string[] = [];

  for (const ev of events) {
    try {
      const resolved = resolveOrderFromVariant(ev.variant_id);
      if (!ev.identifier || !resolved) {
        // Irrecuperabile in automatico: variant non nostro o identifier mai
        // arrivato. Non lo tocchiamo, resta visibile per revisione manuale.
        stillUnresolved++;
        continue;
      }
      const g = await activateShopifyPlan(ev.identifier, resolved.plan, resolved.period);
      if (g) {
        await dbExecute(
          `UPDATE shopify_events SET status = 'granted', last_error = NULL WHERE event_id = $1`,
          [ev.event_id]
        );
        granted++;
        console.log(`[shopify/reconcile] GRANT order=${ev.event_id} plan=${g.plan} period=${resolved.period}`);
      } else {
        // Profilo ancora inesistente o grandfather: si ritenta al prossimo giro.
        stillUnresolved++;
      }
    } catch (e) {
      errors.push(`${ev.event_id}: ${String(e)}`);
    }
  }

  // Blocker go-live: un ordine può restare 'pending' per sempre. Il webhook
  // scrive la riga di idempotenza PRIMA di concedere il piano; se la function
  // muore lì in mezzo (timeout, OOM) la riga resta 'pending' e il retry di
  // Shopify la vede come duplicata e non fa nulla → pagamento incassato, piano
  // mai concesso, e nessuno se ne accorge perché la scansione qui sopra guarda
  // solo 'unresolved'.
  // NON si ri-tenta in automatico: non sappiamo se il grant era già passato, e
  // activateShopifyPlan STACCA il tempo residuo → un secondo giro regalerebbe
  // un mese/anno in più. Si segnala una volta e si marca 'stale' (che è anche
  // ciò che evita di ri-allertare ogni 10 minuti sullo stesso ordine).
  const stale = await dbQuery<{ event_id: string; identifier: string | null }>(
    `SELECT event_id, identifier
       FROM shopify_events
      WHERE status = 'pending'
        AND event_type = 'orders/paid'
        AND processed_at < NOW() - INTERVAL '15 minutes'
      ORDER BY processed_at ASC
      LIMIT 50`
  );
  for (const ev of stale) {
    await dbExecute(
      `UPDATE shopify_events
          SET status = 'stale',
              last_error = 'webhook interrotto a metà: verificare a mano se il piano è stato concesso'
        WHERE event_id = $1 AND status = 'pending'`,
      [ev.event_id]
    );
    console.error(`[shopify/reconcile] STALE order=${ev.event_id} identifier=${ev.identifier ?? "?"}`);
  }

  // Un pagamento che resta senza piano è un problema di soldi: va segnalato, non
  // solo contato. Alert solo se c'è davvero qualcosa di irrisolto.
  if (stillUnresolved > 0 || errors.length > 0 || stale.length > 0) {
    await opsAlert("shopify-reconcile", [
      ...(stillUnresolved > 0 ? [`${stillUnresolved} pagamenti Shopify ancora senza piano`] : []),
      ...stale.map(
        (ev) => `ordine ${ev.event_id} (${ev.identifier ?? "identifier ignoto"}): webhook interrotto, verificare il piano a mano`
      ),
      ...errors.slice(0, 5),
    ]);
  }

  return NextResponse.json({
    scanned: events.length,
    granted,
    stillUnresolved,
    stale: stale.length,
    errors,
  });
}
