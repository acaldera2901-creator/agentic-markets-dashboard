#!/usr/bin/env bash
# passo7-mode-live.sh — passo 7 (ULTIMO): AFFILIATE_MODE=live + redeploy di produzione
# (una env Vercel vale solo dal deploy successivo). Solo dopo i passi 2-6 verdi.
#   passo7-mode-live.sh --env-file F            # dry-run: precondizioni + valore attuale
#   passo7-mode-live.sh --env-file F --esegui   # imposta live e redeploya il deployment di produzione corrente
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,6p' "$0"; }
du_parse_args "$@"
[ "${#EXTRA_ARGS[@]}" -eq 0 ] || die "argomento sconosciuto: ${EXTRA_ARGS[*]}"
du_init passo7-mode-live "Passo 7 — AFFILIATE_MODE=live" "vercel env update AFFILIATE_MODE production (valore precedente stampato qui sotto, di solito shadow) + vercel redeploy del deployment di produzione, oppure promote del deployment precedente (id stampato qui sotto) dalla dashboard."
du_require_cmd vercel curl psql node
du_need_db

echo "== Precondizioni =="
for s in passo2 passo5 passo6; do du_has_mark "$s" || die "$s non marcato OK in $LOG_DIR: AFFILIATE_MODE=live va per ultimo"; ok "$s: $(cat "$LOG_DIR/$s.ok")"; done
check "termini v3 online" sh -c 'curl -s --max-time 30 "$1" | grep -q "$2"' _ "$SITE_URL/affiliates/terms" "$TERMS_V3"
check "/api/affiliate/me senza sessione → 401" [ "$(du_http_code "$SITE_URL/api/affiliate/me")" = 401 ]
du_db_schema_checks
NAMES="$(du_vercel_env_names)"
check "AFFILIATE_HASH_SECRET assente" sh -c '! printf "%s\n" "$1" | grep -qx AFFILIATE_HASH_SECRET' _ "$NAMES"
PAY="$(du_vercel_env_value AFFILIATE_PAYOUTS)"
check "AFFILIATE_PAYOUTS non live (${PAY:-vuota})" [ "$(printf '%s' "$PAY" | tr '[:upper:]' '[:lower:]')" != live ]
[ "$DU_KO" = 0 ] || die "$DU_KO precondizioni KO"
PREV="$(du_vercel_env_value AFFILIATE_MODE)"
echo "AFFILIATE_MODE attuale: ${PREV:-<vuota o sensitive>} (rollback = rimettere questo valore)"
[ "$PREV" = live ] && { ok "già live"; du_mark passo7 live; exit 0; }
PROD_JSON="$(vercel inspect "${SITE_URL#https://}" --scope "$VERCEL_SCOPE" -F json 2>/dev/null || true)"
PROD_URL="$(printf '%s' "$PROD_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.target==="production"&&j.readyState==="READY"?j.url:"")}catch{}})')"
PROD_ID="$(printf '%s' "$PROD_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).id||"")}catch{}})')"
[ -n "$PROD_URL" ] || die "deployment di produzione corrente non trovato (vercel inspect ${SITE_URL#https://} --scope $VERCEL_SCOPE): redeploy a mano dalla dashboard dopo aver impostato la env"
echo "deployment di produzione attuale: $PROD_URL ($PROD_ID) ← rollback: promote di questo"
echo "Comandi:"
echo "  vercel env update|add AFFILIATE_MODE production  (valore 'live' via stdin)"
echo "  vercel redeploy $PROD_URL --target production --scope $VERCEL_SCOPE"
if [ "$ESEGUI" != 1 ]; then c_grn "DRY-RUN: nessuna modifica."; exit 0; fi
du_confirm "AFFILIATE LIVE"
if printf '%s\n' "$NAMES" | grep -qx AFFILIATE_MODE; then du_vercel_env_set AFFILIATE_MODE live; else du_vercel_env_set AFFILIATE_MODE live --no-sensitive; fi
NOW="$(du_vercel_env_value AFFILIATE_MODE)"
[ "$NOW" = live ] || [ -z "$NOW" ] || die "AFFILIATE_MODE letto «$NOW» dopo l'update"
vercel redeploy "$PROD_URL" --target production --scope "$VERCEL_SCOPE"

echo; echo "== Verifica post-passo =="
NEW_ID="$(vercel inspect "${SITE_URL#https://}" --scope "$VERCEL_SCOPE" -F json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(j.readyState==="READY"?j.id:"")}catch{}})')"
check "produzione servita da un deployment NUOVO ($NEW_ID ≠ $PROD_ID)" sh -c '[ -n "$1" ] && [ "$1" != "$2" ]' _ "$NEW_ID" "$PROD_ID"
check "AFFILIATE_MODE=live (o non leggibile perché sensitive)" sh -c '[ "$1" = live ] || [ -z "$1" ]' _ "$(du_vercel_env_value AFFILIATE_MODE)"
check "termini v3 ancora online" sh -c 'curl -s --max-time 30 "$1" | grep -q "$2"' _ "$SITE_URL/affiliates/terms" "$TERMS_V3"
check "/api/affiliate/me senza sessione → 401" [ "$(du_http_code "$SITE_URL/api/affiliate/me")" = 401 ]
[ "$DU_KO" = 0 ] || die "$DU_KO verifiche KO dopo il live. Rollback: $DU_ROLLBACK (deployment precedente: $PROD_URL)"
du_mark passo7 "live; deployment precedente $PROD_URL ($PROD_ID); valore precedente ${PREV:-vuoto}"
c_grn "Passo 7 OK: AFFILIATE_MODE=live. Prova manuale: /affiliates o /invite loggato → iscrizione aperta; /api/affiliate/me loggato → 200."
