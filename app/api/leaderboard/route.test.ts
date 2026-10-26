import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbQuery } = vi.hoisted(() => ({ dbQuery: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbQuery, dbExecute: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionPlan: vi.fn() }));
import { GET } from "./route";

beforeEach(() => dbQuery.mockReset());

describe("leaderboard system statistics use one population", () => {
  it.each([
    { wins: "0", losses: "40", expectedWins: 0, expectedSettled: 40, expectedRate: 0 },
    { wins: "10", losses: "30", expectedWins: 10, expectedSettled: 40, expectedRate: 25 },
    { wins: "0", losses: "0", expectedWins: 100, expectedSettled: 120, expectedRate: 83 },
  ])("bets $wins wins / $losses losses cannot mix with leaderboard wins", async ({ wins, losses, expectedWins, expectedSettled, expectedRate }) => {
    dbQuery.mockResolvedValueOnce([{ wins, losses }]).mockResolvedValueOnce([
      { id: 1, display_name: "Member", points: 1000, bets_won: 100, bets_total: 120, sport: "football", joined_at: "2026-10-01T00:00:00Z" },
    ]);
    const response = await GET();
    expect(await response.json()).toMatchObject({
      system_wins: expectedWins,
      system_settled: expectedSettled,
      system_hit_rate: expectedRate,
    });
  });
});
