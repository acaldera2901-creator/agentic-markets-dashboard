// /world-cup — public World Cup hub (Track B, APPROVE msg_mq1ek03x).
// Hub open, picks gated: groups/calendar/squads/countdown/hit-rate are public;
// the predictions board keeps the existing per-session projection + blur CTA.
// Groups/calendar proxied from ESPN (cached 5 min), squads from Track A tables.
import type { Metadata } from "next";
import Link from "next/link";
import SiteTopbar from "@/components/world-cup/SiteTopbar";
import { SportGlyphSprite } from "@/app/components/sport-glyphs";
import Countdown from "@/components/world-cup/Countdown";
import GroupsGrid from "@/components/world-cup/GroupsGrid";
import CalendarSection from "@/components/world-cup/CalendarSection";
import WcBoard from "@/components/world-cup/WcBoard";
import WinnerOdds from "@/components/world-cup/WinnerOdds";
import WinnerOddsCompact from "@/components/world-cup/WinnerOddsCompact";
import WcReferenceTabs from "@/components/world-cup/WcReferenceTabs";
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

// Some nations arrive under two spellings in wc_squads (data dupes seen on the
// hub): Cabo Verde / Cape Verde and Congo DR / DR Congo are the same country.
// Collapse them in the UI — keep the preferred spelling's row (and its valid
// team link). The wc_squads table itself still needs a proper dedup (DB write).
const SQUAD_CANON: Record<string, string> = {
  "cabo verde": "Cape Verde",
  "cape verde": "Cape Verde",
  "congo dr": "DR Congo",
  "dr congo": "DR Congo",
};
function dedupeSquads(rows: SquadSummary[]): SquadSummary[] {
  const byKey = new Map<string, SquadSummary>();
  for (const s of rows) {
    const raw = s.team_canonical.trim();
    const canon = SQUAD_CANON[raw.toLowerCase()] ?? raw;
    const existing = byKey.get(canon.toLowerCase());
    if (!existing) {
      byKey.set(canon.toLowerCase(), s);
      continue;
    }
    const sPreferred = SQUAD_CANON[raw.toLowerCase()] === raw;
    const ePreferred =
      SQUAD_CANON[existing.team_canonical.trim().toLowerCase()] === existing.team_canonical.trim();
    if (sPreferred && !ePreferred) byKey.set(canon.toLowerCase(), s);
    else if (sPreferred === ePreferred && (s.squad_size ?? 0) > (existing.squad_size ?? 0))
      byKey.set(canon.toLowerCase(), s);
  }
  return [...byKey.values()].sort((a, b) => a.team_canonical.localeCompare(b.team_canonical));
}

export default async function WorldCupPage() {
  const [groups, fixtures, squads] = await Promise.all([
    fetchWcGroups(),
    fetchWcFixtures(),
    dbQuery<SquadSummary>(
      `SELECT team_canonical, squad_size, injured_count, updated_at
       FROM wc_squads ORDER BY team_canonical ASC`
    ),
  ]);

  const dedupedSquads = dedupeSquads(squads);
  const squadsContent = dedupedSquads.length ? (
    <div className="wc-squads-grid">
      {dedupedSquads.map((s) => (
        <Link
          key={s.team_canonical}
          href={`/world-cup/${teamSlug(s.team_canonical)}`}
          className="wc-squad-chip"
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
  );

  return (
    <div className="portal-root wc-root">
      <SportGlyphSprite />
      <SiteTopbar backLabel="Board" />
      <main className="wc-page">
      {/* Compact hero band — title left, live countdown right (no oversized block) */}
      <header className="wc-hub-hero">
        <div className="wc-hub-hero-titles">
          <span className="wc-hero-glyph" aria-hidden="true">
            <svg><use href="#g-trophy" /></svg>
          </span>
          <div>
            <div className="eyebrow">FIFA World Cup 2026 · USA / Canada / Mexico</div>
            <h1>World Cup Intelligence Hub</h1>
          </div>
        </div>
        <Countdown />
      </header>

      {/* Two-column hub: prediction board (main) + compact sidebar (option C) */}
      <div className="wc-layout">
        <div className="wc-main">
          <section className="wc-section wc-section-flush" id="board">
            <h2 className="wc-section-title">Prediction board</h2>
            <WcBoard />
          </section>
        </div>
        <aside className="wc-aside">
          <div className="wc-aside-card">
            <div className="wc-aside-title">Track record</div>
            <TrackRecordStrip />
          </div>
          <WinnerOddsCompact />
          <nav className="wc-aside-card wc-jump-links">
            <div className="wc-aside-title">Explore</div>
            <a href="#groups">Groups →</a>
            <a href="#calendar">Match calendar →</a>
            <a href="#squads">Squads &amp; call-ups →</a>
          </nav>
        </aside>
      </div>

      {/* Tournament reference — tabbed so the hub stops sprawling below the board */}
      <section className="wc-section">
        <h2 className="wc-section-title">Tournament reference</h2>
        <WcReferenceTabs
          tabs={[
            { id: "outlook", label: "Who wins", content: <WinnerOdds /> },
            { id: "groups", label: "Groups", content: <GroupsGrid groups={groups} /> },
            { id: "calendar", label: "Match calendar", content: <CalendarSection fixtures={fixtures} /> },
            { id: "squads", label: "Squads", content: squadsContent },
          ]}
        />
      </section>
      </main>
    </div>
  );
}
