import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

function isAuthorized(req: NextRequest): boolean {
  if (!ADMIN_SECRET) return false;
  const cookie = req.cookies.get("admin_token")?.value;
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  return cookie === ADMIN_SECRET || bearer === ADMIN_SECRET;
}

async function sendTelegram(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await dbQuery("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100");
  return NextResponse.json({ notifications: rows ?? [] });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    type: "telegram" | "in_app" | "email" | "push";
    title?: string;
    body: string;
    target?: string;
  };

  if (!body.type || !body.body) {
    return NextResponse.json({ error: "type and body required" }, { status: 400 });
  }

  let sent = false;

  if (body.type === "telegram") {
    const text = body.title ? `<b>${body.title}</b>\n${body.body}` : body.body;
    sent = await sendTelegram(text);
  }

  await dbQuery(
    `INSERT INTO notifications (type, title, body, target, sent, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [body.type, body.title ?? null, body.body, body.target ?? "all", sent, sent ? new Date().toISOString() : null]
  );

  return NextResponse.json({ ok: true, sent });
}
