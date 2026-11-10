// The social desk's manifest as a photo source: exact guid, status "ready", credit from the manifest, guard unchanged.
import { describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { manifestPhoto } from "./photo-manifest";
import { cardJobWithPhoto } from "./card-job";
import { pickCard, cardText, cardTint } from "./card";
import { protagonist, protagonistTint, sceneKind } from "./image";

const G = "a054227db8f60d6d198eb2b9de2890e8e18c40eb645dfb325b4e75f8bbbbc250";
function setup(entries: object[], withFile = true) {
  const d = mkdtempSync(join(tmpdir(), "pman-"));
  const jpg = join(d, "marco-rose.jpg");
  if (withFile) writeFileSync(jpg, "JPG");
  const mf = join(d, "manifest.json");
  writeFileSync(mf, JSON.stringify(entries.map((e) => ({ file: jpg, ...e }))));
  return { d, jpg, env: { NEWS_WATCHER_PHOTO_MANIFEST: mf, NEWS_IMAGE_STYLE: "emma", NEWS_WATCHER_PHOTO_DIR: join(d, "photos"), NEWS_WATCHER_PUBLIC_DIR: join(d, "public") } as unknown as NodeJS.ProcessEnv };
}
const ready = { guid: G, person: "Marco Rose", author: "Steffen Prößdorf", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", url: "https://commons.wikimedia.org/wiki/File:x.jpg", width: 2793, height: 2153, status: "ready" };

describe("manifestPhoto", () => {
  it("ready + file + full credit → PhotoRef with the manifest's licence and author", () => {
    const { env, jpg } = setup([ready]);
    expect(manifestPhoto(G, env)).toMatchObject({ person: "Marco Rose", file: jpg, author: "Steffen Prößdorf", license: "CC BY-SA 4.0", url: ready.url });
  });
  it("other guid / no hash / other status → null", () => {
    const { env } = setup([ready, { ...ready, guid: "f".repeat(64), status: "blocked_no_valid_asset" }]);
    expect(manifestPhoto("0".repeat(64), env)).toBeNull();
    expect(manifestPhoto(undefined, env)).toBeNull();
    for (const status of ["ready_lowres", "candidate_weak", "pending", "ready_download_pending", "blocked_no_valid_asset"]) expect(manifestPhoto(G, setup([{ ...ready, status }]).env)).toBeNull();
  });
  it("missing file, or incomplete credit (author/licence/url) → null: no credit, no photo", () => {
    expect(manifestPhoto(G, setup([ready], false).env)).toBeNull();
    for (const k of ["person", "author", "license", "url"]) expect(manifestPhoto(G, setup([{ ...ready, [k]: "" }]).env)).toBeNull();
  });
  it("a path that does not exist is looked up by basename next to the manifest (LaunchAgent mirror)", () => {
    const d = mkdtempSync(join(tmpdir(), "pman-"));
    mkdirSync(join(d, "m"));
    writeFileSync(join(d, "m", "marco-rose.jpg"), "JPG");
    writeFileSync(join(d, "m", "manifest.json"), JSON.stringify([{ ...ready, file: "/Users/someone/Desktop/x/marco-rose.jpg" }]));
    expect(manifestPhoto(G, { NEWS_WATCHER_PHOTO_MANIFEST: join(d, "m", "manifest.json") } as unknown as NodeJS.ProcessEnv)?.file).toBe(join(d, "m", "marco-rose.jpg"));
  });
  it("no manifest / broken JSON → null, never throws", () => {
    expect(manifestPhoto(G, { NEWS_WATCHER_PHOTO_MANIFEST: join(tmpdir(), "nope.json") } as unknown as NodeJS.ProcessEnv)).toBeNull();
    const d = mkdtempSync(join(tmpdir(), "pman-")); writeFileSync(join(d, "m.json"), "{oops");
    expect(manifestPhoto(G, { NEWS_WATCHER_PHOTO_MANIFEST: join(d, "m.json") } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("cardJobWithPhoto with the manifest", () => {
  const note = { title: "Bournemouth come from behind to beat Sparta Prague", body: "Bournemouth won 3-1 in Prague." };
  const spec = () => pickCard("a054227db8f60d6d", sceneKind(note), cardText(note), cardTint(protagonistTint(note, ["AFC Bournemouth"]), "a054227db8f60d6d"), protagonist(note, ["AFC Bournemouth"]), [], false);
  it("the manifest photo wins: credit from the manifest, photo first in refs, no Wikimedia call, no kit check", async () => {
    const { env, jpg } = setup([ready]);
    const fetchMock = vi.fn(async () => { throw new Error("no network expected"); });
    const kit = vi.fn(async () => true);
    const job = await cardJobWithPhoto(spec(), note, ["AFC Bournemouth"], env, { fetch: fetchMock as unknown as typeof fetch, kitCheck: kit, hash: G });
    expect(job.credit).toMatchObject({ person: "Marco Rose", license: "CC BY-SA 4.0", author: "Steffen Prößdorf" });
    expect(job.refs?.[0]).toBe(jpg);
    expect(job.prompt).toMatch(/Marco Rose/);
    expect(fetchMock).not.toHaveBeenCalled(); expect(kit).not.toHaveBeenCalled();
  });
  it("GUARD unchanged: no manifest entry for this hash and no Wikimedia photo → no credit (the watcher then does not make the card)", async () => {
    const { env } = setup([ready]);
    const offline = vi.fn(async () => { throw new Error("offline"); });
    const job = await cardJobWithPhoto(spec(), note, ["AFC Bournemouth"], env, { fetch: offline as unknown as typeof fetch, hash: "e".repeat(64) });
    expect(job.credit).toBeUndefined();
  });
});
