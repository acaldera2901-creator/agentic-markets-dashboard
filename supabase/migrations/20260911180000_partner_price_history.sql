-- #PREZZI-STORIA-0911 — la storia dei prezzi partner, in casa propria.
--
-- PERCHE' UNA TABELLA NUOVA E NON `odds_snapshots`.
-- Il primo tentativo scriveva li'. Funzionava — 1.442 righe in un giro, zero
-- errori — ed era illeggibile: `odds_snapshots` ha 16,2 MILIONI di righe e
-- nessun indice che copra la colonna `source`, quindi ogni query di lettura
-- moriva in statement timeout (8 secondi). E l'indice non si poteva aggiungere:
-- CONCURRENTLY non gira dentro una transazione, la versione normale deve
-- scansionare tutta la tabella e sfora lo stesso timeout.
--
-- Un impianto di misura che scrive e non si lascia rileggere non e' un
-- impianto: e' zavorra. Quindi i prezzi partner vivono in una tabella propria,
-- piccola e indicizzata per le domande che dovra' reggere.
--
-- A COSA SERVE. Oggi non sappiamo se abbiamo un vantaggio sul mercato, e non
-- perche' manchino le idee: manca il METRO. Misurato l'11/09, sei feature del
-- modello non hanno informazione residua rispetto al prezzo (tutte sotto |t|=2
-- condizionando sul mercato), e il candidato piu' forte — il movimento della
-- linea — non si e' potuto nemmeno testare, perche' il CLV ricostruito a
-- posteriori agganciava 17 pick su 74.
--
-- Con una riga per partita, per book e per giro, fra due settimane si potra'
-- rispondere a tre domande che oggi non hanno risposta:
--   * qual e' il nostro closing line value;
--   * se il movimento della linea distingue le pick buone da quelle obsolete;
--   * se esiste un segmento in cui battiamo la chiusura.

CREATE TABLE IF NOT EXISTS partner_price_history (
  id             bigserial PRIMARY KEY,
  -- La chiave di partita, nella stessa forma usata altrove (`teamPairKey`):
  -- e' cio' che permette di legare un prezzo a una nostra pick.
  team_pair_key  text        NOT NULL,
  bookmaker      text        NOT NULL,
  sport          text        NOT NULL,
  home_name      text,
  away_name      text,
  odds_home      double precision,
  odds_draw      double precision,
  odds_away      double precision,
  commence_time  timestamptz NOT NULL,
  captured_at    timestamptz NOT NULL DEFAULT now(),
  -- Minuti mancanti al fischio al momento della cattura. Ridondante rispetto
  -- alle due colonne sopra, ma e' LA dimensione su cui si guarda un movimento
  -- di linea: averla pronta evita di ricalcolarla in ogni analisi e permette
  -- di indicizzarla.
  minuti_al_via  integer
);

-- La domanda principale: «tutti i prezzi di QUESTA partita, in ordine di
-- tempo». Serve per apertura, movimento e chiusura.
CREATE INDEX IF NOT EXISTS idx_pph_partita
  ON partner_price_history (team_pair_key, captured_at);

-- La seconda: «cosa e' stato catturato di recente», per i controlli di salute
-- e per sapere se l'impianto sta girando.
CREATE INDEX IF NOT EXISTS idx_pph_quando
  ON partner_price_history (captured_at DESC);

-- La terza: «le catture vicine al fischio», che sono quelle da cui si ricava la
-- linea di chiusura.
CREATE INDEX IF NOT EXISTS idx_pph_chiusura
  ON partner_price_history (commence_time, minuti_al_via);

COMMENT ON TABLE partner_price_history IS
  'Storia dei prezzi dai book partner (#PREZZI-STORIA-0911). Una riga per partita, book e giro del cron. Solo misura: nessun processo di prodotto legge questa tabella per decidere.';
