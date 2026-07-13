#!/bin/bash
# weekly-pick-morning-check.sh — #WEEKLY-PICK-3 (richiesta Andrea 2026-07-13)
# Task del lunedì mattina: assicura che la multipla della settimana sia LIVE.
# Gira via LaunchAgent com.agentic-markets.weeklypick-morning:
#   - RunAtLoad (appena si accende/logga il Mac) + lun 08:00 (coalescente al wake).
# Comportamento:
#   - weekly pick della settimana corrente disponibile -> esce in silenzio.
#   - mancante + secret presente in ~/.config/agentic-markets/cron-secret ->
#     triggera /api/weekly-pick/generate e ricontrolla.
#   - mancante senza secret -> notifica macOS con le istruzioni.
# Nessun secret nel repo: il file locale (chmod 600) lo crea Andrea se vuole
# il trigger automatico; senza, la task resta un check+notifica.
set -u
API="https://www.betredge.com/api/weekly-pick"
GEN="https://www.betredge.com/api/weekly-pick/generate"
SECRET_FILE="$HOME/.config/agentic-markets/cron-secret"
LOG="$HOME/.local/state/weekly-pick-check.log"
mkdir -p "$(dirname "$LOG")"

notify() { /usr/bin/osascript -e "display notification \"$1\" with title \"BetRedge · Weekly Pick\"" 2>/dev/null; }
log() { echo "[$(date '+%F %T')] $1" >> "$LOG"; }

available() {
  curl -s --max-time 20 "$API" | grep -q '"available":true'
}

if available; then
  log "ok: weekly pick disponibile"
  exit 0
fi

log "weekly pick MANCANTE per la settimana corrente"

if [ -f "$SECRET_FILE" ]; then
  SECRET=$(cat "$SECRET_FILE" | tr -d '[:space:]')
  if [ -n "$SECRET" ]; then
    RES=$(curl -s --max-time 45 -H "Authorization: Bearer $SECRET" "$GEN")
    log "trigger generate -> $RES"
    sleep 3
    if available; then
      notify "Multipla generata ora automaticamente ✓"
      log "ok: generata via trigger"
      exit 0
    fi
    notify "Trigger eseguito ma multipla ancora assente: $RES"
    exit 1
  fi
fi

notify "Multipla della settimana MANCANTE. Triggera dal dashboard Vercel (cron weekly-pick/generate) o metti CRON_SECRET in ~/.config/agentic-markets/cron-secret per l'auto-trigger."
exit 1
