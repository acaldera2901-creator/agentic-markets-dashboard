// tests/paygate.test.ts
import assert from "node:assert/strict";
import { amountFor, periodDays, hashToken, newOrderToken, buildPayUrl, evaluateCallback } from "../lib/paygate";

// — prezzi server-side —
assert.equal(amountFor("base", "monthly"), 19.9);
assert.equal(amountFor("base", "annual"), 169);
assert.equal(amountFor("premium", "monthly"), 49.9);
assert.equal(amountFor("premium", "annual"), 419);
// @ts-expect-error combinazione invalida
assert.throws(() => amountFor("enterprise", "monthly"), /plan/i);

// — giorni per periodo —
assert.equal(periodDays("monthly"), 30);
assert.equal(periodDays("annual"), 365);

// — token: hash deterministico, token random diverso ogni volta —
const t = newOrderToken();
assert.equal(t.tokenHash, hashToken(t.token));
assert.notEqual(newOrderToken().token, newOrderToken().token);

// — buildPayUrl: currency=USD, address re-encodato una volta (%2F -> %252F) —
const u = buildPayUrl({ addressIn: "abc%2Fdef%3D%3D", amount: 169, email: "a@b.com" });
assert.match(u, /^https:\/\/checkout\.paygate\.to\/pay\.php\?/);
assert.match(u, /currency=USD/);
assert.match(u, /amount=169/);
assert.match(u, /address=abc%252Fdef%253D%253D/);
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

console.log("paygate ok");
