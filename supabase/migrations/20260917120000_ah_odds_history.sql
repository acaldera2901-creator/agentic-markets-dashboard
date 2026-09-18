-- #AH-PERSISTENZA-0917 — l'handicap asiatico smette di essere buttato via.
--
-- COSA C'ERA PRIMA. `agents/ah_collector.py` gira da mesi nel roster (run.py,
-- sorvegliato dal watchdog), interroga Pinnacle/SBOBet/The Odds API e pubblica
-- ogni record sullo stream Redis `ah:odds`. **Nessuno consuma QUELLO stream**:
-- `ah:odds` compare solo nella riga che lo pubblica. (Correzione, rilievo di
-- Calde del 17/09: `consume()` ha eccome dei chiamanti — sette, in analyst,
-- model, research, risk_manager, strategist, trader. La prima stesura di questo
-- commento diceva «zero chiamanti» perche' il grep era stato troncato e le
-- occorrenze di `.venv` riempivano l'output. La conclusione non cambia, la
-- prova che la sosteneva era sbagliata e non si lascia scritta in una
-- migration.) Il docstring prometteva «and optionally to DB» e nel file non
-- c'era nessuna scrittura: il segnale di un book sharp entrava in un tubo e si
-- perdeva ogni 60 secondi.
--
-- PERCHE' UNA TABELLA NUOVA E NON `odds_snapshots`. Stessa ragione gia' misurata
-- per #PREZZI-STORIA-0911: `odds_snapshots` ha superato i 34 milioni di righe e
-- non si lascia rileggere — una lettura banale come `is_closing=is.true` risponde
-- HTTP 500 per statement timeout. Un impianto di misura che scrive e non si
-- lascia interrogare non e' un impianto.
--
-- A COSA SERVE, E COSA NON PROMETTE. Serve a rendere TESTABILE una domanda che
-- oggi non ha dati: l'handicap asiatico di un book sharp ha informazione residua
-- rispetto al prezzo 1X2 che gia' usiamo? Non promette che la risposta sia si'.
-- L'11/09 sei feature su sei non avevano informazione residua condizionando sul
-- mercato. Questa tabella serve a poter rispondere, non a far vincere l'ipotesi.
--
-- COSTO. Guardia di cadenza lato agente (default 900s, non i 60s del loop) e
-- solo la linea principale, non le altLines: ~100 righe/giro sulle leghe coperte.

CREATE TABLE IF NOT EXISTS ah_odds_history (
  id             bigserial PRIMARY KEY,

  -- La chiave di partita nella forma canonica di core.odds_api_client
  -- .football_pair_key — la stessa che usano odds_snapshots e
  -- partner_price_history. E' cio' che permette di legare un handicap a una
  -- nostra pick: senza, la riga non e' misurabile e non si scrive.
  team_pair_key  text        NOT NULL,
  match_id       text,
  source         text        NOT NULL,   -- 'pinnacle' | 'sbobet' | 'odds_api_ah'
  sport          text        NOT NULL DEFAULT 'soccer',
  league         text,
  home_name      text,
  away_name      text,

  -- L'handicap e i suoi due prezzi. `ah_line` e' riferito alla squadra di casa,
  -- come lo restituiscono tutte e tre le fonti.
  ah_line        double precision,
  ah_odds_home   double precision,
  ah_odds_away   double precision,

  commence_time  timestamptz NOT NULL,
  captured_at    timestamptz NOT NULL DEFAULT now(),
  -- Minuti al fischio alla cattura: e' LA dimensione su cui si legge un
  -- movimento di linea. Calcolato dove l'istante di cattura e' noto con
  -- certezza, non dedotto dopo da due colonne (stessa scelta di
  -- partner_price_history).
  minuti_al_via  integer
);

-- Una riga per partita, fonte e GIRO. Senza questo vincolo un riavvio, un
-- doppio processo o un replay raddoppiano i punti della serie, e una serie
-- storica con punti doppi non e' piu' misurabile: il movimento si legge sui
-- distinti, non sui conteggi. (Riserva di Andrea sull'APPROVE del 17/09.)
ALTER TABLE ah_odds_history
  ADD CONSTRAINT ah_odds_history_giro_unico
  UNIQUE (team_pair_key, source, captured_at);

-- «Tutti gli handicap di QUESTA partita, in ordine di tempo»: apertura,
-- movimento, chiusura.
CREATE INDEX IF NOT EXISTS idx_aoh_partita
  ON ah_odds_history (team_pair_key, captured_at);

-- «Cosa e' stato catturato di recente»: controlli di salute, e sapere se
-- l'impianto sta girando davvero invece di dedurlo dal silenzio.
CREATE INDEX IF NOT EXISTS idx_aoh_quando
  ON ah_odds_history (captured_at DESC);

-- «Le catture vicine al fischio», da cui si ricava la linea di chiusura.
CREATE INDEX IF NOT EXISTS idx_aoh_chiusura
  ON ah_odds_history (commence_time, minuti_al_via);

COMMENT ON TABLE ah_odds_history IS
  'Storia dell''handicap asiatico dai book sharp (#AH-PERSISTENZA-0917). Una riga per partita, fonte e giro. Solo misura: nessun processo di prodotto legge questa tabella per decidere.';
