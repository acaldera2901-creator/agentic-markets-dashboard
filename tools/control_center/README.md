# BetRedge Control Center

Torre di controllo locale. Spec: `docs/superpowers/specs/2026-08-20-betredge-control-center-design.md`.

**Aprire:** http://127.0.0.1:8790 (il server gira sotto launchd, KeepAlive)

## La pagina: un piano, non quattro schede

Dal 04/09 c'e' una pagina sola, `static/index.html`. Non scorre: la rotella
zooma (attorno al puntatore), il trascinamento sposta, i tasti `1-9 0` portano
a un settore, `P` al Ponte, `Esc` a tutto il piano. Da lontano ogni settore e'
una targa (lettera, numero chiave, stato); da vicino compare il contenuto.
Il Ponte e' l'unico settore leggibile a ogni distanza: e' l'ancora.

Dodici settori, una sola componentistica (targa, pannello, KPI, riga, scheda,
tile, LED quadrato, pulsante a tre ruoli, conferma inline). Le vecchie rotte
`/betredge`, `/sala`, `/architettura.html` reindirizzano al settore
corrispondente. I font (Saira, JetBrains Mono — variabili, OFL) stanno in
`static/vendor/fonts/`: la torre deve aprirsi anche senza rete, quindi nessun
CDN.

Le conferme (spegni, APPROVE, archivia) non sono piu' `window.confirm`: sono
un riquadro dentro la scheda, con Esc/Invio. Finche' una conferma e' aperta il
giro di aggiornamento delle schede aspetta, per non cancellarla sotto le dita.

Il settore **Cervello** legge `/api/cervello` (grafo della memoria: nodi con
raggio ∝ √grado, colore per tipo, opacita' che cala con l'eta' dell'ultimo
tocco). Se l'endpoint manca o risponde `{"assente":true}` mostra «cervello in
sincronizzazione», mai una pagina rotta.

**Misurare a mano senza scrivere niente:**

    venv/bin/python -m tools.control_center.collector --dry-run

Nota: gli script del venv hanno lo shebang rotto da uno spostamento di cartella.
Usare sempre `venv/bin/python -m ...`, mai `venv/bin/pytest`.

**Stato su disco:** `~/.betredge-cc/state.json` e `history.jsonl`
**Log:** `~/Library/Logs/betredge-cc/`
**launchd:** i tre plist stanno in `ops/launchd/`, copiati in `~/Library/LaunchAgents/`
— `collector` (ogni 5 min), `server` (KeepAlive), `watcher` (ogni 60s, lavora
le diagnosi in coda).

## I tasti sui rossi

Due livelli, e la differenza non è burocrazia.

**Riavvia** compare solo sui LaunchAgent di perimetro: `launchctl kickstart -k`,
reversibile, nessun dato in gioco. La lista arriva dal server per ogni check
(`riavviabile` nello snapshot); la pagina non la deduce dal nome, perché
dedurla faceva comparire il tasto su `daemon-health`, dove il riavvio non può
funzionare.

**Chiedi a Claude** accoda un job. Il watcher lo esegue con
`--permission-mode plan` e una lista di strumenti ristretta: Claude può
leggere, cercare e guardare i log, non può scrivere file né toccare il DB né
deployare. Produce un documento con CAUSA, COSA NON È, PROPOSAL e RISCHIO, che
resta in attesa del tuo `APPROVE`. Un tasto che riparasse la produzione da solo
aggirerebbe il gate di approvazione.

Le POST sono protette da un token (in `~/.betredge-cc/token`, iniettato nella
pagina servita) più un controllo dell'`Origin`: il loopback da solo non basta,
perché qualsiasi pagina aperta nel browser può fare una POST verso 127.0.0.1.

## Reporter: chi giudica invece di lavorare

`daemon-health` esce 1 **per progetto** — significa "almeno un check è rosso".
Leggerlo come un guasto del processo era un falso rosso che puntava al
messaggero. I daemon in `REPORTER` vengono letti dal loro report, non dall'exit
code, e non sono riavviabili.

Nota affine: `launchctl` riporta SIGTERM come `-15` **o** come `143` (128+15).
Entrambi sono uscite ordinate.

## KPI: numeri, non semafori

I KPI hanno livello `info`, non un colore: "un ROI del 3% è buono?" non si
risponde con una soglia, e dare un colore a un dato senza soglia difendibile
è inventare un verdetto. `info` non entra mai in "cosa è rotto" e non notifica.

Due guardie sul track record: sotto **30 pick chiusi** la finestra scrive
"campione insufficiente" invece di un numero (su 3 pick il ROI grezzo dava
−100%), e `result` vale `won`/`lost`/`void`/`unresolved` — **non** `win`: una
query scritta su `win` restituisce zero vittorie e un ROI di −100%.

## Da dove vengono le credenziali

Non sono copiate qui: la dashboard le legge dove vivono, in ordine di priorità
crescente (`FONTI_ENV` in `db.py`).

| Fonte | Cosa porta |
|---|---|
| `<repo>/.env` | DB, quote, Telegram bot, chat personale |
| `accelerator/studio-instagram/.env` | `IG_ACCESS_TOKEN_EN/IT`, `IG_USER_ID_EN/IT` |
| `accelerator/studio/.env` | `TELEGRAM_CHAT_ID_FREE` — il canale pubblico |
| `~/.betredge-cc/credentials.env` | ciò che non sta in nessun repo: Resend, Reddit |

**Cosa manca e perché** (stato 2026-08-20):

- **`RESEND_API_KEY`** — Vercel la marca *sensitive* e non la restituisce:
  `vercel env pull` ha reso 28 valori su 106 e questo era fra i vuoti. Va
  incollata a mano in `credentials.env`.
- **Instagram** — i token in `studio-instagram/.env` esistono ma sono
  **scaduti** (errore 190). Il tile dice "SCADUTO, va rigenerato", non
  "mancante": sono due azioni diverse. `IG_*_IT` è invece vuoto.
- **TikTok** — nessuna credenziale in nessun progetto: l'account non è
  Business, quindi non ha API.
- **Reddit** — l'endpoint pubblico dà 403 anche con UA da browser: serve
  un'app OAuth.

## Email: il database dice se è PARTITA, Resend se è ARRIVATA

`crm_trigger_sends` è il registro degli invii, perché il motore è il CRM in
codice (l'automation di Resend è disabilitata dal 27/07). Resend serve per lo
strato che il DB non conosce: domini autenticati, bounce, consegne. Senza la
chiave i due tile Resend restano `unknown` — e il conteggio degli invii
funziona comunque.

## Il grafo del cervello (`/api/cervello`)

La memoria unificata (`~/Desktop/00-SISTEMA/cervello/`, 995 file `.md`) letta
come grafo: un file e' un nodo, un wikilink e' un arco. `cervello.py` la
cammina **dentro il giro del collector**, non dentro la richiesta — a freddo
costa 2,9 s, e nessuna pagina puo' aspettare tre secondi. Il JSON finisce in
`~/.betredge-cc/cervello.json`; l'endpoint lo serve e basta. Se non e' mai
girato risponde `{"assente":true}`: un grafo vuoto si leggerebbe come "il
cervello non ha niente dentro", che e' il contrario.

Niente settimo LaunchAgent: stessa cadenza (5 min), stesso venv, un daemon in
meno da sorvegliare. Sta in `collector.main()` e non in `collect()` perche' non
e' un check — non ha un verdetto, non entra nello snapshot, e il `--dry-run`
per contratto non scrive. Se il parser muore il collector non muore con lui.

**Cosa entra e cosa no** (le scelte, non i dettagli):

- **`4-archivio/` non entra col suo sottografo.** E' un record storico: i suoi
  file portano 885 wikilink verso vault che non esistono piu'. Resta pero'
  nell'indice di risoluzione, cosi' un file vivo che cita un archiviato ottiene
  un nodo `tipo: archivio` (attenuato) invece di un falso `mancante`. Misurato:
  57 nodi archiviati citati da vivi, contro ~380 che sarebbero entrati in blocco.
- **`Group_Chat-ORIGINALE-INTERO.md` si salta** — 2,8 MB identici ai
  `Group_Chat-<mese>.md` accanto.
- **Il rumore non e' dove sembra.** Il filtro sui blocchi di codice recintati
  toglie **zero** bersagli su 592: e' una guardia, non una pulizia. Il rumore
  vero sono i segnaposto della prosa che spiega la sintassi (`[[A]]`, `[[X]]`,
  `[[...]]`). Togliere anche il codice **inline** e' stato misurato e scartato:
  costerebbe 10 riferimenti veri per togliere 10 pezzi di rumore.
- **Il `type:` del frontmatter vince sulla cartella**, ma passa da un
  vocabolario solo: 198 file dicono `type: project` dove la cartella dice
  `progetto`, e tenerli distinti darebbe una legenda con due voci per la stessa
  cosa. Gli alias normalizzano, il resto passa com'e'.
- **Risoluzione: percorso esatto, poi nome di file univoco, poi `mancante`.**
  Un nome ambiguo non si indovina. Misurato: un terzo passo "per suffisso"
  avrebbe risolto **3** dei 151 mancanti — non vale una regola in piu'.
- **`scope: azienda` non e' un arco.** E' un'etichetta di perimetro: farne una
  relazione creerebbe due hub da 290 archi che nascondono il grafo vero.

**Perche' il grafo non balla.** Le posizioni sono force-directed calcolate qui
(numpy), seminate dal giro precedente. Il seme da solo non bastava: near
equilibrium Fruchterman-Reingold muove ogni nodo di tutta la temperatura anche
quando la forza vera e' trascurabile, e con 338 orfani — un gas repulsivo senza
minimo netto — due giri identici spostavano i nodi di 15-18 unita' su un campo
da 800. Non era convergenza, era un ciclo limite. Ora il grafo porta la sua
`impronta` strutturale: se nodi e archi non sono cambiati le posizioni si
ricopiano **identiche** e il layout non gira affatto (0,04 s invece di 0,9 s).
Quando invece qualcosa cambia, si rilassa in locale: un file nuovo sposta gli
altri di 9,6 unita' mediane.

**Note per chi disegna la pagina.** `peso` e' la taglia del file in KB, grezza:
va da 1 a 1402, quindi va scalata (radice o log), non usata come raggio.
`grado` e' il numero di archi che toccano il nodo. `fase` e' valorizzata solo
sui file con blocco `STATO` (157 su 913) e arriva gia' con la sua emoji.
`toccato` e' `null` sui nodi `mancante`, che non sono file.

## Come si aggiunge un check

Una funzione che ritorna un `Verdict` in `checks/<gruppo>.py`, più una riga in
`checks()`. Il collector non si tocca — se un check nuovo costringe a
modificarlo, il contratto è sbagliato ed è un segnale, non un dettaglio.

## Le regole che tengono in piedi la fiducia nella pagina

- **`unknown` non è `red`.** Fonte non disponibile, credenziale mancante,
  tabella vuota → `unknown` col motivo. Mai uno zero al posto di un dato non
  misurato.
- **Si giudica l'artefatto, non l'invocazione.** Un cron è verde se ha prodotto
  la sua scrittura, non se ha risposto 200.
- **Cron incondizionati → freschezza. Cron condizionali → arretrato.** Un cron
  che scrive solo quando c'è lavoro non si misura sulla data dell'ultima
  scrittura: il 2026-08-20 `paygate-reconcile` sembrava fermo da 22 giorni
  mentre il suo arretrato era zero — nessuno comprava, e non è un guasto.
- **Le rotte dietro feature flag non si sorvegliano.** `/risultati` e `/oggi`
  fanno `notFound()` quando `NEXT_PUBLIC_UX_NEW != "1"`.
- **Le query non scansionano tabelle enormi.** `max(captured_at)` su
  `odds_snapshots` (20,9 milioni di righe, nessun indice su quella colonna) è
  una scansione completa: misurata 33,4 s, ogni 5 minuti, su produzione. Le
  righe entrano in ordine di tempo, quindi l'ultima per chiave primaria dà la
  stessa risposta in 0,65 s.
- **Le soglie si mettono su ciò che misurano.** `db_latency` guarda la query
  (65-200 ms), non connessione+query: l'handshake verso eu-west-1 costa ~650 ms
  stabili e una soglia sulla somma segnala la distanza da Dublino.
- **Ambra non notifica mai.** Vive sulla pagina, non sul telefono.

## Cosa NON fa

Non scrive sul DB (`SET TRANSACTION READ ONLY`, verificato: una `CREATE TABLE`
viene respinta). Non ascolta fuori da loopback. Non rimedia: osserva.

**Fasi 2 e 3** (pipeline, risultati, business, canali): sezione 9 della spec.
