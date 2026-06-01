// One-off: apply db/migrations/002_profiles.sql to the company Supabase via exec_sql RPC.
// Verifies the table exists afterwards. Run: node --env-file=.env scripts/apply_profiles_migration.mjs
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
const sql = readFileSync(new URL("../db/migrations/002_profiles.sql", import.meta.url), "utf8");

const { error } = await db.rpc("exec_sql", { query: sql });
if (error) {
  console.error("MIGRATION ERROR:", error.message || error);
  process.exit(1);
}
console.log("Migration applied (no error).");

// Verify table exists + show columns.
const verify = await db.rpc("exec_sql", {
  query:
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='profiles' ORDER BY ordinal_position",
});
if (verify.error) {
  console.error("VERIFY ERROR:", verify.error.message || verify.error);
  process.exit(1);
}
console.log("profiles columns:", JSON.stringify(verify.data));
