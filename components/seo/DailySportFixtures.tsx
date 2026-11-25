import Link from "next/link";
import ClassicChrome from "@/components/classic/ClassicChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { dailyFixtures } from "@/lib/seo/daily-fixtures";
import { fetchPublicMatchReadings, fixtureReadingKey } from "@/lib/seo/public-match-probabilities";
import { fetchUpcomingMatches, type UpcomingMatch } from "@/lib/seo/upcoming-matches";
import { CLASSIC } from "@/lib/classic/flag";
import { DailySkipLink } from "./DailySkipLink";
import { JsonLd, breadcrumbJsonLd, matchesJsonLd } from "./json-ld";

const dayFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "UTC" });

const percentFormat = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 });

function groupByCompetition(matches: readonly UpcomingMatch[]) {
  const groups = new Map<string | null, UpcomingMatch[]>();
  for (const match of matches) {
    const isUnspecified = ["Partner feed", "Tennis", "Football"].includes(match.competition);
    const competition = isUnspecified ? null : match.competition;
    const group = groups.get(competition);
    if (group) group.push(match);
    else groups.set(competition, [match]);
  }
  return groups;
}

function FixtureList({ groups, readings }: {
  groups: ReturnType<typeof groupByCompetition>;
  readings: Awaited<ReturnType<typeof fetchPublicMatchReadings>>;
}) {
  return (
    <div className="mt-5 space-y-5">
      {Array.from(groups, ([competition, matches]) => (
        <div key={competition ?? "unlisted"}>
          {(competition || groups.size > 1) && (
            <h3 className="font-semibold" style={{ color: "var(--am-text)" }}>
              {competition ?? "Competition not listed"}
            </h3>
          )}
          <ul className="divide-y divide-current/15">
            {matches.map((match) => {
              const key = fixtureReadingKey(match);
              const reading = key ? readings.get(key) : null;
              return (
                <li key={match.id} className="grid gap-1 py-3 sm:grid-cols-[5rem_1fr_auto]">
                  <time dateTime={match.startsAt}>{timeFormat.format(new Date(match.startsAt))}</time>
                  <span><strong style={{ color: "var(--am-text)" }}>{match.home} vs {match.away}</strong></span>
                  {reading && (
                    <span className="tabular-nums">
                      {reading.source === "market" ? "Market-derived" : "Estimated"} · {percentFormat.format(reading.probability)}
                      {reading.computedAt && (
                        <time className="block text-xs" dateTime={reading.computedAt}>
                          Calculated {timeFormat.format(new Date(reading.computedAt))} UTC
                        </time>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export async function DailySportFixtures({ sport }: { sport: UpcomingMatch["sport"] }) {
  const football = sport === "football";
  const label = football ? "Football" : "Tennis";
  const path = `/${sport}-predictions-today`;
  const board = `/predictions?sport=${sport}`;
  const [matches, readings] = await Promise.all([fetchUpcomingMatches(), fetchPublicMatchReadings(sport)]);
  const { day, today, nextDay, next } = dailyFixtures(matches, sport);
  const groups = groupByCompetition(today.length ? today : next);
  const visible = Array.from(groups.values()).flat();

  return (
    <>
      {!CLASSIC && <DailySkipLink />}
      <ClassicChrome />
      <JsonLd data={breadcrumbJsonLd([[`${label} Predictions Today`, path]])} />
      {visible.length > 0 && <JsonLd data={matchesJsonLd(visible)} />}
      <main className="relative mx-auto max-w-3xl px-5 py-10 sm:px-8" style={{ color: "var(--am-muted)" }}>
        <header className="space-y-4">
          <h1
            id="daily-content"
            tabIndex={-1}
            className="scroll-mt-24 text-3xl font-bold sm:text-4xl"
            style={{ color: "var(--am-text)" }}
          >
            {label} predictions today
          </h1>
          <p><time dateTime={day}>{dayFormat.format(new Date(day))}</time> · All times UTC</p>
          <p>{football
            ? "Browse today’s football fixtures, grouped by competition where available, with kick-off times in UTC and a pre-match model percentage where available. Open the football board for the available 1X2 breakdown: home win, draw and away win."
            : "Browse today’s tennis schedule with match start times in UTC and available pre-match win probabilities. Each percentage is labelled as a market-derived reading or an estimate. Tournament names appear where available."}</p>
          <Link className="inline-block font-semibold underline underline-offset-4" href={board}>Open the {sport} probability board</Link>
        </header>

        <section className="mt-9" aria-labelledby="today-fixtures">
          <h2 id="today-fixtures" className="text-xl font-bold" style={{ color: "var(--am-text)" }}>{football ? "Today’s football fixtures by competition" : "Today’s tennis match schedule"}</h2>
          {today.length > 0 && <p className="mt-3">Each public percentage refers to one outcome. Open the board to see the outcome and the analysis available to your account.</p>}
          {today.length ? <FixtureList groups={groups} readings={readings} /> : <p className="mt-3">No fixtures for today are currently listed in BetRedge’s public match window.</p>}
        </section>
        {!today.length && nextDay && (
          <section className="mt-7" aria-labelledby="next-fixtures">
            <h2 id="next-fixtures" className="text-xl font-bold" style={{ color: "var(--am-text)" }}>Next listed {sport} matches · {dayFormat.format(new Date(nextDay))}</h2>
            <FixtureList groups={groups} readings={readings} />
          </section>
        )}

        <section className="mt-9 space-y-3" aria-labelledby="reading-probabilities">
          <h2 id="reading-probabilities" className="text-xl font-bold" style={{ color: "var(--am-text)" }}>How to read {sport} match probabilities</h2>
          <p>{football
            ? "For a three-outcome football market, compare home win, draw and away win together. If you calculate implied probabilities from decimal odds, divide 1 by each price and then normalise the three results to remove the margin. Compare the same match and outcome on both sides."
            : "For a two-player match-winner market, compare both players together. Decimal odds of 2.00 imply 50% before adjusting for margin. A market-only reading reflects market prices; where an independent estimate is available, check its source before comparing the two."}</p>
          <p>Readings depend on match coverage and account access. A probability describes uncertainty about a result.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Prediction resources">
            <Link href={`/ai-${sport}-predictions`} className="underline">{label} methodology</Link>
            <Link href="/tools/odds-converter" className="underline">Odds to probability calculator</Link>
            <Link href="/history" className="underline">Public track record</Link>
            <Link href={football ? "/tennis-predictions-today" : "/football-predictions-today"} className="underline">{football ? "Tennis" : "Football"} fixtures today</Link>
          </nav>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
