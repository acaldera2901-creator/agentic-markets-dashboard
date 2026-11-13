// components/seo/UpcomingMatches.tsx — #SEO-AEO-1106
// Server-rendered list of the next fixtures on /predictions: the board itself is client-rendered, so without this a crawler or an AI
// assistant sees no match. Same facts as the board shows an anonymous visitor (teams/players, competition, kickoff): nothing gated.
import { JsonLd, matchesJsonLd } from "./json-ld";
import type { UpcomingMatch } from "@/lib/seo/upcoming-matches";

const CSS = `
.seo-upcoming{position:relative;z-index:0;max-width:68ch;margin:0 auto;padding:40px 24px 56px;font-size:15px;line-height:1.7;color:var(--am-muted)}
.seo-upcoming h2{color:var(--am-text);font-size:22px;font-weight:700;letter-spacing:-.015em;margin:0 0 12px}
.seo-upcoming p{margin:0 0 14px}
.seo-upcoming ul{list-style:none;margin:0;padding:0}
.seo-upcoming li{padding:8px 0;border-top:1px solid var(--am-line)}
.seo-upcoming li strong{color:var(--am-text);font-weight:600}
`;

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hourCycle: "h23" }).format(new Date(iso)) + " UTC";

export function UpcomingMatches({ matches }: { matches: readonly UpcomingMatch[] }) {
  if (!matches.length) return null;
  return (
    <section className="seo-upcoming" aria-labelledby="upcoming-matches-h">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <JsonLd data={matchesJsonLd(matches)} />
      <h2 id="upcoming-matches-h">Football and tennis fixtures</h2>
      <p>
        {matches.length} public fixtures in the current match window, including matches recently started.
        Teams, players, competitions and start times are available without signing in.
        Use the interactive board above for the available analysis and market information.
      </p>
      <ul>
        {matches.map((m) => (
          <li key={m.id + m.startsAt}>
            <strong>
              {m.home} vs {m.away}
            </strong>{" "}
            · {m.competition} · {fmt(m.startsAt)}
          </li>
        ))}
      </ul>
    </section>
  );
}
