// lib/segments.ts
// Mini-DSL dei segmenti marketing: validazione su whitelist + compilazione in
// SQL parametrico ($n) per dbQuery. I nomi-campo e gli operatori SQL vengono
// SOLO da questa whitelist; i valori dall'operatore passano come param ($n) e
// vengono escapati da lib/db.interpolate. Mai SQL raw dall'input.

import { ADMIN_IDENTIFIER } from "./admin-profile-policy";

export type SegmentClause = { field: string; op: string; value?: unknown };
export type SegmentRule = { all: SegmentClause[] };

// Email dell'identità admin, esclusa dal marketing (allineata a lib/admin-profile-policy).
export const ADMIN_ELIGIBILITY_EXCLUDE_EMAIL = ADMIN_IDENTIFIER;

// NB: lib/db interpola i $n come literal (escaped), NON come bind del driver → la whitelist field/op qui sotto è l'UNICA difesa da SQL injection: ogni nuovo campo DEVE restare whitelistato e i valori passare solo via params.

// Operatori ammessi per ciascun campo. Qualunque cosa fuori da qui → throw.
const FIELD_OPS: Record<string, string[]> = {
  plan: ["eq", "in"],
  language: ["eq", "in"],
  requested_plan: ["eq", "in", "is_null"],
  activated: ["eq"],
  account_age_days: ["lte", "gte"],
  plan_expires_at: ["expired", "active", "expiring_in_days"],
};

const PLAN_VALUES = new Set(["free", "pending_payment", "base", "premium"]);
const REQUESTED_PLAN_VALUES = new Set(["base", "premium"]);
const LANG_RE = /^[a-z]{2,5}$/;

function fail(msg: string): never {
  throw new Error(`segment rule invalid: ${msg}`);
}

export function validateRule(input: unknown): SegmentRule {
  if (!input || typeof input !== "object" || !Array.isArray((input as { all?: unknown }).all)) {
    fail("missing 'all' array");
  }
  const all = (input as { all: unknown[] }).all;
  const clauses: SegmentClause[] = [];
  for (const raw of all) {
    if (!raw || typeof raw !== "object") fail("clause must be an object");
    const c = raw as SegmentClause;
    const ops = FIELD_OPS[c.field];
    if (!ops) fail(`unknown field '${String(c.field)}'`);
    if (!ops.includes(c.op)) fail(`op '${String(c.op)}' not allowed for field '${c.field}'`);

    // Validazione del value per operatore.
    if (c.op === "in") {
      if (!Array.isArray(c.value) || c.value.length === 0) fail(`op 'in' requires a non-empty array for '${c.field}'`);
      if (c.field === "plan" && !c.value.every((v) => PLAN_VALUES.has(String(v)))) fail("invalid plan value");
      if (c.field === "requested_plan" && !c.value.every((v) => REQUESTED_PLAN_VALUES.has(String(v)))) fail(`invalid requested_plan value`);
      if (c.field === "language" && !c.value.every((v) => LANG_RE.test(String(v)))) fail(`invalid language value`);
    } else if (c.op === "eq") {
      if (c.value === undefined || c.value === null) fail(`op 'eq' requires a value for '${c.field}'`);
      if (c.field === "plan" && !PLAN_VALUES.has(String(c.value))) fail("invalid plan value");
      if (c.field === "requested_plan" && !REQUESTED_PLAN_VALUES.has(String(c.value))) fail(`invalid requested_plan value`);
      if (c.field === "language" && !LANG_RE.test(String(c.value))) fail(`invalid language value`);
      if (c.field === "activated" && typeof c.value !== "boolean") fail("'activated' requires boolean value");
    } else if (c.op === "expiring_in_days" || c.op === "lte" || c.op === "gte") {
      if (typeof c.value !== "number" || !Number.isFinite(c.value) || c.value < 0) fail(`op '${c.op}' requires a non-negative number for '${c.field}'`);
    }
    // is_null / expired / active: nessun value.
    clauses.push({ field: c.field, op: c.op, value: c.value });
  }
  return { all: clauses };
}

// Compila una clausola in un frammento SQL con placeholder $n a partire da `next`.
// Ritorna il frammento e i param aggiunti (in ordine).
function compileClause(c: SegmentClause, next: number): { sql: string; params: unknown[] } {
  switch (c.field) {
    case "plan":
    case "language":
    case "requested_plan": {
      if (c.op === "is_null") return { sql: `${c.field} IS NULL`, params: [] };
      if (c.op === "in") {
        const arr = c.value as unknown[];
        const ph = arr.map((_, i) => `$${next + i}`).join(",");
        return { sql: `${c.field} IN (${ph})`, params: arr };
      }
      return { sql: `${c.field} = $${next}`, params: [c.value] };
    }
    case "activated":
      return { sql: c.value ? "activated_at IS NOT NULL" : "activated_at IS NULL", params: [] };
    case "account_age_days": {
      // lte = account "giovane" (creato negli ultimi N giorni); gte = più vecchio.
      const cmp = c.op === "lte" ? ">=" : "<";
      return { sql: `created_at ${cmp} (NOW() - make_interval(days => $${next}))`, params: [c.value] };
    }
    case "plan_expires_at": {
      if (c.op === "expired") return { sql: "plan_expires_at IS NOT NULL AND plan_expires_at <= NOW()", params: [] };
      if (c.op === "active") return { sql: "plan_expires_at IS NOT NULL AND plan_expires_at > NOW()", params: [] };
      // expiring_in_days: attivo ora ma scade entro N giorni.
      return {
        sql: `plan_expires_at IS NOT NULL AND plan_expires_at > NOW() AND plan_expires_at <= (NOW() + make_interval(days => $${next}))`,
        params: [c.value],
      };
    }
    default:
      fail(`unknown field '${c.field}'`);
  }
}

// Predicato di eligibility consenso (soft opt-in clienti). Usa $1 = email admin.
function eligibilitySql(): { sql: string; params: unknown[] } {
  return {
    sql: "(plan IN ('base','premium') OR (plan = 'free' AND activated_at IS NOT NULL)) AND plan <> 'admin_full' AND lower(identifier) <> $1",
    params: [ADMIN_ELIGIBILITY_EXCLUDE_EMAIL],
  };
}

export function buildSegmentQuery(rule: SegmentRule, opts: { select: "count" | "contacts" }): { sql: string; params: unknown[] } {
  const elig = eligibilitySql();
  const params: unknown[] = [...elig.params];
  const fragments: string[] = [elig.sql];
  for (const c of rule.all) {
    const compiled = compileClause(c, params.length + 1);
    fragments.push(compiled.sql);
    params.push(...compiled.params);
  }
  const where = fragments.map((f) => `(${f})`).join(" AND ");
  const cols =
    opts.select === "count"
      ? "COUNT(*)::int AS n"
      : "id, identifier, name, plan, language, requested_plan, plan_expires_at, created_at, activated_at";
  return { sql: `SELECT ${cols} FROM profiles WHERE ${where}`, params };
}
