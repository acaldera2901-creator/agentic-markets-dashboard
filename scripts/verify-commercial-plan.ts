import assert from "node:assert/strict";
import {
  PUBLIC_PAID_PLAN,
  PUBLIC_PLAN_KEYS,
  normalizeCheckoutPlan,
  planPriceCopy,
} from "../lib/commercial-plan";

assert.deepEqual(PUBLIC_PLAN_KEYS, ["base"]);
assert.equal(PUBLIC_PAID_PLAN.key, "base");
assert.equal(PUBLIC_PAID_PLAN.amountUsdt, 49.5);
assert.equal(PUBLIC_PAID_PLAN.priceLabel.it, "49.50 USDT/mese");
assert.equal(PUBLIC_PAID_PLAN.priceLabel.en, "49.50 USDT/month");
assert.equal(planPriceCopy("base", "it"), "49.50 USDT/mese");
assert.equal(planPriceCopy("base", "en"), "49.50 USDT/month");
assert.equal(normalizeCheckoutPlan("base"), "base");
assert.equal(normalizeCheckoutPlan("premium"), "base");
assert.equal(normalizeCheckoutPlan("free"), null);

console.log("commercial plan contract ok");
