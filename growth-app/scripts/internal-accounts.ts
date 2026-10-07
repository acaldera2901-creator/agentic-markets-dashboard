// Generates content/internal-accounts.json — LOCAL ONLY, admin connection, read-only.
//
//   npx tsx scripts/internal-accounts.ts --env-file ~/Desktop/agentic-markets/.env
//
// Reads identifiers to recognise our own / test accounts (scripts/internal-rules.ts)
// and writes ONLY profile/order ids + a reason code. Prints only counts per
// reason: no id, no e-mail, no name ever reaches the terminal or the repo.
// DATABASE_URL stays in ~/Desktop/agentic-markets/.env: never in the repo, never on Vercel.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { countByReason, validateInternal } from "../core/internal";
import { connect } from "../data/live-source";
import { readEnvKey } from "./env";
import { type OrderIn, type ProfileIn, classify } from "./internal-rules";

async function main() {
  const url = readEnvKey("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL non trovata (env o --env-file)");
  const sql = connect(url);
  try {
    const { now, profiles, orders } = await sql.begin("read only", async (tx) => {
      const [{ now }] = await tx.unsafe("SELECT now() AS now");
      const profiles = (await tx.unsafe("SELECT id::text AS id, identifier, plan, plan_source, stripe_subscription_id FROM profiles")) as unknown as ProfileIn[];
      const orders = (await tx.unsafe(`
        SELECT 'paygate_orders' AS table, id::text AS id, identifier, amount_usd::float AS amount_usd, paid_at IS NOT NULL AS paid FROM paygate_orders
        UNION ALL
        SELECT 'paypal_orders', id::text, identifier, amount_usd::float, paid_at IS NOT NULL FROM paypal_orders
        UNION ALL
        SELECT 'shopify_events', event_id, identifier, NULL::float, true FROM shopify_events WHERE event_type = 'orders/paid'`)) as unknown as OrderIn[];
      return { now: new Date(now as string | Date).toISOString(), profiles, orders };
    });
    const file = classify(profiles, orders, now);
    validateInternal(file); // the same check the build runs: never write a file the app would reject
    const out = join(__dirname, "..", "content", "internal-accounts.json");
    writeFileSync(out, JSON.stringify(file, null, 2) + "\n");
    console.log(`scritto ${out} (dbNow ${now})`);
    console.log(`profili letti: ${profiles.length} · ordini letti: ${orders.length}`);
    for (const [k, n] of Object.entries(countByReason(file)).sort()) console.log(`  ${k}: ${n}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("ELENCO NON SCRITTO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
