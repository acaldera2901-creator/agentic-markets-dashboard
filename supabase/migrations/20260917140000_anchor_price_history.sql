-- #ANCORA-CHIUSURA-0917 — la linea di chiusura dell'ancora, che oggi non esiste.
--
-- COSA C'E' GIA', E VA DETTO PRIMA: il prezzo dell'ancora NON e' un dato che ci
-- manca. `prediction_log` lo scrive dal 06/06 (169.000 righe) con `odds_home/
-- draw/away`, `market_p_*`, `blend_alpha` e perfino `result`. Sul calcio sono
-- ~90 punti prezzo per partita. Costruire una raccolta nuova per l'ancora
-- sarebbe rifare cio' che esiste.
--
-- QUELLO CHE MANCA DAVVERO E' L'ULTIMO PUNTO. Misurato il 17/09 sulle partite
-- con fischio dall'11/09 (n=391): la spaziatura fra snapshot consecutivi e' di
-- ~120 minuti OVUNQUE — mediana 119,8 min nelle ultime 3 ore, 120,0 min fra le
-- 10 e le 20 ore prima. Non e' un freeze: e' la griglia del cron
-- `/api/predictions/refresh` (`0 */2 * * *`), che chiama `/api/predictions`,
-- l'unico writer del log per il calcio. Conseguenza aritmetica: l'ultima
-- osservazione prima del fischio cade uniformemente fra 0 e 120 minuti —
-- **solo l'1,8% delle partite ha un prezzo entro 15 minuti dal via**, il 26,6%
-- entro l'ora. Senza l'ultimo punto non esiste una closing line, e senza
-- closing line non esiste il CLV.
--
-- COSA FA QUESTA TABELLA: raccoglie SOLO la coda, fitta, vicino al fischio.
-- Non duplica prediction_log, lo completa dove la griglia a 2 ore non arriva.
--
-- COSTO, MISURATO NON STIMATO: il giro non chiama l'Odds API se non c'e'
-- nessuna partita imminente (si guarda prima il NOSTRO database). Quando
-- chiama, e' una richiesta per lega interessata. Crediti residui il 17/09:
-- 152.966, consumo di giornata 598.

CREATE TABLE IF NOT EXISTS anchor_price_history (
  id             bigserial PRIMARY KEY,

  -- Stessa chiave di odds_snapshots, partner_price_history e ah_odds_history:
  -- e' cio' che permette di mettere in fila la pick, il prezzo partner e la
  -- chiusura dell'ancora sulla stessa partita.
  team_pair_key  text        NOT NULL,
  sport          text        NOT NULL DEFAULT 'football',
  league         text,
  home_name      text,
  away_name      text,

  -- Il book che ha vinto la selezione dell'ancora in questo giro, e il suo
  -- margine: senza, un prezzo non si sa da dove viene e non si puo' pesare.
  bookmaker      text,
  overround      double precision,

  odds_home      double precision,
  odds_draw      double precision,
  odds_away      double precision,

  commence_time  timestamptz NOT NULL,
  captured_at    timestamptz NOT NULL DEFAULT now(),
  minuti_al_via  integer     NOT NULL
);

-- «Tutti i prezzi di chiusura di QUESTA partita, in ordine di tempo.»
CREATE INDEX IF NOT EXISTS idx_aph_partita
  ON anchor_price_history (team_pair_key, captured_at);

-- «L'ultimo prezzo prima del fischio»: e' LA query del CLV.
CREATE INDEX IF NOT EXISTS idx_aph_chiusura
  ON anchor_price_history (team_pair_key, minuti_al_via);

-- Salute dell'impianto: sapere se sta girando invece di dedurlo dal silenzio.
CREATE INDEX IF NOT EXISTS idx_aph_quando
  ON anchor_price_history (captured_at DESC);

COMMENT ON TABLE anchor_price_history IS
  'Coda fitta del prezzo dell''ancora vicino al fischio (#ANCORA-CHIUSURA-0917). Completa prediction_log, che sul calcio ha gia'' ~90 punti a partita ma su griglia di 2 ore. Solo misura: nessun processo di prodotto legge questa tabella per decidere.';
