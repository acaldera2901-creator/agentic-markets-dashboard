import Link from "next/link";
import ClassicChrome from "@/components/classic/ClassicChrome";
import { SiteFooter } from "@/components/SiteFooter";
import { dailyFixtures } from "@/lib/seo/daily-fixtures";
import { fetchPublicMatchReadings, fixtureReadingKey } from "@/lib/seo/public-match-probabilities";
import { fetchUpcomingMatches, type UpcomingMatch } from "@/lib/seo/upcoming-matches";
import { JsonLd, breadcrumbJsonLd, matchesJsonLd } from "./json-ld";

const dayFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "UTC" });

const percentFormat = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 });

function FixtureList({ matches, readings }: {
  matches: readonly UpcomingMatch[];
  readings: Awaited<ReturnType<typeof fetchPublicMatchReadings>>;
}) {
  return (
    <ul className="divide-y divide-current/15">
      {matches.map((match) => {
        const key = fixtureReadingKey(match);
        const reading = key ? readings.get(key) : null;
        return (
          <li key={match.id} className="grid gap-1 py-3 sm:grid-cols-[5rem_1fr_auto]">
            <time dateTime={match.startsAt}>{timeFormat.format(new Date(match.startsAt))}</time>
            <span><strong style={{ color: "var(--am-text)" }}>{match.home} vs {match.away}</strong><br />{match.competition}</span>
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
  );
}

export async function DailySportFixtures({ sport }: { sport: UpcomingMatch["sport"] }) {
  const football = sport === "football";
  const label = football ? "Football" : "Tennis";
  const path = `/${sport}-predictions-today`;
  const board = `/predictions?sport=${sport}`;
  const [matches, readings] = await Promise.all([fetchUpcomingMatches(), fetchPublicMatchReadings(sport)]);
  const { day, today, nextDay, next } = dailyFixtures(matches, sport);
  const visible = today.length ? today : next;

  return (
    <>
      <ClassicChrome />
      <JsonLd data={breadcrumbJsonLd([[`${label} Predictions Today`, path]])} />
      {visible.length > 0 && <JsonLd data={matchesJsonLd(visible)} />}
      <main className="relative mx-auto max-w-3xl px-5 py-10 sm:px-8" style={{ color: "var(--am-muted)" }}>
        <header className="space-y-4">
          <p><time dateTime={day}>{dayFormat.format(new Date(day))}</time> · All times UTC</p>
          <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: "var(--am-text)" }}>{label} predictions today</h1>
          <p>{football
            ? "Find today’s upcoming football matches and kick-off times. Open a match on the board to check available home-win, draw and away-win probabilities."
            : "Find today’s upcoming tennis matches, tournaments and start times. Open a match on the board to check available player win probabilities and their source."}</p>
          <Link className="inline-block font-semibold underline underline-offset-4" href={board}>Open the {sport} probability board</Link>
        </header>

        <section className="mt-9" aria-labelledby="today-fixtures">
          <h2 id="today-fixtures" className="text-xl font-bold" style={{ color: "var(--am-text)" }}>Today’s {sport} fixtures on BetRedge</h2>
          <p className="mt-3">Where shown, the public percentage refers to one outcome only. The board shows the outcome and full reading according to account access.</p>
          {today.length ? <FixtureList matches={today} readings={readings} /> : <p className="mt-3">No fixtures for today are currently listed in BetRedge’s public match window.</p>}
        </section>
        {!today.length && nextDay && (
          <section className="mt-7" aria-labelledby="next-fixtures">
            <h2 id="next-fixtures" className="text-xl font-bold" style={{ color: "var(--am-text)" }}>Next listed fixtures · {dayFormat.format(new Date(nextDay))}</h2>
            <FixtureList matches={next} readings={readings} />
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
