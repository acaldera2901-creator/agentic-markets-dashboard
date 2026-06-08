// Tennis "why" v2 — human-readable explanation builder.
//
// Mirror of the football why-v2 humanisation (core/world_cup_explanation.py
// build_wc_explanation): say WHO is favoured, by HOW MUCH (%), and WHY in plain
// language — never the internal jargon the v1 string leaked ("Surface-Elo model",
// raw "Serve/return 59.2%/42.5%", "Feature quality 54%", "Lean: … win probability").
//
// Honesty contract: TEXT ONLY. This module never sees, computes or alters a
// probability, pick, confidence, surface or feature value — the caller resolves
// every input. Missing inputs degrade to silence (fail-soft), never fabrication.
//
// SINGLE SOURCE OF TRUTH for the lead tiers: config/settings.py
// WHY_STRONG_PICK_CONFIDENCE (65) and SURFACE_FLOOR_FOOTBALL (56). Tennis has no
// surfacing floor of its own (lab finding 2026-06-08), so the football floor is
// reused purely as the copy boundary between "favoured but open" and "no clear
// favourite". Keep these in sync with settings.

export const WHY_STRONG_PICK_CONFIDENCE = 65;
export const TENNIS_FAVOURED_FLOOR = 56;

export type TennisExplanationInput = {
  pick: string;
  opponent: string;
  confidence: number | null;
  surface: string;
  serveFormPick: number | null;
  serveFormOpp: number | null;
  returnFormPick: number | null;
  returnFormOpp: number | null;
  featureQuality: number | null;
  hasRealMarket: boolean;
};

// Below this gap (in raw serve/return rate points) the two players are treated as
// level on that shot — no edge is claimed. Above the "clear" gap the wording is
// stronger. These are copy thresholds only; they never touch probabilities.
const _SERVE_EDGE = 0.03;
const _SERVE_CLEAR = 0.07;
const _RETURN_EDGE = 0.03;
const _RETURN_CLEAR = 0.06;

// Feature quality below this means the statistical read is thin; the copy hedges
// ("the underlying form read is thin") instead of asserting a confident reason.
const _LOW_QUALITY = 0.35;

function _isNum(v: number | null): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function _hasSurface(surface: string): boolean {
  const s = surface.trim().toLowerCase();
  return s !== "" && s !== "n/a" && s !== "na" && s !== "unknown";
}

// Plain-language serve comparison. Returns null when level or data missing.
function _serveClause(input: TennisExplanationInput): string | null {
  if (!_isNum(input.serveFormPick) || !_isNum(input.serveFormOpp)) return null;
  const diff = input.serveFormPick - input.serveFormOpp;
  if (diff >= _SERVE_CLEAR) return `${input.pick} holds serve markedly better`;
  if (diff >= _SERVE_EDGE) return `${input.pick} is the steadier server`;
  if (diff <= -_SERVE_CLEAR) return `${input.opponent} is the bigger server, so the favourite has to earn it on return`;
  if (diff <= -_SERVE_EDGE) return `${input.opponent} edges the serving exchanges`;
  return null;
}

// Plain-language return comparison. Returns null when level or data missing.
function _returnClause(input: TennisExplanationInput): string | null {
  if (!_isNum(input.returnFormPick) || !_isNum(input.returnFormOpp)) return null;
  const diff = input.returnFormPick - input.returnFormOpp;
  if (diff >= _RETURN_CLEAR) return `${input.pick} is biting hard on return`;
  if (diff >= _RETURN_EDGE) return `${input.pick} reads the serve a little better`;
  if (diff <= -_RETURN_CLEAR) return `${input.opponent} is the more dangerous returner`;
  return null;
}

// Drops a leading repeat of the favourite's name when two clauses both open with
// it, so the prose reads "X holds serve better, and also reads the serve…" rather
// than naming the same player twice in a row.
function _dedupSecondClause(second: string, pick: string): string {
  return second.startsWith(`${pick} `) ? `also ${second.slice(pick.length + 1)}` : second;
}

export function buildTennisExplanation(input: TennisExplanationInput): string {
  const conf = _isNum(input.confidence) ? Math.round(input.confidence) : null;
  const confTxt = conf !== null ? `${conf}%` : "the model's read";
  const onSurface = _hasSurface(input.surface)
    ? ` on ${input.surface.toLowerCase()}`
    : "";

  const parts: string[] = [];

  // ── Lead, keyed to confidence (mirrors football why-v2 tiers) ──────────────
  if (conf !== null && conf >= WHY_STRONG_PICK_CONFIDENCE) {
    parts.push(`${input.pick} is the strong pick against ${input.opponent}${onSurface}, with a ${confTxt} chance to win.`);
  } else if (conf !== null && conf >= TENNIS_FAVOURED_FLOOR) {
    parts.push(`${input.pick} is favoured against ${input.opponent}${onSurface} at ${confTxt}, but it is far from settled.`);
  } else if (conf !== null) {
    parts.push(`${input.pick} vs ${input.opponent}${onSurface} is close to a coin-flip — no clear favourite, with ${input.pick} edging it at just ${confTxt}.`);
  } else {
    parts.push(`${input.pick} vs ${input.opponent}${onSurface}: the model leans ${input.pick}, but without a firm probability it is best read as a toss-up.`);
  }

  // ── Why, in plain words — only when the form read is solid enough ───────────
  const qualityThin = _isNum(input.featureQuality) && input.featureQuality < _LOW_QUALITY;
  if (qualityThin) {
    parts.push("The recent-form read behind this is thin, so the lean rests mostly on each player's surface rating rather than current shot data.");
  } else {
    const reasons = [_serveClause(input), _returnClause(input)].filter(
      (c): c is string => c !== null,
    );
    if (reasons.length) {
      const joined =
        reasons.length === 1
          ? reasons[0]
          : `${reasons[0]}, and ${_dedupSecondClause(reasons[1], input.pick)}`;
      parts.push(`${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`);
    }
  }

  // ── Honesty close (mirrors the football disclaimer) ────────────────────────
  if (!input.hasRealMarket) {
    parts.push("No live market price is available, so no betting edge is claimed.");
  }
  parts.push("Informational only and does not guarantee an outcome. Bet responsibly.");

  return parts.join(" ");
}
