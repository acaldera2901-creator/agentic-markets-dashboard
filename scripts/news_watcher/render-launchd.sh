#!/usr/bin/env bash
# scripts/news_watcher/render-launchd.sh (#NEWSWATCH-2) — renders the three plists of
# the news loop for one interval into <outdir>. It INSTALLS NOTHING: no copy to
# ~/Library/LaunchAgents, no launchctl. Installation is a gated step (PROPOSAL #NEWSWATCH-2).
#
#   scripts/news_watcher/render-launchd.sh 300 /tmp/plists     # 5 min
#   scripts/news_watcher/render-launchd.sh 180 /tmp/plists     # 3 min
set -euo pipefail
INTERVAL="${1:?interval in seconds: 180 or 300}"
OUT="${2:?output directory}"
case "$INTERVAL" in 180|300|600) ;; *) echo "interval must be 180, 300 or 600 (got $INTERVAL)" >&2; exit 2 ;; esac
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
sed "s/__INTERVAL_S__/$INTERVAL/g" "$HERE/com.betredge.news-watcher.plist" > "$OUT/com.betredge.news-watcher.plist"
cp "$HERE/com.betredge.caffeinate.plist" "$HERE/com.betredge.news-sentinel.plist" "$OUT/"
for f in "$OUT"/com.betredge.*.plist; do plutil -lint "$f" >/dev/null; done
grep -q "__INTERVAL_S__" "$OUT/com.betredge.news-watcher.plist" && { echo "placeholder left" >&2; exit 1; }
echo "rendered (interval ${INTERVAL}s, not installed):"
ls -1 "$OUT"/com.betredge.*.plist
