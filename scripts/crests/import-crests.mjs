// Crests (football) and player photos (tennis) from TheSportsDB (free public key "3"),
// for the teams/players BetRedge actually serves. Writes webp files to public/crests/
// and the lookup map to lib/ui/crest-map.json (read by lib/ui/crest-assets.ts).
//
// Origin: #CLASSIC-ROOBET-1013 round 2 — Andrea asked to import all crests and tennis
// faces and took responsibility for the licensing (images are TheSportsDB community
// uploads; club crests are trademarks of the clubs). Source per file is kept in
// scripts/crests/sources.json so any single asset can be traced or removed.
//
// Resumable: the HTTP cache lives outside the repo and existing webp files are kept,
// so a re-run only fetches what is new. Rate limit: 1 req every 2 s (free key).
//
// usage: node scripts/crests/import-crests.mjs <cacheDir> [baseUrl=https://www.betredge.com]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [CACHE, BASE = "https://www.betredge.com"] = process.argv.slice(2);
if (!CACHE) { console.error("usage: node scripts/crests/import-crests.mjs <cacheDir> [baseUrl]"); process.exit(2); }
const require = createRequire(path.join(ROOT, "package.json"));
const sharp = require("sharp");
fs.mkdirSync(CACHE, { recursive: true });

const MAP_FILE = path.join(ROOT, "lib/ui/crest-map.json");
const SRC_FILE = path.join(ROOT, "scripts/crests/sources.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ABBR = new Set(["fc", "cf", "sk", "ac", "sc", "sv", "as", "us", "ud", "rc", "ss", "ssc", "acf", "fk", "cd", "sd", "afc", "cfc", "club", "de", "fsv", "tsg", "vfb", "vfl", "bsc", "rb", "1", "04", "05", "07", "09", "1899", "1860", "the", "sporting", "clube", "athletic", "atletico", "ca", "cr", "ec", "se", "united", "city"]);
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
const core = (s) => norm(s).filter((t) => !ABBR.has(t));
const jacc = (a, b) => { const A = new Set(a), B = new Set(b); const i = [...A].filter((x) => B.has(x)).length; return i / (A.size + B.size - i || 1); };
// Same key as lib/ui/crest-assets.ts — keep in sync.
const mapKey = (sport, name) => `${sport}:${name.trim().toLowerCase()}`;

async function getJson(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "betredge-crests/1.0" } });
      if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(1500); }
  }
  return null;
}

async function sdb(kind, q) {
  const cf = path.join(CACHE, "sdb-" + slug(kind + ":" + q) + ".json");
  if (fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, "utf8"));
  const url = kind === "team"
    ? `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(q)}`
    : `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(q)}`;
  const d = await getJson(url);
  await sleep(2000); // free key: ~30 req/min, faster gets throttled with empty answers
  const list = (kind === "team" ? d?.teams : d?.player) || [];
  // Only non-empty answers are cached: when throttled the free API also answers
  // 200 with a null list, and caching that poisoned a whole first run (13/10).
  if (list.length) fs.writeFileSync(cf, JSON.stringify(list));
  return list;
}

function pickTeam(name, list) {
  const q = core(name), qn = norm(name);
  let best = null, bs = 0;
  for (const t of list) {
    if (t.strSport !== "Soccer" || !t.strBadge) continue;
    const c = core(t.strTeam), cn = norm(t.strTeam);
    let s = jacc(q, c);
    if (qn.join(" ") === cn.join(" ")) s = 2;
    else if (q.length && (q.every((x) => c.includes(x)) || c.every((x) => q.includes(x)))) s = Math.max(s, 0.9);
    // youth/women/reserve sides only when the served name says so
    if (/\b(women|femenino|feminino|ladies|u19|u21|u23|reserves?|b|c|ii|2)$/i.test(t.strTeam) && !/\b(women|b|ii)$/i.test(name)) s *= 0.3;
    if (s > bs) { bs = s; best = t; }
  }
  return bs >= 0.6 ? best : null;
}

function pickPlayer(name, list) {
  const q = norm(name);
  let best = null, bs = 0;
  for (const p of list) {
    if (p.strSport !== "Tennis") continue;
    const src = p.strCutout || p.strThumb || p.strRender;
    if (!src) continue;
    const c = norm(p.strPlayer);
    let s = jacc(q, c);
    if ([...q].sort().join(" ") === [...c].sort().join(" ")) s = 2;
    if (s > bs) { bs = s; best = { ...p, _src: src }; }
  }
  return bs >= 0.66 ? best : null;
}

async function fetchBuf(url) {
  const cf = path.join(CACHE, "img-" + slug(url) + ".bin");
  if (fs.existsSync(cf)) return fs.readFileSync(cf);
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url); if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(cf, b); return b; } } catch {}
    await sleep(1000);
  }
  return null;
}

// <= 20 KB per file: quality steps down until it fits.
async function toWebp(buf, out, size, cover) {
  for (const q of [82, 70, 58, 46]) {
    const img = sharp(buf).resize(size, size, cover ? { fit: "cover", position: "top" } : { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    const b = await img.webp({ quality: q, alphaQuality: 80 }).toBuffer();
    if (b.length <= 20 * 1024 || q === 46) { fs.writeFileSync(out, b); return b.length; }
  }
}

const readJson = (f, dflt) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : dflt);
const map = readJson(MAP_FILE, {});
const sources = readJson(SRC_FILE, {});
const save = () => {
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MAP_FILE, JSON.stringify(sorted(map), null, 1) + "\n");
  fs.writeFileSync(SRC_FILE, JSON.stringify(sorted(sources), null, 1) + "\n");
};

const [pred, hist, ten, tl] = await Promise.all([
  getJson(BASE + "/api/predictions"), getJson(BASE + "/api/v2/history?limit=500"), getJson(BASE + "/api/tennis"), getJson(BASE + "/api/tennis-live"),
]);
if (!pred || !ten) { console.error("data source unreachable:", BASE); process.exit(1); }
const teams = new Set(), players = new Set();
for (const r of pred.predictions || []) { teams.add(r.home_team); teams.add(r.away_team); }
for (const r of hist?.history || []) {
  if (r.sport === "tennis") { players.add(r.home_team); players.add(r.away_team); }
  else { teams.add(r.home_team); teams.add(r.away_team); }
}
for (const r of [...(ten.matches || []), ...(tl?.matches || [])]) { players.add(r.player1); players.add(r.player2); }
const T = [...teams].filter(Boolean).sort(), P = [...players].filter(Boolean).sort();
console.log("teams", T.length, "players", P.length);
fs.mkdirSync(path.join(ROOT, "public/crests/football"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "public/crests/tennis"), { recursive: true });

const miss = { football: [], tennis: [] };
async function one(sport, name, find, size, coverFor) {
  const k = mapKey(sport, name);
  const file = `${sport}/${slug(name)}.webp`;
  const abs = path.join(ROOT, "public/crests", file);
  if (map[k] && fs.existsSync(abs)) return;
  const hit = await find(name);
  if (!hit) { miss[sport].push(name); return; }
  const url = sport === "football" ? hit.strBadge : hit._src;
  const buf = (await fetchBuf(url + "/small")) || (await fetchBuf(url));
  if (!buf) { miss[sport].push(name); return; }
  try { await toWebp(buf, abs, size, coverFor(hit)); } catch { miss[sport].push(name); return; }
  map[k] = `/crests/${file}`;
  sources[k] = { matched: sport === "football" ? hit.strTeam : hit.strPlayer, url };
}

// Served name -> TheSportsDB name, where the two differ too much for the fuzzy match.
const TEAM_ALIAS = {
  "FC Bayern München": "Bayern Munich", "FC Internazionale Milano": "Inter Milan", "Club Brugge KV": "Club Brugge",
  "Como 1907": "Como", "Real Betis Balompié": "Real Betis", "RCD Espanyol de Barcelona": "Espanyol",
  "RC Deportivo La Coruña": "Deportivo La Coruna", "Racing Club de Lens": "Lens", "SK Slavia Praha": "Slavia Prague",
  "Hamburger SV": "Hamburg", "Hertha Berlin": "Hertha Berlin", "D.C. United": "DC United", "St. Louis City SC": "St. Louis City",
  "PAE AEK": "AEK Athens", "Frosinone Calcio": "Frosinone", "Djurgardens IF": "Djurgarden", "Genclerbirligi SK": "Genclerbirligi",
  "Torku Konyaspor": "Konyaspor", "US Catanzaro 1929": "Catanzaro", "Stade Lavallois": "Laval", "USL Dunkerque": "Dunkerque",
  "Pumas": "Pumas UNAM", "Shandong Luneng Taishan FC": "Shandong Taishan", "Shelbourne Dublin": "Shelbourne",
  "St Patricks Athletic": "St Patricks Athletic", "Drogheda United": "Drogheda United", "Ilves Tampere": "Ilves",
  "TPS Turku": "TPS", "Erzurum BB": "Erzurumspor", "Zhejiang": "Zhejiang", "Bohemians": "Bohemians", "Walsall": "Walsall",
  "Southampton": "Southampton", "Los Angeles FC": "Los Angeles FC",
};
const findTeam = async (name) => {
  if (TEAM_ALIAS[name]) { const hit = pickTeam(TEAM_ALIAS[name], await sdb("team", TEAM_ALIAS[name])); if (hit) return hit; }
  let hit = pickTeam(name, await sdb("team", name));
  if (!hit) { const alt = core(name).join(" "); if (alt && alt !== name.toLowerCase()) hit = pickTeam(name, await sdb("team", alt)); }
  return hit;
};
const findPlayer = async (name) => {
  let hit = pickPlayer(name, await sdb("player", name));
  if (!hit) { const parts = name.split(/\s+/); if (parts.length >= 2) hit = pickPlayer(name, await sdb("player", [...parts].reverse().join(" "))); }
  return hit;
};

let n = 0;
for (const name of T) { await one("football", name, findTeam, 128, () => false); if (++n % 20 === 0) save(); }
for (const name of P) { await one("tennis", name, findPlayer, 160, (hit) => !hit.strCutout); if (++n % 20 === 0) save(); }
save();
fs.writeFileSync(path.join(CACHE, "miss.json"), JSON.stringify(miss, null, 1));
console.log(JSON.stringify({ football: `${T.length - miss.football.length}/${T.length}`, tennis: `${P.length - miss.tennis.length}/${P.length}`, miss }, null, 1));
