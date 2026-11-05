// lib/v3c/news/photo-kit.test.ts (G5) — national-team shirt on a club note: visual pre-check of the photo (dropped → anonymous scene),
// «Note type: club» + the shirt rule in the emma checker, no mood check on a real photo. Fake `claude` scripts, no network, no codex.
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cardJobWithPhoto } from "./card-job";
import { cardText, pickCard } from "./card";
import { sceneKind } from "./image";
import { IMAGE_CHECK_PROMPT_EMMA } from "./image";
import { checkImage } from "./image-gen";
import { kitIsNational } from "./photo-kit";

const dir = () => mkdtempSync(join(tmpdir(), "kit-"));
function fakeClaude(d: string, json: string): string {
  const p = join(d, "claude");
  writeFileSync(p, `#!/bin/sh\ncat > "$(dirname "$0")/stdin.txt"\necho '${json}'\n`);
  chmodSync(p, 0o755);
  return p;
}
const env = (d: string) => ({ NEWS_IMAGE_STYLE: "emma", NEWS_WATCHER_PHOTO_DIR: join(d, "photos"), NEWS_WATCHER_PUBLIC_DIR: join(__dirname, "../../../public") }) as unknown as NodeJS.ProcessEnv;

const note = { title: "Kovac wanted to avoid risk over Guirassy injury", body: "Serhou Guirassy left the field." };
const teams = ["Borussia Dortmund"];
const spec = () => pickCard("abc123", sceneKind(note), cardText(note), null, "Borussia Dortmund", []);

// photoRef is real code; its network is a mock of Wikipedia + Commons giving a neutral-named file (the name does not betray the Guinea shirt)
const wiki = (async (url: string) => {
  const u = String(url);
  const json = (o: unknown) => ({ ok: true, status: 200, json: async () => o });
  if (u.includes("en.wikipedia.org")) return json({ query: { pages: { 1: { title: "Serhou Guirassy", description: "Guinean footballer", pageimage: "Serhou_Guirassy_2024_(cropped).jpg", index: 1 } } } });
  if (u.includes("commons.wikimedia.org")) return json({ query: { pages: { 9: { imageinfo: [{ url: "https://u/o.jpg", thumburl: "https://u/t.jpg", width: 3000, height: 4000, descriptionurl: "https://commons.wikimedia.org/wiki/File:Serhou_Guirassy_2024_(cropped).jpg", extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, Artist: { value: "X" }, Categories: { value: "" } } }] } } } });
  return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("JPG").buffer };
}) as unknown as typeof fetch;

describe("kitIsNational (fake claude)", () => {
  it("true / false from the structured output; garbage or error → null", async () => {
    const d = dir(); const f = join(d, "p.jpg"); writeFileSync(f, "x");
    expect(await kitIsNational(f, { claudeBin: fakeClaude(d, '{"result":"","structured_output":{"national_team_kit":true,"evidence":"Guinea crest"}}') })).toBe(true);
    expect(await kitIsNational(f, { claudeBin: fakeClaude(d, '{"result":"","structured_output":{"national_team_kit":false,"evidence":"club kit"}}') })).toBe(false);
    expect(await kitIsNational(f, { claudeBin: fakeClaude(d, "not json") })).toBeNull();
    expect(readFileSync(join(d, "stdin.txt"), "utf8")).toContain("p.jpg");
  });
});

describe("cardJobWithPhoto on a club note (Guirassy, Dortmund)", () => {
  it("national-team shirt seen → photo dropped: no photo ref, no credit, anonymous scene, club note flagged", async () => {
    const d = dir(); const logs: string[] = [];
    const j = await cardJobWithPhoto(spec(), note, teams, env(d), { fetch: wiki, kitCheck: async () => true, log: (m) => logs.push(m) });
    expect(j.credit).toBeUndefined();
    expect(j.refs?.some((r) => /\.jpg$/.test(r)) ?? false).toBe(false);
    expect(j.clubNote).toBe(true);
    expect(j.prompt).toMatch(/anonymous/);
    expect(logs.join(" ")).toMatch(/national-team shirt/);
  });
  it("kit check unavailable (null) → photo dropped too (never a doubtful kit)", async () => {
    const j = await cardJobWithPhoto(spec(), note, teams, env(dir()), { fetch: wiki, kitCheck: async () => null });
    expect(j.credit).toBeUndefined();
  });
  it("club kit / no marks → photo kept as reference 1 with its credit", async () => {
    const j = await cardJobWithPhoto(spec(), note, teams, env(dir()), { fetch: wiki, kitCheck: async () => false });
    expect(j.credit?.person).toBe("Serhou Guirassy");
    expect(j.refs?.[0]).toMatch(/\.jpg$/);
    expect(j.prompt).toMatch(/keep the person's expression exactly as in the photo/);
    expect(j.prompt).not.toMatch(/mood:/);
  });
  it("the kit check is cached next to the photo: the second job does not ask again", async () => {
    const d = dir(); const bin = fakeClaude(d, '{"result":"","structured_output":{"national_team_kit":false,"evidence":"club"}}');
    const e = { ...env(d), NEWS_WATCHER_CLAUDE: bin } as NodeJS.ProcessEnv;
    await cardJobWithPhoto(spec(), note, teams, e, { fetch: wiki });
    writeFileSync(bin, "#!/bin/sh\nexit 1\n"); // would fail if asked again
    const j = await cardJobWithPhoto(spec(), note, teams, e, { fetch: wiki });
    expect(j.credit?.person).toBe("Serhou Guirassy");
  });
});

describe("emma checker", () => {
  it("prompt carries the national-shirt rule only for “Note type: club”; the message says it", async () => {
    expect(IMAGE_CHECK_PROMPT_EMMA).toMatch(/Note type: club[\s\S]*NATIONAL team/);
    const d = dir(); const png = join(d, "c.png"); writeFileSync(png, "x");
    const seen = vi.fn();
    const bin = join(d, "claude");
    writeFileSync(bin, `#!/bin/sh\ncat > "${d}/msg.txt"\necho '{"result":"","structured_output":{"ok":true,"problems":[],"text_seen":"NEWS"}}'\n`); chmodSync(bin, 0o755);
    const r = await checkImage(png, "NEWS", { claudeBin: bin }, undefined, true, true);
    expect(r.ok).toBe(true); seen();
    expect(readFileSync(join(d, "msg.txt"), "utf8")).toContain("Note type: club");
    await checkImage(png, "NEWS", { claudeBin: bin }, undefined, true, false);
    expect(readFileSync(join(d, "msg.txt"), "utf8")).not.toContain("Note type: club");
  });
});

describe("mood on real photos (calde risk 1)", () => {
  it("the mood stays in the message with the real-photo rule: refuse only smile/celebration on defeat, exit, injury", async () => {
    const d = dir(); const png = join(d, "c.png"); writeFileSync(png, "x");
    const bin = join(d, "claude");
    writeFileSync(bin, `#!/bin/sh\ncat > "${d}/msg.txt"\necho '{"result":"","structured_output":{"ok":true,"problems":[],"text_seen":"NEWS"}}'\n`); chmodSync(bin, 0o755);
    await checkImage(png, "NEWS", { claudeBin: bin }, "calm and focused", true, true, true);
    const m = readFileSync(join(d, "msg.txt"), "utf8");
    expect(m).toContain("Mood of the note: calm and focused");
    expect(m).toMatch(/REAL photo[\s\S]*ONLY a smile, raised arms or celebration[\s\S]*defeat, an exit or an injury/);
    expect(m).toMatch(/serious, neutral or calm expression is always fine/);
    await checkImage(png, "NEWS", { claudeBin: bin }, "calm and focused", true, true, false); // generated scene: no real-photo line
    expect(readFileSync(join(d, "msg.txt"), "utf8")).not.toContain("REAL photo");
  });
});
