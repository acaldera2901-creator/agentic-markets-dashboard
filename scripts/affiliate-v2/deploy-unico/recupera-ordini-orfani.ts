// recupera-ordini-orfani.ts — #SHOPIFY-ORPHANS-1022 (gated: APPROVE di Andrea, tocca clienti paganti).
//
// Ordini Shopify `orders/paid` rimasti `stale`/`pending` dal 26/07/2026 (bug B1) e più
// vecchi di 30 giorni: la reconcile non li vede più. Questo strumento concede il piano
// con LA STESSA funzione del webhook/reconcile (`activateShopifyPlan` di lib/plan-grant:
// stesso calcolo di scadenza, stessa guardia PayGate, stessa email di attivazione) e
// marca l'evento `granted`. Nessun SQL a mano sui profili.
//
// Default = DRY-RUN: elenca gli ordini e cosa verrebbe concesso (utente, piano, durata,
// nuova scadenza). Nessuna scrittura.
//   npx tsx scripts/affiliate-v2/deploy-unico/recupera-ordini-orfani.ts --env-file /percorso/env.privato
// Esecuzione (solo dopo APPROVE #SHOPIFY-ORPHANS-1022 e verifica in Shopify Admin che ogni
// ordine sia pagato, non rimborsato, in USD, e che il cliente non abbia già avuto il piano):
//   ... --esegui --gate SHOPIFY-ORPHANS-1022 --ordini <event_id>,<event_id>
//   chiede conferma ordine per ordine (scrivi l'event_id), scrive un file di rollback JSON.
// Rollback (per ordine, con conferma): ... --rollback <file.json> [--esegui]
//   rimette status/last_error dell'evento e il profilo com'era, SOLO se il profilo ha
//   ancora la scadenza concessa da qui (altrimenti si ferma: è cambiato dopo).
// Nota: l'email «piano attivato» partita dal grant non si può ritirare.
// Commissioni affiliate: NON scritte qui (fino a ottobre il programma v2 non era live);
// se un ordine ha un'attribuzione l'anteprima lo segnala → PROPOSAL a parte.
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { createInterface } from "node:readline";
import path from "node:path";
import os from "node:os";

const GATE = "SHOPIFY-ORPHANS-1022";
const SINCE = "2026-07-26";
const MARK = `recovery-0726: grant manuale #${GATE}`;

type Args = { envFile?: string; esegui: boolean; gate?: string; ordini: string[]; rollback?: string };
function parseArgs(argv: string[]): Args {
  const a: Args = { esegui: false, ordini: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--env-file") a.envFile = argv[++i];
    else if (k === "--esegui") a.esegui = true;
    else if (k === "--gate") a.gate = argv[++i];
    else if (k === "--ordini") a.ordini = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (k === "--rollback") a.rollback = argv[++i];
    else throw new Error(`argomento sconosciuto: ${k}`);
  }
  return a;
}

type EventRow = {
  event_id: string; status: string; identifier: string | null; variant_id: string | null;
  amount: string | null; last_error: string | null; processed_at: string;
};
type ProfileRow = { identifier: string; plan: string; plan_expires_at: string | null; plan_source: string | null; requested_plan: string | null };
type RollbackRecord = {
  event_id: string; at: string; event_before: { status: string; last_error: string | null };
  profile_before: ProfileRow; profile_after: ProfileRow;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.envFile) {
    const env = parseEnv(readFileSync(args.envFile, "utf8"));
    for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
  }
  if (!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY assenti: passa --env-file");
  }
  // Import dopo l'env: lib/db legge le credenziali al caricamento del modulo.
  const db = await import("../../../lib/db");
  const grant = await import("../../../lib/plan-grant");
  const shopify = await import("../../../lib/shopify");

  const logDir = process.env.DEPLOY_LOG_DIR || path.join(os.homedir(), "deploy-unico-1022-log");
  mkdirSync(logDir, { recursive: true }); chmodSync(logDir, 0o700);
  // Async iterator, not rl.question: with piped input readline would drop lines
  // that arrive before the question is asked.
  const rl = createInterface({ input: process.stdin });
  const lines = rl[Symbol.asyncIterator]();
  const confirm = async (want: string) => {
    process.stdout.write(`  Conferma: scrivi esattamente «${want}» (altro = salta): `);
    const r = await lines.next();
    return !r.done && String(r.value).trim() === want;
  };
  const profileOf = async (identifier: string) =>
    (await db.dbQueryStrict<ProfileRow>(
      `SELECT identifier, plan, plan_expires_at::text AS plan_expires_at, plan_source, requested_plan FROM profiles
        WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 LIMIT 1`, [identifier]))[0] ?? null;

  if (args.rollback) {
    const recs: RollbackRecord[] = JSON.parse(readFileSync(args.rollback, "utf8"));
    console.log(`ROLLBACK da ${args.rollback}: ${recs.length} ordini. ${args.esegui ? "ESEGUI" : "DRY-RUN"}`);
    for (const r of recs) {
      const now = await profileOf(r.profile_before.identifier);
      const ev = (await db.dbQueryStrict<EventRow>(`SELECT event_id, status, last_error FROM shopify_events WHERE event_id = $1`, [r.event_id]))[0];
      const sameGrant = now && now.plan_expires_at === r.profile_after.plan_expires_at && now.plan === r.profile_after.plan;
      console.log(`- ${r.event_id} ${r.profile_before.identifier}: evento ${ev?.status} → ${r.event_before.status}; profilo ${now?.plan}/${now?.plan_expires_at} → ${r.profile_before.plan}/${r.profile_before.plan_expires_at}${sameGrant ? "" : "  ⚠ profilo cambiato dopo il grant: NON lo tocco"}`);
      if (!args.esegui || !(await confirm(r.event_id))) continue;
      if (sameGrant) {
        await db.dbExecute(
          `UPDATE profiles SET plan = $2, plan_expires_at = $3::timestamptz, plan_source = $4, requested_plan = $5, updated_at = NOW()
            WHERE (identifier = $1 OR LOWER(TRIM(identifier)) = $1) AND plan = $6 AND plan_expires_at = $7::timestamptz`,
          [r.profile_before.identifier, r.profile_before.plan, r.profile_before.plan_expires_at, r.profile_before.plan_source,
           r.profile_before.requested_plan, r.profile_after.plan, r.profile_after.plan_expires_at]);
      }
      await db.dbExecute(`UPDATE shopify_events SET status = $2, last_error = $3 WHERE event_id = $1 AND status = 'granted' AND last_error = $4`,
        [r.event_id, r.event_before.status, r.event_before.last_error, MARK]);
      const after = (await db.dbQueryStrict<EventRow>(`SELECT status FROM shopify_events WHERE event_id = $1`, [r.event_id]))[0];
      console.log(`  → evento ora ${after?.status}; profilo ora ${JSON.stringify(await profileOf(r.profile_before.identifier))}`);
    }
    rl.close();
    return;
  }

  const rows = await db.dbQueryStrict<EventRow>(
    `SELECT event_id, status, identifier, variant_id, amount::text AS amount, last_error, processed_at::text AS processed_at
       FROM shopify_events
      WHERE event_type = 'orders/paid' AND status IN ('stale','pending')
        AND processed_at >= '${SINCE}' AND processed_at <= NOW() - INTERVAL '30 days'
      ORDER BY processed_at`);
  console.log(`Ordini orfani oltre 30 giorni (stale/pending dal ${SINCE}): ${rows.length}. Modalità: ${args.esegui ? "ESEGUI" : "DRY-RUN"}`);
  const nowISO = new Date().toISOString();
  type Plan = { ev: EventRow; ok: boolean; why: string; plan?: "base" | "premium"; period?: "monthly" | "annual"; oneOff?: boolean };
  const plans: Plan[] = [];
  for (const ev of rows) {
    const resolved = shopify.resolveOrderFromVariant(ev.variant_id);
    const prof = ev.identifier ? await profileOf(ev.identifier) : null;
    const later = ev.identifier ? await db.dbQueryStrict<{ n: number }>(
      `SELECT count(*)::int AS n FROM shopify_events WHERE event_type='orders/paid' AND status='granted' AND identifier = $1 AND processed_at > $2::timestamptz`,
      [ev.identifier, ev.processed_at]) : [{ n: 0 }];
    const attributed = ev.identifier ? await db.dbQuery<{ n: number }>(
      `SELECT count(*)::int AS n FROM affiliate_attributions WHERE referred_identifier = LOWER(TRIM($1))`, [ev.identifier]) : [{ n: 0 }];
    let p: Plan = { ev, ok: false, why: "" };
    if (!ev.identifier) p.why = "identifier assente: cliente da trovare in Shopify Admin";
    else if (!resolved) p.why = `variant ${ev.variant_id} non è un piano (o SHOPIFY_VARIANT_* mancanti nell'env file)`;
    else if (!prof) p.why = "profilo inesistente";
    else if (!grant.shopifyGrantAllowed(prof.plan, prof.plan_source, prof.plan_expires_at)) p.why = "abbonato PayGate attivo: il grant verrebbe rifiutato";
    else p = { ev, ok: true, why: "", plan: resolved.plan, period: resolved.period, oneOff: !resolved.recurring };
    const g = p.ok && prof ? grant.computePaygateGrant({ currentPlan: prof.plan, currentExpiryISO: prof.plan_expires_at, purchasedPlan: p.plan!, days: p.period === "annual" ? 365 : 30, nowISO }) : null;
    console.log(`\n- ordine ${ev.event_id} · ${ev.status} · arrivato ${ev.processed_at} · importo ${ev.amount ?? "?"} · last_error ${ev.last_error ?? "-"}`);
    console.log(`  cliente ${ev.identifier ?? "?"} · profilo ora ${prof ? `${prof.plan} (${prof.plan_source ?? "-"}) scade ${prof.plan_expires_at ?? "-"}` : "-"}`);
    if (p.ok && g) console.log(`  CONCEDEREBBE: ${p.plan} ${p.period}${p.oneOff ? " one-off" : ""} (${p.period === "annual" ? 365 : 30} giorni) → piano ${g.plan}, scadenza ${g.expiryISO}, plan_source ${p.oneOff ? "shopify_oneoff" : "shopify"}`);
    else console.log(`  NON concedibile qui: ${p.why}`);
    if (later[0]?.n) console.log(`  ⚠ ${later[0].n} ordine/i granted DOPO questo per lo stesso cliente: probabilmente già servito → escludere`);
    if (attributed[0]?.n) console.log(`  ⚠ cliente attribuito a un affiliato: la commissione NON è scritta da qui (PROPOSAL a parte)`);
    plans.push(p);
  }
  if (!args.esegui) { console.log("\nDRY-RUN: nessuna modifica. Per eseguire: --esegui --gate SHOPIFY-ORPHANS-1022 --ordini id1,id2"); rl.close(); return; }

  if (args.gate !== GATE) throw new Error(`serve --gate ${GATE} (APPROVE umano registrato)`);
  if (!args.ordini.length) throw new Error("serve --ordini con la lista VERIFICATA in Shopify Admin");
  const unknown = args.ordini.filter((id) => !plans.some((p) => p.ev.event_id === id));
  if (unknown.length) throw new Error(`ordini non nella lista degli orfani oltre 30 gg: ${unknown.join(", ")}`);
  const rbFile = path.join(logDir, `${new Date().toISOString().replace(/[:.]/g, "")}-orfani-rollback.json`);
  const done: RollbackRecord[] = [];
  const save = () => writeFileSync(rbFile, JSON.stringify(done, null, 2), { mode: 0o600 });
  for (const id of args.ordini) {
    const p = plans.find((x) => x.ev.event_id === id)!;
    console.log(`\n# ordine ${id} → ${p.ev.identifier}`);
    if (!p.ok) { console.log(`  saltato: ${p.why}`); continue; }
    if (!(await confirm(id))) { console.log("  saltato (nessuna conferma)"); continue; }
    // Ricontrollo subito prima di scrivere: lo stato può essere cambiato dall'anteprima.
    const ev = (await db.dbQueryStrict<EventRow>(`SELECT event_id, status, last_error FROM shopify_events WHERE event_id = $1`, [id]))[0];
    if (!ev || (ev.status !== "stale" && ev.status !== "pending")) { console.log(`  saltato: stato ora ${ev?.status}`); continue; }
    const before = await profileOf(p.ev.identifier!);
    if (!before) { console.log("  saltato: profilo sparito"); continue; }
    const g = await grant.activateShopifyPlan(p.ev.identifier!, p.plan!, p.period!, p.oneOff);
    if (!g) { console.log("  grant rifiutato da activateShopifyPlan (profilo/guardia PayGate): evento NON toccato"); continue; }
    await db.dbExecute(`UPDATE shopify_events SET status = 'granted', last_error = $2 WHERE event_id = $1 AND status IN ('stale','pending')`, [id, MARK]);
    const after = (await profileOf(p.ev.identifier!))!;
    done.push({ event_id: id, at: new Date().toISOString(), event_before: { status: ev.status, last_error: ev.last_error }, profile_before: before, profile_after: after });
    save();
    const evAfter = (await db.dbQueryStrict<EventRow>(`SELECT status FROM shopify_events WHERE event_id = $1`, [id]))[0];
    console.log(`  OK: piano ${after.plan} scade ${after.plan_expires_at} · evento ${evAfter?.status}`);
  }
  rl.close();
  console.log(`\nConcessi ${done.length}/${args.ordini.length}. File di rollback: ${existsSync(rbFile) ? rbFile : "(nessuno: nulla concesso)"}`);
}

main().catch((e) => { console.error(`STOP: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
