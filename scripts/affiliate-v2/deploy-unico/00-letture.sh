#!/usr/bin/env bash
# 00-letture.sh — SOLA LETTURA. Da lanciare per primo (passo 1 della PROPOSAL +
# misura B1). Non scrive nulla: SQL in transazioni READ ONLY, Vercel solo nomi
# (più il valore dei soli flag non segreti), GitHub solo lettura.
#   scripts/affiliate-v2/deploy-unico/00-letture.sh --env-file /percorso/env.privato [--sha <SHA approvato>]
# Exit 0 = VAI (eventualmente con condizioni), 1 = NON VAI.
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,7p' "$0"; }
du_parse_args "$@"
APPROVED_SHA=""
set -- "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
while [ $# -gt 0 ]; do case "$1" in --sha) APPROVED_SHA="${2:-}"; shift;; *) die "argomento sconosciuto: $1";; esac; shift; done
ESEGUI=0; DU_RO=1
du_init letture "Letture read-only prima del deploy unico" ""
du_require_cmd psql node git gh vercel supabase curl
du_need_db

BLOCK=()   # NON VAI
COND=()    # VAI, ma con questa condizione
block() { BLOCK+=("$*"); c_red "BLOCCANTE: $*"; }
cond() { COND+=("$*"); c_yel "CONDIZIONE: $*"; }

echo; echo "== A. Git / PR #$PR_NUMBER / CI =="
MAIN="$(du_origin_main)"
if [ "$MAIN" = "$EXPECTED_MAIN_DEFAULT" ]; then ok "origin/main è ancora ${MAIN:0:8}"; else block "origin/main è ${MAIN:0:8}, non ${EXPECTED_MAIN_DEFAULT:0:8}: rebase della #$PR_NUMBER + test prima del merge"; fi
PRJ="$(gh pr view "$PR_NUMBER" -R "$REPO_SLUG" --json state,isDraft,headRefOid,baseRefName --jq '.state+" "+(.isDraft|tostring)+" "+.headRefOid+" "+.baseRefName')"
read -r PR_STATE PR_DRAFT PR_HEAD PR_BASE <<<"$PRJ"
echo "PR #$PR_NUMBER: stato $PR_STATE, draft $PR_DRAFT, head $PR_HEAD, base $PR_BASE"
[ "$PR_STATE" = OPEN ] && [ "$PR_BASE" = main ] || block "PR #$PR_NUMBER non aperta su main"
if [ -n "$APPROVED_SHA" ]; then
  case "$PR_HEAD" in "$APPROVED_SHA"*) ok "head della PR = SHA approvato";; *) block "head della PR ($PR_HEAD) ≠ SHA approvato ($APPROVED_SHA)";; esac
else cond "nessun --sha passato: confronta tu l'head ${PR_HEAD:0:8} con lo SHA dell'APPROVE"; fi
if du_ci_green "$PR_HEAD"; then ok "CI verde sull'head"; else block "CI non verde (o in corso) su ${PR_HEAD:0:8}"; fi

echo; echo "== B. readiness.mjs (schema affiliati via exec_sql, read-only) =="
RJSON=""; RRC=0
if [ -n "$ENV_FILE" ]; then RJSON="$(node "$REPO_ROOT/scripts/affiliate-v2/readiness.mjs" "$ENV_FILE" 2>&1)" || RRC=$?
else RJSON="$(node "$REPO_ROOT/scripts/affiliate-v2/readiness.mjs" 2>&1)" || RRC=$?; fi
echo "$RJSON"
MISSING_TABLES="$(printf '%s' "$RJSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).missingTables.join(" "))}catch{process.stdout.write("?")}})')"
if [ "$RRC" = 2 ] || [ "$MISSING_TABLES" = "?" ]; then block "readiness.mjs non eseguibile (credenziali REST assenti o errore): rc=$RRC"
elif [ -n "$MISSING_TABLES" ]; then cond "tabelle affiliate mancanti (atteso prima del passo 2): $MISSING_TABLES → le crea il passo 2"
else ok "tutte le tabelle affiliate attese sono presenti"; fi

echo; echo "== C. Migration: registro remoto vs file del repo =="
echo "-- supabase migration list (CLI; --db-url per non dipendere dal link locale):"
if ML_OUT="$(supabase migration list --db-url "$DB_URL" 2>&1)"; then printf '%s\n' "$ML_OUT" | grep -v "new version\|We recommend" || true
else c_yel "(CLI non riuscita: si usa la lettura diretta sotto)"; fi
APPLIED="$(du_applied_versions)"
MISSING_AFF=""; MISSING_FILES=""
for m in $AFFILIATE_MIGRATIONS; do
  v="${m%%_*}"
  [ -f "$(du_mig_file "$m")" ] || MISSING_FILES="$MISSING_FILES $m"
  if printf '%s\n' "$APPLIED" | grep -qx "$v"; then echo "  applicata   $m"; else echo "  DA APPLICARE $m"; MISSING_AFF="$MISSING_AFF $v"; fi
done
[ -z "$MISSING_FILES" ] || block "file migration assenti nel checkout:$MISSING_FILES (sei sul branch della #$PR_NUMBER?)"
[ -z "$MISSING_AFF" ] || cond "migration affiliate da applicare al passo 2:$MISSING_AFF (+ sempre le cinque 20261022*)"
OTHERS=""
for f in "$REPO_ROOT"/supabase/migrations/*.sql; do
  b="$(basename "$f" .sql)"; v="${b%%_*}"
  case "$AFFILIATE_MIGRATIONS" in *"$b"*) continue;; esac
  printf '%s\n' "$APPLIED" | grep -qx "$v" || OTHERS="$OTHERS $b"
done
if [ -n "$OTHERS" ]; then cond "migration NON affiliate non registrate in prod (NON le applica nessuno di questi script, hanno un gate proprio):$OTHERS"; fi

echo; echo "== D. Vercel Production: env (solo NOMI) =="
if ! du_vercel whoami >/dev/null 2>&1; then block "vercel CLI non loggata (vercel login) o progetto non linkato in $VERCEL_CWD"; NAMES=""
else NAMES="$(du_vercel_env_names)"; printf '%s\n' "$NAMES" | sed 's/^/  /'; fi
has() { printf '%s\n' "$NAMES" | grep -qx "$1"; }
if [ -n "$NAMES" ]; then
  if has AFFILIATE_HASH_SECRET; then block "AFFILIATE_HASH_SECRET è impostata: decisione di Andrea = NON impostarla (passo 11)"; else ok "AFFILIATE_HASH_SECRET assente"; fi
  for n in CRON_SECRET ADMIN_SECRET; do if has "$n"; then ok "$n presente (valore non letto)"; else block "$n assente in Production"; fi; done
  echo "Flag da API Vercel (senza .env locali): sensitive/non leggibile = blocco."
  MODE="$(du_vercel_env_value AFFILIATE_MODE)" || { MODE="UNREADABLE"; block "AFFILIATE_MODE non leggibile"; }
  TV="$(du_vercel_env_value AFFILIATE_TERMS_VERSION)" || { TV="UNREADABLE"; block "AFFILIATE_TERMS_VERSION non leggibile"; }
  PAY="$(du_vercel_env_value AFFILIATE_PAYOUTS)" || { PAY="UNREADABLE"; block "AFFILIATE_PAYOUTS non leggibile"; }
  ACC="$(du_vercel_env_value AFFILIATE_ACCOUNTING_READY)" || { ACC="UNREADABLE"; block "AFFILIATE_ACCOUNTING_READY non leggibile"; }
  V2="$(du_vercel_env_value NEXT_PUBLIC_AFFILIATE_V2)" || { V2="UNREADABLE"; block "NEXT_PUBLIC_AFFILIATE_V2 non leggibile"; }
  echo "  AFFILIATE_MODE=${MODE:-<vuota o sensitive>} · AFFILIATE_TERMS_VERSION=${TV:-<vuota o sensitive>} · AFFILIATE_PAYOUTS=${PAY:-<vuota>} · AFFILIATE_ACCOUNTING_READY=${ACC:-<vuota>} · NEXT_PUBLIC_AFFILIATE_V2=${V2:-<vuota>}"
  [ "$(printf '%s' "$PAY" | tr '[:upper:]' '[:lower:]')" = live ] && block "AFFILIATE_PAYOUTS=live: deve restare off in questo deploy"
  du_safe_payment_flags || block "payout/accounting/hash non disattivati o non verificabili"
  [ "$V2" = 1 ] || cond "NEXT_PUBLIC_AFFILIATE_V2 non letta come 1 (dichiarata impostata il 20/10): verificala in dashboard"
  if [ "$TV" = "$TERMS_V3" ]; then ok "AFFILIATE_TERMS_VERSION già v3"; else cond "AFFILIATE_TERMS_VERSION da portare a $TERMS_V3 al passo 3 (oggi: ${TV:-vuota/sensitive})"; fi
  cond "AFFILIATE_MODE attuale: ${MODE:-non leggibile} → diventa live solo al passo 7"
fi

echo; echo "== E. B1 — shopify_events orders/paid (sola lettura) =="
echo "-- ultimi 30 giorni:"
du_sql_ro "SELECT status, count(*) AS n FROM shopify_events WHERE event_type='orders/paid' AND processed_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1"
echo "-- dal 26/07/2026 (commit 42663625):"
du_sql_ro "SELECT status, count(*) AS n FROM shopify_events WHERE event_type='orders/paid' AND processed_at >= '2026-07-26' GROUP BY 1 ORDER BY 1"
ORPH_IN="$(du_sql_val "SELECT count(*) FROM shopify_events WHERE event_type='orders/paid' AND status IN ('stale','pending') AND processed_at >= '2026-07-26' AND processed_at > now() - interval '30 days'")"
ORPH_OUT="$(du_sql_val "SELECT count(*) FROM shopify_events WHERE event_type='orders/paid' AND status IN ('stale','pending') AND processed_at >= '2026-07-26' AND processed_at <= now() - interval '30 days'")"
GRANTED="$(du_sql_val "SELECT count(*) FROM shopify_events WHERE event_type='orders/paid' AND status='granted' AND processed_at >= '2026-07-26'")"
echo "orfani (stale/pending dal 26/07): entro 30 gg = $ORPH_IN · oltre 30 gg = $ORPH_OUT · granted dal 26/07 = $GRANTED"
if [ "$((ORPH_IN + ORPH_OUT))" -gt 0 ]; then
  cond "ORDINI ORFANI: SÌ ($ORPH_IN recuperabili via reconcile dopo il deploy, P-B1.2; $ORPH_OUT oltre 30 gg → recupera-ordini-orfani.ts, gate #SHOPIFY-ORPHANS-1022). Valuta hotfix-b1.md solo se il deploy unico slitta."
  [ "$GRANTED" -gt 0 ] && echo "  (ci sono anche granted dopo il 26/07: forse la exec_sql di prod non ha il difetto, o grant da reconcile — guarda last_error/date)"
else ok "ordini orfani: NO (nessun stale/pending dal 26/07)"; fi
UNRES="$(du_sql_val "SELECT count(*) FROM shopify_events WHERE event_type='orders/paid' AND status='unresolved' AND processed_at > now() - interval '30 days' AND position('[affiliate:non-usd]' in coalesce(last_error,'')) = 0")"
echo "righe unresolved (finestra reconcile 30 gg) SENZA marcatore valuta: $UNRES"
if [ "$UNRES" -gt 0 ]; then
  cond "$UNRES ordini unresolved senza marcatore valuta: controllane la valuta in Shopify Admin PRIMA del merge (se non USD la reconcile pagherebbe commissione sull'importo come USD)"
  du_sql_ro "SELECT event_id, identifier, amount, processed_at FROM shopify_events WHERE event_type='orders/paid' AND status='unresolved' AND processed_at > now() - interval '30 days' AND position('[affiliate:non-usd]' in coalesce(last_error,'')) = 0 ORDER BY processed_at"
fi

echo; hr
if [ "${#BLOCK[@]}" -gt 0 ]; then
  c_red "VERDETTO: NON VAI"
  for b in "${BLOCK[@]}"; do echo "  ✗ $b"; done
else
  c_grn "VERDETTO: VAI"
fi
if [ "${#COND[@]}" -gt 0 ]; then echo "Condizioni / da sapere:"; for c in "${COND[@]}"; do echo "  • $c"; done; fi
echo "Log (contiene identificativi cliente: non condividerlo fuori): $LOG"
[ "${#BLOCK[@]}" -eq 0 ]
