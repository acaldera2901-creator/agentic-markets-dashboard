-- #CRYPTO-ADDR-REGISTRY-0729 — un indirizzo di deposito, un ordine solo. Per
-- sempre, e attraverso ENTRAMBE le tabelle di ordini.
--
-- Il perché sta in come si legge la catena. `checkIncoming` (lib/crypto-verify.ts)
-- somma TUTTI i trasferimenti confermati in entrata verso l'indirizzo: non esiste
-- un legame fra una singola transazione e l'ordine che l'ha richiesta. Finché ogni
-- ordine ha il suo indirizzo la cosa è corretta e semplice — ma se un indirizzo
-- viene riusato, quella somma diventa il saldo di due ordini diversi.
--
-- Due modi in cui il riuso morde, ed è importante distinguerli perché una UNIQUE
-- parziale "solo pending" ne copre uno solo:
--
--   1. DUE PENDING INSIEME sullo stesso indirizzo → un pagamento li salda
--      entrambi. Questo lo ferma anche una UNIQUE WHERE status='pending'.
--   2. UN INDIRIZZO GIÀ PAGATO IN PASSATO riassegnato a un ordine nuovo → il
--      nuovo ordine nasce già "pagato" dalla transazione vecchia, senza che
--      nessuno abbia inviato niente. Una UNIQUE su soli pending NON lo vede,
--      perché l'ordine vecchio ormai è 'paid' e non partecipa più al vincolo.
--      È il caso peggiore: non serve nemmeno una corsa, basta il riuso.
--
-- E perché una tabella e non due indici. Da #WEEKLY-CRYPTO-DIRECT-1 gli ordini
-- crypto vivono in DUE tabelle — `paygate_orders` (piani) e `weekly_pick_orders`
-- (Weekly Pick) — che condividono lo stesso spazio di indirizzi e la stessa
-- funzione di verifica, ma hanno claim atomici separati (claim_paygate_order e
-- claim_weekly_pick_order). Un vincolo per-tabella non può vedere un indirizzo
-- che compare una volta di qua e una volta di là: i due claim non si parlano e
-- concederebbero entrambi. Siccome un piano costa più della Weekly Pick
-- ($14.99/$29.99 contro $12.99), il pagamento del piano salderebbe da solo anche
-- la schedina. Il registro è l'unico posto dove l'unicità è dichiarabile una
-- volta per tutti i rail, presenti e futuri.
--
-- Stato al 2026-07-29: 5 ordini crypto in tutto (4 piani + 1 weekly), 5 indirizzi
-- distinti. Questa migration NON corregge un dato sporco — chiude la porta prima
-- che il volume la apra, ed è per questo che si può applicare senza fretta e
-- senza finestre di manutenzione.

CREATE TABLE IF NOT EXISTS public.crypto_deposit_addresses (
  -- Normalizzato lower() dal chiamante: gli explorer EVM restituiscono lo stesso
  -- indirizzo in checksum-case o tutto minuscolo, e due grafie diverse dello
  -- stesso indirizzo passerebbero il vincolo pur essendo lo stesso posto.
  address    TEXT PRIMARY KEY,
  order_id   UUID NOT NULL,
  -- Quale tabella possiede l'ordine. Niente FK: le due tabelle sono distinte e
  -- una FK condizionale non esiste — il campo serve a dire dove guardare.
  order_kind TEXT NOT NULL CHECK (order_kind IN ('plan', 'weekly')),
  coin       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill degli ordini crypto già esistenti, così il vincolo nasce coerente con
-- la realtà invece che solo con il futuro. ON CONFLICT DO NOTHING: se per assurdo
-- ci fosse già un duplicato in produzione la migration NON deve fallire — la
-- tabella resta con la prima occorrenza e il duplicato emerge dalla query di
-- verifica qui sotto, come diagnosi e non come outage.
INSERT INTO public.crypto_deposit_addresses (address, order_id, order_kind, coin, created_at)
SELECT LOWER(crypto_address_in), id, 'plan', coin, created_at
  FROM public.paygate_orders
 WHERE crypto_address_in IS NOT NULL
ON CONFLICT (address) DO NOTHING;

INSERT INTO public.crypto_deposit_addresses (address, order_id, order_kind, coin, created_at)
SELECT LOWER(crypto_address_in), id, 'weekly', coin, created_at
  FROM public.weekly_pick_orders
 WHERE crypto_address_in IS NOT NULL
ON CONFLICT (address) DO NOTHING;

ALTER TABLE public.crypto_deposit_addresses ENABLE ROW LEVEL SECURITY;

-- No policies + revoke: solo service_role (che bypassa RLS) può toccarla.
-- Stesso trattamento di shopify_events e per la stessa ragione — è una tabella
-- di controllo del percorso pagamenti, nessun client deve poterla leggere né
-- tantomeno inserirci una riga per "prenotare" un indirizzo altrui.
REVOKE ALL ON public.crypto_deposit_addresses FROM anon, authenticated;

-- Diagnosi post-apply (da lanciare a mano, non fa parte della migration):
--   SELECT address, COUNT(*) FROM (
--     SELECT LOWER(crypto_address_in) AS address FROM paygate_orders     WHERE crypto_address_in IS NOT NULL
--     UNION ALL
--     SELECT LOWER(crypto_address_in)            FROM weekly_pick_orders WHERE crypto_address_in IS NOT NULL
--   ) t GROUP BY address HAVING COUNT(*) > 1;
-- Zero righe = nessun indirizzo è mai stato riusato finora.
