#!/usr/bin/env bash
# passo2-migration.sh — passo 2: SOLO le migration affiliate, con psql, nell'ordine
# esatto, in UNA transazione; poi `supabase migration repair --status applied`.
# MAI `supabase db push` (applicherebbe anche 202610160002_product_analytics & c.).
#   passo2-migration.sh --env-file F --sha <SHA approvato>            # dry-run
#   passo2-migration.sh --env-file F --sha <SHA approvato> --esegui   # applica
# Si può fare con il codice vecchio ancora in prod (stesse firme, colonne nullable).
# DEVE precedere il merge (passo 4): il codice nuovo chiama funzioni nuove.
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,8p' "$0"; }
du_parse_args "$@"
APPROVED_SHA=""
set -- "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
while [ $# -gt 0 ]; do case "$1" in --sha) APPROVED_SHA="${2:-}"; shift;; *) die "argomento sconosciuto: $1";; esac; shift; done
ROLLBACK="vedi PROPOSAL passo 2, in quest'ordine e SOLO per la parte da annullare: (a) prima il revert del codice se già mergiato; (b) psql -f scripts/affiliate-v2/rollback_reverse_audit_1022.sql; (c) psql --single-transaction -f scripts/affiliate-v2/rollback_refund_cumulative_1022.sql -f supabase/migrations/20261022120000_affiliate_v2_reversal.sql; (d) rollback_clicks_retention_1022.sql (+ togliere il cron da vercel.json); (e) rollback_ops_1022.sql poi rieseguire 20261015120000 e 20261015130000; (f) per #550: DROP FUNCTION affiliate_reverse_commission(text,text,text,numeric,integer) + rieseguire 20261020150000; stack intero: rollback_gate_b.sql (rifiuta se ci sono dati). Le righe di supabase_migrations.schema_migrations: supabase migration repair --status reverted <versioni>."
du_init passo2-migration "Passo 2 — migration affiliate esplicite (psql) + migration repair" "$ROLLBACK"
du_require_cmd psql git supabase
du_need_db
[ -n "$APPROVED_SHA" ] || die "serve --sha <SHA approvato>: i file applicati devono essere quelli dello SHA dell'APPROVE"

[ "$APPROVED_SHA" = "$DEPLOY_APPROVED_SHA" ] || die "SHA diverso dal contesto della run"

# Precondizione 1: backup del passo 0 fatto nelle ultime 24 ore.
if ! du_has_mark passo0 || [ -n "$(find "$LOG_DIR/passo0.ok" -mmin +1440 2>/dev/null)" ]; then
  die "manca il backup del passo 0 delle ultime 24 h (esegui passo0-backup.sh --esegui)"
fi
ok "backup passo 0: $(cat "$LOG_DIR/passo0.ok")"

# Precondizione 2: i file di migration del checkout sono identici a quelli dello SHA approvato.
git -C "$REPO_ROOT" cat-file -e "$APPROVED_SHA^{commit}" 2>/dev/null || git -C "$REPO_ROOT" fetch -q origin "$APPROVED_SHA" || die "SHA $APPROVED_SHA non trovato"
FILES=(); for m in $AFFILIATE_MIGRATIONS; do FILES+=("supabase/migrations/$m.sql"); done
git -C "$REPO_ROOT" diff --quiet "$APPROVED_SHA" -- "${FILES[@]}" || die "i file di migration nel checkout differiscono da $APPROVED_SHA: fai checkout dello SHA approvato"
ok "file di migration = $APPROVED_SHA"

# Cosa manca nel registro remoto.
APPLIED="$(du_applied_versions)"
TO_APPLY=(); TO_REPAIR=()
for m in $AFFILIATE_MIGRATIONS; do
  v="${m%%_*}"; why=""
  printf '%s\n' "$APPLIED" | grep -qx "$v" || why="mancante nel registro"
  case " $ALWAYS_APPLY " in *" $v "*) [ -n "$why" ] || why="nuova in #$PR_NUMBER (riesecuzione idempotente)";; esac
  if [ -n "$why" ]; then TO_APPLY+=("$m"); TO_REPAIR+=("$v"); echo "  APPLICA  $m  ($why)"; else echo "  salta    $m  (già registrata)"; fi
done
[ "${#TO_APPLY[@]}" -gt 0 ] || { ok "niente da applicare"; exit 0; }
PSQL_ARGS=(-X -q -v ON_ERROR_STOP=1 --single-transaction -c "SET lock_timeout = '5s'" -c "SET statement_timeout = '120s'")
for m in "${TO_APPLY[@]}"; do PSQL_ARGS+=(-f "$(du_mig_file "$m")"); done
echo
echo "Comando (una sola transazione: o tutte o nessuna):"
echo "  psql \"\$SUPABASE_DB_URL\" ${PSQL_ARGS[*]}" | sed "s|$REPO_ROOT/||g"
echo "  supabase migration repair --status applied ${TO_REPAIR[*]} --db-url \"\$SUPABASE_DB_URL\""
echo "Migration NON affiliate eventualmente pendenti: NON toccate (gate propri)."
if [ "$ESEGUI" != 1 ]; then c_grn "DRY-RUN: nessuna modifica."; exit 0; fi
du_confirm "APPLICA MIGRATION AFFILIATE"
psql "$DB_URL" "${PSQL_ARGS[@]}"
ok "psql: transazione confermata"
REP_OUT="$(supabase migration repair --status applied "${TO_REPAIR[@]}" --db-url "$DB_URL" 2>&1)" || { echo "$REP_OUT"; die "migration repair fallita: le migration SONO applicate, il registro no. Rilancia solo: supabase migration repair --status applied ${TO_REPAIR[*]} --db-url \"\$SUPABASE_DB_URL\""; }
printf '%s\n' "$REP_OUT" | grep -v "new version\|We recommend" || true

echo; echo "== Verifica post-passo (read-only) =="
APPLIED="$(du_applied_versions)"
for v in "${TO_REPAIR[@]}"; do check "registro: $v applicata" sh -c "printf '%s\n' \"\$1\" | grep -qx '$v'" _ "$APPLIED"; done
du_db_schema_checks
[ "$DU_KO" = 0 ] || die "$DU_KO verifiche KO dopo le migration: NON fare il merge. Rollback: $ROLLBACK"
du_mark passo2 "${TO_REPAIR[*]}"
c_grn "Passo 2 OK."
