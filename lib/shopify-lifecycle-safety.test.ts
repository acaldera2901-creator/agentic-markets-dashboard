import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// #SUB-LIFECYCLE-0828 — gli invarianti di SICUREZZA del ramo di osservazione.
//
// Il ramo nuovo scrive in `shopify_events`, la stessa tabella su cui gira
// l'idempotenza dei pagamenti e il ri-tentativo dei grant. Sono invarianti sui
// SOLDI, quindi asseriti meccanicamente sul testo delle rotte e non affidati
// alla review: la loro violazione sarebbe un piano concesso senza pagamento, o
// un pagamento vero scartato come duplicato.
//
// NB co-locati in lib/ perché vitest.config.ts include solo
// {app,lib,components,features}/**/*.test.ts.

const ROOT = join(__dirname, "..");
const WEBHOOK = readFileSync(join(ROOT, "app/api/shopify/webhook/route.ts"), "utf-8");
const RECONCILE = readFileSync(join(ROOT, "app/api/cron/shopify-reconcile/route.ts"), "utf-8");

/** Corpo di recordLifecycleEvent, dalla firma alla graffa di chiusura in colonna 0. */
function recordLifecycleBody(): string {
  const start = WEBHOOK.indexOf("async function recordLifecycleEvent");
  expect(start, "recordLifecycleEvent deve esistere").toBeGreaterThan(-1);
  const end = WEBHOOK.indexOf("\n}", start);
  expect(end).toBeGreaterThan(start);
  return WEBHOOK.slice(start, end);
}

describe("#SUB-LIFECYCLE-0828 il ramo osservazione non muove piani", () => {
  it("non concede, non revoca, non regala weekly pick", () => {
    const body = recordLifecycleBody();
    for (const vietata of ["activateShopifyPlan", "revokeShopifyPlan", "grantWeeklyPick"]) {
      expect(body, `recordLifecycleEvent non deve chiamare ${vietata}`).not.toContain(vietata);
    }
  });

  it("non scrive mai in profiles", () => {
    const body = recordLifecycleBody();
    expect(body.toLowerCase()).not.toContain("update profiles");
    expect(body.toLowerCase()).not.toContain("insert into profiles");
  });

  it("marca le righe 'observed' e nessuno degli stati che la reconcile raccoglie", () => {
    const body = recordLifecycleBody();
    expect(body).toContain("'observed'");
    // 'pending' e 'unresolved' sono gli stati che innescano un ri-tentativo di
    // grant: una riga di lifecycle non deve poterli avere.
    expect(body).not.toContain("'pending'");
    expect(body).not.toContain("'unresolved'");
  });

  it("non sovrascrive una riga esistente (ON CONFLICT DO NOTHING)", () => {
    const body = recordLifecycleBody();
    expect(body).toContain("ON CONFLICT (event_id) DO NOTHING");
    expect(body).not.toContain("DO UPDATE");
  });

  it("inghiotte i propri errori: l'osservabilità non può far fallire un webhook di pagamento", () => {
    // Senza ack Shopify ritenta per giorni. Una riga di osservabilità non vale
    // un loop di retry sul rail dei soldi.
    const body = recordLifecycleBody();
    expect(body).toContain("try {");
    expect(body).toContain("catch");
  });
});

describe("#SUB-LIFECYCLE-0828 il ramo osservazione è dietro la firma", () => {
  it("registra solo DOPO la verifica HMAC", () => {
    // Se registrasse prima, chiunque conosca l'URL potrebbe riempire la tabella
    // con eventi non firmati.
    const hmac = WEBHOOK.indexOf("verifyShopifyHmac(raw, hmac)");
    const call = WEBHOOK.indexOf("await recordLifecycleEvent(");
    expect(hmac).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(-1);
    expect(call, "la registrazione deve stare dopo il check HMAC").toBeGreaterThan(hmac);
  });
});

describe("#SUB-LIFECYCLE-0828 la reconcile non raccoglie le righe di lifecycle", () => {
  it("OGNI query della reconcile su shopify_events filtra event_type = 'orders/paid'", () => {
    // È la seconda difesa (la prima è lo status 'observed'). Se un domani questo
    // filtro sparisse, la reconcile leggerebbe righe che non sono ordini e
    // proverebbe a concedere piani su eventi di ciclo di vita.
    const selects = [...RECONCILE.matchAll(/FROM\s+shopify_events([\s\S]*?)(?:LIMIT|\)|`)/g)];
    expect(selects.length, "almeno una SELECT su shopify_events").toBeGreaterThan(0);
    for (const m of selects) {
      expect(m[1], `SELECT senza filtro sul topic: ${m[1].slice(0, 120)}`)
        .toContain("event_type = 'orders/paid'");
    }
  });
});
