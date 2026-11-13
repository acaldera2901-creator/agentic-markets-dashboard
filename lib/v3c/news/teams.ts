// lib/v3c/news/teams.ts (#REDESIGN-V3C news) — which board teams a news item
// names. Deterministic: normalised word sequences, a curated alias list, the
// longest name wins and owns its words («Inter Miami» never counts as «Inter»),
// an alias shared by two board teams counts for neither. No fuzzy matching:
// a missed link is better than a wrong one.
import { words } from "./rewrite";

/** Extra names people write, keyed by the normalised board name. */
const ALIASES: Record<string, string[]> = {
  "manchester united": ["man utd", "man united"],
  "manchester city": ["man city"],
  "tottenham hotspur": ["tottenham", "spurs"],
  "brighton hove albion": ["brighton"],
  "wolverhampton wanderers": ["wolves", "wolverhampton"],
  "newcastle united": ["newcastle"],
  "west ham united": ["west ham"],
  "leicester city": ["leicester"],
  "nottingham forest": ["nottingham forest"],
  inter: ["inter milan", "internazionale"],
  internazionale: ["inter milan", "inter"],
  "ac milan": ["milan"],
  milan: ["ac milan"],
  "paris saint germain": ["psg", "paris sg"],
  "atletico madrid": ["atletico", "atleti"],
  "bayern munich": ["bayern"],
  "bayern munchen": ["bayern", "bayern munich"],
  "borussia dortmund": ["dortmund", "bvb"],
  "borussia monchengladbach": ["gladbach", "monchengladbach"],
  "olympique lyonnais": ["lyon"],
  "olympique de marseille": ["marseille"],
  "inter miami cf": ["inter miami"],
  "sporting cp": ["sporting lisbon"],
  "psv eindhoven": ["psv"],
  barcelona: ["barca"],
  "fc barcelona": ["barcelona", "barca"],
};

/** Club-name words that are never a name on their own. */
const AFFIX = new Set(["fc", "cf", "afc", "sc", "ac", "as", "ssc", "ss", "cd", "ud", "sv", "fk", "sk", "vfl", "vfb", "tsg", "rc", "rcd", "ogc", "us", "bk", "if", "club", "calcio", "1"]);
const GENERIC = new Set(["city", "united", "real", "sporting", "athletic", "inter", "olympique", "borussia", "dynamo", "racing", "union", "rovers", "town", "county", "wanderers", "albion", "hotspur", "forest", "villa", "palace", "national", "football", "de", "of"]);

/** Longer names of clubs that may not be on the board but swallow a shorter alias. */
const DECOYS = [
  "inter miami", "manchester city", "manchester united", "real madrid", "real sociedad", "real betis", "athletic club",
  "atletico madrid", "new york city", "orlando city", "leicester city", "hull city", "bristol city", "cardiff city",
  "swansea city", "stoke city", "norwich city", "birmingham city", "sporting cp", "sporting gijon", "racing club", "ac milan",
];

export const norm = (s: string): string => words(s).join(" ");

/** Every way we accept a team to be written, normalised. */
export function aliasesFor(name: string): string[] {
  const full = norm(name);
  if (!full) return [];
  const out = new Set<string>([full]);
  const core = full.split(" ").filter((w) => !AFFIX.has(w)).join(" ");
  if (core && core.length >= 4 && !GENERIC.has(core)) out.add(core);
  for (const a of ALIASES[full] ?? []) out.add(a);
  for (const a of ALIASES[core] ?? []) out.add(a);
  return [...out];
}

/** The board team names (as given) that `text` mentions. */
export function matchTeams(text: string, teams: readonly string[]): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const t of new Set(teams)) for (const a of aliasesFor(t)) (owners.get(a) ?? owners.set(a, new Set()).get(a)!).add(t);
  for (const d of DECOYS) if (!owners.has(d)) owners.set(d, new Set());
  const cands = [...owners.entries()].map(([a, o]) => ({ toks: a.split(" "), owner: o.size === 1 ? [...o][0] : null })).sort((x, y) => y.toks.length - x.toks.length || y.toks.join(" ").length - x.toks.join(" ").length);
  const toks = words(text);
  const used = new Array<boolean>(toks.length).fill(false);
  const found = new Set<string>();
  for (const c of cands) {
    const n = c.toks.length;
    for (let i = 0; i + n <= toks.length; i++) {
      let ok = true;
      for (let j = 0; j < n && ok; j++) ok = !used[i + j] && toks[i + j] === c.toks[j];
      if (!ok) continue;
      for (let j = 0; j < n; j++) used[i + j] = true;
      if (c.owner) found.add(c.owner);
    }
  }
  return found;
}
