#!/bin/bash
# Verifica post-attivazione #FRIENDLY-1 (da lanciare ~15 min dopo il kickstart).
# Controlla: agent vivo, fixture FRIENDLY pubblicate, righe friendly_model scritte.
set -uo pipefail
cd "$(dirname "$0")/.."

LOG=/Users/calde/Library/Logs/agentic-markets/agents.err.log
PASS=0; FAIL=0
ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko()   { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo "── 1. Agent in esecuzione"
PID=$(launchctl list | awk '/com.agentic-markets.agents/{print $1}')
[[ "$PID" =~ ^[0-9]+$ ]] && ok "agent attivo (PID $PID)" || ko "agent non in esecuzione"

echo "── 2. Collector pubblica FRIENDLY (log ultimi 30 min)"
RECENT=$(find "$LOG" -mmin -30 2>/dev/null)
if grep -q "published .* fixtures for FRIENDLY" "$LOG" 2>/dev/null; then
  ok "$(grep "published .* fixtures for FRIENDLY" "$LOG" | tail -1 | sed 's/.*\[/[/')"
else
  ko "nessun 'published ... for FRIENDLY' nel log${RECENT:+ (log recente presente)}"
fi

echo "── 3. ModelAgent scrive righe friendly"
if grep -q "FRIENDLY row written" "$LOG" 2>/dev/null; then
  ok "$(grep -c "FRIENDLY row written" "$LOG") righe scritte — ultima: $(grep "FRIENDLY row written" "$LOG" | tail -1 | sed 's/.*FRIENDLY row/FRIENDLY row/')"
else
  ko "nessun 'FRIENDLY row written' nel log"
fi

echo "── 4. Righe friendly_model su Supabase (sempre paper, mai signal)"
URL=$(grep "^SUPABASE_URL" .env | cut -d= -f2)
KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY" .env | cut -d= -f2)
if [[ -n "$URL" && -n "$KEY" ]]; then
  ROWS=$(curl -s "$URL/rest/v1/unified_predictions?source_table=eq.friendly_model&select=signal_type,is_paper,competition" \
        -H "apikey: $KEY" -H "authorization: Bearer $KEY")
  N=$(echo "$ROWS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
  BAD=$(echo "$ROWS" | python3 -c "import json,sys; rows=json.load(sys.stdin); print(sum(1 for r in rows if r.get('signal_type')!='paper' or not r.get('is_paper')))" 2>/dev/null || echo "?")
  [[ "$N" -gt 0 ]] && ok "$N righe friendly_model in unified_predictions" || ko "0 righe friendly_model"
  [[ "$BAD" == "0" ]] && ok "tutte paper (invariante v1 rispettata)" || ko "$BAD righe NON paper — INVARIANTE VIOLATA"
else
  ko ".env senza credenziali Supabase"
fi

echo "── 5. Heartbeat WC non clobberato (readiness ancora presente)"
if grep -q "World Cup monitor:" "$LOG" 2>/dev/null; then
  ok "$(grep "World Cup monitor:" "$LOG" | tail -1 | sed 's/.*World Cup/World Cup/')"
else
  ko "nessun ciclo WC nel log"
fi

echo
echo "RISULTATO: $PASS ok, $FAIL falliti"
[[ $FAIL -eq 0 ]] && echo "→ #FRIENDLY-1 OPERATIVO. Dopo i match di stasera ricontrolla: grep 'unified settled' \$LOG | grep Friendly" || echo "→ indagare i punti falliti prima di dichiarare operativo"
exit $FAIL
