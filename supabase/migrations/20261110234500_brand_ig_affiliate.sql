-- #T10-BRAND-IG — profilo brand + riga `affiliates` per il link Instagram di BetRedge (codice BRAND-IG, link /r/BRAND-IG).
-- Perché: gli UTM di /ig misurano solo i click; l'attribuzione di signup/Pro passa da profiles.referral_code + affiliates.
-- Additiva e idempotente (nessuna DROP/ALTER, ON CONFLICT DO NOTHING). Nessun wallet collegato: le commissioni sul
-- codice brand maturano in registro ma non sono pagabili (nessun payout possibile senza wallet).
-- Rollback: DELETE FROM public.affiliates WHERE code='BRAND-IG' (solo se senza attribuzioni/commissioni); DELETE FROM public.profiles WHERE identifier='brand-ig@betredge.com' AND ... (solo se nessun altro vi punta).

INSERT INTO public.profiles (identifier, referral_code, language)
VALUES ('brand-ig@betredge.com', 'BRAND-IG', 'en')
ON CONFLICT (identifier) DO NOTHING;

-- onerous_ack_at/onerous_ack_version: NOT NULL senza default su prod (20261015120000_affiliate_v2_wallet).
INSERT INTO public.affiliates (identifier, code, status, terms_version, terms_accepted_at, age_confirmed_at, onerous_ack_at, onerous_ack_version)
SELECT p.identifier, 'BRAND-IG', 'active', 'brand-internal', now(), now(), now(), 'brand-internal'
FROM public.profiles p
WHERE p.identifier = 'brand-ig@betredge.com' AND UPPER(p.referral_code) = 'BRAND-IG'
ON CONFLICT DO NOTHING;
