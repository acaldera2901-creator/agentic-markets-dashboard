# news watcher — build, install, knobs

The source is `scripts/news_watcher/main.ts` + `lib/v3c/news/*`. launchd does NOT run the repo:
it runs a single bundled file outside `~/Desktop` (TCC: a LaunchAgent cannot read `~/Desktop`):

    ~/Library/Application Support/news-watcher/news-watcher.mjs

A fix made only in that bundle is lost at the next build. Fix the source, then rebuild.

## Build the bundle (does not install anything)

From a clean worktree on the commit to ship:

    npx esbuild scripts/news_watcher/main.ts --bundle --platform=node --format=esm --target=node20 \
      --outfile=/tmp/news-watcher.mjs --log-level=warning
    node --check /tmp/news-watcher.mjs

The output starts with `// scripts/news_watcher/main.ts`, like the live bundle.

## Install (gated: APPROVE of Andrea)

Replacing the live bundle is a production deploy: PROPOSAL on `ch_deploy_gate`, then
backup (`cp -p news-watcher.mjs news-watcher.mjs.bak-<tag>`), copy, `node news-watcher.mjs --dry-run`,
and only then let launchd run it. Plists: `render-launchd.sh` (renders, installs nothing).

## Environment (in `news-watcher/.env`, never in the plist)

| Variable | Effect |
|---|---|
| `NEWS_WATCHER_IMAGES=1` | one card per written note |
| `NEWS_WATCHER_IMAGE_PUBLISH=supabase` | upload cards + `news_items.image_url` |
| `NEWS_IMAGE_STYLE=emma` | the emma template (real photo + crests as reference images); falls back to legacy if a local asset is missing (`lib/v3c/news/assets.ts`) |
| `NEWS_WATCHER_GPTIMG` | the plain generator (default `~/.local/bin/gptimg`) |
| `NEWS_WATCHER_GPTIMG_REF` | the generator **with reference images** used by emma (default `<home>/assets/gptimg-ref.sh`). Any executable taking `-i <ref>… <prompt> <out.png>`. When Codex is out of credits, point it to a wrapper that falls back to Higgsfield *with the references* (calde 06/11, img-ref wrapper): the built-in Higgsfield fallback in `image-gen.ts` takes no references, so emma cards built on a real photo otherwise wait for Codex. No code change needed to switch. |
| `NEWS_WATCHER_ASSETS` / `NEWS_WATCHER_COMPOSE_LOGO` / `NEWS_WATCHER_LOGO` / `NEWS_WATCHER_PUBLIC_DIR` | emma local files (`lib/v3c/news/assets.ts`) |

## Reliability rules (06/11)

- Story dedup before the paid rewrite: `lib/v3c/news/story.ts` (same match from two sources, or near-identical title, within 36 h).
- Card look-alike check: dHash threshold 16/64 for emma (fixed template), 24 for legacy (`DHASH8_MAX_EMMA`, `DHASH8_MAX` in `card.ts`).
- A card is given up after the same check fails twice in a row, and a given-up card is never generated again (`watcher.ts`).
