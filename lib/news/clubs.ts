// lib/news/clubs.ts (#NEWS-FOTMOB-PROD-1026) — the clubs a note names, with
// their REAL crest (the board's own map, lib/ui/crest-map.json: TheSportsDB
// badges bundled under /public/crests, never generated) and their real kit
// colours, from a curated table. A club outside the table gets no tint; a club
// without a bundled crest gets no crest — never a guessed colour, never a
// substitute badge. Pure: no network, no model.
//
// Matching is the one of lib/news/teams.ts (normalised word sequences, the
// longest name wins and owns its words — «Inter Miami» is never «Inter»),
// written per club here because a club has several spellings and teams.ts
// treats two spellings of the same club as two competing owners.
//
// Colours: primary = the shirt, secondary = the second shirt colour or the
// trim, as hex. `unsure: true` marks an entry not verified beyond reasonable
// doubt: it still resolves the club (crest, name) but gives NO tint. Names:
// the first is the served/board name (= the crest-map key); the rest are the
// spellings the notes use (EN/IT, short forms).
import { crestUrl } from "@/lib/ui/crest-assets";
import { norm, words } from "./teams";

export type Club = { name: string; names: readonly string[]; colors: readonly [string, string] | null; unsure?: boolean };
type Row = [name: string, aliases: readonly string[], primary: string | null, secondary?: string | null, unsure?: boolean];

const ROWS: readonly Row[] = [
  // ── Serie A ──
  ["AC Milan", ["Milan"], "#FB090B", "#000000"],
  ["FC Internazionale Milano", ["Inter", "Internazionale", "Internazionale Milano", "Inter Milan"], "#010E80", "#000000"],
  ["Juventus FC", ["Juventus", "Juve"], "#000000", "#FFFFFF"],
  ["SSC Napoli", ["Napoli"], "#12A0D7", "#FFFFFF"],
  ["AS Roma", ["Roma"], "#8E1F2F", "#F0BC42"],
  ["SS Lazio", ["Lazio"], "#87D8F7", "#FFFFFF"],
  ["Atalanta BC", ["Atalanta"], "#1E71B8", "#000000"],
  ["ACF Fiorentina", ["Fiorentina"], "#482E92", "#FFFFFF"],
  ["Bologna FC 1909", ["Bologna"], "#1A2F48", "#A21C26"],
  ["Torino FC", ["Torino"], "#8A1E03", "#FFFFFF"],
  ["Genoa CFC", ["Genoa"], "#A41E2E", "#0A2A5C"],
  ["Cagliari Calcio", ["Cagliari"], "#AD1F2B", "#0E2F6B"],
  ["Udinese Calcio", ["Udinese"], "#000000", "#FFFFFF"],
  ["US Sassuolo Calcio", ["Sassuolo"], "#00A752", "#000000"],
  ["US Lecce", ["Lecce"], "#FFD800", "#D71920"],
  ["Parma Calcio 1913", ["Parma"], "#FFD700", "#0A2B6B"],
  ["AC Monza", ["Monza"], "#EC173A", "#FFFFFF"],
  ["Como 1907", ["Como"], "#114169", "#FFFFFF"],
  ["Venezia FC", ["Venezia"], "#F26522", "#0B6A3A", true],
  ["Frosinone Calcio", ["Frosinone"], "#FFD600", "#1E3FA2"],
  ["Hellas Verona", ["Verona"], "#FFD700", "#0D3B8A"],
  ["Empoli", [], "#0A3B8F", "#FFFFFF"],
  ["Sampdoria", [], "#1B3A9E", "#FFFFFF"],
  ["Palermo", [], "#F5A7C1", "#000000"],
  ["Pisa", [], "#0E3C8C", "#000000"],
  ["Modena", [], "#FFD200", "#0C3C8C"],
  ["Cesena FC", ["Cesena"], "#000000", "#FFFFFF"],
  ["Avellino", [], "#0B8A3B", "#FFFFFF"],
  ["US Catanzaro 1929", ["Catanzaro"], "#FFD200", "#C8102E"],
  ["Benevento", [], "#FFD200", "#C8102E"],
  ["Padova", [], "#FFFFFF", "#C8102E"],
  ["Vicenza", [], "#C8102E", "#FFFFFF"],
  ["Mantova", [], "#C8102E", "#FFFFFF"],
  ["Ascoli", [], "#000000", "#FFFFFF"],
  ["Juve Stabia", [], "#FFD200", "#0C3C8C"],
  ["Cremonese", [], "#7D7F85", "#C8102E", true],
  ["Carrarese", [], "#0057A8", "#FFD200", true],
  ["Arezzo", [], "#7B1E3A", "#FFFFFF", true],
  ["Südtirol", ["Sudtirol"], "#FFFFFF", "#C8102E", true],
  ["Virtus Entella", ["Entella"], "#FFFFFF", "#0057A8", true],
  // ── Premier League / EFL ──
  ["Manchester United FC", ["Manchester United", "Man Utd", "Man United"], "#DA291C", "#FBE122"],
  ["Manchester City FC", ["Manchester City", "Man City"], "#6CABDD", "#1C2C5B"],
  ["AFC Bournemouth", ["Bournemouth"], "#DA291C", "#000000"],
  ["Liverpool FC", ["Liverpool"], "#C8102E", "#FFFFFF"],
  ["Arsenal FC", ["Arsenal"], "#EF0107", "#FFFFFF"],
  ["Chelsea FC", ["Chelsea"], "#034694", "#FFFFFF"],
  ["Tottenham Hotspur FC", ["Tottenham Hotspur", "Tottenham", "Spurs"], "#FFFFFF", "#132257"],
  ["Newcastle United FC", ["Newcastle United", "Newcastle"], "#241F20", "#FFFFFF"],
  ["Aston Villa FC", ["Aston Villa"], "#670E36", "#95BFE5"],
  ["Everton FC", ["Everton"], "#003399", "#FFFFFF"],
  ["West Ham United FC", ["West Ham United", "West Ham"], "#7A263A", "#1BB1E7"],
  ["Brighton & Hove Albion", ["Brighton"], "#0057B8", "#FFFFFF"],
  ["Leicester City", ["Leicester"], "#003090", "#FDBE11"],
  ["Wolverhampton Wanderers", ["Wolves"], "#FDB913", "#231F20"],
  ["Nottingham Forest", [], "#DD0000", "#FFFFFF"],
  ["Crystal Palace", [], "#1B458F", "#C4122E"],
  ["Fulham FC", ["Fulham"], "#FFFFFF", "#000000"],
  ["Brentford FC", ["Brentford"], "#E30613", "#FFFFFF"],
  ["Leeds United", ["Leeds"], "#FFFFFF", "#1D428A"],
  ["Sheffield United", [], "#EE2737", "#FFFFFF"],
  ["Sheffield Wednesday", [], "#0E63AD", "#FFFFFF"],
  ["Luton", ["Luton Town"], "#F78F1E", "#002D62"],
  ["Wrexham AFC", ["Wrexham"], "#D71920", "#FFFFFF"],
  // ── La Liga ──
  ["Real Madrid CF", ["Real Madrid"], "#FFFFFF", "#00529F"],
  ["FC Barcelona", ["Barcelona", "Barcellona", "Barça", "Barca"], "#A50044", "#004D98"],
  ["Atlético de Madrid", ["Atletico Madrid", "Atlético Madrid", "Atletico", "Atleti"], "#CB3524", "#FFFFFF"],
  ["Sevilla FC", ["Sevilla", "Siviglia"], "#FFFFFF", "#D4001C"],
  ["Villarreal CF", ["Villarreal"], "#FFE667", "#005187"],
  ["RCD Espanyol de Barcelona", ["Espanyol", "Espanyol de Barcelona"], "#0071CE", "#FFFFFF"],
  ["CA Osasuna", ["Osasuna"], "#D91A21", "#0A346F"],
  ["Real Sociedad", [], "#0067B1", "#FFFFFF"],
  ["Athletic Club", ["Athletic Bilbao"], "#EE2523", "#FFFFFF"],
  ["Real Betis Balompié", ["Real Betis", "Betis"], "#00954C", "#FFFFFF"],
  ["Girona FC", ["Girona"], "#CD2534", "#FFFFFF"],
  // ── Bundesliga ──
  ["FC Bayern München", ["Bayern Munich", "Bayern München", "Bayern", "Bayern Monaco"], "#DC052D", "#FFFFFF"],
  ["Borussia Dortmund", ["Dortmund", "BVB"], "#FDE100", "#000000"],
  ["Bayer 04 Leverkusen", ["Bayer Leverkusen", "Leverkusen"], "#E32221", "#000000"],
  ["TSG Hoffenheim", ["Hoffenheim", "1899 Hoffenheim", "TSG 1899 Hoffenheim"], "#1C63B7", "#FFFFFF"],
  ["RB Leipzig", ["Leipzig", "Lipsia"], "#DD0741", "#FFFFFF"],
  ["Eintracht Frankfurt", ["Frankfurt", "Francoforte"], "#E1000F", "#000000"],
  ["VfB Stuttgart", ["Stuttgart", "Stoccarda"], "#FFFFFF", "#E32219"],
  ["VfL Wolfsburg", ["Wolfsburg"], "#65B32E", "#FFFFFF"],
  ["1. FSV Mainz 05", ["Mainz", "Magonza"], "#C3141E", "#FFFFFF"],
  ["1. FC Köln", ["Köln", "Koln", "Colonia"], "#ED1C24", "#FFFFFF"],
  ["1. FC Union Berlin", ["Union Berlin"], "#EB1923", "#FFFFFF"],
  ["Hertha Berlin", ["Hertha BSC", "Hertha"], "#005CA9", "#FFFFFF"],
  ["1. FC Kaiserslautern", ["Kaiserslautern"], "#E30613", "#FFFFFF"],
  ["VfL Bochum", ["Bochum"], "#005CA9", "#FFFFFF"],
  ["Borussia Mönchengladbach", ["Gladbach", "Mönchengladbach", "Monchengladbach"], "#000000", "#1E9A4A", true],
  ["SC Freiburg", ["Freiburg", "Friburgo"], "#E2001A", "#000000", true],
  // ── Ligue 1 ──
  ["Paris Saint-Germain FC", ["Paris Saint-Germain", "PSG", "Paris SG"], "#004170", "#DA291C"],
  ["Olympique Lyonnais", ["Lyon", "Lione"], "#FFFFFF", "#DA291C"],
  ["Olympique de Marseille", ["Marseille", "Marsiglia"], "#2FAEE0", "#FFFFFF"],
  ["Lille OSC", ["Lille", "LOSC"], "#D71920", "#00205B"],
  ["Racing Club de Lens", ["Lens"], "#FFD300", "#C8102E"],
  ["AS Monaco", ["Monaco"], "#E63312", "#FFFFFF"],
  ["Stade de Reims", ["Reims"], "#D71920", "#FFFFFF"],
  ["Nantes", ["FC Nantes"], "#FFD800", "#00643B"],
  ["Metz", ["FC Metz"], "#7A1E3A", "#FFFFFF"],
  ["Montpellier", ["Montpellier HSC"], "#0A2B6B", "#F08A24"],
  ["Le Havre AC", ["Le Havre"], "#0F6DB5", "#002B5C", true],
  // ── Primeira Liga · Belgium · Netherlands ──
  ["Benfica", ["SL Benfica"], "#E83030", "#FFFFFF"],
  ["FC Porto", ["Porto"], "#0046A8", "#FFFFFF"],
  ["Sporting CP", ["Sporting Lisbon"], "#008A4C", "#FFFFFF"],
  ["Club Brugge", ["Club Brugge KV", "Bruges"], "#0055A4", "#000000"],
  ["Ajax", ["AFC Ajax"], "#FFFFFF", "#D2122E"],
  ["PSV Eindhoven", ["PSV"], "#ED1C24", "#FFFFFF"],
  ["Feyenoord", [], "#E8172E", "#FFFFFF"],
  // ── Scottish Premiership ──
  ["Celtic", ["Celtic FC"], "#018749", "#FFFFFF"],
  ["Rangers", ["Rangers FC"], "#1B458F", "#FFFFFF"],
  ["Hearts", ["Heart of Midlothian"], "#800910", "#FFFFFF"],
  ["Hibernian", ["Hibs"], "#008000", "#FFFFFF"],
  ["Aberdeen", [], "#E2001A", "#FFFFFF"],
  ["Dundee United", [], "#F47920", "#000000"],
  ["Dundee FC", ["Dundee"], "#0C2340", "#FFFFFF"],
  ["Kilmarnock", [], "#1B458F", "#FFFFFF"],
  ["Motherwell", [], "#FFBF00", "#7A1F2B"],
  ["St Mirren", [], "#000000", "#FFFFFF"],
  ["St Johnstone", [], "#1B458F", "#FFFFFF", true],
  // ── Turkey ──
  ["Galatasaray", [], "#FDB912", "#A90432"],
  ["Fenerbahce", ["Fenerbahçe"], "#FFED00", "#00205B"],
  ["Trabzonspor", [], "#8E1E3A", "#1A7BC2"],
  ["Besiktas", ["Beşiktaş"], "#000000", "#FFFFFF"],
  // ── MLS ──
  ["Los Angeles FC", ["LAFC"], "#000000", "#C39E6D"],
  ["LA Galaxy", ["Los Angeles Galaxy"], "#00245D", "#FFFFFF"],
  ["Inter Miami CF", ["Inter Miami"], "#F7B5CD", "#000000"],
  ["Atlanta United FC", ["Atlanta United"], "#80000B", "#A29061"],
  ["New York City FC", ["NYCFC"], "#6CACE4", "#041E42"],
  ["New York Red Bulls", ["Red Bulls"], "#ED1E36", "#FFFFFF"],
  ["Seattle Sounders FC", ["Seattle Sounders"], "#5D9741", "#236192"],
  ["Portland Timbers", [], "#004812", "#D69A00"],
  ["Columbus Crew SC", ["Columbus Crew"], "#FEDD00", "#000000"],
  ["FC Cincinnati", ["Cincinnati"], "#F05323", "#003087"],
  ["Toronto FC", [], "#B81137", "#313F49"],
  ["Nashville SC", [], "#ECE83A", "#1F1646"],
  ["Austin FC", [], "#00B140", "#000000"],
  ["Charlotte FC", [], "#1A85C8", "#000000"],
  ["D.C. United", ["DC United"], "#000000", "#EF3E42"],
  ["FC Dallas", [], "#E81F3E", "#00205B"],
  ["Houston Dynamo", [], "#FF6B00", "#000000"],
  ["Minnesota United FC", ["Minnesota United"], "#8CD2F4", "#231F20"],
  ["New England Revolution", [], "#0A2240", "#C63323"],
  ["Orlando City SC", ["Orlando City"], "#633492", "#FDE192"],
  ["Philadelphia Union", [], "#071B2C", "#B18500"],
  ["Real Salt Lake", [], "#B30838", "#013A81"],
  ["San Jose Earthquakes", [], "#0067B1", "#000000"],
  ["Sporting Kansas City", ["Sporting KC"], "#91B0D5", "#002F65"],
  ["Vancouver Whitecaps FC", ["Vancouver Whitecaps"], "#00245E", "#9DC2EA"],
  ["CF Montreal", ["CF Montréal"], "#0033A1", "#000000"],
  ["Colorado Rapids", [], "#862633", "#8BB8E8"],
  ["Chicago Fire", [], "#FF0000", "#141B4D", true],
  ["St. Louis City SC", ["St. Louis City"], "#DF2733", "#010E2E", true],
  ["San Diego FC", [], "#0A2240", "#C8A96A", true],
  // ── Brasileirão · Argentina ──
  ["Flamengo", [], "#C8102E", "#000000"],
  ["Palmeiras", [], "#006437", "#FFFFFF"],
  ["Corinthians", [], "#000000", "#FFFFFF"],
  ["Sao Paulo", ["São Paulo"], "#C8102E", "#000000"],
  ["Santos", [], "#FFFFFF", "#000000"],
  ["Fluminense", [], "#7A1E3A", "#00844B"],
  ["Vasco da Gama", ["Vasco"], "#000000", "#FFFFFF"],
  ["Botafogo", [], "#000000", "#FFFFFF"],
  ["Grêmio", ["Gremio"], "#0B83C5", "#000000"],
  ["Internacional", [], "#E5050F", "#FFFFFF"],
  ["Bahia", [], "#0057A8", "#E30613"],
  ["Coritiba", [], "#00633F", "#FFFFFF"],
  ["Racing Club", [], "#6CACE4", "#FFFFFF"],
  // ── decoys: clubs that share a word with a bigger name; no colours claimed ──
  ["FC Inter Turku", ["Inter Turku"], null],
];

export const CLUBS: readonly Club[] = ROWS.map(([name, aliases, p, s, unsure]) => ({ name, names: [name, ...aliases], colors: p && s ? [p, s] : null, ...(unsure ? { unsure: true } : {}) }));

/** Every accepted spelling (normalised) → its club; the longest spellings first, so they own their words. */
const CANDS: readonly { toks: string[]; club: Club }[] = CLUBS.flatMap((club) => club.names.map((n) => ({ toks: norm(n).split(" ").filter(Boolean), club })))
  .filter((c) => c.toks.length)
  .sort((x, y) => y.toks.length - x.toks.length || y.toks.join(" ").length - x.toks.join(" ").length);

/** The clubs a text names, at most `max`, in the order they first appear. */
export function clubsInText(text: string, max = 2): Club[] {
  const toks = words(text);
  const used = new Array<boolean>(toks.length).fill(false);
  const found = new Map<Club, number>();
  for (const c of CANDS) {
    const n = c.toks.length;
    for (let i = 0; i + n <= toks.length; i++) {
      let ok = true;
      for (let j = 0; j < n && ok; j++) ok = !used[i + j] && toks[i + j] === c.toks[j];
      if (!ok) continue;
      for (let j = 0; j < n; j++) used[i + j] = true;
      found.set(c.club, Math.min(found.get(c.club) ?? Number.MAX_SAFE_INTEGER, i));
    }
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map(([c]) => c);
}

/** What the picture shows for one club: its real crest (or none) and its real colours (or none). */
export type ClubBadge = { name: string; crest: string | null; colors: readonly [string, string] | null };

export function badgeFor(club: Club): ClubBadge {
  return { name: club.name, crest: crestUrl(club.name, "football"), colors: club.unsure ? null : club.colors };
}

/**
 * The badges of a note: the clubs the watcher stored as named by the original
 * (checked, in order) when they resolve, else the clubs its title and body
 * name; at most two, each with crest and colours when we have them.
 */
export function noteBadges(title: string, body: string, teams: readonly string[] = [], max = 2): ClubBadge[] {
  const fromTeams = teams.length ? clubsInText(teams.join(". "), max) : [];
  const clubs = fromTeams.length ? fromTeams : clubsInText(`${title}. ${body}`, max);
  return clubs.map(badgeFor);
}
