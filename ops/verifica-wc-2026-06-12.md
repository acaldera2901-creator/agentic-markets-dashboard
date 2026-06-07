# Verifica post-kickoff WC — da eseguire il 12 giugno 2026 (mattina)

> Piano di verifica differito di #ODDS-1 e #SETTLE-1 (APPROVE Andrea 2026-06-06/07).
> Per eseguirla: apri Claude Code (profilo aziendale) e digita
> **"esegui la verifica in ops/verifica-wc-2026-06-12.md"**.
> Tutto READ-ONLY. Connessione DB: connection string psql nella memoria
> `supabase-credentials-agentic-markets`. Repo: ~/Desktop/agentic-markets.

## Check (riportare ad Andrea in tabella: verde/rosso)

1. **Closing lines** — `SELECT count(DISTINCT match_id) FROM odds_snapshots WHERE is_closing=true;`
   Atteso **>0** dopo i kickoff WC dell'11/6. Mostrare un esempio
   (match_id, team_pair_key, captured_at, commence_time): captured_at deve essere
   l'ultimo snapshot prima di commence_time.

2. **Settlement cron** (`/api/cron/settle`, ogni 30 min su Vercel) —
   `SELECT count(*) FROM prediction_log WHERE settled_at > now()-interval '24 hours';`
   e `SELECT count(*) FROM unified_predictions WHERE is_historical=true AND settled_at > now()-interval '24 hours';`
   Atteso **>0** se partite WC finite ieri. Spot-check su 1-2 match WC: `result` e
   `final_score` (dentro notes JSON) devono combaciare col risultato reale.

3. **Gate WC** — `GET https://agentic-markets-roan.vercel.app/api/diagnostics/world-cup`
   con `Authorization: Bearer $RESEARCH_SECRET` (da .env del repo).
   Attesi: `settlement` e `history` passati a **true** in readiness.

4. **Crediti Odds API** — `SELECT * FROM source_quota_log WHERE provider='odds_api' ORDER BY date DESC LIMIT 3;`
   Atteso `requests_made ≤ 3200` con `requests_limit 3200`. Confronto col provider:
   endpoint gratuito `https://api.the-odds-api.com/v4/sports?apiKey=$ODDS_API_KEY`
   (key da .env) → header `x-requests-used` / `x-requests-remaining` (piano 100K/mese).

5. **Join pair-key** — la query del diario 2026-06-07 (unified_predictions WC ↔
   odds_snapshots via team_pair_key calcolato da starts_at+nomi): atteso ~**28/28**
   dopo il fix canonicalizzazione (commit `d7b94f2`).

## Se qualcosa è rosso
Proporre fix come **PROPOSAL** (gate di approvazione: nessuna modifica a codice
prodotto/DB senza APPROVE di Andrea o Michele).
