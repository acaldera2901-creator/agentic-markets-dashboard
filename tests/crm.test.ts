// tests/crm.test.ts
import assert from "node:assert/strict";
import { resolveFlow, dueTriggers, isEligible, type CrmProfile, type Touchpoint } from "../lib/crm";

const base: CrmProfile = { identifier: "a@b.com", plan: "free", language: "it", created_at: "2026-06-01T00:00:00Z", activated_at: "2026-06-01T00:00:00Z", plan_expires_at: null };
const NOW = "2026-06-15T00:00:00Z"; // 14 giorni dopo

// onboarding: non attivato
assert.deepEqual(resolveFlow({ ...base, activated_at: null }, NOW), { flow: "onboarding", dayInFlow: 14 });
// acquisition: free attivato, niente storico pagamento → giorni da activated_at
assert.deepEqual(resolveFlow(base, NOW), { flow: "acquisition", dayInFlow: 14 });
// retention: pagante non scaduto → dayInFlow = giorni ALLA scadenza
assert.deepEqual(resolveFlow({ ...base, plan: "premium", plan_expires_at: "2026-06-18T00:00:00Z" }, NOW), { flow: "retention", dayInFlow: 3 });
// winback: free con scadenza passata entro 30gg → giorni DALLA scadenza
assert.deepEqual(resolveFlow({ ...base, plan: "free", plan_expires_at: "2026-06-08T00:00:00Z" }, NOW), { flow: "winback", dayInFlow: 7 });
// scaduto da >30gg → torna acquisition
assert.equal(resolveFlow({ ...base, plan: "free", plan_expires_at: "2026-05-01T00:00:00Z" }, NOW).flow, "acquisition");
// admin escluso
assert.equal(resolveFlow({ ...base, plan: "admin_full" }, NOW).flow, "none");

// isEligible
assert.equal(isEligible(base), true);
assert.equal(isEligible({ ...base, plan: "admin_full" }), false);
assert.equal(isEligible({ ...base, marketing_opt_out: true }), false);
assert.equal(isEligible({ ...base, identifier: "telegram_123" }), false);

// dueTriggers: solo trigger del flow corrente, al giorno esatto, non già inviati
const tps: Touchpoint[] = [
  { key: "acq_day7", flow: "acquisition", day: 7 },
  { key: "acq_day14", flow: "acquisition", day: 14 },
  { key: "ret_3d", flow: "retention", day: 3 },
];
assert.deepEqual(dueTriggers("acquisition", 14, tps, new Set()).map(t => t.key), ["acq_day14"]);
assert.deepEqual(dueTriggers("acquisition", 14, tps, new Set(["acq_day14"])).map(t => t.key), []); // dedup
assert.deepEqual(dueTriggers("retention", 14, tps, new Set()).map(t => t.key), []); // giorno non combacia
assert.deepEqual(dueTriggers("retention", 3, tps, new Set()).map(t => t.key), ["ret_3d"]);

console.log("crm ok");
