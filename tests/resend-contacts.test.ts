// tests/resend-contacts.test.ts
import assert from "node:assert/strict";
import { lifecycleStage, cohortMonth, buildContactPayload, type SegmentContact } from "../lib/resend-contacts";

const NOW = "2026-06-27T12:00:00.000Z";

const base: SegmentContact = {
  id: "u1", identifier: "a@b.com", name: "Mario Rossi", plan: "premium",
  language: "it", requested_plan: null, plan_expires_at: "2026-12-01T00:00:00.000Z",
  created_at: "2026-05-10T00:00:00.000Z", activated_at: "2026-05-10T00:00:00.000Z",
};

assert.equal(cohortMonth(base.created_at), "2026-05");

// premium con scadenza lontana → active
assert.equal(lifecycleStage(base, NOW), "active");
// premium che scade entro 7gg → expiring
assert.equal(lifecycleStage({ ...base, plan_expires_at: "2026-06-30T00:00:00.000Z" }, NOW), "expiring");
// scaduto → expired
assert.equal(lifecycleStage({ ...base, plan_expires_at: "2026-06-01T00:00:00.000Z" }, NOW), "expired");
// free attivato → prospect
assert.equal(lifecycleStage({ ...base, plan: "free", plan_expires_at: null }, NOW), "prospect");

const payload = buildContactPayload(base, ["pro_it", "renewers"], NOW);
assert.equal(payload.email, "a@b.com");
assert.equal(payload.firstName, "Mario");
assert.equal(payload.properties.plan, "premium");
assert.equal(payload.properties.language, "it");
assert.equal(payload.properties.lifecycle_stage, "active");
assert.equal(payload.properties.cohort_month, "2026-05");
assert.equal(payload.properties.seg_pro_it, true);
assert.equal(payload.properties.seg_renewers, true);
assert.deepEqual(payload.segments, ["pro_it", "renewers"]);
// MAI impostare unsubscribed nell'upsert
assert.equal("unsubscribed" in payload, false);

console.log("resend contacts ok");
