// shopify-lifecycle.ts — #SUB-LIFECYCLE-0828
//
// Perché esiste: il webhook Shopify concede il piano solo su `orders/paid` e
// gestisce `refunds/create`. Ogni ALTRO topic veniva ACK-ato e buttato senza
// lasciare traccia (`route.ts`: `return { received: true, ignored: topic }`).
// La whitelist è la scelta di sicurezza giusta — un topic sconosciuto non deve
// mai concedere un piano — ma buttare l'evento significa che il CICLO DI VITA
// dell'abbonamento è invisibile.
//
// Il caso che l'ha reso concreto (misurato il 28/08 sul prod): l'unico cliente
// del rail carta ha pagato $14.99 il 25/07 con `plan_source='shopify'`, ha
// ricevuto tre email di retention che — per `crm-content.ts` RENEWAL_CLAUSE —
// gli dicevano che il piano **si rinnova da solo**, e il 25/08 alle 06:00 è
// stato declassato a `free` senza che un secondo `orders/paid` sia mai arrivato.
// Le tre cause possibili (contratto disdetto, tentativo di addebito fallito,
// contratto mai creato) si distinguono SOLO da topic che stiamo buttando.
//
// Questo modulo NON concede nulla e non decide nulla: rende osservabile ciò che
// arriva. La decisione su cosa farne resta di chi legge.

/** Prefissi dei topic da registrare.
 *
 *  Volutamente per PREFISSO e non per lista esatta di topic: se un nome preciso
 *  ci sfugge (i topic delle subscription sono cambiati fra versioni dell'Admin
 *  API), una lista chiusa lo lascerebbe invisibile — cioè ripeterebbe il difetto
 *  che questo modulo esiste per chiudere.
 *
 *  Il prezzo è qualche riga in più. Ciò che evita la discarica è questo filtro,
 *  non un limite di volume: i topic fuori prefisso NON vengono registrati, solo
 *  loggati col loro nome, così se qualcosa di utile ci sfugge si scopre dal log
 *  e si aggiunge un prefisso — invece di indovinare oggi. */
export const OBSERVED_TOPIC_PREFIXES = ["subscription_", "orders/", "customers/disable"];

/** Topic già gestiti a monte con logica propria: non passano da qui. */
export const HANDLED_TOPICS = ["orders/paid", "refunds/create"];

export function isObservedTopic(topic: string | null): boolean {
  if (!topic) return false;
  if (HANDLED_TOPICS.includes(topic)) return false;
  return OBSERVED_TOPIC_PREFIXES.some((p) => topic.startsWith(p));
}

/** Chiave di idempotenza per la riga in `shopify_events`.
 *
 *  `shopify_events.event_id` è la PRIMARY KEY e per gli ordini è l'order id
 *  nudo. Un evento di lifecycle NON deve poter collidere con un order id (una
 *  collisione, con `ON CONFLICT DO NOTHING`, farebbe sparire l'evento in
 *  silenzio e — peggio — potrebbe far sembrare "già visto" un ordine vero), per
 *  questo la chiave è sempre prefissata dal topic.
 *
 *  Si preferisce `x-shopify-webhook-id`: è stabile fra i retry della stessa
 *  delivery (quindi idempotente) ma diverso fra due eventi distinti dello
 *  stesso contratto — cioè non collassa `billing_attempts/failure` di gennaio
 *  con quello di febbraio. Senza quell'header si ricade sull'id della risorsa,
 *  che è meno preciso ma non produce mai una chiave vuota. */
export function lifecycleEventKey(
  topic: string,
  webhookId: string | null,
  resourceId: string | null
): string {
  const suffix = webhookId || resourceId || `noid-${Date.now()}`;
  return `${topic}:${suffix}`;
}

/** Id della risorsa dal payload, provando i campi che i topic osservati usano.
 *  Non è un identificatore d'utente: serve solo come fallback di chiave. */
export function extractResourceId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const k of ["admin_graphql_api_id", "id", "order_id", "subscription_contract_id"]) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Email del cliente, se il payload la porta.
 *
 *  Serve per collegare l'evento a un profilo. Nessun topic osservato è
 *  garantito portarla, quindi il chiamante deve accettare `null` — un evento
 *  senza email vale comunque più di un evento buttato. */
export function extractLifecycleIdentifier(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  const direct = p["email"] ?? p["contact_email"];
  if (typeof direct === "string" && direct.includes("@")) return direct.trim().toLowerCase();

  const customer = p["customer"];
  if (customer && typeof customer === "object") {
    const e = (customer as Record<string, unknown>)["email"];
    if (typeof e === "string" && e.includes("@")) return e.trim().toLowerCase();
  }
  return null;
}
