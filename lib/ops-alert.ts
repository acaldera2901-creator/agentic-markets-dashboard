// ops-alert.ts — fail-loud notifier for critical cron jobs.
//
// opsAlert() is fire-and-forget: it NEVER throws and NEVER blocks the caller on
// a slow webhook. It always writes the detail to stderr (so the failed-run
// status + Vercel log drain carry it even with no webhook configured) and, if
// ALERT_WEBHOOK_URL is set, additionally POSTs a compact JSON payload to it.
// The env can point at ANY incoming webhook — a Telegram sendMessage proxy,
// Slack, Discord, or a custom endpoint. Without the env it degrades to log-only.
export async function opsAlert(source: string, errors: string[]): Promise<void> {
  // Always leave a trace in the logs, webhook or not.
  console.error("[ops-alert]", source, errors);

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const payload = { source, errors, ts: new Date().toISOString() };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    // Never let an alerting failure bubble into the cron — log and move on.
    console.error("[ops-alert] webhook POST failed:", String(e));
  } finally {
    clearTimeout(timeout);
  }
}
