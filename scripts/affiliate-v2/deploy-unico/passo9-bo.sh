#!/usr/bin/env bash
# passo9-bo.sh — passo 9: backoffice. Env BETREDGE_ADMIN_BASE_URL/SECRET sul progetto Vercel
# del BO, poi merge della PR #2 di betredge-backoffice (il deploy del merge prende le env).
# Solo DOPO il passo 5 verde (le rotte admin del sito devono esistere).
#   passo9-bo.sh --env-file F --bo-dir /percorso/betredge-backoffice --bo-sha <SHA approvato PR #2> [--bo-scope SCOPE]
#   ... --esegui
# BETREDGE_ADMIN_SECRET = ADMIN_SECRET del sito, letto dall'env file e passato a Vercel via stdin.
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,7p' "$0"; }
du_parse_args "$@"
BO_DIR=""; BO_SHA=""; BO_SCOPE="${VERCEL_SCOPE}"
set -- "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
while [ $# -gt 0 ]; do case "$1" in
  --bo-dir) BO_DIR="${2:-}"; shift;;
  --bo-sha) BO_SHA="${2:-}"; shift;;
  --bo-scope) BO_SCOPE="${2:-}"; shift;;
  *) die "argomento sconosciuto: $1";; esac; shift; done
du_init passo9-bo "Passo 9 — BO: env + merge PR #$BO_PR_NUMBER ($BO_REPO_SLUG)" "git revert dello squash della PR BO (su un branch + PR) o promote del deployment BO precedente; vercel env rm BETREDGE_ADMIN_BASE_URL/BETREDGE_ADMIN_SECRET production nel progetto BO. Le rotte del sito restano protette da ADMIN_SECRET."
du_require_cmd gh vercel curl
[ -n "$BO_DIR" ] && [ -f "$BO_DIR/.vercel/project.json" ] || die "--bo-dir deve essere il checkout del BO linkato a Vercel (.vercel/project.json)"
[ "${#BO_SHA}" = 40 ] || die "serve --bo-sha <SHA completo approvato della PR #$BO_PR_NUMBER>"
BOV() { vercel --cwd "$BO_DIR" --scope "$BO_SCOPE" "$@"; }

echo "== Precondizioni =="
du_has_mark passo5 || die "passo 5 non verde: il BO va dopo il deploy del backend"
ok "passo 5: $(cat "$LOG_DIR/passo5.ok")"
SITE_PRJ="$(sed -E 's/.*"projectId":"([^"]+)".*/\1/' "$VERCEL_CWD/.vercel/project.json")"
BO_PRJ="$(sed -E 's/.*"projectId":"([^"]+)".*/\1/' "$BO_DIR/.vercel/project.json")"
echo "progetto Vercel BO: $(tr -d '\n' < "$BO_DIR/.vercel/project.json")"
[ "$SITE_PRJ" != "$BO_PRJ" ] || die "--bo-dir è linkato al progetto del SITO ($SITE_PRJ): metterei il segreto sul progetto sbagliato"
[ -n "$(du_env ADMIN_SECRET)" ] || die "ADMIN_SECRET non nell'env file"
check "il sito accetta ADMIN_SECRET su /api/admin/affiliate/export (200)" [ "$(du_http_code "$SITE_URL/api/admin/affiliate/export?kind=affiliates" ADMIN_SECRET)" = 200 ]
[ "$DU_KO" = 0 ] || die "ADMIN_SECRET dell'env file non funziona sul sito: il BO riceverebbe 401"
PRJ="$(gh pr view "$BO_PR_NUMBER" -R "$BO_REPO_SLUG" --json state,isDraft,headRefOid,baseRefName,mergeable --jq '.state+" "+(.isDraft|tostring)+" "+.headRefOid+" "+.baseRefName+" "+.mergeable')"
read -r S DRAFT HEAD BASE MERGEABLE <<<"$PRJ"
echo "BO PR #$BO_PR_NUMBER: $S draft=$DRAFT head=$HEAD base=$BASE mergeable=$MERGEABLE"
[ "$S" = OPEN ] || die "PR BO non aperta"
[ "$HEAD" = "$BO_SHA" ] || die "head PR BO ($HEAD) ≠ SHA approvato ($BO_SHA)"
[ "$MERGEABLE" = MERGEABLE ] || die "PR BO non mergeable ($MERGEABLE)"
du_ci_green "$BO_SHA" "$BO_REPO_SLUG" || die "CI della PR BO non verde"
BO_NAMES="$(BOV env ls production 2>/dev/null | awk 'NR>1 && $1 ~ /^[A-Z][A-Z0-9_]*$/ {print $1}' | sort -u)"
echo "Comandi:"
echo "  (BO) vercel env add|update BETREDGE_ADMIN_BASE_URL production  ← $SITE_URL"
echo "  (BO) vercel env add|update BETREDGE_ADMIN_SECRET production --sensitive  ← ADMIN_SECRET (stdin, mai stampato)"
[ "$DRAFT" = true ] && echo "  gh pr ready $BO_PR_NUMBER -R $BO_REPO_SLUG"
echo "  gh pr merge $BO_PR_NUMBER -R $BO_REPO_SLUG --squash --delete-branch --match-head-commit $BO_SHA"
if [ "$ESEGUI" != 1 ]; then c_grn "DRY-RUN: nessuna modifica."; exit 0; fi
du_confirm "BO MERGE"
setbo() { if printf '%s\n' "$BO_NAMES" | grep -qx "$1"; then printf '%s' "$2" | BOV env update "$1" production --yes; else printf '%s' "$2" | BOV env add "$1" production --yes "${@:3}"; fi; }
setbo BETREDGE_ADMIN_BASE_URL "$SITE_URL" --no-sensitive
setbo BETREDGE_ADMIN_SECRET "$(du_env ADMIN_SECRET)" --sensitive
cd "$(mktemp -d)"
[ "$DRAFT" = true ] && gh pr ready "$BO_PR_NUMBER" -R "$BO_REPO_SLUG"
gh pr merge "$BO_PR_NUMBER" -R "$BO_REPO_SLUG" --squash --delete-branch --match-head-commit "$BO_SHA"

echo; echo "== Verifica post-passo =="
BO_NAMES="$(BOV env ls production 2>/dev/null | awk 'NR>1 && $1 ~ /^[A-Z][A-Z0-9_]*$/ {print $1}' | sort -u)"
for n in BETREDGE_ADMIN_BASE_URL BETREDGE_ADMIN_SECRET; do check "env BO $n presente" sh -c 'printf "%s\n" "$1" | grep -qx "$2"' _ "$BO_NAMES" "$n"; done
M="$(gh pr view "$BO_PR_NUMBER" -R "$BO_REPO_SLUG" --json state,mergeCommit --jq '.state+" "+(.mergeCommit.oid // "")')"
check "PR BO MERGED ($M)" sh -c 'case "$1" in MERGED\ ?*) true;; *) false;; esac' _ "$M"
[ "$DU_KO" = 0 ] || die "$DU_KO verifiche KO"
du_mark passo9 "$M"
c_grn "Passo 9 OK. A deploy BO finito: apri il BO, sezione affiliati → la lista si carica (= BO → sito con ADMIN_SECRET funziona). Nessuna scrittura di prova."
