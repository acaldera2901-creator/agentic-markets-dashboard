# Reddit — playbook operativo u/Betredge

**Data:** 2026-08-13 · **Owner:** marketing · **Decisione di Andrea:** si comunica dal profilo `u/Betredge`, **nessun link nei post**, link solo se richiesto nei commenti.

## Il principio

Nei subreddit che contano la promozione è vietata (`r/algobetting`: "No ads/advertising" · `r/sportsbetting`: "No Advertising or Self-Promotion" · `r/sportsbook`: il contenuto deve stare su Reddit). Un post senza link non viola nulla: è un contributo. Il brand viaggia nel **nome utente**, che è visibile su ogni riga che scriviamo, e la conversione avviene per curiosità — non per click.

Regola dei link, in tre righe:
- **Nel post: mai.** Nemmeno in coda, nemmeno come "fonte".
- **Nel profilo: sì.** È l'unico posto dove è legittimo, e chi clicca sul nome utente lo trova. È anche l'unico punto misurabile.
- **Nei commenti: solo se qualcuno chiede**, e solo rispondendo alla domanda posta. Mai per primi.

## A. Il profilo è la landing page

Va sistemato **prima** del primo post — oggi è vuoto e non converte nulla.

- **Display name:** BetRedge — football & tennis model probabilities
- **Bio (max 200 char):** "We build calibrated probability models for football and tennis and compare them to market prices. We publish our calibration curves, including the parts that don't flatter us. 18+, not advice."
- **Website:** `https://www.betredge.com/?utm_source=reddit&utm_medium=profile&utm_campaign=algobetting`
  → è il solo link taggato dell'operazione, e quindi **la sola sorgente misurabile** di questo canale.
- **Nessuna immagine di prodotto**, nessuno slogan commerciale, nessun prezzo.

## B. Warm-up — 8 giorni, poi si pubblica

Oggi l'account ha **1 commento e 3 giorni di vita**: un post lungo pubblicato adesso rischia il filtro antispam, che è silenzioso (nessun errore, semplicemente nessuno lo legge) e brucia il contenuto per sempre.

- **2-3 commenti al giorno**, in `r/algobetting` (25.344) e `r/sportsanalytics` (23.914).
- **Cosa si commenta:** thread di metodologia dove abbiamo qualcosa di vero da dire — calibrazione, Dixon-Coles, Elo per superficie, qualità dei dati storici, closing line. Il commento deve reggere da solo: un numero, un riferimento, un'obiezione motivata.
- **Cosa non si fa mai:** nominare BetRedge per primi, rispondere "noi facciamo esattamente questo", commentare thread di pick o di risultati.
- **Criterio di uscita dal warm-up:** ≥ 40 di comment karma e zero commenti rimossi. Non è la soglia dei 200 del piano originale — quella era per pubblicare *link*, e qui non ne pubblichiamo.

## C. Il post principale

Testo in `2026-08-13-reddit-algobetting-post.md`, **versione senza link**. Angolo: le curve di calibrazione di calcio e tennis su 23.091 previsioni walk-forward, inclusa l'ammissione che sul calcio il mercato è meglio calibrato del nostro modello.

Struttura pensata per la conversione senza chiedere nulla:
1. **Il titolo ammette il limite** — è la sola cosa che, in quella community, compra il diritto di essere letti.
2. **Le tabelle sono complete** (numerosità per bin inclusa): chi sa leggerle capisce che dietro c'è un sistema vero, non una landing page.
3. **La chiusura invita a discutere il metodo**, non a visitare un sito. Le domande sono l'obiettivo: ogni risposta nei commenti è un secondo contenuto, ed è lì che il nome utente viene cliccato.
4. **Nessun link** — chi vuole trovarci clicca il nome utente o cerca "betredge".

## D. Come si misura, senza link nel post

L'UTM del post non esiste più. Restano tre segnali, tutti reali:

1. **Il link del profilo** (`utm_medium=profile`) — l'unico click tracciato. È il numero principale.
2. **Search Console, query di marca** — ricerche per "betredge" nei giorni successivi al post. Se il post funziona, la gente cerca il nome. È il segnale più onesto che abbiamo.
3. **Traffico diretto** sulla home nelle 48h dopo la pubblicazione, confrontato con la settimana precedente (misurabile solo dopo #FUNNEL-MEAS-0813).

Più i segnali di Reddit stesso: upvote, commenti, e quante volte qualcuno chiede "dove si trova?".

## E. Soglia di morte

Al **27/08**, sui due post pubblicati: se il totale fa **meno di 30 click dal profilo, zero ricerche di marca nuove in Search Console e nessuna richiesta del link nei commenti**, Reddit non è il canale. Si passa all'outreach diretto e si chiude, senza terzo tentativo.

## F. Gate aperti

- **PROPOSAL ferma su Tommy** in `ch_deploy_gate`: il brand compare in contesto betting mentre la qualificazione gambling è aperta. Vale anche per un post senza link, perché il nome utente **è** il brand. Da sbloccare prima della pubblicazione.
- OK di Andrea sul testo del post (nomina il brand in contesto betting).
- L'attribuzione (#FUNNEL-MEAS-0813) deve essere live, altrimenti il punto D.3 non è misurabile.
