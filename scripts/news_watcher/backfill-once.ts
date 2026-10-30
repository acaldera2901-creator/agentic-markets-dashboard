// One-off backfill (#NEWSWATCH-HF-BACKFILL, 30/10): cards for notes already on the page with image_url null.
// Same pipeline as the watcher (pickCard → cardPrompt → makeImage[gptimg, Higgsfield fallback] → tooSimilar),
// one attempt per note. `make` only makes files; `publish <guid...>` uploads + PATCHes image_url for the
// listed notes, after saving the rollback list. Not part of the bundle; delete after use.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { cardPrompt, cardText, cardTint, expectedText, pickCard, tooSimilar } from "../../lib/v3c/news/card";
import { protagonist, protagonistTint, sceneKind } from "../../lib/v3c/news/image";
import { makeImage, storagePublisher, storageRemover, type ImageFiles, type ImageSig } from "../../lib/v3c/news/image-gen";

const HOME = join(homedir(), "Library", "Application Support", "news-watcher");
const OUT = join(homedir(), "Desktop", "01-BETREDGE", "preview-news-prod", "2026-10-30-backfill");
mkdirSync(OUT, { recursive: true });
process.loadEnvFile(join(HOME, ".env"));
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);
const credits = () => Number(/([\d.]+) credits/.exec(execFileSync("higgsfield", ["account", "status"], { encoding: "utf8" }))?.[1]);
type Res = { guid: string; base: string; title: string; expected: string; format: string; ok: boolean; reason?: string; files?: ImageFiles; sig?: ImageSig };
const resFile = join(OUT, process.env.BF_RES || "results.json");

async function make(guids: string[]) {
  const news = JSON.parse(readFileSync(join(OUT, "news.json"), "utf8")).cards as { guid: string; note: { en: { title: string; body: string } }; teams: string[]; image: unknown }[];
  const ledger = (JSON.parse(readFileSync(join(HOME, "state.json"), "utf8")).cards ?? []) as Parameters<typeof tooSimilar>[1];
  const c0 = credits();
  log(`credits before ${c0}`);
  const out: Res[] = [];
  for (const g of guids) {
    const n = news.find((x) => x.guid.startsWith(g));
    if (!n || n.image) { log(`skip ${g}: not found or already has an image`); continue; }
    const note = n.note.en;
    const card = pickCard(n.guid, sceneKind(note), cardText(note), cardTint(protagonistTint(note, n.teams), n.guid), protagonist(note, n.teams), ledger as never);
    const base = `news-bf-${n.guid.slice(0, 12)}`;
    const expected = expectedText(card.text);
    const a = await makeImage({ base, prompt: cardPrompt(card), attempts: 0, expected }, {
      dir: join(HOME, "images"), gptimg: join(homedir(), ".local", "bin", "gptimg"), cwebp: "/opt/homebrew/bin/cwebp", claudeBin: join(homedir(), ".local", "bin", "claude"),
      hf: { bin: "higgsfield", dailyMax: 20, totalMax: Number(process.env.HF_TOTAL_MAX ?? 60), log },
    });
    const dup = a.kind === "ok" ? tooSimilar(a.sig, ledger as never) : null;
    const r: Res = { guid: n.guid, base, title: note.title, expected, format: `${card.format}/${card.tint}`, ok: a.kind === "ok" && !dup };
    if (a.kind === "ok" && !dup) {
      r.files = a.files; r.sig = a.sig;
      (ledger as unknown[]).push({ ...card, dhash: a.sig.dhash, csig: a.sig.csig, at: Date.now() });
    } else r.reason = a.kind === "ok" ? `duplicate: ${dup}` : a.reason;
    out.push(r);
    writeFileSync(resFile, JSON.stringify(out, null, 1));
    const spent = c0 - credits();
    log(`${r.ok ? "made" : "refused"} ${base} · ${r.format} · text «${expected}» · ${r.reason ?? ""} · spent ${spent}`);
    if (spent > 10) { log("STOP: more than 10 credits spent in this run"); break; }
  }
  log(`credits after ${credits()}`);
}

async function publish(guids: string[]) {
  const res = (JSON.parse(readFileSync(resFile, "utf8")) as Res[]).filter((r) => r.ok && guids.some((g) => r.guid.startsWith(g)));
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const rest = `${url.replace(/\/+$/, "")}/rest/v1/news_items`;
  const h = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  const rb: { guid_hash: string; image_url: string | null }[] = [];
  for (const r of res) {
    const rows = (await (await fetch(`${rest}?guid_hash=eq.${r.guid}&select=image_url`, { headers: h })).json()) as { image_url: string | null }[];
    if (rows.length !== 1 || rows[0].image_url !== null) throw new Error(`${r.guid}: expected one row with image_url null, got ${JSON.stringify(rows)}`);
    rb.push({ guid_hash: r.guid, image_url: null });
  }
  const rbFile = join(OUT, process.env.BF_RB || "rollback.json");
  if (existsSync(rbFile)) throw new Error("rollback.json already exists");
  writeFileSync(rbFile, JSON.stringify(rb, null, 1));
  log(`rollback saved: ${rb.length} rows → ${rbFile}`);
  if (process.env.BF_REMOVE) await storageRemover(url, key, process.env.NEWS_WATCHER_IMAGE_BUCKET || "news-images")([process.env.BF_REMOVE]);
  const put = storagePublisher(url, key, process.env.NEWS_WATCHER_IMAGE_BUCKET || "news-images");
  for (const r of res) {
    // the DB check wants news-<12 hex>.webp: the guid prefix, not the local "news-bf-" name
    const u = await put({ base: `news-${r.guid.slice(0, 12)}` }, r.files!);
    const p = await fetch(`${rest}?guid_hash=eq.${r.guid}`, { method: "PATCH", headers: { ...h, prefer: "return=minimal" }, body: JSON.stringify({ image_url: u }) });
    if (!p.ok) throw new Error(`PATCH ${r.guid} → ${p.status}`);
    log(`published ${r.base} → ${u}`);
  }
}

const [cmd, ...ids] = process.argv.slice(2);
(cmd === "make" ? make(ids) : cmd === "publish" ? publish(ids) : Promise.reject(new Error("make|publish"))).catch((e) => { log(`ERROR ${e}`); process.exit(1); });
