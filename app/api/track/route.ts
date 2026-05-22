import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DB_URL = process.env.DATABASE_URL ?? "";

async function ensureEventsTable() {
  if (!DB_URL) return;
  const { neon } = await import("@neondatabase/serverless");
  const db = neon(DB_URL);
  await db`
    CREATE TABLE IF NOT EXISTS events (
      id          BIGSERIAL PRIMARY KEY,
      event_type  TEXT NOT NULL,
      session_id  TEXT,
      country     TEXT,
      language    TEXT,
      plan        TEXT,
      partner_id  TEXT,
      value       FLOAT DEFAULT 0,
      meta        JSONB DEFAULT '{}',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

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

    if (DB_URL) {
      await ensureEventsTable();
      const { neon } = await import("@neondatabase/serverless");
      const db = neon(DB_URL);
      await db`
        INSERT INTO events (event_type, session_id, country, language, plan, partner_id, value, meta)
        VALUES (
          ${body.event_type},
          ${body.session_id ?? null},
          ${country},
          ${body.language ?? null},
          ${body.plan ?? null},
          ${body.partner_id ?? null},
          ${body.value ?? 0},
          ${JSON.stringify(body.meta ?? {})}
        )
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[track] error:", err);
    return NextResponse.json({ ok: true }); // never block the client on tracking failures
  }
}
