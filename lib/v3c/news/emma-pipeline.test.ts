// Block 2 of the «emma» style: crest lookup from repo files, `-i` reference args, 4:5 crop + local logo + webp weight.
import { describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { crestRefs } from "./emma-assets";
import { genCommand, postProcess } from "./image-gen";
import { EMMA_SIZE } from "./card-emma";
import { MAX_WEBP_BYTES } from "./image";

const REPO = resolve(__dirname, "../../..");
const PUBLIC = join(REPO, "public");

describe("crestRefs — only files that exist, never invented", () => {
  it("Barcelona and Como resolve to real files under public/crests/football", () => {
    const r = crestRefs("Raphinha stays", "Barcelona deal runs to 2030", ["FC Barcelona"], PUBLIC);
    expect(r.length).toBeGreaterThan(0);
    for (const c of r) { expect(c.url).toMatch(/^\/crests\/football\/.+\.webp$/); expect(existsSync(c.file)).toBe(true); }
  });
  it("unknown club / no teams → no crest; max 2; no duplicates", () => {
    expect(crestRefs("Zzz", "Qwerty United of Nowhere FC", ["Nowhere Rovers 1999"], PUBLIC)).toEqual([]);
    const r = crestRefs("Arsenal beat Tottenham 2-1", "Arsenal win the derby 2-1", ["Arsenal", "Tottenham Hotspur", "Chelsea"], PUBLIC);
    expect(r.length).toBeLessThanOrEqual(2);
    expect(new Set(r.map((c) => c.url)).size).toBe(r.length);
  });
  it("a crest whose file is missing is dropped (the 404 case)", () => {
    expect(crestRefs("Barcelona", "Barcelona win", ["FC Barcelona"], join(tmpdir(), "no-such-public"))).toEqual([]);
  });
});

describe("genCommand — reference images as `-i`", () => {
  const o = { gptimg: "/bin/x/gptimg" };
  it("emma + refs → gptimg-ref with one -i per file, prompt and output last", () => {
    const [bin, args] = genCommand(o, { prompt: "P", refs: ["/a/photo.png", "/a/crest.png"] }, "/out.png", true);
    expect(bin).toBe("/bin/x/gptimg-ref.sh");
    expect(args).toEqual(["-i", "/a/photo.png", "-i", "/a/crest.png", "P", "/out.png"]);
  });
  it("legacy, or emma without refs → gptimg -r exactly as before", () => {
    expect(genCommand(o, { prompt: "P", refs: ["/a.png"] }, "/o.png", false)).toEqual(["/bin/x/gptimg", ["-r", "P", "/o.png"]]);
    expect(genCommand(o, { prompt: "P" }, "/o.png", true)).toEqual(["/bin/x/gptimg", ["-r", "P", "/o.png"]]);
  });
  it("gptimg-ref.sh passes each -i as `--image` AFTER the prompt (fake codex records argv)", () => {
    const d = mkdtempSync(join(tmpdir(), "gref-"));
    const fake = join(d, "codex");
    const img = join(d, "home", ".codex", "generated_images", "s1", "x.png");
    mkdirSync(join(d, "home", ".codex", "generated_images", "s1"), { recursive: true });
    writeFileSync(img, "PNG");
    writeFileSync(fake, `#!/bin/bash\nprintf '%s\\n' "$@" > "${d}/argv.txt"\necho "saved ${img}"\n`);
    chmodSync(fake, 0o755);
    const out = join(d, "out.png");
    execFileSync(join(REPO, "scripts/news/gptimg-ref.sh"), ["-i", "/p/photo.png", "-i", "/p/crest.png", "PROMPT TEXT", out], { env: { ...process.env, CODEX_BIN: fake, HOME: join(d, "home") } });
    const argv = readFileSync(join(d, "argv.txt"), "utf8").trim().split("\n");
    const iPrompt = argv.findIndex((a) => a.includes("PROMPT TEXT"));
    expect(iPrompt).toBeGreaterThan(-1);
    expect(argv.slice(iPrompt + 1)).toEqual(["--image", "/p/photo.png", "--image", "/p/crest.png"]);
    expect(readFileSync(out, "utf8")).toBe("PNG");
  });
});

describe("postProcess 4:5 + logo", () => {
  const SAMPLE = join(process.env.HOME ?? "", "Desktop/01-BETREDGE/ufficio-maven/drafts/social/2026-11-05-news-sito-stile/prove-verticali/1-raphinha-contratto-1080x1350.png");
  const logo = { python: "python3", script: join(__dirname, "compose-logo.py"), png: join(PUBLIC, "logos/betredge-logo-white.png") };
  it.skipIf(!existsSync(SAMPLE) || !existsSync("/opt/homebrew/bin/cwebp"))("Emma's sample → 1080x1350 webp ≤150 KB with the logo composed", async () => {
    const out = mkdtempSync(join(tmpdir(), "pp-"));
    const r = await postProcess(SAMPLE, "t", out, "/opt/homebrew/bin/cwebp", EMMA_SIZE, logo);
    if ("error" in r) throw new Error(r.error);
    console.log(`[emma-postprocess] webp ${r.webpBytes} bytes (limit ${MAX_WEBP_BYTES}) → ${r.webp}`);
    expect(r.webpBytes).toBeLessThanOrEqual(MAX_WEBP_BYTES);
    const dims = execFileSync("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", r.png]).toString();
    expect(dims).toMatch(/pixelWidth: 1080/); expect(dims).toMatch(/pixelHeight: 1350/);
    expect(statSync(r.png).size).toBeGreaterThan(0);
  }, 60_000);
});
