#!/usr/bin/env bash
# passo0-backup.sh — passo 0: backup prima delle migration (pg_dump, sola lettura sul DB).
#   passo0-backup.sh --env-file /percorso/env.privato            # dry-run: mostra cosa farebbe
#   passo0-backup.sh --env-file /percorso/env.privato --esegui   # scrive i dump in $DEPLOY_LOG_DIR/backup
# Produce: schema di public + supabase_migrations, e i DATI di affiliate*, profiles,
# shopify_events. Contengono dati personali: restano in $LOG_DIR/backup (permessi 700).
# In più (manuale, consigliato): snapshot/PITR dalla dashboard Supabase.
source "$(dirname "$0")/lib.sh"
du_usage() { sed -n '2,7p' "$0"; }
du_parse_args "$@"
[ "${#EXTRA_ARGS[@]}" -eq 0 ] || die "argomento sconosciuto: ${EXTRA_ARGS[*]}"
du_init passo0-backup "Passo 0 — backup (pg_dump)" "n/a (il backup non modifica nulla)"
du_require_cmd psql pg_dump gzip
du_need_db

# Precondizioni: DB raggiungibile; pg_dump non più vecchio del server.
SV="$(du_sql_val "SHOW server_version_num")"; SMAJ=$((SV / 10000))
DMAJ="$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
echo "server Postgres $SMAJ · pg_dump $DMAJ"
[ "$DMAJ" -ge "$SMAJ" ] || die "pg_dump ($DMAJ) più vecchio del server ($SMAJ): aggiorna i client Postgres"
TABLES="$(du_sql_list "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'affiliate%' OR table_name IN ('profiles','shopify_events')) ORDER BY 1" | tr '\n' ' ')"
echo "tabelle i cui dati vanno nel backup: $TABLES"

TS="$(date -u +%Y%m%dT%H%M%SZ)"; B="$LOG_DIR/backup"
SCHEMA="$B/$TS-schema.sql.gz"; DATA="$B/$TS-data-affiliate-profiles-shopify.sql.gz"
TARGS=(); for t in $TABLES; do TARGS+=(-t "public.$t"); done
echo "1) pg_dump --schema-only -n public -n supabase_migrations → $SCHEMA"
echo "2) pg_dump --data-only ${TARGS[*]} → $DATA"
if [ "$ESEGUI" != 1 ]; then c_grn "DRY-RUN: nessun file scritto."; exit 0; fi
du_confirm "BACKUP"
mkdir -p "$B"; chmod 700 "$B"
pg_dump "$DB_URL" --schema-only --no-owner -n public -n supabase_migrations | gzip > "$SCHEMA"
pg_dump "$DB_URL" --data-only --no-owner "${TARGS[@]}" | gzip > "$DATA"

# Verifica post-passo: archivi integri, schema con la tabella profiles, dati non vuoti.
check "archivio schema integro" gzip -t "$SCHEMA"
check "archivio dati integro" gzip -t "$DATA"
check "lo schema contiene CREATE TABLE public.profiles" sh -c "gzip -dc '$SCHEMA' | grep -q 'CREATE TABLE public.profiles'"
check "i dati contengono COPY public.profiles" sh -c "gzip -dc '$DATA' | grep -q 'COPY public.profiles'"
ls -l "$SCHEMA" "$DATA"
[ "$DU_KO" = 0 ] || die "backup incompleto: NON procedere col passo 2"
du_mark passo0 "$SCHEMA $DATA"
c_grn "Passo 0 OK. Restore (solo in emergenza, su indicazione): gzip -dc <file> | psql \"\$SUPABASE_DB_URL\""
