# shellcheck shell=bash
# shellcheck disable=SC2034  # constants are used by the scripts that source this file
# scripts/affiliate-v2/deploy-unico/lib.sh — shared helpers for the
# #AFFILIATE-PLATFORM-1022 single-deploy scripts. Sourced, never executed.
# Bash 3.2 compatible (macOS /bin/bash): no associative arrays, no mapfile.
#
# Secrets (SUPABASE_DB_URL, CRON_SECRET, ADMIN_SECRET, service key) are read
# from the private env file passed with --env-file (or the environment) and are
# never printed: HTTP headers go through curl -H @file, Vercel values via stdin.

set -euo pipefail

DU_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$DU_DIR" rev-parse --show-toplevel)"
REPO_SLUG="${REPO_SLUG:-acaldera2901-creator/agentic-markets-dashboard}"
BO_REPO_SLUG="${BO_REPO_SLUG:-acaldera2901-creator/betredge-backoffice}"
PR_NUMBER="${PR_NUMBER:-553}"
BO_PR_NUMBER="${BO_PR_NUMBER:-2}"
EXPECTED_MAIN_DEFAULT="d78b5221b8d2933c734b5dffe29a1524fa907b67"
TERMS_V3="aff-2026-10-22-v3"
SITE_URL="${SITE_URL:-https://www.betredge.com}"
LOG_DIR="${DEPLOY_LOG_DIR:-$HOME/deploy-unico-1022-log}"
# The Vercel-linked checkout (.vercel/project.json). The worktree of the PR
# usually is not linked: default to the canonical repo folder.
if [ -z "${VERCEL_CWD:-}" ]; then
  if [ -f "$REPO_ROOT/.vercel/project.json" ]; then VERCEL_CWD="$REPO_ROOT"; else VERCEL_CWD="$HOME/Desktop/agentic-markets"; fi
fi

# Affiliate migrations, in the exact order they must be applied. Nothing else
# in supabase/migrations is ever applied by these scripts (no `db push`).
AFFILIATE_MIGRATIONS="20261007120000_affiliate_v2
20261015120000_affiliate_v2_wallet
20261015130000_affiliate_v2_payouts
20261020150000_affiliate_v2_maturity
20261022120000_affiliate_v2_reversal
20261022130000_affiliate_v2_ops
20261022140000_affiliate_v2_clicks_retention
20261022150000_affiliate_v2_refund_cumulative
20261022160000_affiliate_v2_reverse_audit
20261023120000_affiliate_v2_leave_terms
20261023130000_affiliate_v2_reversal_inbox"
# Always re-applied (new in #553; 130000/160000 were corrected in place and all
# five are CREATE OR REPLACE / IF NOT EXISTS — idempotent).
ALWAYS_APPLY="20261022120000 20261022130000 20261022140000 20261022150000 20261022160000 20261023120000 20261023130000"

ESEGUI=0
ENV_FILE="${DEPLOY_ENV_FILE:-}"
DU_STEP=""
LOG=""
EXTRA_ARGS=()

c_red() { printf '\033[31m%s\033[0m\n' "$*"; }
c_grn() { printf '\033[32m%s\033[0m\n' "$*"; }
c_yel() { printf '\033[33m%s\033[0m\n' "$*"; }
hr() { printf '%s\n' "------------------------------------------------------------------------"; }
die() { c_red "STOP: $*"; exit 1; }

# du_parse_args "$@" — common flags; unknown flags land in EXTRA_ARGS.
du_parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --esegui) ESEGUI=1 ;;
      --env-file) ENV_FILE="${2:-}"; shift ;;
      -h|--help) du_usage; exit 0 ;;
      *) EXTRA_ARGS+=("$1") ;;
    esac
    shift
  done
}

# du_init STEP "description" "rollback text" — log file + header.
du_init() {
  du_context >/dev/null || die "imposta DEPLOY_RUN_ID e DEPLOY_APPROVED_SHA prima di ogni esecuzione"
  DU_STEP="$1"
  umask 077
  mkdir -p "$LOG_DIR"
  chmod 700 "$LOG_DIR"
  LOG="$LOG_DIR/$(date -u +%Y%m%dT%H%M%SZ)-$DU_STEP.log"
  exec > >(tee -a "$LOG") 2>&1
  hr
  echo "#AFFILIATE-PLATFORM-1022 · $DU_STEP · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "$2"
  if [ "${DU_RO:-0}" = 1 ]; then c_grn "SOLA LETTURA (nessuna scrittura; non esiste --esegui)"
  elif [ "$ESEGUI" = 1 ]; then c_yel "MODALITÀ: ESEGUI (scrive davvero, dopo la tua conferma)"; else c_grn "MODALITÀ: DRY-RUN (nessuna scrittura). Per applicare: --esegui"; fi
  echo "Log: $LOG"
  if [ -n "${3:-}" ]; then echo "ROLLBACK di questo passo: $3"; fi
  hr
  DU_ROLLBACK="${3:-}"
  trap 'du_on_err $LINENO' ERR
}

du_on_err() {
  c_red "ERRORE alla riga $1 di $DU_STEP. Niente è stato confermato oltre l'ultimo «OK» stampato."
  if [ -n "${DU_ROLLBACK:-}" ]; then c_yel "Rollback: $DU_ROLLBACK"; fi
  echo "Log completo: $LOG"
}

du_require_cmd() {
  local c
  for c in "$@"; do command -v "$c" >/dev/null 2>&1 || die "comando mancante: $c"; done
}

# du_env KEY — value from the environment, else from the private env file.
# Parsed with node:util parseEnv (same as readiness.mjs): the file is never sourced.
du_env() {
  local k="$1" v
  v="$(printenv "$k" 2>/dev/null || true)"
  if [ -z "$v" ] && [ -n "$ENV_FILE" ]; then
    [ -r "$ENV_FILE" ] || die "env file non leggibile: $ENV_FILE"
    v="$(node --input-type=module -e 'import {readFileSync} from "node:fs";import {parseEnv} from "node:util";const e=parseEnv(readFileSync(process.argv[1],"utf8"));process.stdout.write(e[process.argv[2]]??"")' "$ENV_FILE" "$k")"
  fi
  printf '%s' "$v"
}

# du_need_db — resolve SUPABASE_DB_URL once, in the main shell (a die inside
# $(...) would only exit the subshell and psql would fall back to a local DB).
DB_URL=""
du_need_db() {
  DB_URL="$(du_env SUPABASE_DB_URL)"
  [ -n "$DB_URL" ] || die "SUPABASE_DB_URL assente (connessione diretta Postgres: Supabase → Settings → Database). Passa --env-file."
  export DB_URL
}

# du_sql_ro "SQL" — read-only transaction, unaligned output with header.
du_sql_ro() {
  psql "${DB_URL:?du_need_db non chiamato}" -X -q -v ON_ERROR_STOP=1 -P pager=off -P footer=off -A -F ' | ' \
    -c "BEGIN READ ONLY" -c "SET LOCAL statement_timeout = '30s'" -c "$1" -c "COMMIT"
}
# du_sql_list "SQL" — tuples only (no header), one row per line, read-only.
du_sql_list() {
  psql "${DB_URL:?du_need_db non chiamato}" -X -q -v ON_ERROR_STOP=1 -t -A -F ' | ' \
    -c "BEGIN READ ONLY" -c "SET LOCAL statement_timeout = '30s'" -c "$1" -c "COMMIT" | sed '/^$/d'
}
# du_sql_val "SQL" — single value, read-only.
du_sql_val() { du_sql_list "$1" | head -1; }

# du_confirm "PHRASE" — the operator must type PHRASE exactly.
du_confirm() {
  local ans
  echo
  c_yel "Conferma: scrivi esattamente «$1» e premi Invio (qualsiasi altra cosa annulla)."
  IFS= read -r ans || ans=""
  [ "$ans" = "$1" ] || die "conferma non data: nessuna modifica eseguita da qui in avanti"
  echo "Confermato da $(whoami) alle $(date -u +%H:%M:%SZ)"
}

# Every step is bound to one operator-selected run, approved revision and target.
# Start a fresh run ID after changing revision/target; old .ok files cannot pass.
du_context() {
  local db
  db="$(du_env SUPABASE_DB_URL)" || return 1
  [ -n "${DEPLOY_RUN_ID:-}" ] || { echo "DEPLOY_RUN_ID required" >&2; return 1; }
  [[ "${DEPLOY_APPROVED_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || { echo "DEPLOY_APPROVED_SHA must be a full SHA" >&2; return 1; }
  printf '%s\n' "$DEPLOY_RUN_ID" "$DEPLOY_APPROVED_SHA" "$SITE_URL" "$VERCEL_CWD" "$VERCEL_SCOPE" "$(cat "$VERCEL_CWD/.vercel/project.json" 2>/dev/null || true)" "$db" | shasum -a 256 | awk '{print $1}'
}
du_mark() {
  local context
  context="$(du_context)" || return 1
  printf '%s\n%s\n' "$context" "${2:-ok} $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOG_DIR/$1.ok"
}
du_has_mark() {
  local context
  context="$(du_context)" || return 1
  [ -f "$LOG_DIR/$1.ok" ] && [ "$(head -1 "$LOG_DIR/$1.ok")" = "$context" ] &&
    [ -z "$(find "$LOG_DIR/$1.ok" -mmin +1440)" ]
}

# ---------- git / GitHub ----------
du_origin_main() { git -C "$REPO_ROOT" fetch -q origin main && git -C "$REPO_ROOT" rev-parse origin/main; }

# du_ci_green SHA [REPO] — every check-run completed with success/skipped/neutral
# and the combined commit status not failing. Prints a summary line.
du_ci_green() {
  local sha="$1" repo="${2:-$REPO_SLUG}" bad total pending state
  total="$(gh api "repos/$repo/commits/$sha/check-runs?per_page=100" --jq '.check_runs | length')"
  pending="$(gh api "repos/$repo/commits/$sha/check-runs?per_page=100" --jq '[.check_runs[] | select(.status != "completed")] | length')"
  bad="$(gh api "repos/$repo/commits/$sha/check-runs?per_page=100" --jq '[.check_runs[] | select(.status == "completed" and (.conclusion != "success" and .conclusion != "skipped" and .conclusion != "neutral"))] | length')"
  state="$(gh api "repos/$repo/commits/$sha/status" --jq '.state + " (" + (.total_count|tostring) + ")"')"
  echo "CI $sha: check-run $total, in corso $pending, falliti $bad; status combinato $state"
  [ "$total" -gt 0 ] && [ "$pending" = 0 ] && [ "$bad" = 0 ] && case "$state" in success*|"pending (0)") true ;; *) false ;; esac
}

# ---------- Vercel ----------
VERCEL_SCOPE="${VERCEL_SCOPE:-betredge}"
du_vercel() { vercel --cwd "$VERCEL_CWD" --scope "$VERCEL_SCOPE" "$@"; }
# Read project settings through the API: `env run` also loads local .env files
# and therefore cannot establish the production value. Never decrypt secrets.
du_vercel_project_id() {
  node -e 'const j=require(process.argv[1]);if(!/^prj_[A-Za-z0-9]+$/.test(j.projectId))process.exit(1);process.stdout.write(j.projectId)' "$VERCEL_CWD/.vercel/project.json"
}
du_vercel_env_metadata() {
  local project raw
  project="$(du_vercel_project_id)" || return 1
  raw="$(du_vercel api "/v10/projects/$project/env" 2>/dev/null)" || return 1
  printf '%s' "$raw" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);if(!Array.isArray(j.envs))throw Error();const a=j.envs.filter(e=>Array.isArray(e.target)&&e.target.includes("production"));if(a.some(e=>!e.key||!e.id||!e.type))throw Error();process.stdout.write(JSON.stringify(a.map(({key,id,type})=>({key,id,type}))))}catch{process.exitCode=1}})'
}
du_vercel_env_names() {
  local metadata
  metadata="$(du_vercel_env_metadata)" || return 1
  printf '%s' "$metadata" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).map(e=>e.key).sort().join("\n")))'
}
# Only explicitly allowlisted non-secret configuration can be returned.
# Sensitive/ambiguous values fail closed, never become an empty/off value.
du_vercel_env_value() {
  case "$1" in
    AFFILIATE_MODE|AFFILIATE_TERMS_VERSION|AFFILIATE_PAYOUTS|AFFILIATE_ACCOUNTING_READY|NEXT_PUBLIC_AFFILIATE_V2|BETREDGE_ADMIN_BASE_URL) ;;
    *) die "du_vercel_env_value: $1 non è in whitelist (potrebbe essere un segreto)";;
  esac
  local metadata id project raw
  metadata="$(du_vercel_env_metadata)" || return 1
  id="$(printf '%s' "$metadata" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).filter(e=>e.key===process.argv[1]);if(a.length===0)return;if(a.length!==1||a[0].type==="sensitive"){console.error("Production flag unreadable or ambiguous: "+process.argv[1]);process.exitCode=1;return}process.stdout.write(a[0].id)})' "$1")" || return 1
  [ -n "$id" ] || return 0
  project="$(du_vercel_project_id)" || return 1
  raw="$(du_vercel api "/v1/projects/$project/env/$id" 2>/dev/null)" || return 1
  printf '%s' "$raw" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const e=JSON.parse(s);if(e.key!==process.argv[1]||e.type==="sensitive"||!(e.type==="plain"||e.decrypted===true)||typeof e.value!=="string"||!e.value.length)throw Error();process.stdout.write(e.value)}catch{console.error("Invalid/unreadable production flag: "+process.argv[1]);process.exitCode=1}})' "$1"
}
# du_vercel_env_set NAME VALUE [extra flags] — add or update on Production, value via stdin.
du_vercel_env_set() {
  local name="$1" value="$2" names; shift 2
  names="$(du_vercel_env_names)" || return 1
  if printf '%s\n' "$names" | grep -qx "$name"; then
    printf '%s' "$value" | du_vercel env update "$name" production --yes "$@"
  else
    printf '%s' "$value" | du_vercel env add "$name" production --yes "$@"
  fi
}

# ---------- HTTP (read-only checks) ----------
# du_http_code URL [auth-env-name] — status code; the bearer, if any, goes via a header file.
du_http_code() {
  local url="$1" key="${2:-}" hf
  if [ -n "$key" ]; then
    hf="$(mktemp)"; printf 'Authorization: Bearer %s\n' "$(du_env "$key")" > "$hf"
    curl -s -o /dev/null -w '%{http_code}' --max-time 30 -H @"$hf" "$url" || true
    rm -f "$hf"
  else
    curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$url" || true
  fi
}
du_http_body() { curl -s --max-time 30 "$1" || true; }

# Checks print «OK …» / «KO …» and bump DU_KO on failure.
DU_KO=0
ok() { c_grn "OK  $*"; }
ko() { c_red "KO  $*"; DU_KO=$((DU_KO + 1)); }
check() { local d="$1"; shift; if "$@"; then ok "$d"; else ko "$d"; fi; }

# The 7 functions + purge required by the new code (proposal, «Piano di verifica» 2/7b).
DB_FUNCTIONS="affiliate_receive_reversal affiliate_replay_reversals affiliate_reverse_commission affiliate_admin_reverse_commission affiliate_screen_wallet affiliate_set_status affiliate_review_attribution affiliate_payout_mark_sent affiliate_payout_unmark_sent affiliate_purge_clicks"
DB_TABLES="affiliate_reversal_inbox affiliates affiliate_referral_clicks affiliate_attributions affiliate_wallets affiliate_commissions affiliate_payouts affiliate_payer_fingerprints affiliate_refund_events affiliate_admin_actions affiliate_absences affiliate_terms_acceptances"

# du_db_schema_checks — read-only: tables, functions, refund-events backfill, cumulative function body.
du_db_schema_checks() {
  local t f n a b
  n="$(du_sql_val "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='affiliates' AND column_name='left_at'")"
  check "affiliates.left_at presente (1023)" [ "$n" = 1 ]
  for t in $DB_TABLES; do
    n="$(du_sql_val "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$t'")"
    check "tabella $t presente" [ "$n" = 1 ]
  done
  for f in $DB_FUNCTIONS; do
    n="$(du_sql_val "SELECT count(*) FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public' AND p.proname='$f'")"
    check "funzione $f presente" [ "$n" -ge 1 ]
  done
  a="$(du_sql_val "SELECT count(*) FROM public.affiliate_refund_events" 2>/dev/null || echo ERR)"
  b="$(du_sql_val "SELECT count(*) FROM public.affiliate_commissions WHERE kind IN ('reversal','clawback') AND status <> 'void'" 2>/dev/null || echo ERR)"
  check "affiliate_refund_events ($a) = storni non void ($b) (backfill 150000)" [ "$a" = "$b" ]
  n="$(du_sql_val "SELECT bool_or(position('affiliate_refund_events' in prosrc) > 0) FROM pg_proc WHERE proname='affiliate_reverse_commission'" 2>/dev/null || echo ERR)"
  check "affiliate_reverse_commission è la versione cumulata (150000)" [ "$n" = t ]
  n="$(du_sql_val "SELECT count(*) FROM pg_constraint WHERE conname = 'affiliate_admin_actions_action_check' AND pg_get_constraintdef(oid) LIKE '%commission_reversed%'" 2>/dev/null || echo ERR)"
  check "CHECK affiliate_admin_actions ammette commission_reversed (160000)" [ "$n" -ge 1 ]
}

# du_applied_versions — versions recorded in supabase_migrations.schema_migrations.
du_applied_versions() { du_sql_list "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"; }

du_mig_file() { printf '%s/supabase/migrations/%s.sql' "$REPO_ROOT" "$1"; }

# Fail closed: a CLI failure is never permission to enable accrual or payouts.
du_safe_payment_flags() {
  local pay acc names
  names="$(du_vercel_env_names)" || return 1
  pay="$(du_vercel_env_value AFFILIATE_PAYOUTS)" || return 1
  acc="$(du_vercel_env_value AFFILIATE_ACCOUNTING_READY)" || return 1
  [ "$pay" = off ] || { echo "AFFILIATE_PAYOUTS must be explicitly off" >&2; return 1; }
  case "$acc" in ""|0) ;; *) echo "Accounting must remain disabled" >&2; return 1;; esac
  ! printf '%s\n' "$names" | grep -qx AFFILIATE_HASH_SECRET
}

# Resolve the actual production alias, then require its deployment metadata.
# `vercel inspect` alone omits git metadata in current CLI versions.
du_production_matches() {
  local sha="$1" inspected id detail
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || return 1
  inspected="$(du_vercel inspect "${SITE_URL#https://}" -F json 2>/dev/null)" || return 1
  id="$(printf '%s' "$inspected" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);if(j.target!=="production"||j.readyState!=="READY"||!/^dpl_[a-zA-Z0-9]+$/.test(j.id))throw Error();process.stdout.write(j.id)}catch{process.exitCode=1}})')" || return 1
  detail="$(du_vercel api "/v13/deployments/$id" 2>/dev/null)" || return 1
  printf '%s' "$detail" | node -e 'const fs=require("fs");let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s),p=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));if(j.id!==process.argv[3]||j.projectId!==p.projectId||j.target!=="production"||j.readyState!=="READY"||(j.gitSource?.sha??j.meta?.githubCommitSha)!==process.argv[1])throw Error()}catch{process.exitCode=1}})' "$sha" "$VERCEL_CWD/.vercel/project.json" "$id"
}
