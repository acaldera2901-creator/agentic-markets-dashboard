import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Retire all public access without reading or changing historical records.
function retired() {
  return NextResponse.json(
    { error: "Leaderboard is no longer available." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = retired;
export const POST = retired;
export const DELETE = retired;
