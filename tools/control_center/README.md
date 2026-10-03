# BetRedge Control Center

Torre di controllo locale. Spec: `docs/superpowers/specs/2026-08-20-betredge-control-center-design.md`.

**Aprire:** http://127.0.0.1:8790 (il server gira sotto launchd, KeepAlive)

## La home: il cockpit (`/`), e il piano intero su `/canvas`

Dal 30/09 la radice e' `static/cockpit.html`: una schermata sola che risponde
a una domanda — *devo agire?* Legge **solo** `/api/cockpit?area=<area>` (ogni
60 s) e non ha un dato che non venga da li'. In cima la **banda del verdetto**:
rossa se almeno un ticket e' rosso, ambra se sono tutti ambra, verde («Tutto
ok») se non c'e' niente; `N cose richiedono te` e' il conteggio dei ticket e la
cifra N e' l'unico rosso della banda. Accanto i quattro numeri (`numeri` nella
risposta: progetti attivi, bloccati, daemon vivi/totali, eta' dello snapshot).
Sotto, due colonne: a sinistra **Richiedono te** come ticket numerati (cosa,
perche', da quando, azione, fonte) con lo stato vuoto disegnato; a destra i
**Progetti** (nome, fase, goal, barra a tacche dei task, prossimo task) con la
salute in **una sola** codifica — la barretta a inizio riga — e la riga
espandibile coi task: la spunta fa `POST /api/task/fatto` dopo una conferma
inline (mai `window.confirm`); `riaperto dal check` e `verificato dal check`
si vedono sulla casella. In fondo, collassati, «In carico / da osservare» e
«Archivio». Se l'endpoint non risponde la banda si spegne e lo dice, i dati
vecchi restano marcati nel piede: mai una pagina rotta. Tasti: `R` aggiorna,
`E` apre/chiude i progetti, `C` va al canvas. Il selettore di area in testa ha
oggi solo BetRedge (l'unica con card `Area:` e check nello snapshot); la lista
`AREE` in cima allo script e' il posto dove entrano le altre.

Il piano zoomabile di prima e' intero su **`/canvas`** (`static/index.html`),
raggiungibile da «Vista completa» nel cockpit: non scorre, la rotella zooma
(attorno al puntatore), il trascinamento sposta, i tasti `1-9 0` portano a un
settore, `P` al Ponte, `Esc` a tutto il piano. Da lontano ogni settore e' una
targa (lettera, numero chiave, stato); da vicino compare il contenuto. Il
Ponte e' l'unico settore leggibile a ogni distanza: e' l'ancora.

Dodici settori, una sola componentistica (targa, pannello, KPI, riga, scheda,
tile, LED quadrato, pulsante a tre ruoli, conferma inline) — il cockpit la
riusa (stessi token, stessa conferma, stesso LED). Le vecchie rotte
`/betredge`, `/sala`, `/architettura.html` reindirizzano al settore
corrispondente di `/canvas`. I font (Saira, JetBrains Mono — variabili, OFL)
stanno in `static/vendor/fonts/`: la torre deve aprirsi anche senza rete,
quindi nessun CDN.

Le conferme (spegni, APPROVE, archivia) non sono piu' `window.confirm`: sono
un riquadro dentro la scheda, con Esc/Invio. Finche' una conferma e' aperta il
giro di aggiornamento delle schede aspetta, per non cancellarla sotto le dita.

Il settore **Cervello** legge `/api/cervello` (grafo della memoria: nodi con
raggio ∝ √grado, colore per tipo, opacita' che cala con l'eta' dell'ultimo
tocco). Se l'endpoint manca o risponde `{"assente":true}` mostra «cervello in
sincronizzazione», mai una pagina rotta.

Il settore **Progetti** (lettera L, si apre dal Ponte — i tasti `1-9 0` erano
finiti) legge `/api/progetti` e apre una card intera con
`/api/progetto?id=<registro>/<nome del file>`. Dal grafo del Cervello il nodo
di un progetto porta alla stessa scheda («apri la scheda del progetto»
nell'ispettore), e `#scheda=sistema/side-hustle-etsy` e' l'indirizzo che si
incolla in chat. **E' una vista, non un registro**: legge i file `.md` dei tre
posti dove le card vivono gia' (`~/.claude/.../memory`,
`~/.claude-personal/.../memory`, `sistema-andrea/docs/progetti`) a ogni
richiesta — non il riversamento nel cervello, che e' vecchio fino a 5 minuti —
e non esiste un endpoint che ne scriva una: #UNIONE-0907, la card resta
l'unica fonte. Il markdown lo rende `markdown_min.py`, scritto a mano e senza
dipendenze, perche' il server gira sul python di Homebrew e il collector sul
venv del repo: una libreria installata in uno solo dei due si scopre con un
500 in pagina. La striscia «ci lavorano adesso» incrocia la Sala al volo e
dichiara sempre *perche'* ha agganciato una sessione; se la Sala tace, la
scheda esce lo stesso senza quella striscia.

## Il cockpit (`/api/cockpit?area=<area>`) e i task nelle card

I task vivono nel blocco STATO della card (#UNIONE-0907, nessun registro
nuovo). Campi nuovi, tutti facoltativi — una card senza resta valida com'e':

    > **Area:** betredge                (una o piu', separate da virgola)
    > **Goal:** frase verificabile       (se manca vale il `Done quando`)
    > **Task:**
    >   - [ ] testo · owner · scad:AAAA-MM-GG · check:<id_check>[,<id>]
    >   - [x] testo · owner · fatto:AAAA-MM-GG

Il primo pezzo e' il testo; `scad`, `check`, `fatto` sono attributi;
l'**owner** e' il primo pezzo che ne ha la *forma* — un nome di `NOMI_NOTI`
in `cockpit.py` (Andrea, Michele, Claude, Tommy, Steve, Codex, gli agenti…) o
`Nome → Nome`. Ogni altro pezzo torna nel testo, quindi un ` · ` dentro la
frase non diventa l'owner. Chi agisce e' il **primo** nome (`attore`):
`Claude → dopo OK Andrea` e' di Claude, `Andrea → Claude` di Andrea, e
`ui-andrea` non e' Andrea. La lista finisce al campo `**...:**` successivo; le
caselle fuori da `**Task:**` (p.es. nei Pending) non sono task. `check:` e'
l'id di un check dello snapshot (`/api/state`).

**Il check chiude il task, non la spunta:** check tutti verdi -> `verificato
dal check` anche senza `[x]`; `[x]` con un check rosso -> `riaperto dal check`;
`[x]` con un check ambra/non misurato/assente -> `spuntato ma il check non è
verde` (resta aperto).

**Fase e Prossima azione** (`progetti._scheda`, campo `fase_fonte`). La fase
si legge, in ordine: (1) dalla **testata piu' recente** — la riga che comincia
con `STATO <data>`, con la fase fra backtick; le testate dentro `<details>` non
contano; (2) dal campo `**Fase:**`, con o senza backtick ed emoji (`IN PAUSA`
/ `attende` valgono `BLOCCATO`); (3) dal blocco intero solo se non ha nessuna
testata; (4) dalla riga legacy `**Stato:**`. Una testata recente **senza**
fase da' fase `null`: non eredita il `BLOCCATO` di una voce storica. Un campo
scritto come voce di lista (`- **Fase:** …`) vale come gli altri; `**PROSSIMA
AZIONE:**` usato come titolo vale la **prima voce** della lista sotto.

`GET /api/cockpit?area=betredge` restituisce:

- `numeri` — i quattro numeri della banda, derivati qui e non in pagina:
  `progetti_attivi`, `bloccati`, `daemon_vivi`/`daemon_totali` (i check
  `launchd_*` dell'area), `ultima_spunta` (la data `fatto:` piu' recente).
- `richiedono_te` — solo i rossi/ambra veri che chiedono Andrea: task aperti
  di Andrea con un check non verde o scaduti (su card non ferme), e i check
  **rossi che nessun task prende in carico** (triage, `tipo: check`). Ogni
  ticket `task` porta `titolo` (senza i numeri copiati nella card, se il task
  ha un check vivo: il numero vero e' nel `perche`), `testo` (quello esatto
  della card), `da_quando` (il **primo rosso** della serie corrente in
  `history.jsonl`; senza storico la stima `red_runs` × 5 min). Un rosso citato
  da un task di un altro owner **su card viva** e' preso in carico: va in
  `in_carico`, non qui. Un task **senza owner** non prende in carico niente:
  il rosso resta triage. Ambra e non-misurati entrano solo se un task di
  Andrea li cita, altrimenti `da_osservare` («ambra non notifica mai»).
- `in_coda_per_te` / `n_in_coda` — azioni vere di Andrea **senza urgenza
  misurata**: task aperti di Andrea senza check e non scaduti, card `BLOCCATO`
  in attesa di Andrea (`owner: Andrea` / «attende Andrea» nella Prossima
  azione o nel campo Fase), voci dei Pending scritte come `Andrea: …` /
  `owner: Andrea`. Solo da card non ferme. Voce: `{tipo: task|bloccato|pending,
  titolo, card, nome_card, scad|null, eta_giorni, fonte, indice?}`. **Non**
  entrano in `n_richiedono_te` ne' nel verdetto.
- `in_carico` — `{titolo, owner, checks, fonte, card, nome_card, giorni_fermo,
  card_ferma}`. Se la card e' ferma o `ARCHIVIATO` il check **non** si
  silenzia: resta in `da_osservare` con `in_carico_a`, `card`, `giorni_fermo`.
- `progetti` — card dell'area toccate negli ultimi 14 giorni: fase, goal,
  task chiusi/totali, prossimo task, salute dei check collegati, ultimo tocco
  (data dello STATO o dell'ultima spunta; l'mtime solo se manca: un ritocco in
  blocco lo sposta), ultima verifica, `ferma`, `perche_qui`. Una card ferma o
  archiviata con un task aperto su un check **rosso** sta qui (in fondo,
  `ferma: true`, `perche_qui` dice perche'), non in archivio.
- `archivio` — card dell'area ferme da >14 giorni o `ARCHIVIATO` senza rossi
  aperti: contate, non mostrate in principale.
- `assente: false`. Un'area valida che nessuna card dichiara risponde **404**
  `{"area", "assente": true, "aree": [...], "messaggio"}` (400 resta per uno
  slug non valido).

### Progetti e workstream (`/api/hub`)

Un **progetto** e' di primo livello (BetRedge; poi swr7, Machina, …). Un
**workstream** e' il lavoro interno di un progetto (warmup email, piani,
settlement…). Nessun registro nuovo: sono tutte card `project_*.md`, cambia
solo cosa dichiara il blocco STATO.

    > **Tipo:** progetto                 (solo la card-progetto)
    > **Nome:** BetRedge                 (breve; senza, il nome del file ripulito)
    > **Area:** betredge                 (lo slug che lega progetto e workstream)
    > **Goal:**
    >   - track record pubblico · attuale:58.2% su 3090 · obiettivo:da decidere · check:history_coerente
    >   - pick senza settlement · attuale:1933 · obiettivo:0 · check:cron_settle

Una card con `**Area:**` e senza `**Tipo:** progetto` e' un workstream. Un
`attuale` o `obiettivo` assente vale `non misurato` / `da decidere`: il cockpit
non inventa numeri. `check:` (facoltativo) da' la salute del singolo goal.
Una seconda card `Tipo: progetto` nella stessa area finisce in `avvisi`, vale
la prima.

- `GET /api/cockpit?area=<slug>` aggiunge `verdetto` {livello, n_richiedono_te},
  `progetto` (la card-progetto con goal, salute peggiore fra la sua e quella dei
  workstream vivi, `avanzamento` sui task di tutte le card dell'area,
  `n_workstream` = `n_workstream_vivi` + `n_workstream_archivio`, `task` =
  lista piatta di tutti i task contati in `avanzamento`: `{testo, owner,
  attore, stato, scad, check, card, nome_card, fatto, spuntato, indice}`) e
  `workstream`; `progetti` resta come alias di `workstream` per
  `cockpit.html`. Ogni workstream porta `nome`. Ogni goal con `check:` porta
  accanto ad `attuale` (testo della card) il valore vivo: `attuale_live` (la
  headline del check; con piu' check `N/M verdi`), `valore_live`,
  `misurato_alle` (il check piu' vecchio), `eta_live_min`, `diverge` (true se
  un numero scritto nella card non compare nel valore vivo; null se non c'e'
  niente da confrontare).
- `GET /api/hub` → `{verdetto, progetti:[{id, area, nome, fase, goal_sintesi,
  goal, salute, n_richiedono_te, avanzamento, n_workstream, n_workstream_vivi,
  n_workstream_archivio, n_in_coda, ultimo_tocco}], in_coda_per_te, n_in_coda,
  aree, slot_liberi}`. Le aree vengono dalle `**Area:**` presenti (solo slug
  `a-z0-9_-`), non da una lista nel codice; il verdetto aggrega tutte le aree,
  anche quelle senza card-progetto, e un ticket di una card con due aree conta
  una volta. Il livello (rosso/ambra/verde) e' la stessa regola di
  `livelloTicket` in pagina, ora derivata nel server.

I check dello snapshot appartengono all'area `betredge` (e' lo snapshot di
BetRedge). `POST /api/task/fatto` `{id, indice, testo}` (token + Origin come
`/api/action`) e' l'unica scrittura su una card: spunta **solo** quella riga
(`[x]` + `· fatto:data`), pretende che il testo combaci (altrimenti 409:
la card e' cambiata sotto la pagina; vale anche il `titolo` senza numeri
fissi del ticket), lascia `<card>.md.bak`, scrive su
temporaneo + rename. Il percorso viene dall'indice delle card, mai dal corpo.

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

La memoria unificata (`~/Desktop/00-SISTEMA/cervello-maven/` (perimetro aziendale, vedi `perimetro.txt`)) letta
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

## La torre ferma: come si riconosce e come si ripara

Il 02/10 il collector ha scritto lo snapshot delle 01:21Z e poi è rimasto
vivo 6 h 58 min (stato `S`, 2,4 s di CPU): un SELECT partito sul socket morto
del risveglio del Mac non ha mai avuto risposta, il thread del check è non-daemon
e l'interprete all'uscita lo aspettava. launchd non avvia un giro finché il
vecchio vive, quindi la torre ha mostrato letture di 7 ore prima come attuali.

**Come si riconosce.** La banda dell'hub diventa rossa: «la torre non si
aggiorna da N min: i dati sono vecchi» (oltre 20 min). Lo decide il server
(`stale` ed `eta_min` in `/api/hub` e `/api/state`), non il collector, che da
appeso non può dirlo. Il check `torre_fresca` (gruppo daemon) lo denuncia al
primo giro dopo: rosso oltre 20 min, ambra oltre 12. Da terminale:
`ps -o pid,etime,stat -p $(pgrep -f control_center.collector)` — un'età oltre i
4 minuti è un'appesa.

**Come si ripara.** `launchctl kickstart -k gui/$UID/com.betredge.control-center.collector`.

**Perché non dovrebbe più servire.** `collector.esegui` esce con `os._exit`
(non aspetta i thread appesi) e ha un tetto di 240 s (`TETTO_S`): oltre, scrive
«collector: tetto di tempo raggiunto» in `collector.err.log` ed esce con 3. I
check hanno un budget di giro di 180 s (`BUDGET_CHECK_S`): quelli non tornati
diventano `unknown` e lo snapshot esce lo stesso. Le connessioni al DB hanno
keepalive TCP (socket muto chiuso in ~25 s) e `statement_timeout` di 90 s.

## Cosa NON fa

Non scrive sul DB (`SET TRANSACTION READ ONLY`, verificato: una `CREATE TABLE`
viene respinta). Non ascolta fuori da loopback. Non rimedia: osserva.

**Fasi 2 e 3** (pipeline, risultati, business, canali): sezione 9 della spec.
