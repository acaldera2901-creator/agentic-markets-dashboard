// tests/paypal-grant.test.ts
// activatePaypalPlan tocca il DB → qui testiamo la logica di grant condivisa
// (computePaygateGrant), che è ciò che activatePaypalPlan riusa 1:1.
import * as assert from "node:assert/strict";
import { computePaygateGrant } from "../lib/plan-grant";

const nowISO = "2026-07-01T00:00:00.000Z";

// nuovo acquisto premium mensile da free scaduto → 30 giorni da ora
const g1 = computePaygateGrant({ currentPlan: "free", currentExpiryISO: null, purchasedPlan: "premium", days: 30, nowISO });
assert.equal(g1.plan, "premium");
assert.equal(g1.expiryISO, "2026-07-31T00:00:00.000Z");

// rinnovo annuale con tempo residuo → estende dalla scadenza residua
const g2 = computePaygateGrant({ currentPlan: "premium", currentExpiryISO: "2026-07-10T00:00:00.000Z", purchasedPlan: "premium", days: 365, nowISO });
assert.equal(g2.expiryISO, "2027-07-10T00:00:00.000Z");

// anti-downgrade: premium attivo, compro base → resta premium
const g3 = computePaygateGrant({ currentPlan: "premium", currentExpiryISO: "2026-08-01T00:00:00.000Z", purchasedPlan: "base", days: 30, nowISO });
assert.equal(g3.plan, "premium");
console.log("paypal-grant.test.ts OK");
