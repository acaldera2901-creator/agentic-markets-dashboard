#!/bin/bash
# Bonifica plist #015-B+E — idempotente: ricarica solo i job il cui stdio non è
# ancora su ~/Library/Logs. Pausa dopo bootout: è asincrono, un bootstrap
# immediato becca il vecchio processo in uscita e fallisce con EIO (visto live
# 2026-06-05). Rollback: ~/Desktop/sistema-andrea/backups/2026-06-05-plist-bonifica/
set -e
cd "$(dirname "$0")/.."

cp ops/plist-staging/*.plist ~/Library/LaunchAgents/

for j in com.agentic-markets.agents com.agenticmarkets.council-chat-bridge com.agenticmarkets.telegram-llm-council; do
  if launchctl print "gui/$(id -u)/$j" 2>/dev/null | grep -q "stdout path = /Users/$USER/Library/Logs"; then
    echo "$j: già migrato, skip"
    continue
  fi
  launchctl bootout "gui/$(id -u)/$j" 2>/dev/null || true
  sleep 3
  launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/"$j".plist
  echo "$j: reloaded"
done

sleep 5
echo "--- stato job ---"
launchctl list | grep agentic
