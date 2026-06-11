import assert from "node:assert/strict";
import { resolvePlanFromPriceId, periodEndToIso, planToPriceId } from "../lib/stripe";

// price id -> plan
process.env.STRIPE_PRICE_BASE = "price_base_123";
process.env.STRIPE_PRICE_PREMIUM = "price_premium_456";

assert.equal(resolvePlanFromPriceId("price_base_123"), "base");
assert.equal(resolvePlanFromPriceId("price_premium_456"), "premium");
assert.equal(resolvePlanFromPriceId("price_unknown"), null);
assert.equal(resolvePlanFromPriceId(undefined), null);

// plan -> price id
assert.equal(planToPriceId("base"), "price_base_123");
assert.equal(planToPriceId("premium"), "price_premium_456");

// unix seconds -> ISO string
assert.equal(periodEndToIso(1750000000), new Date(1750000000 * 1000).toISOString());
assert.equal(periodEndToIso(null), null);

console.log("stripe mapping ok");
