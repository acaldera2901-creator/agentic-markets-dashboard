import { stakeAdapter } from "./adapters/stake";
import { roobetAdapter } from "./adapters/roobet";
import type { Sportsbook, SportsbookId, BookAdapter } from "./types";

function parsePaths(json: string | undefined): Sportsbook["sportPaths"] | undefined {
  if (!json) return undefined;
  try {
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? obj : undefined;
  } catch {
    return undefined;
  }
}

// Per-country base-URL map from SPORTSBOOK_<BOOK>_URLS. Country keys are
// uppercased; the "default" key is preserved. Non-string/empty values dropped.
function parseUrlMap(json: string | undefined): Record<string, string> | undefined {
  if (!json) return undefined;
  try {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== "string" || !v) continue;
      out[k === "default" ? "default" : k.toUpperCase()] = v;
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

type Spec = {
  id: SportsbookId; name: string; logo: string; adapter: BookAdapter;
  codeEnv: string; urlEnv: string; pathsEnv: string; urlsEnv: string;
};

const SPECS: Spec[] = [
  {
    id: "stake", name: "Stake", logo: "/logos/stake.svg", adapter: stakeAdapter,
    codeEnv: "SPORTSBOOK_STAKE_CODE", urlEnv: "SPORTSBOOK_STAKE_URL",
    pathsEnv: "SPORTSBOOK_STAKE_PATHS", urlsEnv: "SPORTSBOOK_STAKE_URLS",
  },
  {
    id: "roobet", name: "Roobet", logo: "/logos/roobet.svg", adapter: roobetAdapter,
    codeEnv: "SPORTSBOOK_ROOBET_CODE", urlEnv: "SPORTSBOOK_ROOBET_URL",
    pathsEnv: "SPORTSBOOK_ROOBET_PATHS", urlsEnv: "SPORTSBOOK_ROOBET_URLS",
  },
];

// Un book è incluso SOLO se la sua baseUrl (referral affiliato) è in env.
// Affiliate "da creare": finché manca la URL, il book non viene emesso.
export function allSportsbooks(): Sportsbook[] {
  const out: Sportsbook[] = [];
  for (const s of SPECS) {
    const baseUrl = process.env[s.urlEnv] || "";
    if (!baseUrl) continue;
    out.push({
      id: s.id, name: s.name, logo: s.logo, adapter: s.adapter,
      affiliateCode: process.env[s.codeEnv] || "",
      baseUrl,
      sportPaths: parsePaths(process.env[s.pathsEnv]),
      regionalUrls: parseUrlMap(process.env[s.urlsEnv]),
    });
  }
  return out;
}
