import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { winBackEmail } from "@/lib/email";
import { sendTransactional } from "@/lib/notify";
import { verifyBearer } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://betredge.com").replace(/\/$/, "");

// Daily subscription sweep (payments GAP2):
//   1. downgrade expired paid plans to 'free' (runtime auth already enforces
//      expiry — this just cleans the stored state and clears the expiry);
//   2. email renewal reminders at ~5 and ~1 days before expiry.
// Runtime access control does NOT depend on this cron; it is housekeeping +
// proactive reminders. Cron-secret gated, default-deny.

type ExpiringRow = { identifier: string; name: string | null; plan_expires_at: string; language: string | null };

function reminderEmail(daysLeft: number, lang: string) {
  const it = lang !== "en";
  const subject = it
    ? `Il tuo BetRedge Pro scade tra ${daysLeft} giorn${daysLeft === 1 ? "o" : "i"}`
    : `Your BetRedge Pro expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  const body = it
    ? `Il tuo abbonamento BetRedge Pro scade tra ${daysLeft} giorn${daysLeft === 1 ? "o" : "i"}. Rinnova per non perdere l'accesso ai segnali e alle probabilità calibrate.`
    : `Your BetRedge Pro subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Renew to keep access to the signals and calibrated probabilities.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="font-size:13px;color:#64748b;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">BetRedge</p>
  <p style="font-size:14px;line-height:1.5">${body}</p>
  <a href="${SITE}/app?tab=account" style="display:inline-block;margin-top:12px;padding:10px 18px;border-radius:8px;background:#0f172a;color:#fff;text-decoration:none;font-size:13px">${it ? "Rinnova ora" : "Renew now"}</a>
</div>`;
  return { subject, html, text: body };
}

// Vercel Cron calls GET with Authorization: Bearer <CRON_SECRET>.
export async function GET(req: Request) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1. Downgrade expired paid plans (fail-loud — a silent failure would leave
  //    expired subscribers showing as paid in the stored state).
  let downgraded = 0;
  let expiredRows: { identifier: string; language: string | null }[] = [];
  try {
    expiredRows = await dbExecute<{ identifier: string; language: string | null }>(
      `UPDATE profiles
         SET plan = 'free', plan_expires_at = NULL, updated_at = NOW()
       WHERE plan IN ('base', 'premium')
         AND plan_expires_at IS NOT NULL
         AND plan_expires_at < NOW()
       RETURNING identifier, language`
    );
    downgraded = expiredRows.length;
  } catch (e) {
    console.error("[cron/subscriptions] downgrade failed:", String(e));
    return NextResponse.json({ error: "downgrade failed" }, { status: 500 });
  }

  // 1b. Win-back: invite the just-expired users back. Best-effort + recorded.
  let winback = 0;
  for (const r of expiredRows) {
    if (!r.identifier.includes("@")) continue;
    const mail = winBackEmail(r.language === "en" ? "en" : "it");
    const res = await sendTransactional({
      type: "winback",
      to: r.identifier,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (res.sent) winback++;
  }

  // 2. Renewal reminders at the 5-day and 1-day marks (each a 24h window so a
  //    once-daily run hits each subscriber exactly once per mark). Email is
  //    best-effort: a send failure never fails the sweep.
  const reminders: Record<string, number> = { "5": 0, "1": 0 };
  for (const days of [5, 1] as const) {
    let due: ExpiringRow[] = [];
    try {
      due = await dbQuery<ExpiringRow>(
        `SELECT identifier, name, plan_expires_at::text, language
           FROM profiles
          WHERE plan IN ('base', 'premium')
            AND plan_expires_at >= NOW() + ($1 || ' days')::interval
            AND plan_expires_at <  NOW() + (($1 + 1) || ' days')::interval`,
        [days]
      );
    } catch (e) {
      console.error(`[cron/subscriptions] reminder query (${days}d) failed:`, String(e));
      continue;
    }
    for (const r of due) {
      if (!r.identifier.includes("@")) continue;
      const mail = reminderEmail(days, r.language ?? "it");
      const res = await sendTransactional({
        type: "renewal_reminder",
        to: r.identifier,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        meta: { days_left: days },
      });
      if (res.sent) reminders[String(days)]++;
    }
  }

  return NextResponse.json(
    { ok: true, downgraded, winback, reminders },
    { headers: { "cache-control": "no-store" } }
  );
}
