import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

// Vercel Cron calls GET with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.get("host")}`;
  const resp = await fetch(`${base}/api/predictions`, {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  });
  const data = await resp.json();
  if (!resp.ok) {
    return NextResponse.json({ error: "upstream_failed", status: resp.status, detail: data }, { status: resp.status });
  }
  return NextResponse.json(data);
}
