# Weekly Pick — pagina piena (Fase 1) · design

**Data**: 2026-07-09 · **Ticket**: #WEEKLY-PICK-2 · **Rischio**: medium (codice prodotto + deploy) → deploy-gate + APPROVE prima del rilascio.

## Problema

`/weekly-pick` è la *multipla della casa*, venduta one-off a $12.99 (inclusa nel Pro). Oggi la pagina è scarna: hero + betslip + storico. Tutto il valore analitico è nascosto dietro un click (modale per singola leg), e per chi non ha comprato la pagina è quasi vuota. Non "vale i soldi che il cliente spende".

Obiettivo: trasformarla in una **pagina di analisi completa e densa**, che rende visibile tutto ciò che il modello **già calcola**, più un livello editoriale derivato dai dati — senza nuove dipendenze esterne e senza violare FTC/no-invenzione.

## Scope

**Fase 1 (questa spec)** — solo dati già in casa, FTC-safe:
1. Brief della settimana (template deterministico dai numeri).
2. Schede leg ricche **inline** (non solo in modale), con campi enrichment oggi non mostrati.
3. Anteprima pubblica che converte (per non-acquirenti).
4. Stat aggregate della settimana.
5. Classifica **solo per le leg World Cup** (endpoint ESPN già esistente).

**Fuori scope (Fase 2, spec separata)**: news reali via RSS, H2H, classifiche dei campionati non-WC. Tutti richiedono fetch esterno / fonte nuova.

## Vincoli non negoziabili

- **FTC-safe**: mai quote, mai edge/vincita promessa, mai claim "battiamo il mercato". Coerente con la pagina attuale.
- **No invenzione**: ogni numero/fatto viene da dati reali già persistiti (`unified_predictions.enrichment`, `.notes`, settlement) o da fonte reale già integrata (ESPN standings WC). Il brief è un **template deterministico**, non prosa generata: riempie placeholder con numeri veri. Le formazioni sono le confermate ESPN (`enrichment.lineups`), fail-soft se assenti.
- **Locked = zero leak**: per i non-acquirenti, pick/prob/status/kickoff/detail restano `null` server-side (invariato rispetto a oggi). L'anteprima mostra solo nomi match, competizione, sport, orario e conteggi aggregati — mai la pick o la probabilità della singola leg né la combinata.
- **Surgical**: nessuna migration, nessun tocco al daemon Python, nessuna modifica a `generate/route.ts`. Match dello stile `lp-*` / `.wp-*` esistente.

## Dati disponibili (verificati)

Da `unified_predictions.enrichment` (già letto dal serve route, oggi parzialmente mostrato):

| Campo | Oggi in pagina? | Fonte |
|---|---|---|
| `form_home/away` (last[], w/d/l, gf/ga) | sì (modale) | history modello |
| `lambdas` (xG home/away) | sì (modale) | modello |
| `squad.injuries_home/away` | sì (modale) | Squad Condition Watch |
| `squad.rotation_flag_*` | sì (modale) | Squad Condition Watch |
| `venue.heat/indoor/altitude/tz/travel` | sì (modale) | WC context |
| `venue.rest_days_home/away` | **NO** | WC context |
| `venue.host_advantage` | **NO** | WC context |
| `squad.xi_value_ratio_home/away` (forza rosa %) | **NO** | Squad Condition Watch |
| `lineups` (formazioni confermate / team news) | **NO** | ESPN, ~1h pre-match |
| `group` (girone WC) | **NO** | WC context |
| `notes.p_home/p_draw/p_away` (1X2) | sì (modale) | modello |
| `confidence_score`, `risk_level`, `explanation` | sì (modale) | modello |

Classifica WC: `lib/world-cup.ts` → `fetchWcGroups()` (già servita da `/api/world-cup/standings`, fonte ESPN, cache). Da usare per posizionare le due nazionali di una leg WC.

## Architettura

Nessun componente nuovo pesante. Il flusso resta: `generate` (cron settimanale) salva le legs → `/api/weekly-pick` (serve) proietta per sessione leggendo l'enrichment. **Tutti gli arricchimenti sono aggiunti al serve route** (già fa il join enrichment), così restano coerenti con lo stato live e non serve rigenerare né migrare.

### Unità (confini chiari)

1. **`buildLegDetail` (esteso)** — `app/api/weekly-pick/route.ts`. Aggiunge al payload `detail` i campi oggi mancanti: `restDays {home,away}`, `hostAdvantage`, `squadStrength {home,away}` (da xi_value_ratio, 0..1), `lineups` (formazioni confermate se presenti), `group`. Puro rispetto alla riga, fail-soft (assente → `null`, mai inventato). Input: `RichRow`. Output: oggetto `detail` esteso.

2. **`weeklyBrief(payload)` (nuovo, puro)** — `lib/weekly-pick.ts`. Da selections+aggregati produce i **dati** del brief (non testo): `{ legs, competitions, combinedProb, avgConfidence, strongest: {label, market, prob} }`. Deterministico, testabile. La UI compone il testo multilingua dai suoi campi (nessuna frase hard-coded nel lib).

3. **Aggregati sport/competizioni (nuovo, serve route)** — conteggi derivati dalle selections: breakdown per sport, n. competizioni distinte, confidenza media. Esposti sia sbloccati sia lockati (sono safe: non rivelano pick/prob).

4. **WC standings per leg (nuovo, serve route)** — per le leg con `sport` WC, `fetchWcGroups()` (cache esistente) → posizione/punti delle due nazionali. Fail-soft: fetch fallito o squadra non trovata → nessuna riga classifica, resto invariato. Chiamata una sola volta per request (non per leg).

5. **UI pagina (esteso)** — `app/weekly-pick/page.tsx`:
   - **Brief** sopra la schedina (usa unità 2 + aggregati unità 3).
   - **Schede leg inline**: ogni leg sbloccata rende il suo `detail` completo in card (competizione+fase+orario, pick+prob+confidenza+rischio, barra 1X2, xG, forma 2 squadre, chip contesto, forza rosa %, riposo, vantaggio-casa, formazioni confermate, posizione classifica WC, "perché"). La modale resta per l'anteprima "zoom" ma non è più l'unico modo di vedere l'analisi.
   - **Anteprima pubblica**: elenco match (squadre, competizione, sport, orario) + pannello "cosa sblocchi" con i fattori e i conteggi (unità 3) + prob combinata mostrata come lockata.
   - **Stat aggregate**: riga breakdown sport + confidenza media.
   - Nuovo copy in tutte le 5 lingue di `COPY`/`DCOPY` (it/en/es/fr/ru).

6. **CSS `.wp-*`** — nuove superfici per brief, card inline, pannello anteprima, riga stat. Coerenti con il design system verde esistente. Nessuna collisione di classe (greppa prima, vedi trappole redesign).

### Data flow

```
generate (cron, invariato) ── selections ──► weekly_pick row
                                                   │
/api/weekly-pick (serve) ── join unified_predictions.enrichment
      │                       + fetchWcGroups() [solo se leg WC]
      ├─ unlocked → detail esteso per leg + brief + aggregati + standings
      └─ locked   → nomi match + aggregati + "cosa sblocchi" (no pick/prob)
                                                   │
page.tsx ── render brief · card inline · anteprima · stat
```

## Error handling / fail-soft

- Campo enrichment assente → sezione omessa, nessun placeholder inventato (comportamento già adottato altrove).
- `fetchWcGroups()` errore/timeout → niente classifica, il resto della pagina funziona.
- Nessuna leg WC → nessuna chiamata standings.
- Brief: se un aggregato non è calcolabile (es. combinata nulla per lockato) → mostra solo i campi safe; per il lockato la combinata resta nascosta.
- Riga senza `notes`/probs → la card mostra ciò che ha (pick, forma…) senza barra 1X2.

## Testing (goal-driven)

- **`lib/weekly-pick.test.ts` (esteso)**: `weeklyBrief()` — casi: strongest corretto per prob max con tie-break stabile; competitions distinte; avgConfidence; input vuoto/parziale → campi null-safe. Puro, nessun DB.
- **Serve route**: verifica proiezione — lockato NON contiene pick/prob/detail/combinata; sbloccato contiene detail esteso. (test unità della proiezione se già presente pattern; altrimenti check manuale documentato).
- **Verifica reale (Costruito ≠ Verificato)**: visual-check da loggato (Pro) su prod-like con `WEEKLY_PICK_ENABLED=true` e una riga weekly_pick reale: la pagina rende brief + card + standings WC; da non-loggato/non-acquirente l'anteprima non rivela nulla. Screenshot prima/dopo.

## Rollback

Feature dietro `WEEKLY_PICK_ENABLED`. Le modifiche sono additive al payload/UI; rollback = revert del commit/PR. Nessun dato migrato, nessuno schema cambiato → rollback pulito e immediato.

## Gate

Rischio medium (codice prodotto + deploy su file condivisi). Prima del deploy: **PROPOSAL con change-spec esatta** in `ch_deploy_gate` e `APPROVE #WEEKLY-PICK-2` di un umano (Andrea/Michele). Branch + PR, mai push diretto su main (disciplina deploy). Fetch prima, verifica board+banner dopo (file condivisi).
