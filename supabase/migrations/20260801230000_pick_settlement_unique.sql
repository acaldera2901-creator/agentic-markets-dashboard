-- #SETTLEMENT-DEDUP-0801 — una sola riga di settlement per pick.
--
-- IL FATTO. Il 2026-08-01, incrociando pick_ledger e pick_settlement, sono
-- emerse 11 chiavi su 363 con DUE righe in conflitto fra loro: sempre nella
-- forma `won + void` o `lost + void`, con lo stesso `outcome` reale della
-- partita. Non erano correzioni: erano due scrittori che si pestavano i piedi —
-- core/supabase_client.py::record_pick_settlement (agente Python) e
-- app/api/cron/settle/route.ts (cron TS di failover) — entrambi con un INSERT
-- nudo e nessun vincolo che impedisse la seconda scrittura. Le 11 righe void
-- spurie sono già state rimosse da calde via MCP prima di questa migration.
--
-- PERCHÉ CONTA PIÙ DI 11 RIGHE. pick_settlement è la tabella che deve PROVARE il
-- track record: chiunque deve poter riesportare ledger + settlement e
-- ricalcolare gli stessi numeri che il prodotto pubblica. Due righe che si
-- contraddicono sullo stesso pick significano che il numero dipende da quale
-- riga legge chi aggrega — e una prova che dipende da chi la legge non è una
-- prova.
--
-- ⚠️ COSA QUESTO VINCOLO CHIUDE, dichiarato perché è una perdita vera.
-- Il design originale (#TRACKREC-PROOF-1) prevedeva le correzioni come NUOVA
-- riga, con "l'ultima per settled_at vince" implementato in
-- scripts/track_record_proof.py. Con la UNIQUE quella strada si chiude: la
-- seconda scrittura viene ignorata (ON CONFLICT DO NOTHING nei due scrittori),
-- quindi **vince la PRIMA**, non l'ultima. Il runner è stato allineato nello
-- stesso commit — non ha senso che il vincolo dica una cosa e il lettore
-- un'altra.
-- In pratica non si perde nulla di usato: il meccanismo di correzione non era
-- mai stato esercitato, e le uniche righe multiple mai esistite erano il bug.
-- Se un giorno servisse correggere davvero un settlement, con questo vincolo
-- diventa un'azione deliberata (migration dedicata con l'evidenza), che su un
-- libro mastro è il comportamento giusto: una correzione va motivata, non
-- scritta di soppiatto da un cron.
--
-- ACCOPPIATA AI DUE SCRITTORI. Questa migration NON va applicata da sola: senza
-- l'ON CONFLICT nei due writer, la race che prima produceva una riga in più
-- produrrebbe un ERRORE a ogni run. I due writer sono modificati nello stesso
-- commit.

-- NB: esisteva gia' `pick_settlement_key_idx`, un indice NON unique sulle stesse
-- tre colonne (verificato su produzione: `CREATE INDEX pick_settlement_key_idx
-- ON public.pick_settlement USING btree (source_table, source_id,
-- model_version)`). Un secondo indice unique sulle identiche colonne sarebbe
-- solo peso morto su una tabella che cresce a ogni settlement: quello unique
-- serve entrambi gli scopi — il lookup che l'indice vecchio copriva e il
-- vincolo. Quindi si sostituisce, non si affianca.
DROP INDEX IF EXISTS public.pick_settlement_key_idx;

CREATE UNIQUE INDEX IF NOT EXISTS pick_settlement_pick_key
  ON public.pick_settlement (source_table, source_id, model_version);
