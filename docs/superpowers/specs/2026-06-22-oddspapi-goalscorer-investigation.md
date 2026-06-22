# Spec/Decision — OddsPapi come fonte quote marcatore (anytime goalscorer)

**Data:** 2026-06-22 · **Owner:** Andrea via Claude Code · **Esito:** ❌ NON FATTIBILE (documentato)

## Context

Le card mostrano "–" su Market/Edge dei marcatori per i match non prezzati dai book US
(es. Germania). Le quote marcatore attuali vengono da **The Odds API player-props US books
(a pagamento)** via `scripts/collect_goalscorer_odds.py`. Ipotesi: usare **OddsPapi** (free,
già integrato per il tennis 1X2) anche per i marcatori → copertura più ampia (book europei) e
gratis. Questa è la valutazione richiesta ("valuta il migliore").

## Investigazione (API OddsPapi v4, sportId soccer = 10)

- `/markets?sportId=10` elenca il market **`10730` = "Anytime Goal Scorer"** (`playerProp=true`).
  Esiste nel catalogo.
- MA nel `/odds?fixtureId=` reale di **Argentina vs Austria** (match major, 20 book: bwin,
  bet365, betmgm, 1xbet, betuk…) il market **10730 NON è presente in nessun book**.
- I market presenti sono 1X2, **Correct Score** (`10336`, esiti "0:0/1:0/…"), Over/Under, ecc.
  Il market `10336` (59 outcomes) che sembrava goalscorer è in realtà **Correct Score**.
- Nessun book popola `playerName` (sempre `null`); `/participants?sportId=10&fixtureId=` → 0.

**Conclusione:** OddsPapi (free tier) **non alimenta di quote il market anytime-goalscorer**
per questi fixture WC. Il market è nel catalogo ma vuoto di odds. Non c'è nemmeno una via di
risoluzione nome-giocatore. → **fonte non utilizzabile per i marcatori.**

## Decisione

- ❌ NON costruire l'integrazione OddsPapi goalscorer (dato assente). Evitato un parser contro
  dati inesistenti.
- ✅ Fonte marcatori = **The Odds API US books (paid)** via il collector esistente, ora
  **schedulato** (`com.agentic-markets.goalscorer-odds`, ogni 4h, finestra 8h). Copre i match
  prezzati dai book US (i major, incl. Germania quando vicina al kickoff) e si mantiene fresco.
- Il "–" residuo su Market/Edge marcatori resta per: (a) match non ancora entro 8h dal kickoff
  (si popolano avvicinandosi), (b) match che i book US non prezzano (minori) → fallback onesto
  FTC (nessuna quota inventata). Il blocco Marcatori mostra comunque il **Modello %**.

## Follow-up possibili (se serve più copertura marcatori, futuro)

- Allargare il collector paid a più region/book di The Odds API (costo).
- Valutare un provider dedicato player-props (es. OpticOdds/tennis-api equivalenti) — costo.
- NON OddsPapi per i marcatori (verificato non disponibile).
