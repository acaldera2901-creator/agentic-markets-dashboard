#!/usr/bin/env bash
# passo5-deploy-verifica.sh — passo 5: attesa del deploy Vercel del merge + verifiche post-deploy.
# SOLA LETTURA di default (HTTP GET, SQL READ ONLY). Nessun --esegui.
#   passo5-deploy-verifica.sh --env-file F [--merge-sha SHA] [--codice CODICE_ATTIVO] [--attesa-min 20]
#   ... --chiama-cron   # in più chiama i due cron affiliati con CRON_SECRET (SCRIVONO: idempotenti; chiede conferma)
# Verde → marca passo5 (precondizione dei passi 6, 7, 9).
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,7p' "$0"; }
du_parse_args "$@"
MERGE_SHA=""; CODE=""; WAIT_MIN=20; CALL_CRON=0
set -- "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
while [ $# -gt 0 ]; do case "$1" in
  --merge-sha) MERGE_SHA="${2:-}"; shift;;
  --codice) CODE="${2:-}"; shift;;
  --attesa-min) WAIT_MIN="${2:-20}"; shift;;
  --chiama-cron) CALL_CRON=1;;
  *) die "argomento sconosciuto: $1";; esac; shift; done
ESEGUI=0; DU_RO=1
du_init passo5-deploy "Passo 5 — attesa deploy + verifiche read-only su $SITE_URL" "Vercel → Deployments → promote del deployment precedente (immediato) + git revert dello squash del passo 4."
du_require_cmd curl git psql node vercel
du_need_db
[ -n "$MERGE_SHA" ] || MERGE_SHA="$(cat "$LOG_DIR/merge-sha.txt" 2>/dev/null || true)"
[ -n "$MERGE_SHA" ] || die "SHA del merge sconosciuto: passa --merge-sha"
echo "SHA del merge: $MERGE_SHA"
has() { grep -q -- "$1" <<<"$2"; }
lacks() { ! grep -q -- "$1" <<<"$2"; }

echo; echo "== Attesa: alias produzione READY sullo SHA $MERGE_SHA =="
deadline=$(( $(date +%s) + WAIT_MIN * 60 ))
until du_production_matches "$MERGE_SHA"; do
  [ "$(date +%s)" -lt "$deadline" ] || die "dopo $WAIT_MIN min alias produzione non risolve allo SHA $MERGE_SHA: controlla il deploy in Vercel (auto-deploy rotto? allora «vercel --prod» da Andrea, gated)"
  echo "  $(date -u +%H:%M:%S) non ancora… (riprovo fra 20 s)"; sleep 20
done
ok "alias produzione READY sullo SHA esatto $MERGE_SHA"
if command -v gh >/dev/null 2>&1; then
  echo "GitHub deployments per lo SHA (stato Vercel):"
  gh api "repos/$REPO_SLUG/deployments?sha=$MERGE_SHA" --jq '.[] | "  " + .environment + " id=" + (.id|tostring)' 2>/dev/null || echo "  (non leggibili)"
fi

echo; echo "== Rotte e pagine (GET, nessuna scrittura) =="
T="$(du_http_body "$SITE_URL/affiliates/terms")"
P="$(du_http_body "$SITE_URL/privacy")"
TT="$(du_http_body "$SITE_URL/terms")"
SM="$(du_http_body "$SITE_URL/sitemap.xml")"
check "/affiliates/terms: versione $TERMS_V3" has "$TERMS_V3" "$T"
check "/affiliates/terms: §7A a 30 giorni" has "section 7A applies 30 days" "$T"
check "/privacy: voce am_ref presente" has "am_ref" "$P"
check "/privacy: paragrafo HMAC «Fraud checks» ASSENTE (segreto non impostato)" lacks "privacy-affiliate-hmac" "$P"
check "/privacy: footer 18+" has "18+" "$P"
check "/terms: footer 18+" has "18+" "$TT"
check "/sitemap.xml contiene /invite" has "betredge.com/invite<" "$SM"
check "/invite → 200" [ "$(du_http_code "$SITE_URL/invite")" = 200 ]
check "/api/affiliate/me senza sessione → 401" [ "$(du_http_code "$SITE_URL/api/affiliate/me")" = 401 ]
for c in affiliate-reconcile affiliate-clicks-retention affiliate-mature; do
  check "/api/cron/$c esiste (senza token → 401, non 404)" [ "$(du_http_code "$SITE_URL/api/cron/$c")" = 401 ]
done
git -C "$REPO_ROOT" cat-file -e "$MERGE_SHA^{commit}" 2>/dev/null || git -C "$REPO_ROOT" fetch -q origin main
VJ="$(git -C "$REPO_ROOT" show "$MERGE_SHA:vercel.json" 2>/dev/null || true)"
check "vercel.json del merge: cron affiliate-reconcile" has '/api/cron/affiliate-reconcile' "$VJ"
check "vercel.json del merge: cron affiliate-clicks-retention" has '/api/cron/affiliate-clicks-retention' "$VJ"
if [ -n "$(du_env ADMIN_SECRET)" ]; then
  check "GET /api/admin/affiliate/export?kind=affiliates con ADMIN_SECRET → 200" [ "$(du_http_code "$SITE_URL/api/admin/affiliate/export?kind=affiliates" ADMIN_SECRET)" = 200 ]
else c_yel "ADMIN_SECRET non nell'env file: export admin NON verificato"; fi
if [ -n "$CODE" ]; then
  H="$(curl -sI --max-time 30 "$SITE_URL/r/$CODE?utm_source=test-deploy" | tr -d '\r')"
  LOC="$(grep -i '^location:' <<<"$H" || true)"
  check "/r/$CODE → 302" grep -qE '^HTTP/[0-9.]+ 302' <<<"$H"
  check "/r/$CODE: location con ref=" has "ref=" "$LOC"
  check "/r/$CODE: location con utm_source=test-deploy" has "utm_source=test-deploy" "$LOC"
  check "/r/$CODE: cache-control no-store" grep -qi '^cache-control:.*no-store' <<<"$H"
else c_yel "--codice non passato: /r/CODE NON verificato"; fi

echo; echo "== DB (READ ONLY) =="
du_db_schema_checks
n="$(du_sql_val "SELECT count(*) FROM public.affiliate_admin_actions")"; echo "affiliate_admin_actions: $n righe (atteso 0 subito dopo il deploy)"

if [ "$CALL_CRON" = 1 ]; then
  echo; echo "== Cron affiliati (SCRIVONO, idempotenti) =="
  [ -n "$(du_env CRON_SECRET)" ] || die "CRON_SECRET non nell'env file"
  du_confirm "CHIAMA CRON"
  hf="$(mktemp)"; printf 'Authorization: Bearer %s\n' "$(du_env CRON_SECRET)" > "$hf"
  r1="$(curl -s --max-time 60 -H @"$hf" "$SITE_URL/api/cron/affiliate-reconcile")"; echo "reconcile #1: $r1"
  r2="$(curl -s --max-time 60 -H @"$hf" "$SITE_URL/api/cron/affiliate-reconcile")"; echo "reconcile #2: $r2"
  r3="$(curl -s --max-time 60 -H @"$hf" "$SITE_URL/api/cron/affiliate-clicks-retention")"; echo "clicks-retention: $r3"
  rm -f "$hf"
  check "reconcile ok:true" has '"ok":true' "$r1"
  check "reconcile rieseguito: written 0 (o skipped se AFFILIATE_MODE=off)" grep -qE '"written":0|"skipped":true' <<<"$r2"
  check "clicks-retention ok:true" has '"ok":true' "$r3"
  check "clicks-retention retention_days 90" has '"retention_days":90' "$r3"
fi

echo; hr
du_production_matches "$MERGE_SHA" || ko "alias produzione cambiato durante la verifica"
if [ "$DU_KO" = 0 ]; then du_mark passo5 "$MERGE_SHA"; c_grn "Passo 5 VERDE ($MERGE_SHA). Prossimo: passo6-backfill-v3.sh. Poi guarda i log Vercel per 30 min: nessun [affiliate/*] error nuovo."
else c_red "Passo 5: $DU_KO verifiche KO. NON procedere ai passi 6-7. Rollback: $DU_ROLLBACK"; exit 1; fi
