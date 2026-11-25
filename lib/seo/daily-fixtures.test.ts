import { describe, expect, it } from "vitest";
import { dailyFixtures } from "./daily-fixtures";
import type { UpcomingMatch } from "./upcoming-matches";

function match(id: string, sport: UpcomingMatch["sport"], startsAt: string): UpcomingMatch {
  return { id, sport, startsAt, home: "A", away: "B", competition: "Test" };
}

describe("dailyFixtures", () => {
  const now = new Date("2026-11-25T23:55:00Z");
  const lateFootball = match("1", "football", "2026-11-25T23:59:00Z");
  const tomorrowTennis = match("2", "tennis", "2026-11-26T00:01:00Z");
  const laterTennis = match("3", "tennis", "2026-11-27T12:00:00Z");

  it("selects fixtures by sport and UTC calendar day", () => {
    const result = dailyFixtures([lateFootball, tomorrowTennis], "football", now);
    expect(result.day).toBe("2026-11-25");
    expect(result.today).toEqual([lateFootball]);
    expect(result.next).toEqual([]);
  });

  it("identifies only the next covered day for the selected sport", () => {
    const result = dailyFixtures([lateFootball, tomorrowTennis, laterTennis], "tennis", now);
    expect(result.today).toEqual([]);
    expect(result.nextDay).toBe("2026-11-26");
    expect(result.next).toEqual([tomorrowTennis]);
  });
});
