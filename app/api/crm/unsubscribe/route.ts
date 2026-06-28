import { NextResponse } from "next/server";
import { dbExecute } from "@/lib/db";
import { verifyUnsub } from "@/lib/crm-unsub";

export const dynamic = "force-dynamic";

// Disiscrizione marketing one-click (no login). GET ?t=<token firmato>.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const id = verifyUnsub(token);
  const html = (msg: string) =>
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:system-ui,sans-serif;max-width:440px;margin:64px auto;padding:24px;text-align:center;color:#0f172a">${msg}</div>`;
  if (!id) {
    return new NextResponse(html("<h2>Link non valido</h2><p>Il link di disiscrizione non è valido o è scaduto.</p>"), {
      status: 400, headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  try {
    await dbExecute(
      "UPDATE profiles SET marketing_opt_out = true, updated_at = NOW() WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1",
      [id]
    );
  } catch (e) {
    console.error("[crm/unsubscribe] update failed:", String(e));
  }
  return new NextResponse(
    html("<p style='font-size:13px;color:#64748b;letter-spacing:.08em;text-transform:uppercase'>BetRedge</p><h2>Disiscrizione completata</h2><p>Non riceverai più email di marketing. / You've been unsubscribed from marketing emails.</p>"),
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
