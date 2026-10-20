# Affiliate integration — 20 October 2026

## Implemented in this change

- Invite links in the shared desktop sidebar, mobile menu and standalone lobby, in all 11 navigation languages.
- Operational AffiliateSection takes precedence over ClassicInvite when NEXT_PUBLIC_AFFILIATE_V2=1. The demo ClassicInvite variant is never used by the application router. With the flag off, existing referral links and counts remain available.
- USDT and USDC on Polygon, as explicitly requested by Andrea. Wallet confirmation follows the selected asset, selection changes reset network consent, and wallet-change email names the saved asset. Existing selection is preserved when changing a wallet.
- Legacy referral reward grants stop when AFFILIATE_MODE=live. Internal promotional invite codes are preserved. Shadow mode does not change legacy rewards.
- New affiliate clicks use affiliate_referral_clicks: the existing BO affiliate_clicks table has a different contract (link_id/book_key) and must remain untouched. Updated the not-yet-applied v2 migrations and rollback accordingly.
- Atomic maturity RPC plus daily authenticated cron: only due pending rows for active affiliates and valid attributions move to payable; shadow/future/review rows stay unchanged. Does not send funds. Cron is inert unless AFFILIATE_MODE=live.
- Read-only readiness script: node scripts/affiliate-v2/readiness.mjs /path/to/private.env. Prints schema inventory only; no secret values or user rows.

## Verified remote state

Read-only inspection of the BO Supabase database on 20 October: affiliate_links, affiliate_clicks and affiliate_click_stats exist; the seven new affiliate-program tables do not. Existing affiliate_clicks has link_id, book_key, country, region, path, referrer, ip_hash, ua and clicked_at. No database writes performed.

This is why the original migration fails at the affiliate_id index. A regression test recreates this collision on local PostgreSQL, then proves both the corrected migration and rollback preserve the BO click row.

Vercel production flags remain off/unset. Sensitive environment values may not be exportable through env pull: empty exported values are NOT evidence that production lacks its database configuration.

## Release boundaries

This change is preparation, NOT permission to activate monetary commissions. No production deploy, migration, environment change or transfer has been performed.

Apply the four v2 SQL files together only after a verified backup and a fresh schema preflight, from the reviewed commit:

- 20261007120000_affiliate_v2.sql
- 20261015120000_affiliate_v2_wallet.sql
- 20261015130000_affiliate_v2_payouts.sql
- 20261020150000_affiliate_v2_maturity.sql

The first two are currently unapplied in the inspected production schema; do not silently edit/reapply an already-applied copy in another environment. Reconcile migration history deliberately. Existing BO tables and data must remain intact.

## Still required before operational activation

1. Published, approved affiliate terms and a matching AFFILIATE_TERMS_VERSION. Current copy still contains legal/pay-day placeholders: do not expose enrollment as ready until resolved.
2. Recipient-address screening provider and credentials. Current adapter deliberately returns not_screened and payout creation refuses it. Do not bypass this check.
3. Coverage for processor fees, refund/dispute reversals and live accounting reconciliation. The current ledger has incoming payment hooks, but these remaining lifecycle pieces must be completed and verified before AFFILIATE_MODE=live. Maturity alone is not sufficient.
4. Dedicated public sending wallet, funded only when payments are to be made. Andrea confirms it does not exist yet. Never collect seed phrases/private keys.
5. Wire operational payout administration into the separate BO if that is the required admin surface. Current AdminPayouts is on the website's original /admin. BO checkout has unrelated uncommitted ecosystem changes; it was not modified.
6. Production migration/activation and final authenticated end-to-end verification. Local fixtures and mocked chain receipts are not real payout proof.

Once prerequisites are met, configure the reviewed terms version and appropriate mode; set NEXT_PUBLIC_AFFILIATE_V2=1 for the real account panel. AFFILIATE_PAYOUT_COINS=USDT,USDC and AFFILIATE_PAYOUT_NETWORKS=polygon are the confirmed rails. Keep AFFILIATE_PAYOUTS=off until sending wallet, screening and operational checks are complete. No automatic shadow-to-live conversion of historical rows.
