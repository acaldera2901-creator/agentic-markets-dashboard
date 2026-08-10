# X API — limiti e costo per la pipeline BetRedge (verificato 2026-08-10)

**Il tier gratuito non esiste più.** X l'ha chiuso ai nuovi sviluppatori il 6 feb 2026 (prima: 500 post/mese). I piani flat Basic $200/mese e Pro $5.000/mese sono chiusi ai nuovi iscritti e il 21 mag 2026 i Basic esistenti sono stati migrati d'ufficio: per un account nuovo l'unica strada è il **pay-per-usage**.

Prezzi ufficiali (docs.x.com/x-api/getting-started/pricing): post creato **$0,015** · post **contenente un link $0,200** (13×, è il costo dominante) · lettura $0,005 con tetto 2M/mese · l'upload media non è una voce a sé.

**I 5 post/giorno del deck ci stanno?** Sì: sul pay-per-usage non esiste alcun tetto di scrittura, quindi 150 post/mese sono ammessi. Il vincolo è il costo, non il limite:
- 5 post/giorno **tutti con link a betredge.com → $1,00/giorno = $30/mese**
- gli stessi 5 post **senza link → $2,25/mese**
- link solo sui 2 post che portano traffico → **$12,10/mese**

**Decisione di Andrea, non mia:** quale delle tre. Nessun minimo mensile, quindi $0 se non si pubblica.

**NON VERIFICATO:** nessuna chiamata reale (nessuna credenziale). Prezzi e limiti letti dalla pagina ufficiale; il rate limit per-endpoint di `POST /2/tweets` non è nell'OpenAPI e va misurato al primo giorno di pubblicazione.
