#!/usr/bin/env bash
# Test only — builds a throwaway «prod-like» database on a LOCAL Postgres:
# Supabase stubs + profiles stub + the repo migrations prod already has
# (initial schema/exec_sql, shopify_events, affiliate up to 20261020150000),
# recorded in supabase_migrations.schema_migrations, plus seed rows for B1,
# the backfill and the notification list. Refuses any non-local host.
#   setup-prodsim.sh postgres://postgres@127.0.0.1:54391/du_prodsim
set -euo pipefail
URL="$1"
case "$URL" in postgres://*@127.0.0.1:*|postgres://*@localhost:*) ;; *) echo "solo Postgres locale" >&2; exit 2;; esac
DB="${URL##*/}"; ADMIN_URL="${URL%/*}/postgres"
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
P=(psql -X -q -v ON_ERROR_STOP=1)
"${P[@]}" "$ADMIN_URL" -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
"${P[@]}" "$URL" -f "$HERE/supabase-stubs.sql"
"${P[@]}" "$URL" -c "CREATE TABLE profiles (identifier text PRIMARY KEY, name text, plan text NOT NULL DEFAULT 'free',
  requested_plan text, plan_expires_at timestamptz, plan_source text, tx_hash text, referral_code text, referred_by text,
  language text, updated_at timestamptz, created_at timestamptz DEFAULT now())"
APPLIED=(20260524000000_initial_schema 20260724121000_shopify_events 20260725140000_shopify_events_outcome
  20260725150000_shopify_events_amount 20261007120000_affiliate_v2 20261015120000_affiliate_v2_wallet
  20261015130000_affiliate_v2_payouts 20261020150000_affiliate_v2_maturity)
for m in "${APPLIED[@]}"; do
  "${P[@]}" "$URL" -f "$ROOT/supabase/migrations/$m.sql" >/dev/null
  "${P[@]}" "$URL" -c "INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('${m%%_*}','${m#*_}')"
done
"${P[@]}" "$URL" <<'SQL'
INSERT INTO profiles(identifier, plan, plan_source, plan_expires_at, referral_code) VALUES
 ('a@x.io','free',NULL,NULL,'AAA'),
 ('b@x.io','premium','shopify', now() + interval '20 days','BBB'),
 ('c@x.io','premium','paygate', now() + interval '10 days','CCC'),
 ('aff@x.io','free',NULL,NULL,'AFFX');
INSERT INTO shopify_events(event_id, event_type, status, identifier, variant_id, amount, last_error, processed_at) VALUES
 ('o1','orders/paid','stale','a@x.io','111',19.99,'stale: no grant after 15m', now() - interval '40 days'),
 ('o2','orders/paid','pending','c@x.io','222',39.99,NULL, now() - interval '35 days'),
 ('o3','orders/paid','stale','a@x.io','111',19.99,'stale', now() - interval '10 days'),
 ('o4','orders/paid','granted','b@x.io','444',299.00,NULL, now() - interval '5 days'),
 ('o5','orders/paid','unresolved','zz@x.io','111',19.99,NULL, now() - interval '3 days'),
 ('o6','orders/paid','unresolved','zz@x.io','111',19.99,'[affiliate:non-usd]', now() - interval '3 days'),
 ('o7','orders/paid','stale','b@x.io','444',299.00,'stale', now() - interval '50 days');
INSERT INTO affiliates(identifier, code, status, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_at, onerous_ack_version)
 VALUES ('aff@x.io','AFFX','active','aff-2026-10-21-v2', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days', 'aff-2026-10-21-v2');
INSERT INTO affiliate_commissions(affiliate_id, referred_identifier, rail, rail_payment_ref, kind, gross_usd, net_usd, rate,
  amount_usd, renewal_index, status, paid_at, payable_after)
 SELECT id, 'ref1@x.io','shopify','S-1','first', 24.39, 19.99, 0.2, 4.00, 0, 'pending', now() - interval '1 day', now() + interval '59 days'
   FROM affiliates WHERE code = 'AFFX';
SQL
echo "prodsim pronto: $URL"
