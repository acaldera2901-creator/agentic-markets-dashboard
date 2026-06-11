import assert from "node:assert/strict";
import { expirySqlExpr } from "../lib/plan-grant";

// Stripe passes an explicit ISO expiry -> used as literal.
assert.equal(
  expirySqlExpr("2026-07-11T00:00:00.000Z"),
  "'2026-07-11T00:00:00.000Z'::timestamptz"
);
// Admin (no explicit expiry) -> 30-day window on DB side.
assert.equal(expirySqlExpr(null), "NOW() + INTERVAL '30 days'");

console.log("plan-grant ok");
