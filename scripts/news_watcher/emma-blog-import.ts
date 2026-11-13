// scripts/news_watcher/emma-blog-import.ts — publishes ONE approved Emma card to the blog feed (/blog#news). T11 block 2.
//   npx tsx scripts/news_watcher/emma-blog-import.ts <AAAA-MM-GG> <slot> [--dry-run]
// Fixed target: the news_items table + news-images bucket of the BetRedge project (izscgffubtakzvwxchqt), service role read at RUNTIME from
// ~/Library/Application Support/news-watcher/.env (never printed). Rules (emma-import.ts): qa_orchestratore ok + full photo credit + blog.pubblica,
// idempotent by guid (manifest id) and by source/title against the watcher's rows. Order: upload credit.json+webp → HEAD verify → INSERT ignore-duplicates → read back.
//   --dry-run: local only (manifest checks, webp conversion in the out dir, the row printed): no network, nothing written outside drafts/tommy.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { baseFor, buildRow, duplicateOf, guidExists, guidFor, validate, type EmmaManifest } from "../../lib/v3c/news/emma-import";
import { MAX_WEBP_BYTES } from "../../lib/v3c/news/image";
import { storagePublisher } from "../../lib/v3c/news/image-gen";

const HOME = homedir();
const PRONTI = process.env.EMMA_PRONTI || join(HOME, "Desktop/01-BETREDGE/ufficio-maven/drafts/social/ig-pronti");
const OUT = process.env.EMMA_BLOG_OUT || join(HOME, "Desktop/01-BETREDGE/ufficio-maven/drafts/tommy/news-emma-blog/out");
const LEDGER = join(OUT, "registro.jsonl");
const CWEBP = process.env.CWEBP || "/opt/homebrew/bin/cwebp";
const [date, slot, ...flags] = process.argv.slice(2);
const dry = flags.includes("--dry-run");
const log = (o: Record<string, unknown>) => console.log(JSON.stringify({ at: new Date().toISOString(), date, slot, dry, ...o }));
const fail = (status: string, reasons: string[], code = 0): never => { log({ status, reasons }); process.exit(code); };

if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !/^\d{2}$/.test(slot ?? "")) fail("uso", ["emma-blog-import.ts <AAAA-MM-GG> <slot> [--dry-run]"], 2);
const dir = join(PRONTI, date, slot);
const mf = join(dir, "manifest.json");
if (!existsSync(mf)) fail("skip", [`nessun manifest in ${mf}`]);
const m = JSON.parse(readFileSync(mf, "utf8")) as EmmaManifest;
const errors = validate(m);
const img = m.image ? resolve(dir, m.image) : "";
if (!img || !img.startsWith(resolve(dir) + sep) || !existsSync(img)) errors.push("immagine mancante o fuori dalla cartella dello slot");
if (errors.length) fail("skip", errors);

const guid = guidFor(m.id!);
const base = baseFor(guid);
const ledger = existsSync(LEDGER) ? readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
if (ledger.some((r) => r.guid === guid && r.status === "imported")) fail("skip", [`già importata (registro locale, ${base})`]);

// 1) image → webp ≤ 150 KB (the DB/bucket constraint), credit.json next to it
const od = join(OUT, `${date}-${slot}`);
mkdirSync(od, { recursive: true });
const webp = join(od, `${base}.webp`);
if (/\.webp$/i.test(img)) copyFileSync(img, webp);
else {
  let ok = false;
  for (const q of [88, 82, 76, 70, 64, 58]) {
    execFileSync(CWEBP, ["-quiet", "-q", String(q), img, "-o", webp]);
    if (statSync(webp).size <= MAX_WEBP_BYTES) { ok = true; break; }
  }
  if (!ok) fail("skip", [`webp > ${MAX_WEBP_BYTES} byte anche a q58`]);
}
const c = m.blog!.credito!;
writeFileSync(join(od, `${base}.credit.json`), JSON.stringify({ person: c.person, author: c.author, license: c.license, licenseUrl: c.licenseUrl ?? null, url: c.url }, null, 1));
const row = buildRow(m, Date.now());

if (dry) { log({ status: "dry-run-ok", id: m.id, guid, base, webpBytes: statSync(webp).size, title: row.rewritten_en.title, teams: row.teams, nota: "nulla è partito: nessuna rete, nessuna riga, nessun upload" }); process.exit(0); }

// 2) real run — runtime secrets, fixed target (async function: tsx runs this file as CJS, no top-level await)
async function real(): Promise<void> {
process.loadEnvFile(join(HOME, "Library/Application Support/news-watcher/.env"));
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url.includes("izscgffubtakzvwxchqt") || !key) fail("failed", ["target non verificato"], 1);
process.env.NEWS_IMAGE_STYLE = "emma"; // storagePublisher: file -e + credit.json
const h = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
const rest = `${url}/rest/v1/news_items`;
try {
  if (await guidExists(rest, h, guid)) fail("skip", [`già importata (guid ${guid.slice(0, 12)} presente in news_items): nessun upload`]); // before ANY upload, no time window
  const since = new Date(Date.now() - 72 * 3_600_000).toISOString();
  const recent = (await (await fetch(`${rest}?published_at=gt.${encodeURIComponent(since)}&select=guid_hash,source_url,rewritten_en&limit=500`, { headers: h })).json()) as never[];
  const dup = duplicateOf(recent, guid, m.blog!.fonte_url!, row.rewritten_en.title);
  if (dup) fail("skip", [dup]);
  const newUrl = await storagePublisher(url, key, "news-images")({ base }, { png: "", webp, webpBytes: statSync(webp).size });
  const head = await fetch(newUrl, { method: "HEAD" });
  if (!head.ok || !(head.headers.get("content-type") ?? "").includes("webp")) throw new Error(`verifica upload fallita: ${head.status}`);
  if (!(await fetch(newUrl.replace(/\.webp$/, ".credit.json"), { method: "HEAD" })).ok) throw new Error("credit.json non raggiungibile");
  const r = await fetch(`${rest}?on_conflict=guid_hash`, { method: "POST", headers: { ...h, prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify([{ ...row, image_url: newUrl }]) });
  const ins = r.ok ? ((await r.json()) as unknown[]) : [];
  if (!r.ok || ins.length !== 1) throw new Error(`INSERT → ${r.status}, righe ${ins.length} (atteso 1)`);
  mkdirSync(OUT, { recursive: true });
  appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), guid, id: m.id, status: "imported", image_url: newUrl }) + "\n");
  log({ status: "imported", id: m.id, guid, image_url: newUrl });
} catch (e) {
  log({ status: "failed", reasons: [String((e as Error).message).slice(0, 200)] }); // no secrets: message only
  process.exit(1);
}
}
void real();
