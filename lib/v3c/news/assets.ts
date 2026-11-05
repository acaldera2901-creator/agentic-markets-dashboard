// lib/v3c/news/assets.ts — where the «emma» pipeline finds its local files. The live watcher runs from
// ~/Library/Application Support/news-watcher (no repo, no ~/Desktop: LaunchAgents can't read it), so everything is configurable:
//   NEWS_WATCHER_GPTIMG_REF · NEWS_WATCHER_COMPOSE_LOGO · NEWS_WATCHER_LOGO · NEWS_WATCHER_PUBLIC_DIR   (one file/dir each)
//   NEWS_WATCHER_ASSETS  = a folder laid out like drafts/tommy/news-style/install-assets.sh builds it:
//        gptimg-ref.sh · compose-logo.py · public/logos/betredge-logo-white.png · public/crests/football/*.webp
//   NEWS_WATCHER_REPO / cwd  = the repo checkout (dev, tests).
// Precedence per file: its own variable > the ASSETS folder > the repo. Pure (no disk access): callers check existence.
import { existsSync } from "node:fs";
import { join } from "node:path";

export type StyleCheck = { requested: string; effective: "legacy" | "emma"; missing: string[] };

/**
 * Start-up check: NEWS_IMAGE_STYLE=emma with a missing local file falls back to legacy (the live cards keep coming) and says why.
 * Needs: gptimg-ref.sh, compose-logo.py, the logo png, the crests folder. (Photo/crest misses are per-card and degrade by themselves.)
 */
export function resolveImageStyle(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = existsSync): StyleCheck {
  const requested = (env.NEWS_IMAGE_STYLE ?? "").trim() || "legacy";
  if (requested.toLowerCase() !== "emma") return { requested, effective: "legacy", missing: [] };
  const p = assetPaths(env);
  const missing = ([["gptimg-ref", p.gptimgRef], ["compose-logo", p.composeScript], ["logo", p.logoPng], ["crests", join(p.publicDir, "crests", "football")]] as const).filter(([, f]) => !exists(f)).map(([n, f]) => `${n}: ${f}`);
  return { requested, effective: missing.length ? "legacy" : "emma", missing };
}

export type AssetPaths = { gptimgRef: string; composeScript: string; logoPng: string; publicDir: string };

export function assetPaths(env: NodeJS.ProcessEnv = process.env): AssetPaths {
  const a = env.NEWS_WATCHER_ASSETS;
  const repo = env.NEWS_WATCHER_REPO || process.cwd();
  const from = (own: string | undefined, inAssets: string, inRepo: string) => own || (a ? join(a, inAssets) : join(repo, inRepo));
  return {
    gptimgRef: from(env.NEWS_WATCHER_GPTIMG_REF, "gptimg-ref.sh", "scripts/news/gptimg-ref.sh"),
    composeScript: from(env.NEWS_WATCHER_COMPOSE_LOGO, "compose-logo.py", "lib/v3c/news/compose-logo.py"),
    logoPng: from(env.NEWS_WATCHER_LOGO, "public/logos/betredge-logo-white.png", "public/logos/betredge-logo-white.png"),
    publicDir: from(env.NEWS_WATCHER_PUBLIC_DIR, "public", "public"),
  };
}
