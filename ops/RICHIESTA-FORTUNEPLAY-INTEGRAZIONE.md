# Richiesta tecnica a FortunePlay / mediaroosters — integrazione betslip

> Bozza pronta da inviare al referente affiliate/tecnico FortunePlay. Contesto: BetRedge
> (prodotto di prediction) mostra le quote live FortunePlay e vuole passare le selezioni
> dell'utente direttamente al betslip FortunePlay, preservando l'attribuzione affiliate.

---

## Testo email (IT)

Oggetto: **Integrazione betslip — passaggio selezioni da BetRedge a FortunePlay**

Ciao [nome],

su BetRedge mostriamo le quote live di FortunePlay sulle nostre schede partita e il cliente
compone una schedina dal nostro sito. Vogliamo che, al click, la schedina si apra **già
precompilata** sul vostro sito, mantenendo l'attribuzione affiliate. Ci servono due conferme:

**1) Deep-link pagina-partita (già funzionante — solo conferma attribuzione).**
Usiamo: `https://www.fortuneplay.com/{locale}/sports/{sport}/{slug}-m-{id}?stag={CODICE}`
(es. `/it/sports/soccer/england-dr-congo-m-71068823?stag=...`).
- Conferma: **`stag` è il parametro corretto** per attribuirci il traffico su un deep-link
  diretto (non solo sul redirect mediaroosters)? Qual è il **valore del nostro codice**?

**2) Betslip precompilato (multi-selezione) — è quello che ci manca.**
Sul vostro sito esiste già "**Per accedere a una scommessa condivisa, inserisci il codice
fornito**" (booking code / scommessa condivisa). Ci serve il modo **programmatico** per
generare/passare una selezione o una schedina multipla:
- Esiste un **endpoint "booking"/"share bet"** (BetConstruct) che, date le selezioni,
  restituisce un **codice** o un **URL** che apre il betslip precompilato? Se sì, doc/endpoint.
- In alternativa: un **parametro URL** che aggiunge selezioni al betslip all'apertura
  (es. `?bet=<outcomeId>` o `?bookingCode=<code>`)?

**Formato selezione che abbiamo** (dal vostro feed pubblico `/_sb_api/api/v2/matches/{id}/markets`),
per ogni gamba della schedina:
```
matchId, matchUrnId (es. "bc:match:30174340"),
marketId (es. 307), specifier (es. "bc_id=2313757911"),
outcomeId (es. 2891),
id = "{matchUrnId}/{marketId}/{outcomeId}/{specifier}"
```
(È esattamente lo schema che il vostro betslip salva lato client.) Con questi campi possiamo
costruire la selezione: ci serve solo l'API/URL che li accetta.

Grazie, [Andrea]

---

## Note interne (non inviare)
- Il **deep-link partita è GIÀ attivo** su BetRedge (verificato: apre la partita giusta) → il punto (1) è solo conferma attribuzione `stag`/codice.
- Il **betslip prefill** è l'unico pezzo bloccato: il betslip FortunePlay vive nella loro `sessionStorage` (chiave `bets`) → non scrivibile cross-origin dal nostro sito. Serve la loro API booking-code oppure un parametro URL supportato dalla loro SPA.
- Schema selezione già catturato dal vivo (vedi sopra) → appena danno l'endpoint, l'implementazione è breve.
