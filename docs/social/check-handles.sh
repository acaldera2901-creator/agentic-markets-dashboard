#!/bin/bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
OUT=/private/tmp/claude-501/-Users-calde/30016381-4ce5-4f88-8f85-6c3871b67538/scratchpad/raw
mkdir -p "$OUT"

echo "=============== DISCORD (API pubblica, verdetto esatto) ==============="
for c in betredge betr-edge betredgeai zzqx7nope99; do
  body=$(curl -s -A "$UA" --max-time 20 "https://discord.com/api/v10/invites/$c")
  echo "discord.gg/$c => $(echo "$body" | head -c 220)"
  echo "---"
done

echo "=============== YOUTUBE (segue redirect, cerca marker) ==============="
for h in betredge betredgeai betredgeofficial zzqx7betredgenope99; do
  f="$OUT/yt_$h.html"
  curl -sL -A "$UA" --max-time 25 -H "Accept-Language: en-US,en;q=0.9" "https://www.youtube.com/@$h" -o "$f"
  size=$(wc -c < "$f")
  notfound=$(grep -c "404 Not Found\|does not exist\|not available" "$f")
  title=$(grep -o '<title>[^<]*</title>' "$f" | head -1)
  subs=$(grep -o '"subscriberCountText":{"simpleText":"[^"]*"' "$f" | head -1)
  echo "yt @$h => bytes=$size notfound_markers=$notfound $title $subs"
done

echo "=============== TIKTOK (segue redirect, cerca marker) ==============="
for h in betredge betr.edge betredgeai zzqx7betredgenope99; do
  f="$OUT/tt_$h.html"
  curl -sL -A "$UA" --max-time 25 -H "Accept-Language: en-US,en;q=0.9" "https://www.tiktok.com/@$h" -o "$f"
  size=$(wc -c < "$f")
  title=$(grep -o '<title[^>]*>[^<]*</title>' "$f" | head -1)
  st=$(grep -o '"statusCode":[0-9]*' "$f" | head -3 | tr '\n' ' ')
  uid=$(grep -o '"uniqueId":"[^"]*"' "$f" | head -1)
  followers=$(grep -o '"followerCount":[0-9]*' "$f" | head -1)
  echo "tt @$h => bytes=$size status=[$st] $uid $followers $title"
done
