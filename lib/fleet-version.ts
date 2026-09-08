// #FLEET-CODE-SHA-0908 — read the fleet's code version out of its heartbeats.
//
// The web half of the product knows its commit (Vercel injects it, see
// `commit` in /api/health). The Python fleet deploys separately, by a manual
// restart on a Mac, and for hours on 07/09 it graded with pre-#361 code while
// `main` already had the fix — nothing on the health surface could say so.
// `agents/base.py` now stamps `code_sha` + `boot_at` into every heartbeat's
// `status_detail`; this module turns those rows into one answer: which SHA
// runs, do the agents agree, and does it match the web.
//
// Pure functions, no I/O, so the logic is testable in vitest without a DB.

export interface FleetHeartbeatRow {
  agent_name: string;
  last_seen: string | null;
  status_detail: string | null;
}

export interface FleetVersionSummary {
  /** The SHA all reporting agents share; null when unknown or when they disagree. */
  code_sha: string | null;
  /** Distinct SHAs seen among non-offline agents, with how many report each. */
  shas: Record<string, number>;
  /** Non-offline agents whose heartbeat carries a sha. */
  reporting: number;
  /** Non-offline agents considered (alive or stale). */
  considered: number;
  /** true = one sha; false = several; null = nobody reports one yet. */
  consistent: boolean | null;
  /** Fleet sha vs web commit (7 vs 8 chars → prefix match). null when either side is unknown. */
  matches_web: boolean | null;
  /** Most recent boot_at among considered agents (a restart moves it). */
  latest_boot_at: string | null;
}

const SHA_RE = /"code_sha"\s*:\s*"([0-9a-f]{7,40})"/;
const BOOT_RE = /"boot_at"\s*:\s*"([^"]{10,40})"/;
const OFFLINE_AFTER_SECONDS = 300; // same threshold as parseStatus() in /api/health

/** Extract `code_sha` from a heartbeat detail. JSON first; regex fallback because
 *  `status_detail` is truncated at 4000 chars and a cut payload is not JSON. */
export function extractCodeSha(detail: string | null | undefined): string | null {
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail) as { code_sha?: unknown };
    if (parsed && typeof parsed === "object" && typeof parsed.code_sha === "string") {
      return /^[0-9a-f]{7,40}$/.test(parsed.code_sha) ? parsed.code_sha : null;
    }
    return null;
  } catch {
    const m = SHA_RE.exec(detail);
    return m ? m[1] : null;
  }
}

export function extractBootAt(detail: string | null | undefined): string | null {
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail) as { boot_at?: unknown };
    return parsed && typeof parsed === "object" && typeof parsed.boot_at === "string" ? parsed.boot_at : null;
  } catch {
    const m = BOOT_RE.exec(detail);
    return m ? m[1] : null;
  }
}

/** Do two short/long SHAs denote the same commit? (7-char Vercel vs 8-char git). */
export function shaMatches(a: string | null, b: string | null): boolean | null {
  if (!a || !b) return null;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.startsWith(y) || y.startsWith(x);
}

export function summarizeFleetVersion(
  rows: FleetHeartbeatRow[],
  webCommit: string | null,
  now: number = Date.now(),
): FleetVersionSummary {
  const considered = rows.filter((r) => {
    if (!r.last_seen) return false;
    const age = (now - new Date(r.last_seen).getTime()) / 1000;
    return Number.isFinite(age) && age < OFFLINE_AFTER_SECONDS;
  });

  const shas: Record<string, number> = {};
  let latestBoot: string | null = null;
  for (const r of considered) {
    const sha = extractCodeSha(r.status_detail);
    if (sha) shas[sha] = (shas[sha] ?? 0) + 1;
    const boot = extractBootAt(r.status_detail);
    if (boot && (!latestBoot || boot > latestBoot)) latestBoot = boot;
  }

  const distinct = Object.keys(shas);
  const reporting = Object.values(shas).reduce((a, b) => a + b, 0);
  const consistent = distinct.length === 0 ? null : distinct.length === 1;
  const codeSha = distinct.length === 1 ? distinct[0] : null;

  return {
    code_sha: codeSha,
    shas,
    reporting,
    considered: considered.length,
    consistent,
    matches_web: shaMatches(codeSha, webCommit),
    latest_boot_at: latestBoot,
  };
}
