// Crest coverage on what the lobby/card shows right now: football teams from
// /api/predictions, tennis players from /api/tennis. For each name: covered (map entry
// AND file on disk) or missing (falls back to the initials square in <Crest>).
// Exit 1 if a map entry points to a missing file (that would render a broken <img>).
//
// usage: node scripts/crests/coverage.mjs [baseUrl=https://www.betredge.com]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = process.argv[2] || "https://www.betredge.com";
const map = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/ui/crest-map.json"), "utf8"));
const key = (sport, name) => `${sport}:${name.trim().toLowerCase()}`; // = lib/ui/crest-assets.ts

const get = async (p) => { const r = await fetch(BASE + p); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); };
const [pred, ten] = await Promise.all([get("/api/predictions"), get("/api/tennis")]);
const shown = {
  football: [...new Set((pred.predictions || []).flatMap((r) => [r.home_team, r.away_team]).filter(Boolean))].sort(),
  tennis: [...new Set((ten.matches || []).flatMap((r) => [r.player1, r.player2]).filter(Boolean))].sort(),
};

let broken = 0;
for (const f of Object.values(map)) if (!fs.existsSync(path.join(ROOT, "public", f))) { broken++; console.log("BROKEN map entry ->", f); }

const out = {};
for (const [sport, names] of Object.entries(shown)) {
  const missing = names.filter((n) => !map[key(sport, n)]);
  out[sport] = { shown: names.length, covered: names.length - missing.length, fallback: missing.length, missing };
}
console.log(JSON.stringify({ base: BASE, mapEntries: Object.keys(map).length, brokenEntries: broken, ...out }, null, 1));
process.exit(broken ? 1 : 0);
