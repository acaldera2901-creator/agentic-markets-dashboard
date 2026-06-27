// tests/segments-rule.test.ts
import assert from "node:assert/strict";
import { validateRule, buildSegmentQuery } from "../lib/segments";

// — validateRule accetta una regola valida —
const ok = validateRule({ all: [{ field: "plan", op: "in", value: ["base", "premium"] }] });
assert.deepEqual(ok.all[0].field, "plan");

// — validateRule rifiuta campo non whitelistato —
assert.throws(() => validateRule({ all: [{ field: "password_hash", op: "eq", value: "x" }] }), /field/i);

// — validateRule rifiuta operatore non ammesso per il campo —
assert.throws(() => validateRule({ all: [{ field: "plan", op: "lte", value: "base" }] }), /op/i);

// — validateRule rifiuta value mancante quando richiesto —
assert.throws(() => validateRule({ all: [{ field: "language", op: "eq" }] }), /value/i);

// — buildSegmentQuery (count): include eligibility + clausola, placeholder contigui —
const q = buildSegmentQuery({ all: [{ field: "language", op: "eq", value: "it" }] }, { select: "count" });
assert.match(q.sql, /SELECT COUNT\(\*\)::int AS n FROM profiles WHERE/);
assert.match(q.sql, /plan IN \('base','premium'\) OR/); // eligibility presente
assert.match(q.sql, /language = \$2/);                   // $1 = email admin (eligibility), $2 = 'it'
assert.deepEqual(q.params, ["acaldera2901@gmail.com", "it"]);

// — expiring_in_days usa make_interval e il param numerico —
const q2 = buildSegmentQuery({ all: [{ field: "plan_expires_at", op: "expiring_in_days", value: 7 }] }, { select: "contacts" });
assert.match(q2.sql, /make_interval\(days => \$2\)/);
assert.deepEqual(q2.params, ["acaldera2901@gmail.com", 7]);

// — select contacts ritorna le colonne attese —
assert.match(q2.sql, /SELECT id, identifier, name, plan, language, requested_plan, plan_expires_at, created_at, activated_at FROM profiles/);

// — 'in' richiede un array non vuoto —
assert.throws(() => validateRule({ all: [{ field: "plan", op: "in", value: [] }] }), /array/i);

// — requested_plan value must be base/premium —
assert.throws(() => validateRule({ all: [{ field: "requested_plan", op: "eq", value: "enterprise" }] }), /requested_plan|invalid/i);
// — language must look like a locale code (lowercase, 2-5 letters) —
assert.throws(() => validateRule({ all: [{ field: "language", op: "eq", value: "'; DROP TABLE x; --" }] }), /language|invalid/i);
// — valid language still accepted —
assert.deepEqual(validateRule({ all: [{ field: "language", op: "eq", value: "it" }] }).all[0].value, "it");

console.log("segments rule ok");
