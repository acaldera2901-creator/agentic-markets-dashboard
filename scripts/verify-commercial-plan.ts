import assert from "node:assert/strict";
import {
  PUBLIC_PAID_PLAN,
  PUBLIC_PLAN_KEYS,
  normalizeCheckoutPlan,
  planPriceCopy,
  blocksRetiredPlanPurchase,
} from "../lib/commercial-plan";

// #RETIRE-BASE-1031: un solo piano pagato pubblico, Pro. Base resta leggibile
// (normalizeCheckoutPlan) ma non acquistabile da chi non ce l'ha già.
assert.deepEqual(PUBLIC_PLAN_KEYS, ["premium"]);
assert.equal(PUBLIC_PAID_PLAN.key, "premium");
assert.equal(PUBLIC_PAID_PLAN.amountUsdt, 29.99);
assert.equal(planPriceCopy("premium", "it"), "$29.99/mese");
assert.equal(planPriceCopy("premium", "en"), "$29.99/month");
assert.equal(normalizeCheckoutPlan("base"), "base");
assert.equal(normalizeCheckoutPlan("premium"), "premium");
assert.equal(normalizeCheckoutPlan("free"), null);
assert.equal(blocksRetiredPlanPurchase("base", "free"), true);
assert.equal(blocksRetiredPlanPurchase("base", "base"), false);
assert.equal(blocksRetiredPlanPurchase("premium", "free"), false);

console.log("commercial plan contract ok");
