import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { resolveFlow, dueTriggers, isEligible, flowAllowed, type CrmProfile } from "@/lib/crm";
import { CRM_TOUCHPOINTS, renderCrm } from "@/lib/crm-content";
import { sendTransactional } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Motore CRM giornaliero. Dry-run di default (logga, NON invia) finché non si
// passa ?send=1 (e l'env CRM_SEND_ENABLED="1"): doppio gate per il primo invio reale.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);

  // QA test-send: ?test=<email>&key=<touchpoint>&lang=it|en invia UN solo
  // touchpoint brandizzato a quell'indirizzo, SENZA scrivere su crm_trigger_sends
  // (nessun effetto sul giro reale). Per verificare il rendering in una casella
  // vera prima del primo invio ai clienti.
  const testTo = url.searchParams.get("test");
  if (testTo) {
    const key = url.searchParams.get("key") || "onb_activate";
    const lang = url.searchParams.get("lang") === "en" ? "en" : "it";
    const mail = renderCrm(key, lang, testTo);
    if (!mail) return NextResponse.json({ error: `unknown touchpoint key '${key}'`, keys: CRM_TOUCHPOINTS.map((t) => t.key) }, { status: 400 });
    const res = await sendTransactional({
      type: "winback",
      to: testTo,
      subject: `[TEST] ${mail.subject}`,
      html: mail.html,
      text: mail.text,
      headers: { "List-Unsubscribe": `<${mail.unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      meta: { crm: key, test: true },
    });
    return NextResponse.json({ ok: true, test: true, to: testTo, key, lang, sent: res.sent, error: res.error });
  }

  const live = url.searchParams.get("send") === "1" && process.env.CRM_SEND_ENABLED === "1";
  const nowISO = new Date().toISOString();

  const profiles = (await dbQuery<CrmProfile>(
    `SELECT identifier, plan, language, created_at::text, activated_at::text, plan_expires_at::text, marketing_opt_out, marketing_opt_in
       FROM profiles`
  )) ?? [];

  // mappa identifier -> set di trigger già inviati
  const sentRows = (await dbQuery<{ trigger_key: string; identifier: string }>(
    "SELECT trigger_key, identifier FROM crm_trigger_sends"
  )) ?? [];
  const sentByUser = new Map<string, Set<string>>();
  for (const r of sentRows) {
    const s = sentByUser.get(r.identifier) ?? new Set<string>();
    s.add(r.trigger_key);
    sentByUser.set(r.identifier, s);
  }

  let planned = 0, sent = 0, failed = 0, skipped = 0;
  const preview: { to: string; flow: string; key: string }[] = [];

  for (const p of profiles) {
    if (!isEligible(p)) continue;
    const { flow, dayInFlow } = resolveFlow(p, nowISO);
    if (flow === "none") continue;
    // Consenso per-flow (legale): acquisition (sconti a free) solo con opt-in esplicito.
    if (!flowAllowed(flow, p)) continue;
    const due = dueTriggers(flow, dayInFlow, CRM_TOUCHPOINTS, sentByUser.get(p.identifier) ?? new Set());
    if (due.length === 0) continue;
    const toSend = due[due.length - 1];           // il più recente dovuto
    const toSuppress = due.slice(0, -1);          // dovuti precedenti mancati → consuma senza inviare
    planned++;
    if (preview.length < 50) preview.push({ to: p.identifier, flow, key: toSend.key });
    if (!live) continue;
    const lang = p.language === "en" ? "en" : "it";
    const mail = renderCrm(toSend.key, lang, p.identifier);
    if (!mail) { console.warn("[cron/crm] no template for", toSend.key); skipped++; continue; }
    let res: { sent: boolean; error?: string };
    try {
      res = await sendTransactional({
        type: "winback",
        to: p.identifier,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        // One-click unsubscribe (RFC 8058): richiesto da Gmail/Yahoo per invii
        // bulk e per l'obbligo di disiscrizione facile (legale-compliance).
        headers: {
          "List-Unsubscribe": `<${mail.unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        meta: { crm: toSend.key, flow },
      });
    } catch (e) {
      console.error("[cron/crm] send error:", p.identifier, toSend.key, String(e));
      failed++;
      continue;
    }
    if (res.sent) {
      sent++;
      // Consume the sent touchpoint AND suppress the earlier missed ones, only
      // AFTER a confirmed send — so a render/send failure above never marks a
      // sequence as consumed without an email actually going out.
      for (const t of [...toSuppress, toSend]) {
        try { await dbExecute("INSERT INTO crm_trigger_sends (trigger_key, identifier) VALUES ($1,$2) ON CONFLICT DO NOTHING", [t.key, p.identifier]); } catch (e) { console.error("[cron/crm] dedup insert failed:", String(e)); }
      }
    } else { failed++; }
  }

  return NextResponse.json({ ok: true, live, profiles: profiles.length, planned, sent, failed, skipped, preview });
}
