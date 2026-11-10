#!/usr/bin/env bash
# sync-photo-manifest.sh — mirrors the social desk's real-photo manifest into the watcher's own folder (a LaunchAgent cannot read ~/Desktop).
# Copies manifest.json + the photo files of the entries with status "ready" to <watcher home>/photos/manifest/ (idempotent, never deletes).
# Usage: sync-photo-manifest.sh [SRC_DIR]   ·   DRY=1 only lists
set -euo pipefail
SRC="${1:-$HOME/Desktop/01-BETREDGE/ufficio-maven/drafts/social/real-photos-news}"
DEST="${NEWS_WATCHER_HOME:-$HOME/Library/Application Support/news-watcher}/photos/manifest"
[ -f "$SRC/manifest.json" ] || { echo "manca $SRC/manifest.json" >&2; exit 1; }
run() { if [ "${DRY:-0}" = "1" ]; then echo "[dry] $*"; else "$@"; fi; }
run mkdir -p "$DEST"
node -e '
const fs=require("fs"),path=require("path");
const [src,dest,dry]=process.argv.slice(1);
const m=JSON.parse(fs.readFileSync(path.join(src,"manifest.json"),"utf8"));
let n=0;
for(const e of m){ if(e.status!=="ready"||!e.file)continue;
  const from=fs.existsSync(e.file)?e.file:path.join(src,path.basename(e.file));
  if(!fs.existsSync(from)){console.error("file mancante:",e.person);continue}
  const to=path.join(dest,path.basename(from)); n++;
  if(dry==="1")console.log("[dry] cp",from,"->",to); else fs.copyFileSync(from,to);
}
if(dry!=="1")fs.copyFileSync(path.join(src,"manifest.json"),path.join(dest,"manifest.json"));
console.log((dry==="1"?"[dry] ":"")+"ready: "+n+" foto, manifest.json -> "+dest);
' "$SRC" "$DEST" "${DRY:-0}"
