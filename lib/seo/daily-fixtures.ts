import type { UpcomingMatch } from "./upcoming-matches";

export function dailyFixtures(matches: readonly UpcomingMatch[], sport: UpcomingMatch["sport"], now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const sportMatches = matches.filter((match) => match.sport === sport);
  const today = sportMatches.filter((match) => match.startsAt.slice(0, 10) === day);
  const nextDay = sportMatches.find((match) => match.startsAt.slice(0, 10) > day)?.startsAt.slice(0, 10);

  return {
    day,
    today,
    nextDay,
    next: nextDay ? sportMatches.filter((match) => match.startsAt.slice(0, 10) === nextDay) : [],
  };
}
