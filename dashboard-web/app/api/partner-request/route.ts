import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DB_URL = process.env.DATABASE_URL ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company, site, category, email, message } = body as {
      company: string;
      site?: string;
      category?: string;
      email: string;
      message?: string;
    };

    if (!company || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (DB_URL) {
      const { neon } = await import("@neondatabase/serverless");
      const db = neon(DB_URL);
      await db`
        CREATE TABLE IF NOT EXISTS partner_requests (
          id SERIAL PRIMARY KEY,
          company TEXT NOT NULL,
          site TEXT,
          category TEXT,
          email TEXT NOT NULL,
          message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await db`
        INSERT INTO partner_requests (company, site, category, email, message)
        VALUES (${company}, ${site ?? null}, ${category ?? null}, ${email}, ${message ?? null})
      `;
    }

    console.log("[partner-request]", { company, category, email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[partner-request] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
