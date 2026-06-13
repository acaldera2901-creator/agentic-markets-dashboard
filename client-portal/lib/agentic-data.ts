import type { BetRecord, DashboardStats, EquitySnapshot } from "@/lib/types";

type DeskBet = {
  id: number | string;
  selection: string;
  odds: number | null;
  stake: number | null;
  paper: boolean;
  status: string;
  profit_loss: number | null;
  betfair_bet_id?: string | null;
  placed_at: string;
  settled_at: string | null;
  home_team?: string | null;
  away_team?: string | null;
  league?: string | null;
  thesis?: string | null;
  match_external_id?: string | null;
};

type DeskData = {
  bets: DeskBet[];
  summary: {
    won: number;
    lost: number;
    pending: number;
    pnl: number;
    win_rate: string;
  };
};

export type RealPortfolio = {
  stats: DashboardStats;
  equity: EquitySnapshot[];
  bets: BetRecord[];
  allocation: Array<{ name: string; value: number; color: string }>;
};

const API_BASE = process.env.AGENTIC_DESK_API_URL || "https://betredge-app.vercel.app";
const STARTING_BANKROLL = Number(process.env.AGENTIC_STARTING_BANKROLL || 7.2);

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function matchName(bet: DeskBet) {
  if (bet.home_team && bet.away_team) return `${bet.home_team} vs ${bet.away_team}`;
  if (bet.home_team) return bet.home_team;
  const thesisMatch = bet.thesis?.match(/for (.+?) \([A-Z0-9]+\)/i)?.[1];
  if (thesisMatch) return thesisMatch;
  return bet.match_external_id || `Betfair ${bet.betfair_bet_id || bet.id}`;
}

function toClientBet(userId: string, bet: DeskBet): BetRecord | null {
  if (!["pending", "won", "lost"].includes(bet.status)) return null;
  return {
    id: String(bet.id),
    user_id: userId,
    sport: "football",
    match_name: matchName(bet),
    selection: bet.selection,
    odds: bet.odds,
    stake: bet.stake,
    status: bet.status as "pending" | "won" | "lost",
    profit_loss: bet.profit_loss,
    placed_at: bet.placed_at,
    settled_at: bet.settled_at,
  };
}

function buildEquity(userId: string, bets: BetRecord[], startingBalance: number): EquitySnapshot[] {
  const settled = bets
    .filter((bet) => bet.status !== "pending" && bet.settled_at && bet.profit_loss != null)
    .sort((a, b) => new Date(a.settled_at!).getTime() - new Date(b.settled_at!).getTime());

  const firstDate = settled[0]?.settled_at || new Date().toISOString();
  const points: EquitySnapshot[] = [{
    id: "start",
    user_id: userId,
    date: firstDate.slice(0, 10),
    balance: money(startingBalance),
    pnl_daily: 0,
    created_at: firstDate,
  }];

  let balance = startingBalance;
  for (const bet of settled) {
    balance = money(balance + (bet.profit_loss || 0));
    points.push({
      id: `bet-${bet.id}`,
      user_id: userId,
      date: bet.settled_at!.slice(0, 10),
      balance,
      pnl_daily: money(bet.profit_loss || 0),
      created_at: bet.settled_at!,
    });
  }

  return points;
}

export async function getRealPortfolio(userId: string): Promise<RealPortfolio> {
  const response = await fetch(`${API_BASE}/api/data`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Desk API ${response.status}`);

  const data = await response.json() as DeskData;
  const bets = data.bets
    .map((bet) => toClientBet(userId, bet))
    .filter((bet): bet is BetRecord => Boolean(bet));
  const settled = bets.filter((bet) => bet.status !== "pending");
  const won = settled.filter((bet) => bet.status === "won").length;
  const pnl = money(Number(data.summary?.pnl || 0));
  const currentBalance = money(STARTING_BANKROLL + pnl);
  const activeBets = bets.filter((bet) => bet.status === "pending").length;
  const footballCount = bets.filter((bet) => bet.sport === "football").length;
  const tennisCount = bets.filter((bet) => bet.sport === "tennis").length;
  const totalSports = footballCount + tennisCount || 1;

  return {
    stats: {
      currentBalance,
      totalPnL: pnl,
      totalPnLPct: STARTING_BANKROLL > 0 ? (pnl / STARTING_BANKROLL) * 100 : 0,
      winRate: settled.length ? (won / settled.length) * 100 : 0,
      activeBets,
      startingBalance: STARTING_BANKROLL,
    },
    equity: buildEquity(userId, bets, STARTING_BANKROLL),
    bets,
    allocation: [
      { name: "Football", value: (footballCount / totalSports) * 100, color: "#22C55E" },
      { name: "Tennis", value: (tennisCount / totalSports) * 100, color: "#818CF8" },
    ],
  };
}
