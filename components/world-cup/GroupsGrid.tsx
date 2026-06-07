// 12 groups (A-L), 4 teams each. Pure render — data arrives from the server
// page (ESPN-proxied, cached). Pre-kickoff all rows are zeroed by the source.
import Link from "next/link";
import type { WcGroup } from "@/lib/world-cup";
import { teamSlug } from "@/lib/world-cup";
import { WC_T, type WcLang } from "@/lib/world-cup-i18n";

export default function GroupsGrid({ groups, lang = "it" }: { groups: WcGroup[]; lang?: WcLang }) {
  const t = WC_T[lang];

  if (!groups.length) {
    return <div className="book-empty">{t.groupsUnavailable}</div>;
  }
  return (
    <div className="wc-groups-grid">
      {groups.map((g) => (
        <div key={g.name} className="glass-card wc-group-card">
          <div className="eyebrow">{t.groupLabel} {g.name}</div>
          <table className="wc-table">
            <thead>
              <tr>
                <th className="wc-team-col">{t.colTeam}</th>
                <th>{t.colP}</th>
                <th>{t.colW}</th>
                <th>{t.colD}</th>
                <th>{t.colL}</th>
                <th>{t.colGD}</th>
                <th>{t.colPts}</th>
              </tr>
            </thead>
            <tbody>
              {g.teams.map((t_) => (
                <tr key={t_.team}>
                  <td className="wc-team-col">
                    <Link href={`/world-cup/${teamSlug(t_.team)}`} className="wc-team-link">
                      {t_.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t_.logo} alt="" width={16} height={16} loading="lazy" />
                      ) : null}
                      {t_.team}
                    </Link>
                  </td>
                  <td>{t_.played}</td>
                  <td>{t_.won}</td>
                  <td>{t_.drawn}</td>
                  <td>{t_.lost}</td>
                  <td>{t_.goals_for - t_.goals_against}</td>
                  <td className="wc-pts">{t_.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
