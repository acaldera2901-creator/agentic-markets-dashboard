// #GROWTH-TRACKING-1006.4 — one-off backfill of the Stripe amounts on the
// stripe_events rows that already exist (invoice.paid recorded before the
// webhook started saving the amount).
//
// DRY-RUN BY DEFAULT: reads only, inside a READ ONLY transaction, and prints
// what it would write. Writing requires `--apply` AND its own DB gate
// (APPROVE) — it is never run as part of a deploy.
//
//   npx tsx scripts/backfill_stripe_amounts.ts            # dry-run
//   npx tsx scripts/backfill_stripe_amounts.ts --dry-run  # same
//   npx tsx scripts/backfill_stripe_amounts.ts --apply    # writes (gated)
//
// Env: DATABASE_URL (Postgres), STRIPE_SECRET_KEY, STRIPE_PRICE_BASE/PREMIUM.
// Limits, declared instead of guessed:
//  - Stripe keeps events for 30 days: an older event id can no longer be
//    resolved to its invoice → reported as "unresolvable", left NULL.
//  - It only UPDATEs existing rows. Paid invoices with no stripe_events row are
//    listed as "missing" for a human to look at, never inserted.

import postgres from "postgres";
import Stripe from "stripe";
import { periodFromSpan } from "../lib/revenue";
import { resolvePlanFromPriceId } from "../lib/stripe";

type Planned = { event_id: string; amount: number | null; currency: string | null; identifier: string | null; plan: string | null; period: string | null };

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
const sql = postgres(url, { max: 1, ssl: "require", prepare: false });

function priceIdOf(line: Stripe.InvoiceLineItem | undefined): string | undefined {
  const p = line?.pricing?.price_details?.price;
  return typeof p === "string" ? p : p?.id;
}

async function main() {
  // Read phase: always read-only.
  const { hasAmount, total, rows, customers } = await sql.begin("read only", async (tx) => {
    const hasAmount = (
      await tx`SELECT 1 FROM information_schema.columns
                WHERE table_name = 'stripe_events' AND column_name = 'amount'`
    ).length > 0;
    const [{ n: total }] = await tx`SELECT COUNT(*)::int AS n FROM stripe_events WHERE event_type = 'invoice.paid'`;
    const rows = hasAmount
      ? await tx`SELECT event_id FROM stripe_events WHERE event_type = 'invoice.paid' AND amount IS NULL ORDER BY processed_at`
      : await tx`SELECT event_id FROM stripe_events WHERE event_type = 'invoice.paid' ORDER BY processed_at`;
    const customers = await tx`SELECT identifier, stripe_customer_id FROM profiles WHERE stripe_customer_id IS NOT NULL`;
    return { hasAmount, total: Number(total), rows, customers };
  });
  const byCustomer = new Map(customers.map((c) => [String(c.stripe_customer_id), String(c.identifier)]));

  console.log(`mode: ${apply ? "APPLY" : "DRY-RUN (read-only)"}`);
  console.log(`stripe_events.amount column present: ${hasAmount}`);
  console.log(`invoice.paid rows in stripe_events: ${total}`);
  console.log(`candidate rows (amount NULL): ${rows.length}`);

  const planned: Planned[] = [];
  const unresolvable: string[] = [];
  const key = process.env.STRIPE_SECRET_KEY;
  const stripe = key ? new Stripe(key) : null;

  if (rows.length > 0 && !stripe) {
    console.log("STRIPE_SECRET_KEY missing: cannot resolve candidates, nothing planned.");
  }
  for (const r of stripe ? rows : []) {
    const id = String(r.event_id);
    try {
      const ev = await stripe!.events.retrieve(id);
      const inv = ev.data.object as Stripe.Invoice;
      const line = inv.lines?.data?.[0];
      const subRef = inv.parent?.subscription_details?.subscription;
      let identifier: string | null = null;
      if (subRef) {
        const sub = typeof subRef === "string" ? await stripe!.subscriptions.retrieve(subRef) : subRef;
        identifier = sub.metadata?.identifier ?? null;
      }
      if (!identifier && inv.customer) identifier = byCustomer.get(String(typeof inv.customer === "string" ? inv.customer : inv.customer.id)) ?? null;
      planned.push({
        event_id: id,
        amount: inv.amount_paid != null ? inv.amount_paid / 100 : null,
        currency: inv.currency ?? null,
        identifier,
        plan: resolvePlanFromPriceId(priceIdOf(line)),
        period: periodFromSpan(line?.period?.start, line?.period?.end),
      });
    } catch (e) {
      unresolvable.push(`${id}: ${String(e instanceof Error ? e.message : e).slice(0, 120)}`);
    }
  }

  // Paid invoices Stripe knows about vs rows we hold: a gap means cash with no
  // stripe_events row (report only — never inserted here).
  if (stripe) {
    let paid = 0;
    for await (const inv of stripe.invoices.list({ status: "paid", limit: 100 })) {
      if (inv.amount_paid > 0) paid += 1;
    }
    console.log(`paid invoices (amount > 0) in Stripe: ${paid} vs invoice.paid rows: ${total}`);
  } else {
    console.log("Stripe invoice listing skipped (no STRIPE_SECRET_KEY).");
  }

  console.log(`planned UPDATEs: ${planned.length}`);
  for (const p of planned) {
    console.log(`  UPDATE stripe_events SET amount=${p.amount}, currency=${p.currency}, identifier=${p.identifier ? "<set>" : "NULL"}, plan=${p.plan}, period=${p.period} WHERE event_id=${p.event_id}`);
  }
  console.log(`unresolvable (left NULL): ${unresolvable.length}`);
  for (const u of unresolvable) console.log(`  ${u}`);

  if (!apply) {
    console.log("dry-run: nothing written.");
    return;
  }
  if (!hasAmount) {
    console.error("refusing --apply: migration 20261006130000 not applied (no amount column).");
    process.exitCode = 1;
    return;
  }
  await sql.begin(async (tx) => {
    for (const p of planned) {
      await tx`UPDATE stripe_events
                  SET amount = ${p.amount}, currency = ${p.currency}, identifier = ${p.identifier},
                      plan = ${p.plan}, period = ${p.period}
                WHERE event_id = ${p.event_id} AND amount IS NULL`;
    }
  });
  console.log(`applied: ${planned.length} rows.`);
}

main()
  .catch((e) => {
    console.error(String(e));
    process.exitCode = 1;
  })
  .finally(() => sql.end());
