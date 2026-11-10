// G1/G2: where the emma pipeline finds gptimg-ref, the logo, compose-logo.py and the crests (live = outside ~/Desktop).
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { assetPaths } from "./assets";
import { cardJob } from "./card-job";
import { defaultLogo, genCommand } from "./image-gen";
import { cardText, pickCard } from "./card";
import { sceneKind } from "./image";

const REPO = resolve(__dirname, "../../..");
const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe("assetPaths — precedence: own variable > NEWS_WATCHER_ASSETS > repo", () => {
  it("repo (cwd / NEWS_WATCHER_REPO) by default", () => {
    const p = assetPaths(env({ NEWS_WATCHER_REPO: "/r" }));
    expect(p).toEqual({ gptimgRef: "/r/scripts/news/gptimg-ref.sh", composeScript: "/r/lib/v3c/news/compose-logo.py", logoPng: "/r/public/logos/betredge-logo-white.png", publicDir: "/r/public" });
  });
  it("ASSETS folder wins over the repo", () => {
    const p = assetPaths(env({ NEWS_WATCHER_REPO: "/r", NEWS_WATCHER_ASSETS: "/a" }));
    expect(p).toEqual({ gptimgRef: "/a/gptimg-ref.sh", composeScript: "/a/compose-logo.py", logoPng: "/a/public/logos/betredge-logo-white.png", publicDir: "/a/public" });
  });
  it("G1: NEWS_WATCHER_GPTIMG_REF (and each other variable) wins over everything", () => {
    const p = assetPaths(env({ NEWS_WATCHER_ASSETS: "/a", NEWS_WATCHER_GPTIMG_REF: "/x/ref.sh", NEWS_WATCHER_COMPOSE_LOGO: "/x/c.py", NEWS_WATCHER_LOGO: "/x/l.png", NEWS_WATCHER_PUBLIC_DIR: "/x/pub" }));
    expect(p).toEqual({ gptimgRef: "/x/ref.sh", composeScript: "/x/c.py", logoPng: "/x/l.png", publicDir: "/x/pub" });
  });
  it("the genCommand picks the gptimgRef given by main.ts, not a ~/.local/bin guess", () => {
    expect(genCommand({ gptimg: "/h/.local/bin/gptimg", gptimgRef: "/a/gptimg-ref.sh" }, { prompt: "P", refs: ["/c.png"] }, "/o.png", true)[0]).toBe("/a/gptimg-ref.sh");
  });
});

describe("G2 — an assets folder outside the repo is enough (crests, logo, compose script)", () => {
  const a = mkdtempSync(join(tmpdir(), "assets-"));
  mkdirSync(join(a, "public/logos"), { recursive: true });
  mkdirSync(join(a, "public/crests/football"), { recursive: true });
  writeFileSync(join(a, "public/logos/betredge-logo-white.png"), "x");
  writeFileSync(join(a, "compose-logo.py"), "# x");
  writeFileSync(join(a, "public/crests/football/fc-barcelona.webp"), "x");
  const e = env({ NEWS_WATCHER_ASSETS: a, NEWS_WATCHER_REPO: join(tmpdir(), "no-repo") });
  it("defaultLogo finds logo + script in the folder; missing → null (the card is not made)", () => {
    expect(defaultLogo(e)).toMatchObject({ script: join(a, "compose-logo.py"), png: join(a, "public/logos/betredge-logo-white.png") });
    expect(defaultLogo(env({ NEWS_WATCHER_ASSETS: join(tmpdir(), "empty-assets") }))).toBeNull();
  });
  it("cardJob reads the crests from the folder's public/ (only files that exist)", () => {
    const note = { title: "Barcelona win 2-1", body: "FC Barcelona beat Real Madrid 2-1." };
    const c = pickCard("abc123", sceneKind(note), cardText(note), "deep red", "Barcelona", []);
    const j = cardJob(c, note, ["FC Barcelona"], { ...e, NEWS_IMAGE_STYLE: "emma" } as NodeJS.ProcessEnv);
    expect(j.refs).toEqual([join(a, "public/crests/football/fc-barcelona.webp")]);
  });
});

describe("install-assets.sh (not run for real: DRY=1 only lists) + the live layout", () => {
  const SCRIPT = join(process.env.HOME ?? "", "Desktop/01-BETREDGE/ufficio-maven/drafts/tommy/news-style/install-assets.sh");
  it.skipIf(!existsSync(SCRIPT))("DRY=1 lists the copies into <home>/assets and writes nothing", () => {
    const h = mkdtempSync(join(tmpdir(), "nwhome-"));
    chmodSync(SCRIPT, 0o755);
    const out = execFileSync(SCRIPT, [REPO], { env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DRY: "1", NEWS_WATCHER_HOME: h } as unknown as NodeJS.ProcessEnv }).toString();
    expect(out).toMatch(/\[dry\] cp .*gptimg-ref\.sh/); expect(out).toMatch(/\[dry\] cp .*compose-logo\.py/); expect(out).toMatch(/\[dry\] cp .*betredge-logo-white\.png/); expect(out).toMatch(/\[dry\] cp -n .*crests\/football/);
    expect(existsSync(join(h, "assets"))).toBe(false);
  });
});
