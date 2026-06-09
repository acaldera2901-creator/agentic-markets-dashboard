// 12 groups (A-L), 4 teams each. Pure render — data arrives from the server
// page (ESPN-proxied, cached). Pre-kickoff all rows are zeroed by the source.
import Link from "next/link";
import type { WcGroup } from "@/lib/world-cup";
import { teamSlug } from "@/lib/world-cup";

export default function GroupsGrid({ groups }: { groups: WcGroup[] }) {
  if (!groups.length) {
    return <div className="book-empty">Group tables unavailable right now — retry shortly.</div>;
  }
  return (
    <div className="wc-groups-grid">
      {groups.map((g) => (
        <div key={g.name} className="wc-group-card">
          <div className="eyebrow">Group {g.name}</div>
          <table className="wc-table">
            <thead>
              <tr>
                <th className="wc-team-col">Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GD</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {g.teams.map((t) => (
                <tr key={t.team}>
                  <td className="wc-team-col">
                    <Link href={`/world-cup/${teamSlug(t.team)}`} className="wc-team-link">
                      {t.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.logo} alt="" width={16} height={16} loading="lazy" />
                      ) : null}
                      {t.team}
                    </Link>
                  </td>
                  <td>{t.played}</td>
                  <td>{t.won}</td>
                  <td>{t.drawn}</td>
                  <td>{t.lost}</td>
                  <td>{t.goals_for - t.goals_against}</td>
                  <td className="wc-pts">{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
