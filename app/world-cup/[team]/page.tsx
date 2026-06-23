// /world-cup/[team] — one page per squad (48), ISR 1h (B3).
// SEO surface ("convocati <team> mondiali 2026"): full roster with injury
// flags, the reveal timeline (in/out per snapshot — Track A data), and the
// team's World Cup fixtures. No money fields, nothing gated here.
import type { Metadata } from "next";
import SiteTopbar from "@/components/world-cup/SiteTopbar";
import { SiteFooter } from "@/components/SiteFooter";
import { notFound } from "next/navigation";
import { dbQuery } from "@/lib/db";
import { fetchWcFixtures, fetchTeamGroupMap, teamSlug, teamNeedleFromSlug, canonTeamSlug } from "@/lib/world-cup";

export const revalidate = 3600;
export const dynamicParams = true;

type SquadRow = {
  id: string;
  team_canonical: string;
  squad_size: number | null;
  injured_count: number | null;
  updated_at: string;
};
type PlayerRow = {
  player_name: string;
  position: string | null;
  is_injured: boolean;
  shirt_number: number | null;
  club_team: string | null;
  age: number | null;
};
type SnapshotRow = {
  captured_at: string;
  diff: { added?: string[]; removed?: string[]; injury_changes?: string[] } | null;
};

export async function generateStaticParams() {
  const rows = await dbQuery<{ team_canonical: string }>(
    `SELECT team_canonical FROM wc_squads ORDER BY team_canonical ASC`
  );
  return rows.map((r) => ({ team: teamSlug(r.team_canonical) }));
}

async function loadSquad(slug: string) {
  const needle = teamNeedleFromSlug(slug);
  const squads = await dbQuery<SquadRow>(
    `SELECT id, team_canonical, squad_size, injured_count, updated_at
     FROM wc_squads WHERE team_canonical ILIKE $1 LIMIT 1`,
    [needle]
  );
  return squads[0] || null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ team: string }> }
): Promise<Metadata> {
  const { team } = await params;
  const squad = await loadSquad(team);
  const name = squad?.team_canonical || team.replace(/-/g, " ");
  return {
    title: `${name} — World Cup 2026 squad, call-ups & fixtures | BetRedge`,
    description: `${name} at the 2026 World Cup: official squad list with injury status, every call-up change as it was announced, and the full match schedule.`,
  };
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});

export default async function TeamPage(
  { params }: { params: Promise<{ team: string }> }
) {
  const { team } = await params;
  const squad = await loadSquad(team);
  if (!squad) notFound();

  const [players, snapshots, fixtures, groupMap] = await Promise.all([
    dbQuery<PlayerRow>(
      `SELECT player_name, position, is_injured, shirt_number, club_team, age
       FROM wc_squad_players WHERE squad_id = $1
       ORDER BY position ASC NULLS LAST, player_name ASC`,
      [squad.id]
    ),
    dbQuery<SnapshotRow>(
      `SELECT captured_at, diff FROM wc_squad_snapshots
       WHERE team_canonical = $1 ORDER BY captured_at DESC LIMIT 20`,
      [squad.team_canonical]
    ),
    fetchWcFixtures(),
    fetchTeamGroupMap(),
  ]);

  // MEDIUM-7: match ESPN fixture/group names against the canonical squad name
  // through canonTeamSlug (USA↔United States, Korea Republic↔South Korea, …),
  // otherwise ~7 nations showed no fixtures and no group.
  const teamKey = canonTeamSlug(squad.team_canonical);
  const teamFixtures = fixtures.filter(
    (f) => canonTeamSlug(f.home_team) === teamKey || canonTeamSlug(f.away_team) === teamKey
  );
  const groupBySlug = new Map(Object.entries(groupMap).map(([name, g]) => [canonTeamSlug(name), g]));
  const group = groupBySlug.get(teamKey) || teamFixtures.find((f) => f.group)?.group || null;
  const reveals = snapshots.filter(
    (s) => s.diff && ((s.diff.added?.length || 0) + (s.diff.removed?.length || 0) + (s.diff.injury_changes?.length || 0) > 0)
  );

  const byPosition = new Map<string, PlayerRow[]>();
  for (const p of players) {
    const key = p.position || "Unassigned";
    if (!byPosition.has(key)) byPosition.set(key, []);
    byPosition.get(key)!.push(p);
  }

  return (
    <div className="portal-root wc-root">
      <SiteTopbar backHref="/world-cup" backLabel="World Cup hub" />
      <main className="wc-page">
      <header className="wc-hero wc-hero-team">
        <div className="eyebrow">
          World Cup 2026{group ? ` · Group ${group}` : ""}
        </div>
        <h1>{squad.team_canonical}</h1>
        <p className="wc-hero-sub">
          {squad.squad_size ?? players.length} players
          {squad.injured_count ? ` · ${squad.injured_count} flagged injured` : " · no injuries flagged"}
        </p>
      </header>

      <section className="wc-section">
        <h2 className="wc-section-title">Squad</h2>
        <div className="wc-roster-grid">
          {[...byPosition.entries()].map(([position, group]) => (
            <div key={position} className="wc-roster-card">
              <div className="eyebrow">{position}</div>
              <ul className="wc-roster-list">
                {group.map((p) => (
                  <li key={p.player_name} className={p.is_injured ? "wc-injured" : ""}>
                    {p.shirt_number != null ? <span className="wc-shirt">{p.shirt_number}</span> : null}
                    {p.player_name}
                    {p.club_team ? <small> · {p.club_team}</small> : null}
                    {p.is_injured ? <small className="wc-injury-tag"> injured</small> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="wc-section">
        <h2 className="wc-section-title">Call-up timeline</h2>
        {reveals.length ? (
          <div className="wc-timeline">
            {reveals.map((s) => (
              <div key={s.captured_at} className="wc-timeline-entry">
                <div className="eyebrow">{dateFmt.format(new Date(s.captured_at))} UTC</div>
                {s.diff?.added?.length ? (
                  <div className="wc-timeline-line wc-in">In: {s.diff.added.join(", ")}</div>
                ) : null}
                {s.diff?.removed?.length ? (
                  <div className="wc-timeline-line wc-out">Out: {s.diff.removed.join(", ")}</div>
                ) : null}
                {s.diff?.injury_changes?.length ? (
                  <div className="wc-timeline-line wc-flag">Injury status changed: {s.diff.injury_changes.join(", ")}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="book-empty">
            No roster changes recorded yet — the baseline squad was captured on{" "}
            {dateFmt.format(new Date(squad.updated_at))} UTC. Every future
            call-up, cut or injury flip lands here automatically.
          </div>
        )}
      </section>

      <section className="wc-section">
        <h2 className="wc-section-title">Fixtures</h2>
        {teamFixtures.length ? (
          <div className="wc-calendar-day">
            {teamFixtures.map((f) => (
              <div key={f.id} className="wc-fixture-row">
                <span className="wc-fixture-time">{dateFmt.format(new Date(f.date))} UTC</span>
                <span className="wc-fixture-teams">
                  {f.home_team}
                  {f.home_score != null && f.away_score != null ? (
                    <strong className="wc-fixture-score">{f.home_score}–{f.away_score}</strong>
                  ) : (
                    <span className="wc-fixture-vs">vs</span>
                  )}
                  {f.away_team}
                </span>
                <span className="wc-fixture-meta">
                  {f.group ? `Group ${f.group} · ` : ""}
                  {f.venue || "Venue TBC"}{f.city ? ` · ${f.city}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="book-empty">Fixtures unavailable right now — retry shortly.</div>
        )}
      </section>
      </main>
      {/* #UI-FOOTER-UNIFIED-0623: footer condiviso anche sulle pagine squadra WC */}
      <SiteFooter />
    </div>
  );
}
