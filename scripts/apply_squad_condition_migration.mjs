// One-off: apply db/migrations/008_squad_condition_reports.sql to the company
// Supabase via the service-role exec_sql RPC, then verify the table + REVOKE.
// Run: node --env-file=.env scripts/apply_squad_condition_migration.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("MISSING ENV: url?", Boolean(url), "key?", Boolean(key));
  process.exit(1);
}
console.log("Supabase host:", new URL(url).host);

const db = createClient(url, key, { auth: { persistSession: false } });
const sql = readFileSync(
  new URL("../db/migrations/008_squad_condition_reports.sql", import.meta.url),
  "utf8",
);

const { error } = await db.rpc("exec_sql", { query: sql });
if (error) {
  console.error("MIGRATION ERROR:", error.message || error);
  process.exit(1);
}
console.log("Migration applied (no error).");

const cols = await db.rpc("exec_sql", {
  query:
    "SELECT column_name, data_type FROM information_schema.columns " +
    "WHERE table_name='squad_condition_reports' ORDER BY ordinal_position",
});
if (cols.error) {
  console.error("VERIFY ERROR:", cols.error.message || cols.error);
  process.exit(1);
}
console.log("squad_condition_reports columns:", JSON.stringify(cols.data));

const grants = await db.rpc("exec_sql", {
  query:
    "SELECT grantee, privilege_type FROM information_schema.role_table_grants " +
    "WHERE table_name='squad_condition_reports' AND grantee IN ('anon','authenticated')",
});
if (grants.error) {
  console.error("GRANT VERIFY ERROR:", grants.error.message || grants.error);
  process.exit(1);
}
console.log(
  "anon/authenticated grants (must be empty, posture #010):",
  JSON.stringify(grants.data),
);
