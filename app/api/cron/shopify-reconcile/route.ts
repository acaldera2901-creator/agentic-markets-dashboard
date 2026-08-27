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

  // ── Abbonamenti scaduti senza rinnovo (#SHOPIFY-LAPSE-WATCHDOG-0827) ──────
  // Il buco che ha lasciato passare il caso reale del 2026-08-27: il primo (e
  // allora unico) cliente carta ha pagato il 25/07, il grant è scaduto il 24/08,
  // nessun secondo `orders/paid` è arrivato e il profilo è tornato `free` senza
  // che nessuno se ne accorgesse. Le due scansioni qui sopra non potevano
  // vederlo: guardano 'unresolved' e 'pending', cioè pagamenti che NON hanno
  // ancora concesso. Qui il pagamento era andato a buon fine — è il RINNOVO che
  // non è mai arrivato, e uno stato sano che smette di rinnovarsi non somiglia a
  // un errore da nessuna parte.
  //
  // NON è un rilevatore di bug: una disdetta legittima finisce qui identica a un
  // webhook di rinnovo mai consegnato. È un watchdog sui ricavi — dice «un
  // cliente pagante è decaduto, guardalo», e la distinzione la fa un umano sul
  // subscription contract in Shopify Admin.
  //
  // Grace di 6 ore: Shopify può fatturare il rinnovo con qualche ora di ritardo,
  // e un allarme che urla su un rinnovo semplicemente lento verrebbe ignorato.
  //
  // Marcatura su `last_error` e NON su `status`: il cron gira ogni 10 minuti, e
  // senza marcatore lo stesso decadimento allerterebbe 144 volte al giorno.
  // `status` deve restare 'granted' anche per un secondo motivo: appena entra
  // #REFERRAL-SHOPIFY-RAIL-0827, `status = 'granted'` su `shopify_events` è il
  // rail carta di countPayingInvitees() (lib/referral-rewards.ts). Declassarlo
  // qui cancellerebbe in silenzio i premi referral dell'invitante — e le due
  // branch sono indipendenti, quindi l'accoppiamento va scritto qui, non
  // scoperto dopo il merge.
  const lapsed = await dbQuery<{ identifier: string; expired_at: string; amount: string | null }>(
    `SELECT DISTINCT ON (e.identifier)
            e.identifier, p.plan_expires_at::text AS expired_at, e.amount::text AS amount
       FROM shopify_events e
       JOIN profiles p ON p.identifier = e.identifier
      WHERE e.event_type = 'orders/paid'
        AND e.status = 'granted'
        AND e.identifier IS NOT NULL
        AND COALESCE(e.last_error, '') NOT LIKE 'lapse-alerted%'
        AND p.plan_source = 'shopify'
        AND p.plan_expires_at IS NOT NULL
        AND p.plan_expires_at < NOW() - INTERVAL '6 hours'
      ORDER BY e.identifier, e.processed_at DESC
      LIMIT 50`
  );
  for (const row of lapsed) {
    // Marca OGNI riga granted di quell'utente, non solo quella selezionata: chi
    // ha già rinnovato una volta ne ha più di una, e lasciarne una senza
    // marcatore rifarebbe scattare l'alert al giro dopo. Un rinnovo futuro
    // crea una riga NUOVA senza marcatore ⇒ se decade di nuovo, si riallerta.
    await dbExecute(
      `UPDATE shopify_events
          SET last_error = 'lapse-alerted: piano scaduto senza rinnovo, verificare il subscription contract'
        WHERE identifier = $1
          AND event_type = 'orders/paid'
          AND status = 'granted'
          AND COALESCE(last_error, '') NOT LIKE 'lapse-alerted%'`,
      [row.identifier]
    );
    console.error(`[shopify/reconcile] LAPSED identifier=${row.identifier} expired_at=${row.expired_at}`);
  }

  // Un pagamento che resta senza piano è un problema di soldi: va segnalato, non
  // solo contato. Alert solo se c'è davvero qualcosa di irrisolto.
  if (stillUnresolved > 0 || errors.length > 0 || stale.length > 0 || lapsed.length > 0) {
    await opsAlert("shopify-reconcile", [
      ...(stillUnresolved > 0 ? [`${stillUnresolved} pagamenti Shopify ancora senza piano`] : []),
      ...stale.map(
        (ev) => `ordine ${ev.event_id} (${ev.identifier ?? "identifier ignoto"}): webhook interrotto, verificare il piano a mano`
      ),
      ...lapsed.map(
        (row) =>
          `abbonamento carta DECADUTO: ${row.identifier} scaduto il ${row.expired_at} senza rinnovo` +
          `${row.amount ? ` (ultimo incasso ${row.amount})` : ""} — disdetta o rinnovo mancato? verificare il subscription contract in Shopify Admin`
      ),
      ...errors.slice(0, 5),
    ]);
  }

  return NextResponse.json({
    scanned: events.length,
    granted,
    stillUnresolved,
    stale: stale.length,
    lapsed: lapsed.length,
    errors,
  });
}
