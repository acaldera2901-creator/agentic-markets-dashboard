# Track record: correzione pronta per approvazione

Verifica del 13 novembre 2026. Modifiche isolate nel worktree
`betredge-track-record-coherence`. Nessun deploy e nessuna scrittura di esiti
in produzione eseguiti durante questa verifica.

## Risultati dell'indagine

- Endpoint FortunePlay dei risultati tennis: HTTP 404 riprodotto.
- Endpoint YBets già censito nel progetto: HTTP 200, stessa struttura
  BetConstruct e risultati conclusi con punteggi.
- Le cache ESPN/partner conservavano indefinitamente i risultati dei giorni
  passati, inclusi elenchi incompleti.
- Le prediction scadute dopo sette giorni uscivano dal ciclo normale. Il
  nuovo recupero legge direttamente le prediction pubblicate, anche scadute.
- Lo storico pubblico leggeva al massimo 15.000 righe, poi deduplicava:
  il taglio aveva già escluso risultati vecchi dalle statistiche.

## Cambiamenti

1. Fallback del recupero tennis sul secondo endpoint partner; le pagine di
   fonti diverse non vengono mischiate dopo un errore.
2. Cache dei risultati passati con scadenza di cinque minuti, anche per ESPN.
3. Recupero continuo del tennis pubblicato, 100 righe per ciclo, raggruppate
   cronologicamente per contenere le richieste. Si riparte dall'inizio dopo
   l'ultima pagina; gli errori su una riga non bloccano le altre.
4. Gli esiti sono accettati solo dopo i controlli già esistenti su identità,
   data, candidato unico, completamento e coerenza dei set. Non si allargano
   le tolleranze temporali per ottenere artificialmente più risultati.
5. Scrittura atomica della riga pubblica e della revisione del ledger.
   La pick pubblicata e quella sigillata vengono valutate separatamente;
   risultati reali già confermati non vengono sovrascritti. Nessun replay Elo.
6. Statistiche sull'intera popolazione in un'unica lettura coerente, con
   elenco e cache delle righe visualizzabili ancora limitati a 300.
7. Monitor di coerenza allineato alla popolazione completa.
8. Testi della pagina espliciti sulle ultime 300 pick verificate e punteggio
   visibile anche senza accesso alla prediction. Nel tennis il punteggio è
   indicato come riferito al vincitore per primo.

## Misure, prima di qualsiasi recupero

- Righe DB della popolazione completa: 19.117.
- Pick mostrate, deduplicate: 15.692.
- Esiti verificati: 9.579; 26 esclusi dalla metrica secondo la regola di
  confidenza già vigente e dichiarata nella pagina.
- Pick nella percentuale: 9.553 (6.304 vinte, 3.249 perse), **66,0%**.
- Copertura: **61,0%**; 6.053 senza esito e 60 senza verifica.
- API live troncata al momento del primo controllo: 68,4% su 6.909 pick.
  Non è un confronto di performance nel tempo: cambia la popolazione inclusa.

Dry-run su fonti reali (dettagli in recovery-dry-run.json):

| Campione | Analizzate | Recuperabili | Vinte | Perse | Scritte |
|---|---:|---:|---:|---:|---:|
| Recenti | 100 | 96 | 63 | 33 | 0 |
| Scadute, precedenti al 15 ottobre | 100 | 0 | 0 | 0 | 0 |

Il secondo campione non ha prodotto abbinamenti che passassero tutti i
controlli. Non implica che i match non siano stati giocati. Non si promette
il recupero integrale dell'arretrato. Il nuovo recupero riguarda il tennis;
le residue anomalie storiche di calcio e gli esiti già marcati unverifiable
richiedono una riconciliazione separata con evidenze, non vengono falsamente
marcati verificati. Cancellazioni e ritiri non diventano sconfitte o void
senza conferma della fonte.

## Verifica

- Python: 103 test passati (fonti, recupero, riconciliazione, guardie temporali).
- TypeScript/React/API: 46 test passati.
- Test SQL con PGlite: esito pubblico perso e pick sigillata vinta sullo
  stesso match, append della revisione, protezione dagli aggiornamenti ripetuti.
- `tsc --noEmit --pretty false`: passato.
- `git diff --check`: passato.
- Nessun build/deploy di produzione eseguito.

## Applicazione proposta — TR-1113

Dopo approvazione: integrare il worktree senza modifiche estranee, pubblicare
frontend/API, aggiornare il codice del daemon tennis e riavviare il solo
servizio interessato. Eseguire il recupero a lotti verificati, registrando
esiti applicati e mancanti, e verificare API live (`truncated: false`, massimo
300 righe), coerenza dei conteggi e andamento della copertura.

Il comando di audit è `python -m scripts.recover_published_results --limit 100`;
`--apply` abilita le scritture, `--after UUID` continua dalla pagina precedente.
Il daemon esegue già la scansione ricorrente con il codice aggiornato.

Autorizzazione richiesta da AGENTS.md: «push, deploy, DB, credenziali e soldi
solo con APPROVE #id». Identificatore della proposta: **TR-1113**.
