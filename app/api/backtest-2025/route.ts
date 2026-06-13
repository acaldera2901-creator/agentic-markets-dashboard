import { NextResponse } from "next/server";
import summary from "@/lib/backtest-2025-summary.json";

// #BACKTEST-2025-1 — public, read-only. A clearly-labelled, walk-forward 2025
// backtest of the production models (football top-5 via lib/poisson-model;
// tennis via the production surface-Elo). Static artifact computed offline by
// scripts/backtest_2025_football.ts + scripts/backtest_2025_tennis.py — it is
// SIMULATION, deliberately served from a separate endpoint and NEVER mixed into
// the live `bets` track record, leaderboard or desk headline stats.
export async function GET() {
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
  });
}
