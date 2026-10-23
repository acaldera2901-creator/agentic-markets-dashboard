#!/usr/bin/env bash
# Test only — runs every deploy-unico script against a THROWAWAY local Postgres
# (built by setup-prodsim.sh), a local stub of the site/PostgREST and fake gh/vercel.
# Never touches GitHub/Vercel/Supabase for real (except `git fetch origin main`, read-only).
#   run-local.sh postgres://postgres@127.0.0.1:54391/du_prodsim [stub-port]
set -uo pipefail
URL="$1"; PORT="${2:-54392}"
HERE="$(cd "$(dirname "$0")" && pwd)"; DU="$(dirname "$HERE")"; ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
WORK="$(mktemp -d)"; export FAKE_STATE="$WORK/state"; mkdir -p "$FAKE_STATE" "$WORK/site/.vercel" "$WORK/bo/.vercel"
echo '{"projectId":"prj_SITE","orgId":"team_T","projectName":"betredge"}' > "$WORK/site/.vercel/project.json"
echo '{"projectId":"prj_BO","orgId":"team_T","projectName":"backoffice"}' > "$WORK/bo/.vercel/project.json"
printf 'CRON_SECRET=x\nADMIN_SECRET=x\nAFFILIATE_MODE=shadow\nNEXT_PUBLIC_AFFILIATE_V2=1\nAFFILIATE_PAYOUTS=off\n' > "$FAKE_STATE/env-site.txt"
export PATH="$HERE/fakebin:$PATH" DEPLOY_LOG_DIR="$WORK/log" SITE_URL="http://127.0.0.1:$PORT" VERCEL_CWD="$WORK/site"
HEAD_SHA="$(git -C "$ROOT" rev-parse HEAD)"; export FAKE_PR_HEAD="$HEAD_SHA" FAKE_BO_HEAD="5e04933187d1eddca0c3af42e09a1815e18e6703"
export DEPLOY_RUN_ID="test-$RANDOM" DEPLOY_APPROVED_SHA="$HEAD_SHA"
ENVF="$WORK/env.privato"
cat > "$ENVF" <<EOF
SUPABASE_DB_URL=$URL
SUPABASE_URL=http://127.0.0.1:$PORT
SUPABASE_SERVICE_ROLE_KEY=test
CRON_SECRET=cron-test
ADMIN_SECRET=admin-test
SHOPIFY_VARIANT_BASE=111
SHOPIFY_VARIANT_PREMIUM=222
SHOPIFY_VARIANT_PREMIUM_ANNUAL=444
EOF
bash "$HERE/setup-prodsim.sh" "$URL" 2>&1 | grep -v NOTIFICA | tail -1
node "$HERE/stub-server.mjs" "$PORT" "$URL" & STUB_PID=$!
trap 'kill "$STUB_PID" 2>/dev/null' EXIT   # only the PID started here
sleep 1
PASS=0; FAIL=0
not() { ! "$@"; }
t() { local d="$1"; shift; if "$@"; then echo "  PASS $d"; PASS=$((PASS+1)); else echo "  FAIL $d"; FAIL=$((FAIL+1)); fi; }
q() { psql "$URL" -X -tAq -c "$1"; }
run() { local name="$1" input="$2"; shift 2; echo; echo "### $name"; printf '%s\n' "$input" | bash "$DU/$name" --env-file "$ENVF" "$@" > "$WORK/out.txt" 2>&1; local rc=$?; tail -n "${TAIL:-6}" "$WORK/out.txt"; return $rc; }

run 00-letture.sh "" --sha "$HEAD_SHA"; rc=$?
t "00: NON VAI senza ADMIN/CRON? no: VAI (rc 0)" [ "$rc" = 0 ]
t "00: vede 5 migration affiliate da applicare" grep -q "migration affiliate da applicare al passo 2: 20261022120000 20261022130000 20261022140000 20261022150000 20261022160000" "$WORK/out.txt"
t "00: orfani 1 entro 30 gg, 3 oltre" grep -q "entro 30 gg = 1 · oltre 30 gg = 3" "$WORK/out.txt"
t "00: 1 unresolved senza marcatore" grep -q "SENZA marcatore valuta: 1" "$WORK/out.txt"
t "00: AFFILIATE_MODE letto shadow" grep -q "AFFILIATE_MODE=shadow" "$WORK/out.txt"
t "00: readiness → mancano affiliate_refund_events/admin" grep -q "affiliate_refund_events" "$WORK/out.txt"
echo "AFFILIATE_HASH_SECRET=s" >> "$FAKE_STATE/env-site.txt"
run 00-letture.sh "" --sha "$HEAD_SHA"; rc=$?
t "00: con AFFILIATE_HASH_SECRET → NON VAI (rc 1)" [ "$rc" = 1 ]
grep -v '^AFFILIATE_HASH_SECRET=' "$FAKE_STATE/env-site.txt" > "$FAKE_STATE/e" && mv "$FAKE_STATE/e" "$FAKE_STATE/env-site.txt"
run 00-letture.sh "" --sha deadbeef; rc=$?
t "00: SHA approvato diverso dall'head → NON VAI" [ "$rc" = 1 ]

run passo2-migration.sh "" --sha "$HEAD_SHA"; rc=$?
t "passo2 senza backup → rifiuta" [ "$rc" != 0 ]
run passo0-backup.sh ""; t "passo0 dry-run non scrive" [ ! -d "$WORK/log/backup" ]
run passo0-backup.sh "NO" --esegui; t "passo0 conferma sbagliata → STOP, nessun file" [ ! -d "$WORK/log/backup" ]
run passo0-backup.sh "BACKUP" --esegui; rc=$?
t "passo0 --esegui OK" [ "$rc" = 0 ]
t "passo0: dump schema+dati presenti" [ "$(ls "$WORK/log/backup" | wc -l | tr -d ' ')" = 2 ]
run passo2-migration.sh "" --sha "$HEAD_SHA"; t "passo2 dry-run: nessuna funzione nuova" [ "$(q "SELECT count(*) FROM pg_proc WHERE proname='affiliate_admin_reverse_commission'")" = 0 ]
TAIL=30 run passo2-migration.sh "APPLICA MIGRATION AFFILIATE" --sha "$HEAD_SHA" --esegui; rc=$?
t "passo2 --esegui OK" [ "$rc" = 0 ]
t "passo2: 1023 left_at presente" [ "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='affiliates' AND column_name='left_at'")" = 1 ]
t "passo2: inbox nel registro" [ "$(q "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261023130000'")" = 1 ]
t "passo2: 1023 nel registro" [ "$(q "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261023120000'")" = 1 ]
t "passo2: 160000 nel registro" [ "$(q "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261022160000'")" = 1 ]
t "passo2: 202610160002 (non affiliate) NON applicata" [ "$(q "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='202610160002'")" = 0 ]
t "passo2: 8 funzioni presenti" [ "$(q "SELECT count(DISTINCT proname) FROM pg_proc WHERE proname IN ('affiliate_reverse_commission','affiliate_admin_reverse_commission','affiliate_screen_wallet','affiliate_set_status','affiliate_review_attribution','affiliate_payout_mark_sent','affiliate_payout_unmark_sent','affiliate_purge_clicks')")" = 8 ]
TAIL=12 run passo2-migration.sh "APPLICA MIGRATION AFFILIATE" --sha "$HEAD_SHA" --esegui; rc=$?
t "passo2 rieseguito (idempotente, riapplica le cinque 1022) OK" [ "$rc" = 0 ]

run passo3-env-terms.sh ""; t "passo3 dry-run: env invariata" not grep -q AFFILIATE_TERMS_VERSION "$FAKE_STATE/env-site.txt"
run passo3-env-terms.sh "TERMINI V3" --esegui; t "passo3: TERMS_VERSION=v3" grep -qx "AFFILIATE_TERMS_VERSION=aff-2026-10-22-v3" "$FAKE_STATE/env-site.txt"

run passo4-merge.sh "" --sha "$HEAD_SHA"; rc=$?; t "passo4 dry-run OK, nessun merge" [ "$rc" = 0 ] && [ ! -f "$FAKE_STATE/merged-553" ]
run passo4-merge.sh "" --sha "0000000000000000000000000000000000000000"; t "passo4: head ≠ SHA approvato → rifiuta" [ $? != 0 ]
FAKE_CI_BAD=1 run passo4-merge.sh "" --sha "$HEAD_SHA"; t "passo4: CI rossa → rifiuta" [ $? != 0 ]
run passo4-merge.sh "" --sha "$HEAD_SHA" --main-atteso 1111111111111111111111111111111111111111; t "passo4: main avanzato → rifiuta" [ $? != 0 ]
run passo4-merge.sh "MERGE 553" --sha "$HEAD_SHA" --esegui; rc=$?
t "passo4 --esegui: ready + merge --squash --match-head-commit" grep -q "pr merge 553 -R acaldera2901-creator/agentic-markets-dashboard --squash --delete-branch --match-head-commit $HEAD_SHA" "$FAKE_STATE/calls.log"

run passo6-backfill-v3.sh ""; t "passo6 senza passo5 verde → rifiuta" [ $? != 0 ]
TAIL=40 run passo5-deploy-verifica.sh "CHIAMA CRON" --merge-sha "$HEAD_SHA" --codice AFFX --chiama-cron --attesa-min 1; rc=$?
t "passo5 verde" [ "$rc" = 0 ]
run passo6-backfill-v3.sh ""; t "passo6 dry-run: riga ancora netta" [ "$(q "SELECT net_usd FROM affiliate_commissions WHERE rail_payment_ref='S-1'")" = 19.99 ]
TAIL=8 run passo6-backfill-v3.sh "BACKFILL V3 1 RIGHE" --esegui; rc=$?
t "passo6 --esegui: lordo + amount ricalcolato" [ "$(q "SELECT net_usd||'/'||amount_usd FROM affiliate_commissions WHERE rail_payment_ref='S-1'")" = "24.39/4.88" ]
RB="$(ls "$WORK"/log/*-backfill-v3-rollback.sql | tail -1)"
psql "$URL" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$RB" >/dev/null
t "passo6: il rollback generato rimette 19.99/4.00" [ "$(q "SELECT net_usd||'/'||amount_usd FROM affiliate_commissions WHERE rail_payment_ref='S-1'")" = "19.99/4.00" ]
TAIL=3 run passo6-backfill-v3.sh "BACKFILL V3 1 RIGHE" --esegui

TAIL=8 run passo7-mode-live.sh ""; t "passo7 dry-run: mode ancora shadow" grep -qx "AFFILIATE_MODE=shadow" "$FAKE_STATE/env-site.txt"
TAIL=10 run passo7-mode-live.sh "AFFILIATE LIVE" --esegui; rc=$?
t "passo7: AFFILIATE_MODE=live + redeploy" [ "$rc" = 0 ] && grep -qx "AFFILIATE_MODE=live" "$FAKE_STATE/env-site.txt" && grep -q "vercel redeploy site-1.vercel.app --target production" "$FAKE_STATE/calls.log"

TAIL=8 run passo8-notifica-v3.sh ""; F="$(ls "$WORK"/log/*-notifica-v3-destinatari.tsv | tail -1)"
t "passo8: 1 destinatario v2 marcato RIALZO" grep -q $'^aff@x.io\tAFFX\taff-2026-10-21-v2\tRIALZO' "$F"

run passo9-bo.sh "" --bo-dir "$WORK/site" --bo-sha "$FAKE_BO_HEAD"; t "passo9: bo-dir = progetto del sito → rifiuta" [ $? != 0 ]
TAIL=10 run passo9-bo.sh "BO MERGE" --bo-dir "$WORK/bo" --bo-sha "$FAKE_BO_HEAD" --esegui; rc=$?
t "passo9: env BO impostate (segreto = ADMIN_SECRET) + merge PR 2" [ "$rc" = 0 ] && grep -qx "BETREDGE_ADMIN_SECRET=admin-test" "$FAKE_STATE/env-bo.txt" && grep -qx "BETREDGE_ADMIN_BASE_URL=http://127.0.0.1:$PORT" "$FAKE_STATE/env-bo.txt"
t "nessun segreto nei log" not grep -rq "admin-test\|cron-test" "$WORK/log"

echo; echo "### recupera-ordini-orfani.ts"
cd "$ROOT" || exit 1
DEPLOY_LOG_DIR="$WORK/log" npx tsx "$DU/recupera-ordini-orfani.ts" --env-file "$ENVF" > "$WORK/orf.txt" 2>&1; cat "$WORK/orf.txt" | grep -v "^\[" | head -40
t "orfani dry-run: o1 concedibile (base monthly 30 gg)" grep -q "CONCEDEREBBE: base monthly (30 giorni)" "$WORK/orf.txt"
t "orfani dry-run: o2 rifiutato (PayGate attivo)" grep -q "abbonato PayGate attivo" "$WORK/orf.txt"
t "orfani dry-run: o7 segnalato (granted successivo)" grep -q "granted DOPO questo" "$WORK/orf.txt"
t "orfani dry-run: o3 (entro 30 gg) NON in lista" not grep -q "ordine o3" "$WORK/orf.txt"
t "orfani dry-run: nessuna scrittura" [ "$(q "SELECT status FROM shopify_events WHERE event_id='o1'")" = stale ]
printf 'o1\n' | DEPLOY_LOG_DIR="$WORK/log" npx tsx "$DU/recupera-ordini-orfani.ts" --env-file "$ENVF" --esegui --ordini o1 > "$WORK/orf2.txt" 2>&1
t "orfani: --esegui senza --gate → STOP" grep -q "serve --gate SHOPIFY-ORPHANS-1022" "$WORK/orf2.txt"
printf 'no\n' | DEPLOY_LOG_DIR="$WORK/log" npx tsx "$DU/recupera-ordini-orfani.ts" --env-file "$ENVF" --esegui --gate SHOPIFY-ORPHANS-1022 --ordini o1 > "$WORK/orf3.txt" 2>&1
t "orfani: conferma sbagliata → saltato" [ "$(q "SELECT status FROM shopify_events WHERE event_id='o1'")" = stale ]
printf 'o1\n' | DEPLOY_LOG_DIR="$WORK/log" npx tsx "$DU/recupera-ordini-orfani.ts" --env-file "$ENVF" --esegui --gate SHOPIFY-ORPHANS-1022 --ordini o1 > "$WORK/orf4.txt" 2>&1; grep -E "OK:|Concessi|STOP" "$WORK/orf4.txt"
t "orfani: o1 granted + piano base 30 gg (via activateShopifyPlan)" [ "$(q "SELECT e.status||'/'||p.plan||'/'||p.plan_source||'/'||(p.plan_expires_at > now() + interval '29 days')::text FROM shopify_events e JOIN profiles p ON p.identifier=e.identifier WHERE e.event_id='o1'")" = "granted/base/shopify/true" ]
RBJ="$(ls "$WORK"/log/*-orfani-rollback.json | tail -1)"
printf 'o1\n' | DEPLOY_LOG_DIR="$WORK/log" npx tsx "$DU/recupera-ordini-orfani.ts" --env-file "$ENVF" --rollback "$RBJ" --esegui > "$WORK/orf5.txt" 2>&1; grep -E "→|STOP" "$WORK/orf5.txt" | head -4
t "orfani rollback: o1 di nuovo stale, profilo di nuovo free" [ "$(q "SELECT e.status||'/'||p.plan||'/'||coalesce(p.plan_source,'-') FROM shopify_events e JOIN profiles p ON p.identifier=e.identifier WHERE e.event_id='o1'")" = "stale/free/-" ]
printf 'o9\n' | DEPLOY_LOG_DIR="$WORK/log" npx tsx "$DU/recupera-ordini-orfani.ts" --env-file "$ENVF" --esegui --gate SHOPIFY-ORPHANS-1022 --ordini o9 > "$WORK/orf6.txt" 2>&1
t "orfani: ordine fuori lista → STOP" grep -q "non nella lista" "$WORK/orf6.txt"

echo; echo "RISULTATO: $PASS PASS, $FAIL FAIL (lavoro in $WORK)"
[ "$FAIL" = 0 ]
