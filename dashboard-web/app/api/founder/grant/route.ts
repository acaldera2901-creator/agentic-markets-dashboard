import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const expected = process.env.FOUNDER_ACCESS_KEY;
  if (!expected || !body.secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (body.secret !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
