// tests/paygate-grant.test.ts — #PAYGATE-PREFLIGHT-0629 finding #3 (anti-downgrade/extend)
import assert from "node:assert/strict";
import { computePaygateGrant } from "../lib/plan-grant";

const NOW = "2026-07-01T00:00:00.000Z";
const now = new Date(NOW).getTime();
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

// 1) Nuovo acquisto, nessuna scadenza → piano comprato, expiry = now + days
let r = computePaygateGrant({ currentPlan: "free", currentExpiryISO: null, purchasedPlan: "base", days: 30, nowISO: NOW });
assert.equal(r.plan, "base");
assert.equal(r.expiryISO, iso(now + 30 * DAY));

// 2) Rinnovo stesso piano ancora attivo → ESTENDE (stack del residuo)
r = computePaygateGrant({ currentPlan: "base", currentExpiryISO: iso(now + 10 * DAY), purchasedPlan: "base", days: 30, nowISO: NOW });
assert.equal(r.plan, "base");
assert.equal(r.expiryISO, iso(now + 40 * DAY)); // 10 residui + 30

// 3) Premium attivo + compra BASE → NON declassa (resta premium), estende
r = computePaygateGrant({ currentPlan: "premium", currentExpiryISO: iso(now + 100 * DAY), purchasedPlan: "base", days: 30, nowISO: NOW });
assert.equal(r.plan, "premium");
assert.equal(r.expiryISO, iso(now + 130 * DAY));

// 4) Base attivo + compra PREMIUM → upgrade, estende
r = computePaygateGrant({ currentPlan: "base", currentExpiryISO: iso(now + 10 * DAY), purchasedPlan: "premium", days: 365, nowISO: NOW });
assert.equal(r.plan, "premium");
assert.equal(r.expiryISO, iso(now + 375 * DAY));

// 5) Scaduto → riparte da ORA (non stacca tempo passato)
r = computePaygateGrant({ currentPlan: "base", currentExpiryISO: iso(now - 5 * DAY), purchasedPlan: "base", days: 30, nowISO: NOW });
assert.equal(r.plan, "base");
assert.equal(r.expiryISO, iso(now + 30 * DAY));

console.log("paygate grant ok");
