// tests/crm-content.test.ts
import assert from "node:assert/strict";
import { CRM_TOUCHPOINTS, CRM_LANGS, renderCrm, resolveCrmLang } from "../lib/crm-content";

// chiavi uniche
const keys = CRM_TOUCHPOINTS.map(t => t.key);
assert.equal(new Set(keys).size, keys.length);
// ogni flow coperto
const flows = new Set(CRM_TOUCHPOINTS.map(t => t.flow));
["onboarding","acquisition","retention","winback"].forEach(f => assert.ok(flows.has(f as never), `manca flow ${f}`));
// copy completo e non vuoto in TUTTE le 5 lingue, per ogni touchpoint
for (const t of CRM_TOUCHPOINTS) for (const lang of CRM_LANGS) {
  assert.ok(t.subject[lang] && t.subject[lang].trim().length > 0, `subject vuoto: ${t.key}/${lang}`);
  assert.ok(t.body[lang] && t.body[lang].trim().length > 0, `body vuoto: ${t.key}/${lang}`);
}
// render in tutte le lingue: subject/html/text popolati + unsubscribe presente
for (const lang of CRM_LANGS) {
  const r = renderCrm("acq_day5_picture", lang, "test@example.com");
  assert.ok(r && r.subject.length > 0 && r.html.includes("BetRedge") && r.text.length > 0, `render fallito: ${lang}`);
  assert.ok(r && r.html.includes("/api/crm/unsubscribe"), `unsubscribe assente: ${lang}`);
}
// footer: disclaimer legale presente (spot-check it + ru)
const rit = renderCrm("acq_day5_picture", "it", "test@example.com");
assert.ok(rit && /18\+|operatore di gioco/.test(rit.html));
const rru = renderCrm("acq_day5_picture", "ru", "test@example.com");
assert.ok(rru && /18\+/.test(rru.html) && rru.html.includes("Отписаться"));
assert.equal(renderCrm("inesistente", "it", "test@example.com"), null);
// risoluzione lingua: normalizzazione + fallback it
assert.equal(resolveCrmLang("en"), "en");
assert.equal(resolveCrmLang("ES"), "es");
assert.equal(resolveCrmLang("fr-FR"), "fr");
assert.equal(resolveCrmLang("ru"), "ru");
assert.equal(resolveCrmLang("de"), "it");
assert.equal(resolveCrmLang(null), "it");
assert.equal(resolveCrmLang(""), "it");
// niente parole vietate, in tutte le lingue
for (const t of CRM_TOUCHPOINTS) for (const lang of CRM_LANGS)
  assert.doesNotMatch((t.subject[lang]+t.body[lang]).toLowerCase(), /guaranteed|safe bet|vincita sicura|ganancia segura|gain garanti|гарантированн/);

// scala acquisition unita (#CRM-MERGE-0727): giorni attesi, senza il vecchio day 7
const acq = CRM_TOUCHPOINTS.filter(t => t.flow === "acquisition").sort((a, b) => a.day - b.day);
assert.deepEqual(acq.map(t => t.day), [2, 5, 10, 14, 21, 28, 35]);
assert.ok(!acq.some(t => t.key === "acq_day7_offer"), "acq_day7_offer va rimosso, non riesumato");
// invariante che regge l'unione: l'email "non ti scriviamo più" sta DOPO ogni offerta.
const doorOpen = acq.find(t => t.key === "acq_day35_door_open");
assert.ok(doorOpen, "manca la chiusura della scala");
const lastOffer = Math.max(...acq.filter(t => /offer|last_chance|final/.test(t.key)).map(t => t.day));
assert.ok(doorOpen!.day > lastOffer, `la chiusura (${doorOpen!.day}) deve seguire l'ultima offerta (${lastOffer})`);

console.log("crm content ok");
