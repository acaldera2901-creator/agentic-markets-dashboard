// lib/v3c/news/photo.ts — G3: a real photo of the person a note is about, from Wikimedia (public API, no key).
// Never invents a person: a name is used only if a Wikipedia article for that exact name says «footballer/manager/tennis player»,
// and the picture is THAT article's own lead image (hosted on Commons) — so the face is the named person's. Licence must be
// CC0 / public domain / CC BY / CC BY-SA, at least 1000 px wide. Anything else → null → the card stays a generic scene, no name.
// Cache: <dir>/<file>.jpg + <file>.json {person, author, license, url…} — the JSON is the credit shown with the card.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clubsInText } from "../../news/clubs";
import type { NoteText } from "./rewrite";

export type PhotoRef = { person: string; file: string; author: string; license: string; licenseUrl: string | null; url: string; width: number; height: number };
export type PhotoOpts = { dir: string; fetch?: typeof fetch; log?: (m: string) => void };

const UA = "BetRedgeNewsWatcher/1.0 (https://www.betredge.com; image credit lookup, low volume)";
const MIN_WIDTH = 1000;
const ROLE = /footballer|football (manager|coach)|soccer|tennis player|\bmanager\b|\bcoach\b/i;
const LICENSE_OK = /^(cc0|public domain|pd\b|cc[- ]by(?![- ](nc|nd))([- ]sa)?\b)/i;
const STOP = new Set(["the", "a", "an", "and", "in", "on", "at", "for", "to", "of", "after", "as", "with", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "league", "premier", "champions", "europa", "serie", "liga", "cup", "fa", "uefa", "fifa", "ligue", "bundesliga", "world", "euro", "england", "spain", "italy", "france", "germany", "brazil", "argentina", "portugal", "netherlands", "united", "city", "real", "fc", "ac", "sc"]);
const PARTICLE = new Set(["de", "da", "do", "dos", "van", "von", "der", "di", "del", "le", "la", "el", "al", "bin", "ter", "ten"]);
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const toks = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Capitalised name candidates (1-3 words) from the title first, then the body's first sentence; club words excluded. Max 3. */
export function personCandidates(note: NoteText, teams: readonly string[]): string[] {
  const clubWords = new Set<string>();
  for (const t of teams) toks(t).forEach((w) => clubWords.add(w));
  for (const c of clubsInText(`${note.title}. ${note.body}`, 6)) for (const n of c.names) toks(n).forEach((w) => clubWords.add(w));
  const out: string[] = [];
  const scan = (text: string) => {
    const words = text.replace(/[“”"()]/g, " ").split(/\s+/).filter(Boolean);
    let cur: string[] = [];
    const flush = () => {
      while (cur.length && PARTICLE.has(fold(cur[cur.length - 1]))) cur.pop();
      if (cur.length) {
        const name = cur.slice(0, 3).join(" ");
        const real = toks(name).filter((w) => !PARTICLE.has(w));
        if (real.length && !real.some((w) => clubWords.has(w) || STOP.has(w) || w.length < 3) && !out.includes(name)) out.push(name);
      }
      cur = [];
    };
    for (const raw of words) {
      const w = raw.replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, "").replace(/['’]s$/i, "");
      if (/^\p{Lu}[\p{L}'’-]+$/u.test(w)) cur.push(w);
      else if (cur.length && PARTICLE.has(fold(w))) cur.push(w);
      else flush();
      if (/[.!?:,;]$/.test(raw)) flush();
    }
    flush();
  };
  scan(note.title);
  scan(note.body.split(/(?<=[.!?])\s/)[0] ?? "");
  // «Haaland» + «Erling Haaland»: keep the fuller name, first
  const full = [...out].sort((a, b) => toks(b).length - toks(a).length);
  const kept = full.filter((n) => !full.some((m) => m !== n && toks(m).length > toks(n).length && toks(n).every((w) => toks(m).includes(w))));
  return kept.slice(0, 3);
}

const slug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/\s+/g, " ").trim();

async function getJson(f: typeof fetch, url: string): Promise<any> {
  const r = await f(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}


// ─── national-team photos on club news (G5, orchestratore finding B) ──────────
const COUNTRIES = "brazil|brasil|argentina|france|germany|spain|italy|england|portugal|netherlands|norway|morocco|guinea|belgium|croatia|uruguay|colombia|usa|united states|mexico|japan|senegal|nigeria|ghana|egypt|algeria|cameroon|denmark|sweden|poland|switzerland|austria|turkey|scotland|wales|ireland|korea|canada|ecuador|chile|peru|paraguay|serbia|ukraine|czech|hungary|greece|romania|iran|australia|tunisia|ivory coast";
const NATIONAL_RE = new RegExp(`national (football |soccer )?team|world cup|nations league|qualif|copa am[eé]rica|uefa euro|\\beuro 20\\d\\d|friendly|olympic|\\b(${COUNTRIES})\\b[ _.-]+(v|vs|x)\\b`, "i");
/** True when the file's name, categories or description say it is a national-team picture (kit of a country, not of the club). */
export function isNationalPhoto(fileName: string, categories = "", description = ""): boolean {
  return NATIONAL_RE.test(`${fileName.replace(/_/g, " ")} ${categories} ${description}`);
}
/** A club note: the title or the teams name a club (a national-team note — «Brazil» — names none). Only then national photos are refused. */
export const isClubNote = (note: NoteText, teams: readonly string[]): boolean => clubsInText(`${note.title}. ${teams.join(". ")}`, 2).length > 0;

/** A photo of the person the note is about, or null (generic scene). Never throws. Club notes never get a national-team photo (the kit would contradict the note). */
export async function photoRef(note: NoteText, teams: readonly string[], o: PhotoOpts): Promise<PhotoRef | null> {
  const f = o.fetch ?? fetch;
  const club = isClubNote(note, teams);
  const clubNames = clubsInText(`${note.title}. ${teams.join(". ")}`, 3).map((c) => c.names[0]);
  /** Licence/size checks + download for one Commons file; "national" = refused only for being a national-team picture. */
  const build = async (fileName: string, personName: string, cand: string, key: string): Promise<PhotoRef | "national" | null> => {
    const info = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(`File:${fileName}`)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1400&iiextmetadatafilter=LicenseShortName|Artist|LicenseUrl|NonFree|Restrictions|Categories|ImageDescription`;
    const ii = (Object.values((await getJson(f, info))?.query?.pages ?? {}) as any[])[0]?.imageinfo?.[0];
    if (!ii) return null;
    const md = ii.extmetadata ?? {};
    const license = String(md.LicenseShortName?.value ?? "").trim();
    if (!LICENSE_OK.test(license) || md.NonFree?.value === "true" || ii.width < MIN_WIDTH) { o.log?.(`photo ${cand}: skipped (${license || "no licence"}, ${ii.width}px)`); return null; }
    if (club && isNationalPhoto(fileName, stripHtml(String(md.Categories?.value ?? "")), stripHtml(String(md.ImageDescription?.value ?? "")))) { o.log?.(`photo ${cand}: skipped (national-team picture on a club note: ${fileName})`); return "national"; }
    const img = await f(ii.thumburl || ii.url, { headers: { "User-Agent": UA } });
    if (!img.ok) return null;
    mkdirSync(o.dir, { recursive: true });
    const file = join(o.dir, `${slug(personName)}.jpg`);
    writeFileSync(file, Buffer.from(await img.arrayBuffer()));
    const ref: PhotoRef = { person: personName.replace(/ \(.*\)$/, ""), file, author: stripHtml(String(md.Artist?.value ?? "")) || "unknown", license, licenseUrl: md.LicenseUrl?.value ?? null, url: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`, width: ii.width, height: ii.height };
    writeFileSync(key, JSON.stringify(ref, null, 1));
    writeFileSync(join(o.dir, `${slug(personName)}.json`), JSON.stringify(ref, null, 1));
    return ref;
  };
  try {
    for (const cand of personCandidates(note, teams)) {
      const key = join(o.dir, `${slug(cand)}.json`);
      if (existsSync(key)) { // cached (a hit; a miss is re-asked next time: it is one cheap GET)
        const c = JSON.parse(readFileSync(key, "utf8")) as PhotoRef;
        if (existsSync(c.file) && !(club && isNationalPhoto(decodeURIComponent(c.url.split("File:")[1] ?? "")))) return c;
      }
      const q = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(`${cand} footballer`)}&gsrlimit=5&prop=pageimages|description&piprop=name&redirects=1`;
      const pages = Object.values((await getJson(f, q))?.query?.pages ?? {}) as { title: string; description?: string; pageimage?: string; index?: number }[];
      const want = toks(cand).filter((w) => !PARTICLE.has(w));
      const page = pages.sort((a, b) => (a.index ?? 9) - (b.index ?? 9)).find((p) => {
        const t = toks(p.title);
        return !!p.pageimage && !/\((surname|disambiguation|given name)\)/i.test(p.title) && ROLE.test(p.description ?? "") && want.every((w) => t.includes(w)) && (want.length > 1 || t[t.length - 1] === want[0] || t[0] === want[0]);
      });
      if (!page) continue;
      const lead = await build(page.pageimage!, page.title, cand, key);
      if (lead && lead !== "national") return lead;
      // #TOMMY-FOTO-1110: lead refused (national-team picture, or licence/resolution): look on Commons for one of the person in the
      // note's club (title must carry the surname and not be national); the last query is the name only
      for (const cn of [...clubNames, ""]) {
        const s = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(`${page.title.replace(/ \(.*\)$/, "")} ${cn}`.trim())}`;
        const hits = ((await getJson(f, s))?.query?.search ?? []) as { title: string }[];
        for (const h of hits) {
          const name = h.title.replace(/^File:/, "");
          if (!want.every((w) => toks(name).includes(w)) || !/\.jpe?g$/i.test(name)) continue;
          const r = await build(name, page.title, cand, key);
          if (r && r !== "national") return r;
        }
      }
    }
  } catch (e) {
    o.log?.(`photo: ${String(e).slice(0, 120)}`);
  }
  return null;
}
