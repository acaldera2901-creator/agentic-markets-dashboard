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
  const resp = await fetch(`${base}/api/predictions`, { method: "POST" });
  const data = await resp.json();
  return NextResponse.json(data);
}
