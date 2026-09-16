// scripts/seo/lastmod.ts — #SEO-LASTMOD-0915
// Genera lib/seo/last-modified.generated.ts: per ogni rotta statica della
// sitemap, la data dell'ULTIMO COMMIT che ha toccato i file che ne producono il
// contenuto.
//
// Perché un file generato e committato, invece di calcolare la data a runtime:
// - a runtime non c'è git (la sitemap gira in una function serverless, e con
//   `revalidate = 3600` verrebbe rivalutata ogni ora: `new Date()` scriverebbe
//   "adesso" su tutte e 150 le URL a ogni rigenerazione, che è esattamente il
//   lastmod che Google impara a ignorare);
// - al build su Vercel il clone è shallow, quindi `git log` su un path che non
//   è stato toccato negli ultimi commit tornerebbe vuoto in silenzio.
// Committare il risultato rende il dato deterministico e ispezionabile nel diff.
//
// Si rigenera con: npm run seo:lastmod

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TOOL_LOCALES, TOOL_SLUGS, hubPath, toolPath } from "../../lib/tools/registry";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = resolve(REPO_ROOT, "lib/seo/last-modified.generated.ts");

// Le pagine-tool sono renderizzate da un solo componente per fascia di rotta e
// prendono TUTTO il testo da lib/tools/copy/<locale>.ts: quei due file sono ciò
// che ne cambia davvero il contenuto. Granularità per locale, non per slug —
// il copy di una lingua vive in un unico modulo e git non sa dire quale delle
// undici sezioni sia stata toccata. Sottostimare la granularità è onesto;
// inventare una data per slug no.
const toolSources = (locale: string, page: string) => [
  page,
  `lib/tools/copy/${locale}.ts`,
];

const ROUTE_SOURCES: Record<string, string[]> = {
  "/": ["app/page.tsx", "app/landing-client.tsx"],
  "/predictions": ["app/predictions"],
  "/plans": ["app/plans"],
  "/history": ["app/history"],
  "/ai-tennis-predictions": ["app/ai-tennis-predictions"],
  "/ai-football-predictions": ["app/ai-football-predictions"],
  "/weekly-model-case": ["app/weekly-pick"],
  "/blog": ["app/blog/page.tsx"],
  "/community": ["app/community"],
  "/partners": ["app/partners"],
  "/terms": ["app/terms"],
  "/privacy": ["app/privacy"],
  "/world-cup": ["app/world-cup"],
};

for (const locale of TOOL_LOCALES) {
  const hubPage = locale === "en" ? "app/tools/page.tsx" : "app/[lang]/tools/page.tsx";
  const toolPage = locale === "en" ? "app/tools/[tool]/page.tsx" : "app/[lang]/tools/[tool]/page.tsx";
  ROUTE_SOURCES[hubPath(locale)] = toolSources(locale, hubPage);
  for (const slug of TOOL_SLUGS) {
    ROUTE_SOURCES[toolPath(slug, locale)] = toolSources(locale, toolPage);
  }
}

/** Data ISO dell'ultimo commit che ha toccato uno qualsiasi dei path. */
function lastCommitISO(paths: string[]): string | null {
  const out = execFileSync(
    "git",
    ["log", "-1", "--format=%cI", "--", ...paths],
    { cwd: REPO_ROOT, encoding: "utf8" },
  ).trim();
  return out || null;
}

const generatedAt = new Date().toISOString();
const entries: [string, string][] = [];
const missing: string[] = [];

for (const route of Object.keys(ROUTE_SOURCES).sort()) {
  const iso = lastCommitISO(ROUTE_SOURCES[route]);
  if (iso) entries.push([route, iso]);
  else missing.push(route);
}

if (missing.length) {
  // Non è fatale (il sitemap ha il suo fallback), ma va visto: di solito vuol
  // dire che una rotta è stata rinominata e la mappa qui sopra non l'ha seguita.
  console.warn(`[lastmod] nessun commit trovato per ${missing.length} rotte:`, missing);
}

const body = entries.map(([route, iso]) => `  ${JSON.stringify(route)}: ${JSON.stringify(iso)},`).join("\n");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `// GENERATO da scripts/seo/lastmod.ts — non modificare a mano.
// Rigenera con: npm run seo:lastmod
// Ogni data è quella dell'ultimo commit che ha toccato i file che producono
// quella pagina (vedi ROUTE_SOURCES nello script).

/** Quando questo file è stato generato: fallback per una rotta non mappata. */
export const GENERATED_AT = ${JSON.stringify(generatedAt)};

export const LAST_MODIFIED: Record<string, string> = {
${body}
};
`,
);

console.log(`[lastmod] scritte ${entries.length} rotte in ${OUT}`);
