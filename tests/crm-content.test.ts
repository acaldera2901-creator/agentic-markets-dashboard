// tests/crm-content.test.ts
import assert from "node:assert/strict";
import { CRM_TOUCHPOINTS, renderCrm } from "../lib/crm-content";

// chiavi uniche
const keys = CRM_TOUCHPOINTS.map(t => t.key);
assert.equal(new Set(keys).size, keys.length);
// ogni flow coperto
const flows = new Set(CRM_TOUCHPOINTS.map(t => t.flow));
["onboarding","acquisition","retention","winback"].forEach(f => assert.ok(flows.has(f as never), `manca flow ${f}`));
// render
const r = renderCrm("acq_day7_offer", "it");
assert.ok(r && r.subject.length > 0 && r.html.includes("BetRedge") && r.text.length > 0);
assert.equal(renderCrm("inesistente", "it"), null);
// niente parole vietate
for (const t of CRM_TOUCHPOINTS) for (const lang of ["it","en"] as const)
  assert.doesNotMatch((t.subject[lang]+t.body[lang]).toLowerCase(), /guaranteed|safe bet|vincita sicura/);

console.log("crm content ok");
