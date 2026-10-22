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
20261022160000_affiliate_v2_reverse_audit"
# Always re-applied (new in #553; 130000/160000 were corrected in place and all
# five are CREATE OR REPLACE / IF NOT EXISTS — idempotent).
ALWAYS_APPLY="20261022120000 20261022130000 20261022140000 20261022150000 20261022160000"

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

# du_mark NAME — marker files in LOG_DIR chain the steps (passo5 green → 6 → 7).
du_mark() { printf '%s\n' "${2:-ok} $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOG_DIR/$1.ok"; }
du_has_mark() { [ -f "$LOG_DIR/$1.ok" ]; }

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
# Production env NAMES only (values stay encrypted).
du_vercel_env_names() { du_vercel env ls production 2>/dev/null | awk 'NR>1 && $1 ~ /^[A-Z][A-Z0-9_]*$/ {print $1}' | sort -u; }
# du_vercel_env_value NAME — ONLY for non-secret flags. The value is read inside
# a child process (`vercel env run -e production -- printenv NAME`): the other
# production secrets live only in that child and are never printed.
du_vercel_env_value() {
  case "$1" in
    AFFILIATE_MODE|AFFILIATE_TERMS_VERSION|AFFILIATE_PAYOUTS|AFFILIATE_ACCOUNTING_READY|NEXT_PUBLIC_AFFILIATE_V2|BETREDGE_ADMIN_BASE_URL) ;;
    *) die "du_vercel_env_value: $1 non è in whitelist (potrebbe essere un segreto)";;
  esac
  du_vercel env run -e production -- printenv "$1" 2>/dev/null || true
}
# du_vercel_env_set NAME VALUE [extra flags] — add or update on Production, value via stdin.
du_vercel_env_set() {
  local name="$1" value="$2"; shift 2
  if du_vercel_env_names | grep -qx "$name"; then
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
DB_FUNCTIONS="affiliate_reverse_commission affiliate_admin_reverse_commission affiliate_screen_wallet affiliate_set_status affiliate_review_attribution affiliate_payout_mark_sent affiliate_payout_unmark_sent affiliate_purge_clicks"
DB_TABLES="affiliates affiliate_referral_clicks affiliate_attributions affiliate_wallets affiliate_commissions affiliate_payouts affiliate_payer_fingerprints affiliate_refund_events affiliate_admin_actions"

# du_db_schema_checks — read-only: tables, functions, refund-events backfill, cumulative function body.
du_db_schema_checks() {
  local t f n a b
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
