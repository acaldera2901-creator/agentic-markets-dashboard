# Il Tavolo — Claude e Codex sullo stesso progetto

Codice: `tools/control_center/tavolo.py` · CLI: `tools/tavolo` (nel PATH come
`tavolo`, vedi «Il comando nel PATH») · skill Claude: `.claude/skills/tavolo/` · ruoli:
`config/tavolo_ruoli.json` · test: `tools/control_center/test_tavolo.py` ·
posta: `~/.betredge-cc/tavolo/` · torre: settore **T · Tavolo** su
`/canvas#tavolo`, API `GET/POST /api/tavolo`.

Adattato dal Tavolo di Michele (SHELL-SYSTEM-GUIDE §6-8, §12), non copiato.

## Il metodo in cinque righe

1. **Simmetria.** Claude e Codex hanno gli stessi comandi, gli stessi tipi di
   messaggio, la stessa capacità effettiva (meccanismo diverso: vedi
   «Simmetria: la differenza residua») e la stessa tabella ruoli. Entrambi leggono,
   propongono, obiettano, danno verdetto e scrivono codice.
2. **Gli script muovono la posta, non un modello.** Niente chat libera:
   messaggi chiusi con id, conv, tipo, e freni nel codice.
3. **Recapito in pull.** `tavolo invia --esegui` lancia il destinatario
   headless e sincrono (`codex exec` / `claude -p`), la risposta torna nella
   stessa conv. `codex queue` non si usa: su Mac lo drena solo una finestra
   Codex Desktop viva (misurato il 21/09).
4. **Si scrive solo in un worktree di filone.** Mai la vetrina, mai main.
5. **La posta di un agente non è mai un via libera.** Push, deploy, DB,
   credenziali, soldi: solo dopo `APPROVE #id` di Andrea.

## Comandi (identici per i due lati)

```bash
tavolo collegati [--progetto P] [--come claude|codex]   # presenza + orientamento corto
tavolo scollegati
tavolo invia --to codex|claude [--tipo T] [--conv C] [--ref R] [--progetto P] [--req] \
             [--in-risposta-a ID] [--campo k=v ...] [--file F | "testo"] \
             [--esegui] [--worktree W | --filone NOME]
tavolo prendi                 # claim esclusivo della mia posta, stampa i corpi
tavolo conferma <id>          # ricevuta di lettura
tavolo avvisi                 # una riga per messaggio in attesa (mai il corpo); tace se HOOK-OFF
tavolo stato [--json] [--conv C]
tavolo chiudi <conv> [--motivo M]
tavolo assegna [compito]      # la tabella ruoli risolta per chi chiama, e la sua validazione
tavolo consegna <id>          # esegue il bridge su un messaggio gia' in inbox
```

`--come claude|codex` vale per tutti i comandi che hanno bisogno di sapere chi
sei, e serve solo quando il Tavolo non ti riconosce da solo.

## Chi sei: l'identità senza variabili da impostare

In quest'ordine (`riconosci` in `tavolo.py`):

1. `AM_SHELL` → claude, `CODEX_SHELL` → codex. **Entrambe** = errore esplicito
   (exit 2), nessuna vince in silenzio. Il bridge le imposta sempre al figlio.
2. Il **processo agente più vicino** fra gli antenati del comando (libproc su
   macOS): `~/.local/share/claude/versions/<ver>` o un binario `claude` →
   claude; un binario `codex` (vendor npm, `CodexCLI.app` di Codex Desktop) →
   codex. `node …/bin/codex` è il lanciatore npm e non conta. Funziona anche
   dentro il sandbox di Codex, dove `ps` e `kill -0` sono negati.
3. Solo se gli antenati **non si leggono**: i marcatori d'ambiente. Misurati
   il 29/10 su `claude` 2.1.312 e `codex exec` 0.153.4: Claude Code imposta
   `CLAUDECODE=1`, `CLAUDE_PID`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT`;
   Codex imposta `CODEX_THREAD_ID`, `CODEX_SESSION_ID`, `CODEX_SANDBOX=seatbelt`,
   `CODEX_SANDBOX_NETWORK_DISABLED`, `CODEX_CI`. Si **ereditano**: un Codex
   lanciato da Claude li ha tutti e due, e l'ambiente globale di tmux porta
   `CLAUDECODE=1` con il `CLAUDE_PID` di una sessione chiusa. Quindi un
   `CLAUDE_PID` morto non conta, e i marcatori non bastano mai quando gli
   antenati si leggono e non c'è nessun agente fra loro (un terminale in tmux).
4. Altrimenti, o se i marcatori sono di tutti e due: **errore che chiede
   `--come`**. Mai indovinare. `--come` contro l'evidenza (processo claude e
   `--come codex`, o `AM_SHELL` e `--come codex`) è un errore anche lui.

## Collegati: chi è al tavolo adesso

`tavolo collegati` scrive `presenze/<identità>.json` nella posta (`identita,
client, pid, exe, riconosciuto, cwd, progetto, collegato_da, ultimo_battito`)
e stampa un orientamento di al massimo 15 righe: chi altro è collegato, la tua
posta aperta, i comandi essenziali e i freni. `tavolo scollegati` la toglie.

- **Battito:** ogni comando `tavolo` di un'identità collegata aggiorna
  `ultimo_battito`. Non cambia il pid: una sessione nuova (o ripresa con
  `--resume`) si ricollega con `tavolo collegati`.
- **Vivo** = battito entro il TTL **e** pid ancora acceso **e** stesso
  eseguibile (un pid riusato da un altro programma è morto). TTL
  `presenza_ttl_min` = 30, sovrascrivibile con `TAVOLO_PRESENZA_TTL_MIN`.
  Altrimenti lo stato è `scaduto` o `pid morto`, e la torre lo mostra così:
  **mai vivo un pid che non esiste più**. Con `--come` da un terminale il pid
  è quello della shell.
- **Una presenza per lato**, perché la posta è per lato: una seconda sessione
  Claude prende il posto della prima.
- Rispetta l'interruttore: senza `LIVE` non ci si collega (exit 5).
- Nella torre: fascia **Collegati ora** nel settore Tavolo (`presenze` in
  `/api/tavolo`). Il pulsante **chiedi** fa scegliere il destinatario: a una
  sessione collegata la domanda resta in posta (la legge con `tavolo prendi`,
  nessun bridge); altrimenti, o se lo scegli, risponde il bridge headless.

Verificato il 29/10 (posta temporanea, server di prova): una `claude -p` e una
`codex exec` vere, col solo prompt «collegati al tavolo» nel worktree e senza
`AM_SHELL`/`CODEX_SHELL`, si sono riconosciute da sole (Codex con `CLAUDECODE=1`
e un `CLAUDE_PID` vivo ereditati: ha deciso l'antenato) e sono comparse **vive
insieme** in `/api/tavolo`; uscite, sono passate a `pid morto` entro un
secondo. Poi Claude ha chiesto «2+2» senza `--esegui`, la sessione Codex
ripresa l'ha presa, confermata e ha risposto nella stessa conv; Claude l'ha
letta e confermata: due ricevute in `letti/`.

## Come l'agente sa cosa fare quando gli dici «collegati al tavolo»

- **Claude nel repo:** skill `tavolo` in `.claude/skills/tavolo/SKILL.md`
  (inneschi: «collegati al tavolo», «tavolo», «parla con codex/claude»).
- **Codex nel repo:** sezione «Il Tavolo» in fondo ad `AGENTS.md`, che Codex
  carica con `-C` sul repo (e che `CLAUDE.md` importa: è neutra per i due).
- **Fuori dal repo:** i testi sotto, da incollare in `~/.codex/AGENTS.md` (oggi
  non esiste) e `~/.claude/CLAUDE.md`. **Preparati, non applicati.**
- In `claude -p` serve il permesso della Bash su `tavolo`
  (`--allowedTools "Bash(tavolo:*)"`); in una sessione interattiva lo chiede.

### Il comando nel PATH

`~/.local/bin/tavolo` è una copia di `tools/tavolo-wrapper.sh`. Esegue
`tools/tavolo` di: `$TAVOLO_REPO` se impostato (sbagliato = errore, niente
ripiego), altrimenti la vetrina `~/Desktop/agentic-markets` se ha già
`tools/tavolo`, altrimenti il worktree sul branch `feat/tavolo-claude-codex`.
Se non trova nulla lo dice ed esce 2. Dopo il merge la vetrina vince da sola;
se il wrapper cambia, si ricopia: `cp tools/tavolo-wrapper.sh ~/.local/bin/tavolo`.

### Codex e il sandbox

Misurato il 29/10 con `codex exec -s workspace-write`: Codex scrive solo nella
cwd e in `/tmp`, quindi `tavolo collegati` su `~/.betredge-cc/tavolo` fallisce
(`Operation not permitted`; ora il Tavolo lo dice in chiaro, exit 2). Serve
una di queste, **da decidere**:

- in `~/.codex/config.toml`:
  ```toml
  [sandbox_workspace_write]
  writable_roots = ["/Users/calde/.betredge-cc/tavolo"]
  ```
- oppure `--add-dir ~/.betredge-cc/tavolo` / l'approvazione del comando nella
  sessione interattiva.

Il sandbox di Codex ha anche la **rete spenta**: da Codex `--esegui` non può
lanciare `claude -p`. Da Codex si scrive senza `--esegui`; risponde la sessione
Claude collegata (`tavolo prendi`) o il bridge lanciato dalla torre.

Tipi: `domanda · proposta · obiezione · verdetto · handoff · lavoro`.
I campi strutturati (`--campo`) sono quelli del template del Council
(`11_LLM_COUNCIL`): `capito · proposta · rischi · obiezioni · raccomandazione
· esito` (`approva|respinge|modifica|nessuno`). Le risposte del bridge hanno
sempre questi campi: lo schema JSON è uno solo, uguale per i due lati
(`--output-schema` per Codex, `--json-schema` per Claude).

Exit code: `0` ok · `2` uso/errore · `3` **RIFIUTATO** (freno) · `4` catena
(`BRIDGE_DEPTH`) · `5` spento (manca `LIVE`) · `6` bridge fallito (anche
binario assente o non eseguibile: il messaggio torna in inbox, niente traceback).

`--in-risposta-a ID` deve puntare a un messaggio **vero**, della **stessa
conv**, mandato **dal destinatario al mittente** (si risponde a chi ha
scritto). È l'unica porta per `inbox-andrea`: un LLM ci scrive solo
rispondendo a un messaggio reale di Andrea per lui.

## Ciclo di vita di un messaggio

1. `invia` passa dai **freni**. Frenato = `RIFIUTATO`, exit 3, scritto nel
   registro, **non entra** nella posta. Non si aggira con un nuovo ref o una
   nuova conv: si smette e si dice ad Andrea.
2. Accettato → `inbox-<lato>/<id>.json` (scrittura su file temporaneo + rename).
3. `prendi` crea `<id>.claim` con `O_EXCL` (pid, chi, quando), poi sposta il
   messaggio in `in-carico/`.
4. `conferma` → `letti/<id>.json` + `letti/<id>.ricevuta`. «Letto» vuol dire
   confermato da chi riceve, non «stampato da qualche parte».
5. Lease 60 min: un claim non confermato torna in inbox, al massimo 2 volte;
   la terza scadenza va in `quarantena/`. I file illeggibili vanno in
   `quarantena/` intatti. **Niente si cancella**: solo rename.

Col bridge (`--esegui`) i passi 3-4 li fa il bridge per conto del
destinatario: claim, esecuzione headless, ricevuta `via: bridge`, risposta
nella stessa conv.

**I freni si controllano prima dell'exec, non dopo.** `consegna` verifica
`LIVE`, conv chiusa, posto nella conv **anche per la risposta**
(`per_conv`), `token_conv` e `exec_lato_giorno`; se uno scatta, l'exec non
parte e il messaggio resta in inbox (nessun token speso). `invia --esegui`
chiede già due posti (messaggio + risposta). Una volta eseguita l'exec, la
risposta entra **sempre**, anche se nel frattempo la conv è stata chiusa, il
tetto raggiunto o `LIVE` tolto: i token sono spesi, perderla sarebbe solo
spreco. Se il binario non parte, o il worktree è occupato, il messaggio
torna in inbox subito (claim rinominato `.claim.rilasciato-*`, non conta come
recupero), non resta in `in-carico/` per 60 minuti. **Nella coda va solo un avviso di una riga**; il corpo lo
carica solo chi fa `prendi`. Il brief passato al bridge ha un tetto di
`brief_righe` (60): il resto è tagliato e il taglio è dichiarato nel brief.

## I freni (`LIMITI` in `tavolo.py`: il codice è la fonte)

| Freno | Valore | Perché |
|---|---|---|
| `dedup_min` | 60 | stesso contenuto allo stesso destinatario = duplicato. L'impronta è solo il contenuto: `ref`, `conv` e `in_risposta_a` **non** contano, e i campi strutturati sono ordinati per chiave (riordinarli non aggira il dedup). Due «ok» uguali a due domande diverse entro 60 min: il secondo è un duplicato, si scrive qualcosa di più preciso |
| `per_conv` | 40 | paracadute anti-fuga sulla vita della conv; con `--esegui` servono due posti (c'è anche la risposta) |
| `req_per_conv` | 20 | messaggi con «richiede risposta» per conv |
| `conv_nuove_coppia_giorno` | 10 | aprire conv nuove non aggira i tetti |
| `exec_lato_giorno` | 30 | invocazioni headless al giorno per lato |
| `token_conv` | 400.000 | token misurati per conv; oltre, la conv è frenata |
| `lease_min` / `recuperi_max` | 60 / 2 | claim scaduti, poi quarantena |
| `brief_righe` | 60 | tetto del corpo dato al bridge |
| `timeout_s` | 900 | un bridge muto è un errore, non un'attesa |
| `presenza_ttl_min` | 30 | senza un comando tavolo da 30 min non sei più «collegato» (`TAVOLO_PRESENZA_TTL_MIN`) |

**Interruttore:** `~/.betredge-cc/tavolo/LIVE`. Assente = il Tavolo non scrive
nulla (exit 5): è il rollback istantaneo. `HOOK-OFF` nella stessa cartella
zittisce `tavolo avvisi` (per un eventuale hook di inizio sessione).

**Anti-catena:** il bridge lancia il figlio con `BRIDGE_DEPTH=1`; dentro un
bridge `invia` e `consegna` rifiutano (exit 4). Un `BRIDGE_DEPTH` non intero
o negativo è una profondità invalida e rifiuta anche lui (fail closed). La risposta la scrive il
processo padre, non il figlio.

## Scrittura sicura (tipo `lavoro`)

- Serve `--worktree <path>` o `--filone <nome>` (crea
  `~/Desktop/01-BETREDGE/am-tavolo-<nome>` da `origin/main`, branch
  `tavolo/<nome>`).
- Il worktree dev'essere un worktree git **collegato del repo agentic-markets**
  (stesso `git-common-dir` della vetrina: un worktree di un altro repo è
  rifiutato), su un branch che non è `main`/`master`, non in detached HEAD, e
  **non la vetrina**: altrimenti `RIFIUTATO`.
- Un solo scrittore per worktree: `flock` esclusivo su un file in
  `~/.betredge-cc/tavolo/lock/` (dentro, pid + identità solo come
  diagnostica). Il kernel rilascia il lock se il proprietario muore: niente
  «lock orfano da cancellare», quindi niente race fra due che lo sostituiscono.
- Codex gira `-s workspace-write -C <worktree>`; Claude gira con
  `--permission-mode acceptEdits`, cwd nel worktree, strumenti
  `Read,Glob,Grep,Bash,Edit,Write`. Pareri e domande: Codex `-s read-only`,
  Claude `--permission-mode dontAsk` con `Read,Glob,Grep,Bash`. In entrambi i
  modi Claude ha la Bash **solo** sulla allowlist `BASH_CLAUDE` di
  `tavolo.py` (test, lint, git di sola lettura) e `--permission-prompts none`:
  il resto è negato.

### Simmetria: la differenza residua (dichiarata)

La capacità è equivalente (entrambi leggono, cercano, lanciano test/lint e
git di sola lettura; nel `lavoro` entrambi scrivono nel worktree), ma il
meccanismo **non** è lo stesso:

- **Codex** ha una shell **qualsiasi** dentro un sandbox del sistema operativo
  (seatbelt): in `read-only` nessuna scrittura su disco, in `workspace-write`
  scrittura solo nel worktree. Il limite è *dove scrive*, non *cosa lancia*.
- **Claude** ha una **allowlist di prefissi di comando**, senza sandbox del
  sistema operativo. Il limite è *cosa lancia*, non *dove scrive*: un comando
  ammesso (es. `npm test`) può scrivere dove vuole (cache, snapshot), e un
  prefisso ammesso non è confinato al worktree (`git log` funziona anche con
  un path fuori). Comandi composti: ci si affida al controllo di Claude Code
  che valuta ogni pezzo (`a && b`) — non verificato da noi su tutti i casi.
- Conseguenza: Codex può lanciare comandi che Claude non può (qualsiasi
  comando di sola lettura fuori lista), Claude può far scrivere su disco un
  comando in lista dove Codex lo vedrebbe fallire. Chiudere del tutto il gap
  vorrebbe dire dare a Claude il suo sandbox (`--settings` con `sandbox`):
  non fatto, non verificato.

Verificato il 29/10 su `claude -p` reale, modo parere: `git log -1 --oneline`
eseguito, `touch` fuori dal repo **negato** («don't ask mode»), file non
creato. Il modo `lavoro` (acceptEdits + allowlist) è verificato solo sugli
argomenti passati (test), **non** con un `claude -p` reale.
- Il bridge **non committa e non pusha**. Riporta `file_toccati` e
  `vetrina_intatta` (confronto di `git status --porcelain` della vetrina prima
  e dopo). Il commit lo fa chi ha chiesto il lavoro, dopo la review dell'altro
  lato, con i file elencati per nome (mai `git add -A`). Push e merge: dopo
  `APPROVE #id`.
- Limiti onesti di `vetrina_intatta`: **rileva, non blocca** (è un campo
  della risposta, a scrittura già avvenuta: il blocco vero è il sandbox di
  Codex / `acceptEdits` di Claude sulla cwd); **non vede i file gitignorati**
  (`git status --porcelain` senza `--ignored`: `.next/`, `node_modules`,
  `.env*` toccati dal bridge non lo fanno diventare `false`); e se un'altra
  sessione tocca la vetrina nello stesso minuto risulta `false` anche se il
  bridge non c'entra.

## Tabella ruoli (`config/tavolo_ruoli.json`)

Modificabile senza toccare il codice, valida per entrambi i lati. Default:
grafica statica → Codex (`gptimg`), rivede Claude · codice e integrazione →
Claude, rivede Codex · review → sempre l'altro rispetto a chi ha scritto ·
decisione → due pareri separati (Claude e Codex) e **sintesi da script**:
`tavolo stato --conv C` confronta gli `esito` dei due lati (`concordano:
true/false`), nessun LLM rilegge tutto. `tavolo assegna` valida la tabella:
per rischio medium/high chi rivede deve essere l'altro LLM.

Effort: `low` di default, `medium` per `lavoro` (`effort_per_tipo`). Modello
per lato in `lati` (Claude: `sonnet`; Codex: quello di default).

## Token: cosa si misura e cosa no

- Codex: `turn.completed.usage` dall'output `--json` (input, cached, output +
  reasoning). **Costo non misurato** (abbonamento): la torre lo scrive.
- Claude: `usage` e `total_cost_usd` dall'output `--output-format json`.
- Un'invocazione senza usage leggibile è contata come «non misurata», mai
  stimata.
- Contesto magro: Claude di default su «pong» 45.194 token e $0,90 → con
  `--setting-sources "" --strict-mcp-config --disable-slash-commands --model
  sonnet` 7.057 token e $0,016 (29/10, prima della Bash in allowlist). Con la
  Bash e due comandi lanciati: 24.561 in (16.102 in cache) · 585 out · $0,041.
- Codex con `--ignore-user-config`: **dipende da quanto il task fa girare
  comandi**, ogni comando rimanda il contesto. Misurato il 29/10: su «pong»
  18.314 in (era 20.710 senza il flag); su un task senza comandi 19.586 in ·
  101 out; su un'exec che ha lanciato `npm test` (misura del QA) **94.855 in,
  di cui 69.248 in cache**. Il numero da aspettarsi non è 18k: è 18-20k per un
  parere secco, un multiplo per un task che esegue.
- Cosa il figlio ha nel contesto: Claude **non legge CLAUDE.md**
  (`--setting-sources ""`). Codex **sì legge l'AGENTS.md del progetto** nella
  cwd `-C` anche con `--ignore-user-config` (verificato il 29/10: ha copiato
  alla lettera la prima riga, `<!-- BEGIN:nextjs-agent-rules -->`, senza
  lanciare comandi né leggere file — zero eventi `command_execution`).
  `~/.codex/AGENTS.md` non esiste. Quindi il brief deve portare il contesto
  per Claude; per Codex c'è in più l'AGENTS.md del repo.

## Limiti dichiarati

- L'identità viene da `AM_SHELL` / `CODEX_SHELL` o dal processo che lancia il
  comando: **non è autenticata crittograficamente**. I freni limitano quanti
  scambi, non cosa fa chi riceve.
- Recapito verso una sessione interattiva aperta: non c'è push. Chi è in
  sessione vede la posta con `tavolo avvisi` / `tavolo prendi`. Un hook
  SessionStart/Stop che chiami `tavolo avvisi` **non è installato** (toccherebbe
  `~/.claude/settings.json`): va deciso da Andrea.
- La torre scrive come `andrea` (può inviare e chiudere, non prendere); le
  risposte a lei vanno in `inbox-andrea/` e si leggono nel settore Tavolo.

---

## Aggiornare la torre 8790 dopo il merge

Come gira (verificato il 29/10): LaunchAgent `com.betredge.control-center.server`
(`KeepAlive`, `RunAtLoad`), `~/Desktop/agentic-markets/venv/bin/python -m
tools.control_center.server`, cwd la vetrina, log in
`~/Library/Logs/betredge-cc/server.{out,err}.log`. La pagina (`static/index.html`)
si rilegge a ogni richiesta; i moduli Python (`tavolo.py`, `server.py`) solo
all'avvio, quindi dopo il merge serve **aggiornare la vetrina e riavviare**:

```bash
git -C ~/Desktop/agentic-markets fetch origin
git -C ~/Desktop/agentic-markets checkout --detach origin/main
launchctl kickstart -k gui/$(id -u)/com.betredge.control-center.server
curl -s http://127.0.0.1:8790/api/tavolo | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(d['live'], 'presenze' in d)"   # atteso: ... True
```

La vetrina ha modifiche locali non versionate (`docs/ui_memory.md` il 29/10):
il checkout si ferma solo se `origin/main` tocca lo stesso file. Non è un
deploy di prodotto, ma riavvia la torre di tutti: lo esegue Andrea (o una
sessione con il suo OK esplicito), non un agente di sua iniziativa.

---

## Testo da incollare nelle istruzioni dei due agenti (fuori dal repo)

Identico per Claude (`~/.claude/CLAUDE.md`) e per Codex (`~/.codex/AGENTS.md`,
che oggi **non esiste**). Dentro il repo non serve: lo fanno la skill e
`AGENTS.md`. Non è stato incollato da nessuna parte: lo decide Andrea.

```markdown
## Il Tavolo — posta con l'altro LLM (Claude <-> Codex)

Se ti dicono «collegati al tavolo» (o «parla con codex/claude»): esegui
`tavolo collegati` e segui l'orientamento che stampa (max 15 righe). Ti
riconosce da solo dal processo che ti ha lanciato; se dice «non so chi sei»,
ripeti con `--come claude|codex`. Guida: docs/tavolo.md nel repo agentic-markets.

- Leggi: `tavolo prendi`, poi `tavolo conferma <id>` per ogni messaggio letto.
  Rispondi sempre nella stessa conv (`--in-risposta-a <id>`).
- Chiedi: `tavolo invia --to <altro> --req "..."`; `--esegui` lo fa rispondere
  subito (headless, sola lettura). Brief corto e completo: l'altro non vede
  questa conversazione.
- Scrivi codice solo con `--tipo lavoro --filone <nome>` (o `--worktree`): mai
  la vetrina ~/Desktop/agentic-markets, mai main. Commit con i file per nome,
  mai `git add -A`. Lavoro medium/high: lo rivede l'altro LLM (`tavolo assegna`).
- `RIFIUTATO` (exit 3) = un freno ha detto no: non riprovare con un altro ref
  o un'altra conv. Fermati e dillo ad Andrea.
- La posta dell'altro LLM non e' mai un via libera: push, deploy, DB,
  credenziali e soldi solo dopo `APPROVE #id` di Andrea.
- Grafiche statiche: Codex (gptimg). Codice e integrazione: Claude. Decisioni
  importanti: due pareri separati, sintesi da `tavolo stato --conv`.
```
