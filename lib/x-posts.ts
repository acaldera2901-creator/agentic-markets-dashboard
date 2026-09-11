// lib/x-posts.ts — #X-PIPELINE-0810 · the copy of the five daily posts on X.
//
// Pure functions, no network and no DB: compose the day, then hand the result to
// lib/x-client.ts (or to scripts/x-dryrun.ts, which prints it instead).
//
// THREE RULES THE TESTS ENFORCE, because each one has already cost something
// somewhere else in this product:
//   1. No claim that promises an outcome. The banned list starts from the six
//      strings already pinned in lib/tools/copy.test.ts and adds the ones that
//      only a social post can produce ("sure bet", "lock of the day", …). Every
//      post that shows a percentage also carries "not advice · 18+".
//   2. Length is X's WEIGHTED length, not String#length. A URL always counts 23
//      (t.co), and every emoji counts 2 — a 275-character post with six emoji is
//      really 281 and gets rejected at publish time.
//   3. A day with no predictions produces NO post. Not a post with an empty
//      list, not a placeholder: an empty schedule plus the reason it is empty.
//
// DECK DEVIATION, declared on purpose: the deck's afternoon slot is called
// "Highest Value Bet". This composer publishes it as "widest model-market gap"
// and never names a stake or a bet. Reason: the go-live risk #1 on this product
// is the non-gambling qualification, and "here is the bet to make" is the exact
// sentence that argues the other way. The information is identical — model %,
// market %, signed gap — the framing is a readout, not a tip.

/** The five phases of the matchday, in the order the deck asks for them. */
export type XSlot =
  | "morning_top5"
  | "afternoon_gap"
  | "prematch_card"
  | "halftime_update"
  | "fulltime_result";

export type XSkipReason =
  | "no_predictions"
  | "no_eligible_favorite"
  | "no_market_comparison"
  | "no_kickoff_match"
  | "no_card"
  | "no_live_match"
  | "no_settled_match";

/** Neutral shape: the caller maps unified_predictions (or a fixture) onto this. */
export type XPrediction = {
  id: string;
  sport: string;
  competition: string;
  home: string;
  away: string;
  /** Name of the favourite. Never "no clear favourite" — the card standard. */
  favorite: string;
  /** Model probability of the favourite, 0..100. */
  modelPct: number;
  /** Market-implied probability of the same side, 0..100, or null if unpriced. */
  marketPct: number | null;
  /** Signed model − market, in points. Null when there is no market anchor. */
  edgePct: number | null;
  startsAtUtc: string;
  halftimeScore?: string | null;
  finalScore?: string | null;
  /** Did the model's favourite end up winning? Settled slots only. */
  favoriteWon?: boolean | null;
};

export type XDayInput = {
  /** YYYY-MM-DD, the matchday being composed. */
  dayUtc: string;
  /** Today's upcoming predictions, any order. */
  predictions: XPrediction[];
  /** The match whose probability card goes out at T−15. Defaults to the first kickoff. */
  cardMatch?: XPrediction | null;
  /** False when the Studio renderer produced no card: the slot is skipped, not faked. */
  cardAvailable?: boolean;
  /** Match at half time, with halftimeScore populated. */
  halftimeMatch?: XPrediction | null;
  /** Match just finished, with finalScore and favoriteWon populated. */
  fulltimeMatch?: XPrediction | null;
  siteUrl?: string;
};

export type XComposedPost = {
  slot: XSlot;
  text: string;
  /** X's weighted length — the number that decides acceptance. */
  weightedLength: number;
  hasUrl: boolean;
  media: "probability_card" | null;
  scheduledAtUtc: string;
};

export type XSkippedSlot = { slot: XSlot; reason: XSkipReason };

export type XDaySchedule = { posts: XComposedPost[]; skipped: XSkippedSlot[] };

export const X_POST_MAX_WEIGHTED = 280;
/** t.co: every link, whatever its real length, weighs exactly this much. */
export const X_URL_WEIGHT = 23;

const DEFAULT_SITE_URL = "https://betredge.com/app";
const NOT_ADVICE = "Model output, not advice. 18+";

/**
 * Floor for a probability published as "the favourite", in points.
 *
 * A three-way market (1/X/2) cannot have a most-likely outcome below ~33.3%, so
 * anything under this is not a statement about who wins — it is the probability
 * of some SELECTION that happens to be an underdog. Found on the real rows of
 * 2026-08-10, where a value pick priced at 22% was about to go out under the
 * header "Top 5 AI predictions". The mapper upstream now resolves the real
 * favourite; this is the guard that holds if a future caller doesn't.
 */
export const MIN_FAVORITE_PCT = 34;

// twitter-text v3 weighting: these code-point ranges weigh 1, everything else
// (accented Latin above U+10FF, CJK, and every emoji) weighs 2.
const WEIGHT_ONE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

// Two copies on purpose: matchAll needs the `g` flag, and a `g` regex carries
// lastIndex between calls — reusing it for a boolean test returns alternating
// true/false on identical input.
const URL_RE = /https?:\/\/\S+/g;
const HAS_URL_RE = /https?:\/\/\S+/;

function weighPlainText(text: string): number {
  let weight = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    weight += WEIGHT_ONE_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi) ? 1 : 2;
  }
  return weight;
}

/** X's weighted length: URLs flattened to 23, emoji counted 2. */
export function tweetLength(text: string): number {
  let total = 0;
  let cursor = 0;
  for (const match of text.matchAll(URL_RE)) {
    const at = match.index ?? 0;
    total += weighPlainText(text.slice(cursor, at));
    total += X_URL_WEIGHT;
    cursor = at + match[0].length;
  }
  return total + weighPlainText(text.slice(cursor));
}

export function fitsTweet(text: string): boolean {
  return tweetLength(text) <= X_POST_MAX_WEIGHTED;
}

// ── FTC / no-promises guard ──────────────────────────────────────────────────
// The first six are the exact strings pinned in lib/tools/copy.test.ts; the rest
// are the outcome promises a social post can produce that a tool page cannot.
export const BANNED_CLAIMS: readonly string[] = [
  "guaranteed profit",
  "beat the market",
  "risk-free profit",
  "profitto garantito",
  "battiamo il mercato",
  "vincita garantita",
  "guaranteed win",
  "sure bet",
  "sure thing",
  "can't lose",
  "cannot lose",
  "lock of the day",
  "free money",
  "easy money",
  "no risk",
  "risk free",
  "will win",
  "100% win",
  "banker",
];

/** Every banned claim present in the text, lowercased. Empty array = clean. */
export function findBannedClaims(text: string): string[] {
  const haystack = text.toLowerCase();
  return BANNED_CLAIMS.filter((claim) => haystack.includes(claim));
}

// ── formatting helpers ──────────────────────────────────────────────────────

function sportEmoji(sport: string): string {
  const s = sport.toLowerCase();
  if (s.includes("tennis")) return "🎾";
  if (s.includes("basket")) return "🏀";
  return "⚽";
}

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

function signedPoints(edge: number): string {
  const rounded = Math.round(edge * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function hhmmUtc(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

function dayLabel(dayUtc: string): string {
  const d = new Date(`${dayUtc}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dayUtc;
  return `${d.getUTCDate()} ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]
  }`;
}

function shiftMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** Fixed slots in UTC. Europe/Rome is UTC+2 in summer: 07:00Z = 09:00 local. */
function atUtc(dayUtc: string, hhmm: string): string {
  return `${dayUtc}T${hhmm}:00.000Z`;
}

function finalize(
  slot: XSlot,
  lines: string[],
  scheduledAtUtc: string,
  media: "probability_card" | null,
  siteUrl: string
): XComposedPost {
  const text = [...lines, NOT_ADVICE, siteUrl].join("\n");
  return {
    slot,
    text,
    weightedLength: tweetLength(text),
    hasUrl: HAS_URL_RE.test(text),
    media,
    scheduledAtUtc,
  };
}

// ── the five slots ──────────────────────────────────────────────────────────

/**
 * Morning: the five highest-conviction model calls.
 *
 * Deterministic shrink ladder, never a truncated name — a mangled
 * "Borussia Mönchengl…" is worse than one line less:
 *   1. all N entries with the opponent;
 *   2. all N entries without the opponent (favourite + % only);
 *   3. drop entries from the bottom, compact.
 * Detail goes before entries because a "Top 5" post that lists three is a lie in
 * the header; the header is recomputed from the entries actually kept.
 */
function composeMorningTop5(
  predictions: XPrediction[],
  dayUtc: string,
  siteUrl: string
): XComposedPost | null {
  if (predictions.length === 0) return null;

  const top = [...predictions].sort((a, b) => b.modelPct - a.modelPct).slice(0, 5);
  const full = top.map(
    (p) => `${sportEmoji(p.sport)} ${p.favorite} ${pct(p.modelPct)} v ${opponentOf(p)}`
  );
  const compact = top.map((p) => `${sportEmoji(p.sport)} ${p.favorite} ${pct(p.modelPct)}`);

  const attempts: string[][] = [full, compact];
  for (let keep = compact.length - 1; keep >= 1; keep--) attempts.push(compact.slice(0, keep));

  for (const lines of attempts) {
    const header = `🤖 Top ${lines.length} AI prediction${lines.length === 1 ? "" : "s"} — ${dayLabel(dayUtc)}`;
    const post = finalize("morning_top5", [header, ...lines], atUtc(dayUtc, "07:00"), null, siteUrl);
    if (fitsTweet(post.text)) return post;
  }
  return null;
}

function opponentOf(p: XPrediction): string {
  return p.favorite === p.home ? p.away : p.home;
}

/** Afternoon: the widest signed gap between our model and the market. */
function composeAfternoonGap(
  predictions: XPrediction[],
  dayUtc: string,
  siteUrl: string
): XComposedPost | null {
  const priced = predictions.filter((p) => p.marketPct != null && p.edgePct != null);
  if (priced.length === 0) return null;

  const best = priced.reduce((a, b) => (Math.abs(b.edgePct!) > Math.abs(a.edgePct!) ? b : a));
  const lines = [
    "📊 Widest model–market gap today",
    `${sportEmoji(best.sport)} ${best.home} v ${best.away} · ${best.competition}`,
    `${best.favorite}: model ${pct(best.modelPct)} · market ${pct(best.marketPct!)} · gap ${signedPoints(best.edgePct!)} pts`,
    `Kickoff ${hhmmUtc(best.startsAtUtc)} UTC`,
  ];
  const post = finalize("afternoon_gap", lines, atUtc(dayUtc, "13:00"), null, siteUrl);
  if (fitsTweet(post.text)) return post;
  // Competition name is the only droppable piece before the numbers.
  const trimmed = [...lines];
  trimmed[1] = `${sportEmoji(best.sport)} ${best.home} v ${best.away}`;
  const retry = finalize("afternoon_gap", trimmed, atUtc(dayUtc, "13:00"), null, siteUrl);
  return fitsTweet(retry.text) ? retry : null;
}

/** T−15: the probability card, the most shareable format the deck identifies. */
function composePrematchCard(match: XPrediction, siteUrl: string): XComposedPost | null {
  const lines = [
    "⏱ Kickoff in 15 min",
    `${sportEmoji(match.sport)} ${match.home} v ${match.away} · ${match.competition}`,
    match.marketPct != null && match.edgePct != null
      ? `${match.favorite}: model ${pct(match.modelPct)} · market ${pct(match.marketPct)} · gap ${signedPoints(match.edgePct)} pts`
      : `${match.favorite}: model ${pct(match.modelPct)}`,
  ];
  const post = finalize(
    "prematch_card",
    lines,
    shiftMinutes(match.startsAtUtc, -15),
    "probability_card",
    siteUrl
  );
  if (fitsTweet(post.text)) return post;
  const trimmed = [...lines];
  trimmed[1] = `${sportEmoji(match.sport)} ${match.home} v ${match.away}`;
  const retry = finalize("prematch_card", trimmed, shiftMinutes(match.startsAtUtc, -15), "probability_card", siteUrl);
  return fitsTweet(retry.text) ? retry : null;
}

/** Half time: the score, and what the model had said before kickoff. */
function composeHalftime(match: XPrediction, siteUrl: string): XComposedPost | null {
  if (!match.halftimeScore) return null;
  const lines = [
    `⏸ HT: ${match.home} ${match.halftimeScore} ${match.away}`,
    `Pre-match model: ${match.favorite} ${pct(match.modelPct)}`,
  ];
  const post = finalize("halftime_update", lines, shiftMinutes(match.startsAtUtc, 60), null, siteUrl);
  return fitsTweet(post.text) ? post : null;
}

/** Full time: the outcome of the probability call, right or wrong. */
function composeFulltime(match: XPrediction, siteUrl: string): XComposedPost | null {
  if (!match.finalScore || match.favoriteWon == null) return null;
  const verdict = match.favoriteWon ? "✅ correct" : "❌ missed";
  const lines = [
    `🏁 FT: ${match.home} ${match.finalScore} ${match.away}`,
    `Model favourite: ${match.favorite} ${pct(match.modelPct)} → ${verdict}`,
  ];
  const post = finalize("fulltime_result", lines, shiftMinutes(match.startsAtUtc, 115), null, siteUrl);
  return fitsTweet(post.text) ? post : null;
}

/**
 * The whole matchday. Every slot either produces a post or lands in `skipped`
 * with the reason — a caller can never mistake "nothing to say" for "failed".
 */
export function composeDay(input: XDayInput): XDaySchedule {
  const siteUrl = (input.siteUrl ?? DEFAULT_SITE_URL).replace(/\/$/, "");
  const posts: XComposedPost[] = [];
  const skipped: XSkippedSlot[] = [];

  const push = (slot: XSlot, post: XComposedPost | null, reason: XSkipReason) => {
    if (post) posts.push(post);
    else skipped.push({ slot, reason });
  };

  // Rows whose "favourite" is below the three-way entropy floor describe a
  // selection, not a winner: they never reach a post. See MIN_FAVORITE_PCT.
  const eligible = input.predictions.filter((p) => p.modelPct >= MIN_FAVORITE_PCT);

  if (eligible.length === 0) {
    // The empty day, explicitly: five reasons, zero posts. Nothing downstream
    // gets a post with an empty list in it.
    const dataReason: XSkipReason =
      input.predictions.length === 0 ? "no_predictions" : "no_eligible_favorite";
    return {
      posts: [],
      skipped: [
        { slot: "morning_top5", reason: dataReason },
        { slot: "afternoon_gap", reason: dataReason },
        { slot: "prematch_card", reason: dataReason },
        {
          slot: "halftime_update",
          reason: input.halftimeMatch?.halftimeScore ? dataReason : "no_live_match",
        },
        {
          slot: "fulltime_result",
          reason: input.fulltimeMatch?.finalScore ? dataReason : "no_settled_match",
        },
      ],
    };
  }

  push("morning_top5", composeMorningTop5(eligible, input.dayUtc, siteUrl), "no_predictions");
  push("afternoon_gap", composeAfternoonGap(eligible, input.dayUtc, siteUrl), "no_market_comparison");

  const cardMatch =
    input.cardMatch ??
    [...eligible].sort(
      (a, b) => new Date(a.startsAtUtc).getTime() - new Date(b.startsAtUtc).getTime()
    )[0] ??
    null;
  // The floor applies to the explicitly-passed matches too: a caller handing in
  // its own cardMatch/halftimeMatch must not slip past the guard above.
  const eligibleMatch = (m: XPrediction | null | undefined): boolean =>
    m != null && m.modelPct >= MIN_FAVORITE_PCT;

  if (!cardMatch) skipped.push({ slot: "prematch_card", reason: "no_kickoff_match" });
  else if (!eligibleMatch(cardMatch)) skipped.push({ slot: "prematch_card", reason: "no_eligible_favorite" });
  else if (input.cardAvailable === false) skipped.push({ slot: "prematch_card", reason: "no_card" });
  else push("prematch_card", composePrematchCard(cardMatch, siteUrl), "no_kickoff_match");

  if (!input.halftimeMatch?.halftimeScore) skipped.push({ slot: "halftime_update", reason: "no_live_match" });
  else if (!eligibleMatch(input.halftimeMatch)) skipped.push({ slot: "halftime_update", reason: "no_eligible_favorite" });
  else push("halftime_update", composeHalftime(input.halftimeMatch, siteUrl), "no_live_match");

  if (!input.fulltimeMatch?.finalScore) skipped.push({ slot: "fulltime_result", reason: "no_settled_match" });
  else if (!eligibleMatch(input.fulltimeMatch)) skipped.push({ slot: "fulltime_result", reason: "no_eligible_favorite" });
  else push("fulltime_result", composeFulltime(input.fulltimeMatch, siteUrl), "no_settled_match");

  posts.sort((a, b) => (a.scheduledAtUtc < b.scheduledAtUtc ? -1 : 1));
  return { posts, skipped };
}

// ── cost ────────────────────────────────────────────────────────────────────
// X pay-per-usage, docs.x.com/x-api/getting-started/pricing, read 2026-08-10:
// a created post is $0.015, a post CONTAINING A URL is $0.200. Media upload is
// not a separately priced line in that table.
export const X_COST_PER_POST_USD = 0.015;
export const X_COST_PER_POST_WITH_URL_USD = 0.2;

export function postCostUsd(post: Pick<XComposedPost, "hasUrl">): number {
  return post.hasUrl ? X_COST_PER_POST_WITH_URL_USD : X_COST_PER_POST_USD;
}

export function dayCostUsd(posts: Pick<XComposedPost, "hasUrl">[]): number {
  return posts.reduce((sum, p) => sum + postCostUsd(p), 0);
}
