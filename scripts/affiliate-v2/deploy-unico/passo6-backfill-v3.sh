#!/usr/bin/env bash
# passo6-backfill-v3.sh — passo 6: commissioni Shopify/Stripe registrate al netto → lordo (termini v3).
# SUBITO dopo il deploy verde (passo 5). Prima l'anteprima (salvata + rollback SQL generato), poi il file.
#   passo6-backfill-v3.sh --env-file F            # anteprima (read-only)
#   passo6-backfill-v3.sh --env-file F --esegui   # applica scripts/affiliate-v2/backfill_gross_v3.sql
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,5p' "$0"; }
du_parse_args "$@"
[ "${#EXTRA_ARGS[@]}" -eq 0 ] || die "argomento sconosciuto: ${EXTRA_ARGS[*]}"
du_init passo6-backfill "Passo 6 — backfill v3 (netto → lordo)" "psql --single-transaction -f <rollback SQL generato qui sotto> (rimette net_usd/amount_usd salvati, solo sulle righe ancora al lordo e fuori payout); in alternativa il backup del passo 0."
du_require_cmd psql
du_need_db
du_has_mark passo5 || die "passo 5 non verde: il backfill va DOPO il deploy del codice (altrimenti arrivano nuove righe nette)"
ok "passo 5 verde: $(cat "$LOG_DIR/passo5.ok")"
BF="$REPO_ROOT/scripts/affiliate-v2/backfill_gross_v3.sql"
[ -f "$BF" ] || die "manca $BF"

PREVIEW_SQL="SELECT id, affiliate_id, rail, status, payout_id, gross_usd, net_usd, rate, amount_usd, round(gross_usd * rate, 2) AS new_amount FROM public.affiliate_commissions WHERE kind IN ('first','renewal') AND net_usd < gross_usd ORDER BY id"
BLOCKED_SQL="SELECT count(*) FROM public.affiliate_commissions c WHERE c.kind IN ('first','renewal') AND c.net_usd < c.gross_usd AND (c.status IN ('in_payout','paid') OR c.payout_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.affiliate_commissions r WHERE r.reverses_id = c.id))"
ELIGIBLE_WHERE="kind IN ('first','renewal') AND net_usd < gross_usd AND status IN ('shadow','pending','payable') AND payout_id IS NULL"

echo "== Anteprima (READ ONLY) =="
TS="$(date -u +%Y%m%dT%H%M%SZ)"
PREV_TXT="$LOG_DIR/$TS-backfill-v3-anteprima.txt"
RB_SQL="$LOG_DIR/$TS-backfill-v3-rollback.sql"
du_sql_ro "$PREVIEW_SQL" | tee "$PREV_TXT"
N_ALL="$(du_sql_val "SELECT count(*) FROM public.affiliate_commissions WHERE kind IN ('first','renewal') AND net_usd < gross_usd")"
N_ELIG="$(du_sql_val "SELECT count(*) FROM public.affiliate_commissions WHERE $ELIGIBLE_WHERE")"
N_BLOCK="$(du_sql_val "$BLOCKED_SQL")"
echo "righe nette: $N_ALL · correggibili dal file: $N_ELIG · che fanno rifiutare il file: $N_BLOCK (anteprima salvata: $PREV_TXT)"
{
  echo "-- rollback del backfill v3 generato $TS dall'anteprima. Solo righe ancora al lordo e fuori payout."
  echo "-- psql \"\$SUPABASE_DB_URL\" -v ON_ERROR_STOP=1 --single-transaction -f <questo file>"
  du_sql_list "SELECT format('UPDATE public.affiliate_commissions SET net_usd = %s, amount_usd = %s WHERE id = %s AND net_usd = gross_usd AND payout_id IS NULL;', net_usd, amount_usd, id) FROM public.affiliate_commissions WHERE $ELIGIBLE_WHERE ORDER BY id"
} > "$RB_SQL"
echo "rollback SQL: $RB_SQL"
if [ "$N_BLOCK" -gt 0 ]; then
  c_red "Il file SI RIFIUTEREBBE: $N_BLOCK righe nette già in un payout o con storni."
  echo "Rettifica manuale OBBLIGATORIA (v3 è retroattiva) — PROPOSAL passo 6: righe in_payout → annulla il payout non marcato (POST /api/admin/affiliate/payouts/{id}/cancel) e rilancia; righe con storni → PROPOSAL dedicata (UPDATE di riga + storni nella stessa proporzione)."
  exit 3
fi
if [ "$N_ELIG" = 0 ]; then ok "nessuna riga da portare al lordo (atteso): niente da applicare"; du_mark passo6 "0 righe"; exit 0; fi
if [ "$ESEGUI" != 1 ]; then c_grn "DRY-RUN: $N_ELIG righe verrebbero portate al lordo. Nessuna modifica."; exit 0; fi
du_confirm "BACKFILL V3 $N_ELIG RIGHE"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 --single-transaction -c "SET lock_timeout = '5s'" -f "$BF"

echo; echo "== Verifica post-passo =="
LEFT="$(du_sql_val "SELECT count(*) FROM public.affiliate_commissions WHERE $ELIGIBLE_WHERE")"
check "nessuna riga correggibile ancora al netto" [ "$LEFT" = 0 ]
[ "$DU_KO" = 0 ] || die "verifica KO. Rollback: psql \"\$SUPABASE_DB_URL\" --single-transaction -f $RB_SQL"
du_mark passo6 "$N_ELIG righe; anteprima $PREV_TXT; rollback $RB_SQL"
c_grn "Passo 6 OK: $N_ELIG righe al lordo. Tieni $PREV_TXT: serve al passo 8 (paragrafo [RIALZO])."
