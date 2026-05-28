import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      event_type: string;
      session_id?: string;
      country?: string;
      language?: string;
      plan?: string;
      partner_id?: string;
      value?: number;
      meta?: Record<string, unknown>;
    };

    if (!body.event_type) {
      return NextResponse.json({ error: "event_type required" }, { status: 400 });
    }

    const country =
      body.country ??
      req.headers.get("x-vercel-ip-country") ??
      req.headers.get("cf-ipcountry") ??
      null;

    await dbQuery(
      `INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        body.event_type,
        body.session_id ?? null,
        country,
        body.language ?? null,
        body.plan ?? null,
        body.partner_id ?? null,
        body.value ?? 0,
        JSON.stringify(body.meta ?? {}),
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[track] error:", err);
    return NextResponse.json({ ok: true }); // never block the client on tracking failures
  }
}
