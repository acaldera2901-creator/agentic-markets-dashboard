#!/usr/bin/env bash
# passo8-notifica-v3.sh — passo 8: elenco destinatari della notifica termini v3. SOLA LETTURA.
# Nessun codice invia email: l'invio è manuale (Andrea), con prova per destinatario.
#   passo8-notifica-v3.sh --env-file F [--bozza /percorso/email-notifica-termini-v3.md]
# Produce in $DEPLOY_LOG_DIR un TSV da compilare: identifier, codice, versione, rialzo, sent_at_utc, message_id.
# La data di invio fa partire i 30 giorni della §7A: senza prova d'invio la §7A non decorre.
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,6p' "$0"; }
du_parse_args "$@"
DRAFT=""
set -- "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
while [ $# -gt 0 ]; do case "$1" in --bozza) DRAFT="${2:-}"; shift;; *) die "argomento sconosciuto: $1";; esac; shift; done
ESEGUI=0; DU_RO=1
du_init passo8-notifica "Passo 8 — destinatari notifica v3 (read-only, invio manuale)" "n/a (comunicazione)"
du_require_cmd psql
du_need_db
du_has_mark passo5 || c_yel "passo 5 non marcato: notifica i termini solo quando /affiliates/terms serve la v3"
TS="$(date -u +%Y%m%dT%H%M%SZ)"; OUT="$LOG_DIR/$TS-notifica-v3-destinatari.tsv"
# [RIALZO] = affiliati con almeno una riga portata al lordo dal passo 6 (dall'anteprima salvata).
RIALZO_IDS=""
PREV="$(ls -t "$LOG_DIR"/*-backfill-v3-anteprima.txt 2>/dev/null | head -1 || true)"
if [ -n "$PREV" ]; then RIALZO_IDS="$(awk -F ' \\| ' 'NR>1 && $4 ~ /^(shadow|pending|payable)$/ && $5=="" {print $2}' "$PREV" | sort -u | tr '\n' ',' | sed 's/,$//')"; fi
echo "affiliati con rialzo (passo 6): ${RIALZO_IDS:-nessuno}"
{
  printf 'identifier\tcode\tterms_version\trialzo\tsent_at_utc\tmessage_id\n'
  du_sql_list "SELECT identifier, code, terms_version, CASE WHEN id = ANY('{${RIALZO_IDS}}'::bigint[]) THEN 'RIALZO' ELSE '' END FROM public.affiliates WHERE terms_version <> '$TERMS_V3' AND status <> 'terminated' ORDER BY terms_accepted_at" | sed 's/ | /\t/g; s/$/\t\t/'
} > "$OUT"
N="$(($(wc -l < "$OUT") - 1))"
echo "destinatari: $N → $OUT (dati personali: resta nella cartella log)"
echo
echo "Da fare a mano, per ogni riga:"
echo "  1. testo: ${DRAFT:-scratchpad/email-notifica-termini-v3.md (bozza EN/IT, da far rivedere a legale-compliance)}; paragrafo [RIALZO] solo dove la colonna lo indica"
echo "  2. invio dalla casella del programma; annota data UTC e Message-ID nelle ultime due colonne"
echo "  3. il pannello mostra già il banner «Termini aggiornati (v3)» a chi ha terms_version ≠ v3"
c_grn "Passo 8: elenco pronto. Nessuna email è stata inviata da questo script."
