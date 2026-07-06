// tests/paygate.test.ts
import assert from "node:assert/strict";
import { amountFor, periodDays, hashToken, newOrderToken, buildPayUrl, evaluateCallback, creatorPromoActive, discountedAmountFor } from "../lib/paygate";

// — prezzi server-side —
// #PRICING-CREATORS-0706 (decisione Andrea 06/07): mensili 14.99/29.99;
// annuali 129/255 PROPOSTI (rapporto ~8.5 mesi invariato), conferma al gate.
assert.equal(amountFor("base", "monthly"), 14.99);
assert.equal(amountFor("base", "annual"), 129);
assert.equal(amountFor("premium", "monthly"), 29.99);
assert.equal(amountFor("premium", "annual"), 255);
// @ts-expect-error combinazione invalida
assert.throws(() => amountFor("enterprise", "monthly"), /plan/i);

// — giorni per periodo —
assert.equal(periodDays("monthly"), 30);
assert.equal(periodDays("annual"), 365);

// — token: hash deterministico, token random diverso ogni volta —
const t = newOrderToken();
assert.equal(t.tokenHash, hashToken(t.token));
assert.notEqual(newOrderToken().token, newOrderToken().token);

// — buildPayUrl (#PAYGATE-ENCODE-FIX): address_in è GIÀ url-encoded e va passato
//   COSÌ COM'È (no doppia codifica: %2F resta %2F, non %252F). Gli altri param
//   sono encodati normalmente.
const u = buildPayUrl({ addressIn: "abc%2Fdef%3D%3D", amount: 169, email: "a@b.com" });
assert.match(u, /^https:\/\/checkout\.paygate\.to\/pay\.php\?/);
assert.match(u, /currency=USD/);
assert.match(u, /amount=169/);
assert.match(u, /address=abc%2Fdef%3D%3D(&|$)/);
assert.doesNotMatch(u, /%252F/);
assert.match(u, /email=a%40b\.com/);

// — evaluateCallback: gate (a)+(b) —
const okOrder = { status: "pending", amount_usd: 169 };
assert.equal(evaluateCallback({ order: null, valueCoin: 169 }).grant, false);                  // ordine assente
assert.equal(evaluateCallback({ order: { status: "paid", amount_usd: 169 }, valueCoin: 169 }).grant, false); // già pagato
assert.equal(evaluateCallback({ order: okOrder, valueCoin: null }).grant, false);              // value_coin assente
assert.equal(evaluateCallback({ order: okOrder, valueCoin: 50 }).grant, false);                // sotto il floor 50% (84.5)
assert.equal(evaluateCallback({ order: okOrder, valueCoin: 169 }).grant, true);                // ok (importo pieno)
assert.equal(evaluateCallback({ order: okOrder, valueCoin: 166 }).grant, true);                // ok
assert.equal(evaluateCallback({ order: okOrder, valueCoin: 120 }).grant, true);                // fee fino a -50% accettate (120 > 84.5)


// — #PRICING-CREATORS-0706: promo creator (-50% primo mese, server-side) —
{
  const FUTURE = "2099-01-01T00:00:00Z";
  const NOW = new Date("2026-07-06T12:00:00Z");
  const eligible = { referred: true, firstPaidOrder: true, now: NOW };

  // DARK di default: senza flag il prezzo è SEMPRE pieno.
  delete process.env.CREATOR_PROMO_ENABLED;
  delete process.env.CREATOR_PROMO_DEADLINE;
  assert.equal(creatorPromoActive(NOW), false);
  assert.deepEqual(discountedAmountFor("base", "monthly", eligible), { amount: 14.99, discounted: false });

  // Flag on ma SENZA deadline reale (A4 FTC): niente promo.
  process.env.CREATOR_PROMO_ENABLED = "true";
  assert.equal(creatorPromoActive(NOW), false);

  // Flag + deadline futura: promo attiva, -50% sul mensile arrotondato al cent.
  process.env.CREATOR_PROMO_DEADLINE = FUTURE;
  assert.equal(creatorPromoActive(NOW), true);
  assert.deepEqual(discountedAmountFor("base", "monthly", eligible), { amount: 7.5, discounted: true });
  assert.deepEqual(discountedAmountFor("premium", "monthly", eligible), { amount: 15, discounted: true });

  // Condizioni A2: SOLO mensile, SOLO referred, SOLO primo ordine pagato.
  assert.equal(discountedAmountFor("base", "annual", eligible).discounted, false);
  assert.equal(discountedAmountFor("base", "monthly", { ...eligible, referred: false }).discounted, false);
  assert.equal(discountedAmountFor("base", "monthly", { ...eligible, firstPaidOrder: false }).discounted, false);

  // Deadline REALE passata: la promo si spegne da sola anche lato server.
  process.env.CREATOR_PROMO_DEADLINE = "2026-01-01T00:00:00Z";
  assert.equal(creatorPromoActive(NOW), false);
  assert.deepEqual(discountedAmountFor("base", "monthly", eligible), { amount: 14.99, discounted: false });

  // Deadline malformata = niente promo (fail-closed sul prezzo pieno).
  process.env.CREATOR_PROMO_DEADLINE = "not-a-date";
  assert.equal(creatorPromoActive(NOW), false);

  delete process.env.CREATOR_PROMO_ENABLED;
  delete process.env.CREATOR_PROMO_DEADLINE;
}

console.log("paygate ok");
