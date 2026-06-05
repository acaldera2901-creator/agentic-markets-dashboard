// /world-cup — public World Cup hub (Track B, APPROVE msg_mq1ek03x).
// Hub open, picks gated: groups/calendar/squads/countdown/hit-rate are public;
// the predictions board keeps the existing per-session projection + blur CTA.
// Groups/calendar proxied from ESPN (cached 5 min), squads from Track A tables.
import type { Metadata } from "next";
import Link from "next/link";
import SiteTopbar from "@/components/world-cup/SiteTopbar";
import Countdown from "@/components/world-cup/Countdown";
import GroupsGrid from "@/components/world-cup/GroupsGrid";
import CalendarSection from "@/components/world-cup/CalendarSection";
import WcBoard from "@/components/world-cup/WcBoard";
import TrackRecordStrip from "@/components/world-cup/TrackRecordStrip";
import { fetchWcGroups, fetchWcFixtures, teamSlug } from "@/lib/world-cup";
import { dbQuery } from "@/lib/db";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "World Cup 2026 — Groups, Calendar, Squads & AI Predictions | Agentic Markets",
  description:
    "FIFA World Cup 2026 hub: all 12 groups, the full 104-match calendar with venues, official squad reveals for the 48 teams, and the AI prediction board with a transparent hit-rate track record.",
};

type SquadSummary = {
  team_canonical: string;
  squad_size: number | null;
  injured_count: number | null;
  updated_at: string;
};

export default async function WorldCupPage() {
  const [groups, fixtures, squads] = await Promise.all([
    fetchWcGroups(),
    fetchWcFixtures(),
    dbQuery<SquadSummary>(
      `SELECT team_canonical, squad_size, injured_count, updated_at
       FROM wc_squads ORDER BY team_canonical ASC`
    ),
  ]);

  return (
    <div className="portal-root wc-root">
      <SiteTopbar backLabel="Board" />
      <main className="wc-page">
      <header className="wc-hero">
        <div className="eyebrow">FIFA World Cup 2026 · USA / Canada / Mexico</div>
        <h1>World Cup Intelligence Hub</h1>
        <p className="wc-hero-sub">
          48 teams · 12 groups · 104 matches. Squad reveals tracked as they
          happen, AI predictions with a transparent hit-rate record.
        </p>
        <Countdown />
      </header>

      <section className="wc-section" id="board">
        <h2 className="wc-section-title">Prediction board</h2>
        <WcBoard />
      </section>

      <section className="wc-section" id="groups">
        <h2 className="wc-section-title">Groups</h2>
        <GroupsGrid groups={groups} />
      </section>

      <section className="wc-section" id="calendar">
        <h2 className="wc-section-title">Match calendar</h2>
        <CalendarSection fixtures={fixtures} />
      </section>

      <section className="wc-section" id="squads">
        <h2 className="wc-section-title">Squads &amp; call-ups</h2>
        {squads.length ? (
          <div className="wc-squads-grid">
            {squads.map((s) => (
              <Link
                key={s.team_canonical}
                href={`/world-cup/${teamSlug(s.team_canonical)}`}
                className="glass-card wc-squad-chip"
              >
                <strong>{s.team_canonical}</strong>
                <small>
                  {s.squad_size ?? "—"} players
                  {s.injured_count ? ` · ${s.injured_count} injured` : ""}
                </small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="book-empty">Squad data syncing — back shortly.</div>
        )}
      </section>

      <section className="wc-section" id="track-record">
        <h2 className="wc-section-title">Track record</h2>
        <TrackRecordStrip />
      </section>
      </main>
    </div>
  );
}
