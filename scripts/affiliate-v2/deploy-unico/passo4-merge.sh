#!/usr/bin/env bash
# passo4-merge.sh — passo 4: UN solo merge (squash) della PR #553 su main.
#   passo4-merge.sh --env-file F --sha <SHA approvato>            # dry-run: controlla tutte le precondizioni
#   passo4-merge.sh --env-file F --sha <SHA approvato> --esegui   # gh pr ready + gh pr merge --squash
# Precondizioni: main ancora d78b5221 (o --main-atteso), head della PR = SHA approvato,
# CI verde su quello SHA, migration del passo 2 presenti nel DB, termini v3 su Vercel.
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,6p' "$0"; }
du_parse_args "$@"
APPROVED_SHA=""; EXPECTED_MAIN="$EXPECTED_MAIN_DEFAULT"
set -- "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
while [ $# -gt 0 ]; do case "$1" in
  --sha) APPROVED_SHA="${2:-}"; shift;;
  --main-atteso) EXPECTED_MAIN="${2:-}"; shift;;
  *) die "argomento sconosciuto: $1";; esac; shift; done
du_init passo4-merge "Passo 4 — merge squash della PR #$PR_NUMBER" "Vercel → Deployments → promote del deployment di produzione precedente (immediato), poi: git revert <SHA del merge stampato qui> su un branch + PR (è uno squash: revert semplice, NON -m 1). Il DB resta com'è (compatibile col codice vecchio)."
du_require_cmd git gh psql vercel
du_need_db
[ -n "$APPROVED_SHA" ] || die "serve --sha <SHA approvato> (quello dell'APPROVE #AFFILIATE-PLATFORM-1022)"
[ "${#APPROVED_SHA}" = 40 ] || die "--sha deve essere lo SHA completo (40 caratteri): gh lo confronta esatto"

[ "$APPROVED_SHA" = "$DEPLOY_APPROVED_SHA" ] || die "SHA diverso dal contesto della run"

echo "== Precondizioni =="
MAIN="$(du_origin_main)"
[ "$MAIN" = "$EXPECTED_MAIN" ] || die "origin/main è $MAIN, atteso $EXPECTED_MAIN: rebase della #$PR_NUMBER, test, nuovo APPROVE sullo SHA nuovo"
ok "origin/main = ${MAIN:0:8}"
PRJ="$(gh pr view "$PR_NUMBER" -R "$REPO_SLUG" --json state,isDraft,headRefOid,baseRefName,mergeable --jq '.state+" "+(.isDraft|tostring)+" "+.headRefOid+" "+.baseRefName+" "+.mergeable')"
read -r PR_STATE PR_DRAFT PR_HEAD PR_BASE PR_MERGEABLE <<<"$PRJ"
echo "PR #$PR_NUMBER: $PR_STATE draft=$PR_DRAFT head=$PR_HEAD base=$PR_BASE mergeable=$PR_MERGEABLE"
[ "$PR_STATE" = OPEN ] && [ "$PR_BASE" = main ] || die "PR non aperta su main"
[ "$PR_HEAD" = "$APPROVED_SHA" ] || die "head della PR ($PR_HEAD) ≠ SHA approvato: qualcuno ha pushato dopo l'APPROVE"
[ "$PR_MERGEABLE" = MERGEABLE ] || die "PR non mergeable ($PR_MERGEABLE)"
du_ci_green "$APPROVED_SHA" || die "CI non verde (o ancora in corso) su $APPROVED_SHA"
ok "CI verde"
du_has_mark passo2 || die "passo2 non verificato per questa esecuzione"
du_db_schema_checks
[ "$DU_KO" = 0 ] || die "schema incompleto: applicare tutte le migration incluse quelle 1023"
du_safe_payment_flags || die "flag payout/accounting non sicuri o illeggibili"
TV="$(du_vercel_env_value AFFILIATE_TERMS_VERSION)"
if [ "$TV" = "$TERMS_V3" ]; then ok "AFFILIATE_TERMS_VERSION=$TV"
else die "AFFILIATE_TERMS_VERSION=${TV:-vuota} ≠ $TERMS_V3: esegui il passo 3"; fi
if du_vercel_env_names | grep -qx AFFILIATE_HASH_SECRET; then die "AFFILIATE_HASH_SECRET impostata: decisione = non impostarla"; fi

echo
echo "Comandi (eseguiti fuori dal checkout, con -R: gh non tocca branch locali):"
[ "$PR_DRAFT" = true ] && echo "  gh pr ready $PR_NUMBER -R $REPO_SLUG"
echo "  gh pr merge $PR_NUMBER -R $REPO_SLUG --squash --delete-branch --match-head-commit $APPROVED_SHA"
if [ "$ESEGUI" != 1 ]; then c_grn "DRY-RUN: nessun merge."; exit 0; fi
du_confirm "MERGE 553"
cd "$(mktemp -d)"
[ "$PR_DRAFT" = true ] && gh pr ready "$PR_NUMBER" -R "$REPO_SLUG"
gh pr merge "$PR_NUMBER" -R "$REPO_SLUG" --squash --delete-branch --match-head-commit "$APPROVED_SHA"

echo; echo "== Verifica post-passo =="
MERGED="$(gh pr view "$PR_NUMBER" -R "$REPO_SLUG" --json state,mergeCommit --jq '.state+" "+(.mergeCommit.oid // "")')"
read -r M_STATE M_SHA <<<"$MERGED"
[ "$M_STATE" = MERGED ] && [ -n "$M_SHA" ] || die "PR non risulta MERGED ($MERGED)"
git -C "$REPO_ROOT" fetch -q origin main
[ "$(git -C "$REPO_ROOT" rev-parse origin/main)" = "$M_SHA" ] || c_yel "origin/main non è ancora il merge (o è già avanzato): controlla"
printf '%s\n' "$M_SHA" > "$LOG_DIR/merge-sha.txt"
du_mark passo4 "$M_SHA"
c_grn "Passo 4 OK. SHA del merge: $M_SHA (salvato in $LOG_DIR/merge-sha.txt). Ora passo5-deploy-verifica.sh. NON fare altri push su main finché il deploy non è verde."
echo "Rollback: $DU_ROLLBACK" | sed "s|<SHA del merge stampato qui>|$M_SHA|"
