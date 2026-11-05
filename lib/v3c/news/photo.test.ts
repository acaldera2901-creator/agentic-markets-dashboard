// G3: photoRef — mocked Wikimedia (licence, size, name checks, cache, no-invention) + one real call (PHOTO_LIVE=1).
import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { personCandidates, photoRef } from "./photo";
import { cardJobWithPhoto } from "./card-job";
import { cardText, pickCard } from "./card";
import { sceneKind } from "./image";

const note = { title: "Haaland scores twice as Manchester City beat Leipzig 3-1", body: "Erling Haaland scored twice as Manchester City beat RB Leipzig 3-1." };
const teams = ["Manchester City", "RB Leipzig"];

type Cfg = { title?: string; description?: string; pageimage?: string | undefined; license?: string; width?: number; nonfree?: boolean; imgOk?: boolean };
function mockFetch(cfg: Cfg = {}) {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(String(url));
    const u = String(url);
    const json = (o: unknown) => ({ ok: true, status: 200, json: async () => o, arrayBuffer: async () => new ArrayBuffer(8) });
    if (u.includes("en.wikipedia.org")) {
      return json({ query: { pages: { 1: { title: cfg.title ?? "Erling Haaland", description: cfg.description ?? "Norwegian footballer (born 2000)", pageimage: "pageimage" in cfg ? cfg.pageimage : "Erling_Haaland_2023.jpg", index: 1 } } } });
    }
    if (u.includes("commons.wikimedia.org")) {
      return json({ query: { pages: { 9: { imageinfo: [{ url: "https://upload.wikimedia.org/o.jpg", thumburl: "https://upload.wikimedia.org/t.jpg", width: cfg.width ?? 3000, height: 4000, descriptionurl: "https://commons.wikimedia.org/wiki/File:Erling_Haaland_2023.jpg", extmetadata: { LicenseShortName: { value: cfg.license ?? "CC BY-SA 4.0" }, Artist: { value: '<a href="x">Jane <b>Doe</b></a>' }, LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" }, ...(cfg.nonfree ? { NonFree: { value: "true" } } : {}) } }] } } } });
    }
    return cfg.imgOk === false ? { ok: false, status: 404 } : { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("JPEGDATA").buffer };
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("personCandidates", () => {
  it("names from the title/first sentence; clubs, months and competitions excluded", () => {
    expect(personCandidates(note, teams)).toEqual(["Erling Haaland"]);
    expect(personCandidates({ title: "Raphinha stays at Barcelona until 2030", body: "The Brazil winger signed in November." }, ["FC Barcelona"])).toEqual(["Raphinha"]);
    expect(personCandidates({ title: "Premier League: Arsenal beat Tottenham 2-1", body: "A late goal in January." }, ["Arsenal", "Tottenham Hotspur"])).toEqual([]);
    expect(personCandidates({ title: "Kevin De Bruyne ruled out for a month", body: "x" }, [])).toEqual(["Kevin De Bruyne"]);
  });
});

describe("photoRef — Wikimedia lead image with licence, size and name checks", () => {
  const dir = () => mkdtempSync(join(tmpdir(), "photo-"));
  it("hit: file saved, author/licence/URL kept, credit JSON next to it, person = the article's name", async () => {
    const d = dir(); const m = mockFetch();
    const r = await photoRef(note, teams, { dir: d, fetch: m.f });
    expect(r).toMatchObject({ person: "Erling Haaland", license: "CC BY-SA 4.0", author: "Jane Doe", url: "https://commons.wikimedia.org/wiki/File:Erling_Haaland_2023.jpg", width: 3000 });
    expect(readFileSync(r!.file, "utf8")).toBe("JPEGDATA");
    expect(existsSync(r!.file.replace(/\.jpg$/, ".json"))).toBe(true);
  });
  it("cache: the second call makes no network request", async () => {
    const d = dir(); const m = mockFetch();
    await photoRef(note, teams, { dir: d, fetch: m.f });
    const n = m.calls.length; const m2 = mockFetch();
    const r = await photoRef(note, teams, { dir: d, fetch: m2.f });
    expect(r?.person).toBe("Erling Haaland"); expect(m2.calls.length).toBe(0); expect(n).toBeGreaterThan(0);
  });
  it.each([
    ["non-free licence", { license: "Fair use" }],
    ["NC licence", { license: "CC BY-NC 4.0" }],
    ["too small (<1000 px)", { width: 800 }],
    ["flagged NonFree", { nonfree: true }],
    ["not a sportsperson (description)", { description: "Norwegian politician" }],
    ["a different person (title mismatch)", { title: "Haaland (surname)" }],
    ["article without a lead image", { pageimage: undefined }],
    ["image download fails", { imgOk: false }],
  ] as [string, Cfg][])("no photo, no invention: %s", async (_n, cfg) => {
    const r = await photoRef(note, teams, { dir: dir(), fetch: mockFetch(cfg).f });
    expect(r).toBeNull();
  });
  it("accepts CC0 / public domain / CC BY; network error → null (never throws)", async () => {
    for (const license of ["CC0", "Public domain", "CC BY 2.0", "CC BY-SA 3.0"]) expect(await photoRef(note, teams, { dir: dir(), fetch: mockFetch({ license }).f })).not.toBeNull();
    expect(await photoRef(note, teams, { dir: dir(), fetch: (async () => { throw new Error("offline"); }) as unknown as typeof fetch })).toBeNull();
  });
});

describe("cardJobWithPhoto", () => {
  const c = pickCard("abc123", sceneKind(note), cardText(note), "deep red", "Manchester City", []);
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
  it("emma + photo: photo is reference image 1 (before crests), person named from the article, credit attached", async () => {
    const d = mkdtempSync(join(tmpdir(), "pj-"));
    const j = await cardJobWithPhoto(c, note, teams, env({ NEWS_IMAGE_STYLE: "emma", NEWS_WATCHER_PHOTO_DIR: d, NEWS_WATCHER_PUBLIC_DIR: join(__dirname, "../../../public") }), { fetch: mockFetch().f });
    expect(j.refs![0]).toBe(j.credit!.file); expect(j.prompt).toMatch(/Reference image 1 is a real photo of Erling Haaland/);
    expect(j.credit).toMatchObject({ license: "CC BY-SA 4.0", author: "Jane Doe" }); expect(j.hfPrompt).not.toMatch(/Reference image/);
  });
  it("emma, nothing found → same as cardJob: generic scene, no name, no photo ref", async () => {
    const j = await cardJobWithPhoto(c, note, teams, env({ NEWS_IMAGE_STYLE: "emma", NEWS_WATCHER_PHOTO_DIR: mkdtempSync(join(tmpdir(), "pj-")) }), { fetch: mockFetch({ description: "Norwegian politician" }).f });
    expect(j.credit).toBeUndefined(); expect(j.prompt).not.toMatch(/real photo of/); expect(j.prompt).toMatch(/anonymous/);
  });
  it("legacy: no network at all, identical to cardJob", async () => {
    const m = mockFetch();
    const j = await cardJobWithPhoto(c, note, teams, env({}), { fetch: m.f });
    expect(m.calls.length).toBe(0); expect(j.refs).toBeUndefined(); expect(j.prompt).not.toMatch(/4:5/);
  });
});

describe.skipIf(!process.env.PHOTO_LIVE)("LIVE Wikimedia (PHOTO_LIVE=1)", () => {
  it("a well-known player resolves to a real, licensed photo", async () => {
    const r = await photoRef({ title: "Haaland scores twice", body: "Erling Haaland scored twice for Manchester City." }, ["Manchester City"], { dir: mkdtempSync(join(tmpdir(), "photo-live-")) });
    console.log("[photo-live]", JSON.stringify({ person: r?.person, license: r?.license, author: r?.author, url: r?.url, width: r?.width, height: r?.height }));
    expect(r).not.toBeNull();
  }, 60_000);
});
