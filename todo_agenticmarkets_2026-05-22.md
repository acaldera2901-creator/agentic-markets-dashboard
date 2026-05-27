# AgenticMarkets — cose da fare

Fonte: `/Users/calde/Downloads/AgenticMarkets_Documento_vs_Sito_Comparazione_2026-05-22.html`

Data: 2026-05-22

## Priorita 1 — chiudere la base prima di toccare il prodotto

- [ ] Verificare stato live attuale prima di ogni modifica.
- [ ] Confrontare codice locale e live per capire se il sito online e' indietro o se il socio ha cambiato qualcosa.
- [ ] Decidere quale versione e' la sorgente corretta da cui ripartire.
- [ ] Non deployare e non pushare senza approvazione esplicita.
- [ ] Documentare per ogni intervento: file cambiati, logica, gap, rischi e prossimo step.

## Priorita 2 — Bets Dashboard

- [ ] Rendere la homepage un vero Bets Desk operativo, non solo una base visiva.
- [ ] Verificare visualmente che il default della sezione Bets sia corretto.
- [ ] Chiudere la dashboard multi-sport con active bets e history.
- [ ] Standardizzare il data model reale delle bet.
- [ ] Aggiungere o completare campi: `fair_odds`, `bookmaker`, `CLV`, `published_at`, `expires_at`, `explanation`.
- [ ] Completare la logica timestamp: pubblicazione, scadenza e regole backend.
- [ ] Rendere la policy Free/Base/Premium configurabile e pulita.
- [ ] Verificare e rifinire filtri Bets sul live e nel codice locale.

## Priorita 3 — storico e fiducia pubblica

- [ ] Rendere visibile e solido Old Bets Taken / Signal History.
- [ ] Aggiungere tabella pubblica con filtri chiari.
- [ ] Separare segnali attivi, scaduti, vinti, persi e void.
- [ ] Evitare risultati inventati o non verificati.
- [ ] Preparare metriche trasparenti per track record pubblico.

## Priorita 4 — Client Area, Settings, Assistance

- [ ] Verificare che Client Area, Settings, Assistance e FAQ siano davvero visibili e navigabili sul live.
- [ ] Rafforzare Client Area con account summary, piano utente e stato accesso.
- [ ] Aggiungere gestione payment/access senza hardcodare prezzi definitivi.
- [ ] Completare Settings con notifiche, sport preferiti, timezone e leaderboard opt-in.
- [ ] Rafforzare Assistance con flusso utile per supporto cliente.
- [ ] Completare contenuti English-first e coprire label ancora mancanti.

## Priorita 5 — architettura monetizzazione e controllo

- [ ] Progettare admin panel non pubblico.
- [ ] Progettare partner click tracking con API ed event model.
- [ ] Aggiungere tracking per revenue, country, language e conversions.
- [ ] Definire business metrics admin-only.
- [ ] Preparare notification structure: Telegram, email, push o in-app.
- [ ] Non esporre admin o metriche sensibili al pubblico.

## Priorita 6 — provider, signal engine e performance

- [ ] Standardizzare provider architecture per odds e dati.
- [ ] Definire interfaccia provider con gestione errori, rate limit e timezone.
- [ ] Progettare flow controllato: ingestion -> scoring -> approval -> publish -> settlement.
- [ ] Strutturare explanation per ogni prediction.
- [ ] Unificare performance tracking: ROI, CLV, sport, market, model performance.
- [ ] Collegare settlement e storico performance in modo verificabile.

## Priorita 7 — compliance, mobile e funzionalita future

- [ ] Aggiungere o rafforzare layer compliance: 18+, no guarantees, affiliate disclosure, privacy, terms, jurisdiction.
- [ ] Testare UX mobile reale.
- [ ] Sistemare eventuali problemi responsive emersi dal test mobile.
- [ ] Implementare Hall of Fame / Leaderboards solo dopo privacy, verification e admin controls.
- [ ] Implementare Premium cashback/rewards solo dopo terms e approvazione partner.

## Bug/gap specifici da controllare

- [ ] Hub `/tennis` restituisce 404: capire se va pubblicato o rimosso dal flusso.
- [ ] Hub `/api/tennis/state` restituisce 404: capire se endpoint mancante o route non deployata.
- [ ] Sports Dashboard live non mostra marker `Tennis`.
- [ ] Sports Dashboard live non mostra marker `Status`.
- [ ] Settings non appare chiaramente dal controllo live HTML.
- [ ] Assistance non appare chiaramente dal controllo live HTML.
- [ ] Old Bets Taken / Signal History non appare chiaramente dal live HTML.

## Sequenza consigliata di lavoro

1. Allineare live/local.
2. Chiudere Bets Dashboard.
3. Rafforzare Old Bets Taken / Signal History.
4. Rafforzare Client Area e Settings.
5. Progettare tracking, admin, provider e signal engine.
6. Solo dopo: Hall of Fame e Premium rewards.

## Prossima mossa consigliata

Partire da `Bets Dashboard + data model + timestamp/history logic`.

