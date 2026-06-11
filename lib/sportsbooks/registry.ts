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

type Spec = {
  id: SportsbookId; name: string; logo: string; adapter: BookAdapter;
  codeEnv: string; urlEnv: string; pathsEnv: string;
};

const SPECS: Spec[] = [
  {
    id: "stake", name: "Stake", logo: "/logos/stake.svg", adapter: stakeAdapter,
    codeEnv: "SPORTSBOOK_STAKE_CODE", urlEnv: "SPORTSBOOK_STAKE_URL", pathsEnv: "SPORTSBOOK_STAKE_PATHS",
  },
  {
    id: "roobet", name: "Roobet", logo: "/logos/roobet.svg", adapter: roobetAdapter,
    codeEnv: "SPORTSBOOK_ROOBET_CODE", urlEnv: "SPORTSBOOK_ROOBET_URL", pathsEnv: "SPORTSBOOK_ROOBET_PATHS",
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
    });
  }
  return out;
}
