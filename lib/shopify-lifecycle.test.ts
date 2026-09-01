import { describe, it, expect } from "vitest";
import {
  isObservedTopic,
  lifecycleEventKey,
  extractResourceId,
  extractLifecycleIdentifier,
  OBSERVED_TOPIC_PREFIXES,
  HANDLED_TOPICS,
} from "./shopify-lifecycle";

// #SUB-LIFECYCLE-0828 — il ciclo di vita degli abbonamenti deve lasciare traccia.
//
// Contesto misurato sul prod il 28/08: `shopify_events` conteneva UNA riga in
// tutto (`orders/paid`, 25/07). L'unico cliente del rail carta è decaduto il
// 24/08 senza un secondo ordine, dopo tre email che gli dicevano che il piano si
// rinnovava da solo. Contratto disdetto, addebito rifiutato e contratto mai
// creato mandano tutti topic che il webhook ACK-ava e buttava.
//
// I due invarianti che questi test difendono:
//   1. si osserva ciò che serve, e per PREFISSO (una lista chiusa di nomi
//      esatti è come si è creato il buco);
//   2. una riga di lifecycle non può MAI essere confusa con un ordine — né
//      collidere sulla PK, né essere raccolta da un ri-tentativo di grant.

describe("#SUB-LIFECYCLE-0828 quali topic si osservano", () => {
  it("osserva i topic del ciclo di vita degli abbonamenti", () => {
    for (const t of [
      "subscription_contracts/create",
      "subscription_contracts/update",
      "subscription_billing_attempts/success",
      "subscription_billing_attempts/failure",
      "subscription_billing_attempts/challenged",
      "orders/cancelled",
      "orders/updated",
    ]) {
      expect(isObservedTopic(t), t).toBe(true);
    }
  });

  it("NON tocca i topic che hanno già una logica propria", () => {
    // Se questi finissero nel ramo di osservazione salterebbero il grant o il
    // rimborso: sarebbe una regressione sui soldi, non sull'osservabilità.
    for (const t of HANDLED_TOPICS) expect(isObservedTopic(t), t).toBe(false);
    expect(HANDLED_TOPICS).toContain("orders/paid");
    expect(HANDLED_TOPICS).toContain("refunds/create");
  });

  it("ignora topic estranei e header assente", () => {
    for (const t of ["products/update", "themes/publish", "app/uninstalled"]) {
      expect(isObservedTopic(t), t).toBe(false);
    }
    expect(isObservedTopic(null)).toBe(false);
    expect(isObservedTopic("")).toBe(false);
  });

  it("cattura per prefisso, non per nome esatto", () => {
    // Il punto della scelta: un topic che oggi non conosciamo, se sta nella
    // famiglia giusta, viene osservato comunque.
    expect(isObservedTopic("subscription_contracts/qualcosa_di_nuovo")).toBe(true);
    expect(isObservedTopic("subscription_futuro/inventato")).toBe(true);
    expect(OBSERVED_TOPIC_PREFIXES).toContain("subscription_");
  });
});

describe("#SUB-LIFECYCLE-0828 chiave di idempotenza", () => {
  it("è prefissata dal topic, così non collide mai con un order id", () => {
    // shopify_events.event_id è la PK e per gli ordini è l'order id NUDO. Se una
    // riga di lifecycle potesse produrre "7958871671121", l'ON CONFLICT DO
    // NOTHING la farebbe sparire in silenzio — o farebbe sembrare già visto un
    // ordine vero, che è il caso costoso.
    const orderId = "7958871671121";
    const key = lifecycleEventKey("orders/cancelled", null, orderId);
    expect(key).not.toBe(orderId);
    expect(key.startsWith("orders/cancelled:")).toBe(true);
  });

  it("è stabile fra i retry della stessa delivery", () => {
    const a = lifecycleEventKey("subscription_billing_attempts/failure", "wh-123", "gid://1");
    const b = lifecycleEventKey("subscription_billing_attempts/failure", "wh-123", "gid://1");
    expect(a).toBe(b);
  });

  it("distingue due eventi diversi dello stesso contratto", () => {
    // Il caso che una chiave basata sul solo id di risorsa collasserebbe: due
    // addebiti falliti in due mesi diversi diventerebbero un solo evento.
    const gen = lifecycleEventKey("subscription_billing_attempts/failure", "wh-gen", "gid://c/1");
    const feb = lifecycleEventKey("subscription_billing_attempts/failure", "wh-feb", "gid://c/1");
    expect(gen).not.toBe(feb);
  });

  it("preferisce il webhook id, ricade sull'id di risorsa, e non rende mai una chiave vuota", () => {
    expect(lifecycleEventKey("t", "wh", "res")).toBe("t:wh");
    expect(lifecycleEventKey("t", null, "res")).toBe("t:res");
    const senzaNulla = lifecycleEventKey("t", null, null);
    expect(senzaNulla.startsWith("t:")).toBe(true);
    expect(senzaNulla.length).toBeGreaterThan("t:".length);
  });
});

describe("#SUB-LIFECYCLE-0828 estrazione dal payload", () => {
  it("prende l'id di risorsa dai campi che i topic osservati usano", () => {
    expect(extractResourceId({ admin_graphql_api_id: "gid://shopify/Order/1" }))
      .toBe("gid://shopify/Order/1");
    expect(extractResourceId({ id: 12345 })).toBe("12345");
    expect(extractResourceId({ order_id: "999" })).toBe("999");
    expect(extractResourceId(null)).toBeNull();
    expect(extractResourceId("stringa")).toBeNull();
    expect(extractResourceId({})).toBeNull();
  });

  it("prende l'email dove Shopify la mette, e normalizza", () => {
    expect(extractLifecycleIdentifier({ email: "A@B.COM" })).toBe("a@b.com");
    expect(extractLifecycleIdentifier({ contact_email: " x@y.se " })).toBe("x@y.se");
    expect(extractLifecycleIdentifier({ customer: { email: "C@D.io" } })).toBe("c@d.io");
  });

  it("rende null invece di inventare un identifier", () => {
    // Un evento senza email vale comunque più di un evento buttato: il
    // chiamante deve poter registrare `null`, non ricevere una stringa finta.
    expect(extractLifecycleIdentifier({})).toBeNull();
    expect(extractLifecycleIdentifier({ email: "non-una-email" })).toBeNull();
    expect(extractLifecycleIdentifier({ customer: {} })).toBeNull();
    expect(extractLifecycleIdentifier(null)).toBeNull();
  });
});
