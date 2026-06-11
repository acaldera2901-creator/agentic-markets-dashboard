# PROPOSAL #TENNIS-VOID-FIX-1 — Tennis: falsi void da resolver fermo (pre 5 giu)

**Data:** 2026-06-11 · **Owner esecuzione:** Claude (aziendale) · **Serve OK da:** Andrea o Michele (umano)
**Rischio:** medium (dati di produzione `unified_predictions` + codice settlement) → gate `ch_deploy_gate`

---

## Task
L'indagine `#TENNIS-VOID-FIX-1` ha stabilito che i void del tennis **non sono reali**: 117 predizioni `expired→void` (80 match fisici distinti) di tornei realmente giocati (Roland Garros, Birmingham, Open delle Puglie, Makarska), tutte con data predizione **29 mag–4 giu**. Cutover netto al **5 giugno**: prima il resolver ESPN era fermo → 100% void, 0 settlati; dal 5 giu → 0% void, 95 settlati.

**Causa radice:** il resolver di settlement (`get_completed_results`, ESPN) non risolveva prima del 5 giu; `_bulk_expire_stale` ha convertito **silenziosamente** ogni riga `outcome IS NULL` più vecchia di 7 giorni in `void` (sia lato Python `tennis_predictions.outcome='expired'`, sia bridge pubblico `unified_predictions.result='void'`). "Non ho saputo prendere il risultato" è collassato in "void confermato".

**Impatto:**
- `unified_predictions` (track record pubblico, `/api/v2/history`): **15 righe tennis `result='void'`** (3 Roland Garros tra queste) — falsi. Il `win_rate` non è gonfiato (i void sono esclusi dal rate) MA i veri win/loss di quei match **mancano dal denominatore** → track record troncato di ~1 settimana di risultati e con un conteggio "void" fuorviante.
- Le altre ~65 righe dark-period non erano pubblicate (nessuna riga unified) → non inquinano la history ma falsano le metriche interne del modello tennis.
- **18 predizioni del 4 giugno** sono ancora `NULL` e oggi sono al limite dei 7 giorni → stanno per essere **falsamente voidate** al prossimo ciclo.

**Eccezioni plausibilmente vere (NON toccare senza verifica):** 2 void *same-day* — HSBC Championships 10/6, Libéma Open 11/6, voidati lo stesso giorno della partita, sul lato resolver-funzionante → possibili cancellazioni/walkover reali.

---

## Vincolo di fattibilità (importante)
**Non esiste fonte di backfill automatico** per i risultati veri del dark-period: ESPN espone solo i risultati recenti (header feed); gli endpoint per-data e summary-by-event-id restituiscono 400/vuoto per match di 2 settimane fa (verificato oggi). Quindi **non possiamo ri-pescare automaticamente** i risultati 29 mag–4 giu dalla pipeline esistente. Questo è ciò che impedisce un semplice "re-settle" e impone le scelte sotto.

---

## Approccio scelto: separare il fix strutturale (sicuro) dal backfill dati (richiede decisione)

### FASE 1 — Fix strutturale + stop al sanguinamento (LOW risk, raccomandata subito)

**F1a. Smettere di spacciare "non risolto" per "void" nella history pubblica.**
- File: `agents/tennis_settlement.py` (`_bulk_expire_stale`) + `core/supabase_client.py` (`settle_unified_tennis`).
- **Prima:** all'expiry chiama `settle_unified_tennis(match_id, None, void=True)` → riga unified `result='void'`, `status='settled'`, `is_historical=true`.
- **Dopo:** all'expiry NON bridgiare come `void`. La riga unified resta NON storica (esclusa da `/api/v2/history`) oppure viene marcata con uno stato distinto (`result='unresolved'`) che l'endpoint history esclude **sia** dal win_rate **sia** dal conteggio void. `void` resterà riservato ai no-result confermati (path same-day/walkover).
- **Endpoint:** `app/api/v2/history/route.ts` — aggiungere `unresolved` alla lista esclusa (oggi conta `won/lost/void/pending`).

**F1b. Salvare i 18 del 4 giugno prima che scadano.**
- One-shot: tentare il settle contro la fonte risultati corrente; quelli non risolvibili ricadono in F1a (niente falso void) invece di essere persi.

**F1c. (opz.) Allargare la finestra di tentativo** in `_select_pending` così un match resta "tentabile" finché c'è una fonte, invece di diventare non-settlabile a 7 giorni esatti. Da valutare con F1a (con resolver funzionante è meno critico).

### FASE 2 — Correzione track record storico (richiede DECISIONE su fonte)
Tre opzioni alternative per le **15 righe void pubbliche** (13 false + 2 da verificare):

- **2A (raccomandata, onesta, no-fabricazione):** rimuovere dalla history pubblica i 13 falsi void (DELETE righe, oppure `is_demo=true`/`is_verified=false` → escluse da `/api/v2/history`). Non inventiamo win/loss che non possiamo verificare. Le 2 same-day restano void in attesa di verifica manuale.
- **2B:** backfill curato dei win/loss per il sottoinsieme ad alta confidenza (i match RG con risultato pubblico inequivocabile) tramite una mappa risultati compilata a mano + verifica. Più completo, ma manuale e limitato ai match verificabili.
- **2C:** integrare una fonte risultati storica (Sackmann ATP/WTA CSV — già usata da Michele per il backtest 10y, o un results-API a pagamento) per backfill completo. Nuova dipendenza/costo.

### FASE 3 — Elo (OPZIONALE, da decidere a parte)
I match dark-period non sono mai entrati nell'Elo (`EloRating` è stato cumulativo, non un replay). Ri-applicarli ora sarebbe fuori-ordine cronologico. Un fix corretto = replay completo cronologico da baseline Sackmann + match live. **Non incluso** in questa PROPOSAL: lo isolo perché tocca le quote del modello (rischio predizioni) e merita decisione dedicata.

---

## COSA CAMBIERÀ ESATTAMENTE (Fase 1, ciò che chiedo di approvare ora)

| Cosa | File / Tabella | Prima → Dopo |
|---|---|---|
| Bridge expiry | `agents/tennis_settlement.py` `_bulk_expire_stale` | `settle_unified_tennis(..., void=True)` → **non** bridgia come void; lascia non-storico o `unresolved` |
| Mapping risultato | `core/supabase_client.py` `settle_unified_tennis` | aggiunge ramo `unresolved` distinto da `void` |
| History | `app/api/v2/history/route.ts` (righe ~78-93) | esclude `unresolved` da win_rate e dal conteggio void |
| Rescue 4 giu | one-shot script `scripts/` | tenta settle dei 18 NULL del 4/6; non risolti → non-void |
| Track record | `unified_predictions` (Fase 2, **dopo scelta 2A/2B/2C**) | 13 righe `result='void'` → rimosse/escluse (2A) o → win/lost verificati (2B/2C) |

- **Comandi/step:** branch isolato su `origin/main` (worktree, regola anti-contaminazione council) → modifica codice F1a/F1b → build + `tsc` + `scripts/verify-projection` + nuovo test sintetico "expired non diventa void pubblico" → review → ff su `origin/main` → Vercel. La parte dati (Fase 2) eseguita con query mirate **solo dopo** scelta 2A/2B/2C, con backup della tabella prima.
- **Reversibilità/rollback:** codice = revert commit. Dati Fase 2 = backup `unified_predictions` (export righe tennis interessate) prima di ogni DELETE/UPDATE; 2A reversibile re-inserendo dal backup.
- **Blast radius:** solo settlement tennis + history tennis. Football, WC, piani, banner, pagamenti: **non toccati**. Il resolver vivo (Jun 5+) continua a funzionare invariato.
- **Piano di verifica:** (1) test: una riga expired NON produce `result='void'` pubblico; (2) `/api/v2/history` tennis: void scende ~da 15 ai soli veri, win_rate ricalcolato su denominatore corretto; (3) i 18 del 4/6 non risultano voidati il giorno dopo; (4) conteggi prima/dopo loggati nel report.

---

## Domanda per l'APPROVE
1. **Fase 1** (fix strutturale + rescue 18): procedo? — *raccomando sì, low-risk.*
2. **Fase 2** quale opzione: **2A** rimuovi falsi void (raccomandata) / **2B** backfill manuale RG / **2C** fonte storica?
3. **Fase 3 Elo**: ora, dopo, o mai?
