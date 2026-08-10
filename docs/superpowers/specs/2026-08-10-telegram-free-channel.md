# Canale Telegram FREE (#TG-FREE-0810)

**Data:** 2026-08-10 · **Origine:** deck Maven, item 06 · **Rischio:** basso sul codice, **medio sulla copy** (vedi §4)

## Il codice è pronto, il canale no

`core.telegram_client.send(text, tier="pro")` accetta ora un tier. Il default è `"pro"`, quindi i **cinque call site esistenti** (`analyst`, `strategist`, `risk_manager`, `result_settlement`, `live_monitor`) scrivono dove scrivevano prima: zero regressione. Il free è opt-in e senza `TELEGRAM_CHAT_ID_FREE` è un **no-op** — il codice si deploya prima che il canale esista.

Sette test in `tests/test_telegram_tiers.py` inchiodano la proprietà che conta: **nessun fallback silenzioso sul PRO**. Un free senza canale configurato non deve mandare contenuti free ai paganti, che sarebbe l'esatto contrario della scala premi. E un `tier` scritto male cade sul **PRO**, non sul free: fail-closed sul lato costoso, perché regalare contenuti pro al canale gratuito è l'errore irrecuperabile.

## 1. Dove non sono d'accordo col deck

Il deck assegna al free i *«top picks»* e al PRO le *«higher confidence picks»*. Tradotto: **al free vanno i pronostici peggiori.**

Credo sia sbagliato, e non per generosità. Un canale gratuito che si vede essere la versione scadente del prodotto insegna al pubblico che il prodotto è scadente — e chi non paga non è un cliente da punire, è un cliente che non ha ancora deciso. Un free channel mediocre converte peggio di uno buono, perché la domanda che si fa l'utente non è «cosa mi manca» ma «questa gente ci prende?».

Inoltre: sotto il floor di surfacing **non esiste un favorito chiaro** — dare al free le predizioni sotto soglia significa dargli rumore, e il rumore non costruisce fiducia in nessuno.

## 2. La scala che propongo: stessa qualità, meno quantità, in ritardo

| | FREE | PRO |
|---|---|---|
| Qualità | **la stessa** — sopra lo stesso floor | la stessa |
| Quantità | **1 pick al giorno** | tutte |
| Tempismo | **+90 minuti** | appena il modello chiude |
| Multiple | no | sì |
| Risultati | **tutti, anche dei pick non ricevuti** | tutti |

**Il ritardo è la ragione onesta per pagare.** Il valore di una predizione decade mentre il mercato si muove: chi la riceve 90 minuti dopo trova una quota peggiore. Non è una punizione inventata, è il meccanismo reale — ed è **misurabile**, quindi si può dimostrare invece di affermarlo.

## 3. Il motore di conversione è la riga «Risultati»

È il pezzo più importante di tutto il documento, e viene dal deck stesso (*«public scorekeeping builds credibility»*).

**Il canale free pubblica l'esito di TUTTI i pronostici, compresi quelli che non ha ricevuto.** Ogni giorno un utente gratuito vede, con i numeri, com'è andata la selezione che gli è stata mostrata *e* quella che non gli è stata mostrata.

Questo converte più di qualsiasi teaser, per tre motivi: è **vero** (sono risultati reali, verificabili), non richiede alcun dark pattern, e sposta la domanda da «cosa mi vendono» a «cosa mi sono perso». E ha un effetto collaterale che ci serve: pubblicare i risultati **anche quando sono brutti** è la stessa postura che ci protegge sui claim, coerente con il reframe di [[project_track_record_ui]].

Corollario scomodo e accettato: se il modello va male, il canale free lo mostra. È il prezzo della credibilità, e non è negoziabile — un track record pubblicato solo quando conviene non è un track record.

## 4. Il vincolo legale, che è il rischio vero di questo item

**Nel canale free NON vanno link affiliati ai bookmaker per utenti italiani.**

Il free è la superficie a pubblico più ampio che avremo, quindi la più esposta. L'**art. 9 D.L. 87/2018** vieta la promozione di gioco con vincita in denaro — **anche di operatori licenziati** — con sanzione al **floor di legge €50.000 per violazione**, e colpisce espressamente il *sito di destinazione*. Un canale Telegram che spinge l'offerta di un book a un pubblico italiano è il caso da manuale.

Quindi: il canale free parla **del prodotto** (predizioni, risultati, il link a betredge.com) e **mai** di un'offerta di scommessa. Il ramo affiliazione resta dove è già gated, in attesa della risposta dell'avvocato sulla VIA A ([[project_gambling_qualification]]).

Serve anche: **18+** nella descrizione del canale e il disclaimer di gioco responsabile — è la stessa barra che abbiamo messo altrove.

## 5. Cosa devi fare tu (dieci minuti)

1. Telegram → nuovo **canale pubblico**, nome e handle coerenti con `@betr.edge` (il kit social ha le proposte verificate come libere).
2. Descrizione: cosa pubblica, **18+**, disclaimer, link a betredge.com.
3. Aggiungi il bot esistente come **amministratore** con permesso di pubblicare (è lo stesso `TELEGRAM_BOT_TOKEN` già in uso, non ne serve uno nuovo).
4. Prendi il `chat_id` del canale: inoltra un messaggio del canale a `@userinfobot`, oppure `getUpdates` sull'API del bot.
5. Dammi il chat_id: lo metto in `TELEGRAM_CHAT_ID_FREE` sulle env di produzione.

Finché il punto 5 non è fatto, il codice è già in main e non fa niente — nessun errore, nessun invio.

## 6. Cosa resta da costruire dopo il tuo OK

Il **router** che decide quale pick va al free e quando (la selezione di 1/giorno, il ritardo di 90 minuti, il post dei risultati). Non l'ho costruito ora di proposito: dipende dai numeri della tabella §2, e quelli sono una tua decisione di prodotto, non una mia. Approva la scala e il router è mezza giornata.

## Verifica

`./venv/bin/python -m pytest tests/test_telegram_tiers.py -q` → **7 passed**. Nessun invio reale: il client `httpx` è sostituito da un fake che registra i `chat_id`.
