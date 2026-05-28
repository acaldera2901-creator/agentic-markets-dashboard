import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

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

    await dbQuery(
      `INSERT INTO partner_requests (company, site, category, email, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [company, site ?? null, category ?? null, email, message ?? null]
    );

    console.log("[partner-request]", { company, category, email });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[partner-request] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
