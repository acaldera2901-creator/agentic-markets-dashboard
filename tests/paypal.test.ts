import assert from "node:assert/strict";
import { paypalApiBase, evaluateCapture } from "../lib/paypal";

// — base URL: default live, sandbox se PAYPAL_ENV=sandbox —
const prev = process.env.PAYPAL_ENV;
process.env.PAYPAL_ENV = "sandbox";
assert.equal(paypalApiBase(), "https://api-m.sandbox.paypal.com");
process.env.PAYPAL_ENV = "live";
assert.equal(paypalApiBase(), "https://api-m.paypal.com");
process.env.PAYPAL_ENV = prev;

// — evaluateCapture: gate (a) ordine pending (b) capture COMPLETED + importo + valuta —
const okOrder = { status: "pending", amount_usd: 169 };
assert.equal(evaluateCapture({ order: null, captured: { status: "COMPLETED", value: 169, currency: "USD" } }).grant, false);          // ordine assente
assert.equal(evaluateCapture({ order: { status: "paid", amount_usd: 169 }, captured: { status: "COMPLETED", value: 169, currency: "USD" } }).grant, false); // già pagato
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "DECLINED", value: 169, currency: "USD" } }).grant, false);        // non completato
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: null, currency: "USD" } }).grant, false);     // importo assente
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: 168.99, currency: "USD" } }).grant, false);   // importo insufficiente
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: 169, currency: "EUR" } }).grant, false);      // valuta errata
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: 169, currency: "USD" } }).grant, true);       // ok
assert.equal(evaluateCapture({ order: okOrder, captured: { status: "COMPLETED", value: 170, currency: "USD" } }).grant, true);       // ok (paga di più)
console.log("paypal.test.ts OK");
