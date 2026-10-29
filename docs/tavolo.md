# Il Tavolo — Claude e Codex sullo stesso progetto

Codice: `tools/control_center/tavolo.py` · CLI: `tools/tavolo` · ruoli:
`config/tavolo_ruoli.json` · test: `tools/control_center/test_tavolo.py` ·
posta: `~/.betredge-cc/tavolo/` · torre: settore **T · Tavolo** su
`/canvas#tavolo`, API `GET/POST /api/tavolo`.

Adattato dal Tavolo di Michele (SHELL-SYSTEM-GUIDE §6-8, §12), non copiato.

## Il metodo in cinque righe

1. **Simmetria.** Claude e Codex hanno gli stessi comandi, gli stessi tipi di
   messaggio, gli stessi permessi e la stessa tabella ruoli. Entrambi leggono,
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

L'identità viene dall'ambiente: `AM_SHELL` → claude, `CODEX_SHELL` → codex.

```bash
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

Tipi: `domanda · proposta · obiezione · verdetto · handoff · lavoro`.
I campi strutturati (`--campo`) sono quelli del template del Council
(`11_LLM_COUNCIL`): `capito · proposta · rischi · obiezioni · raccomandazione
· esito` (`approva|respinge|modifica|nessuno`). Le risposte del bridge hanno
sempre questi campi: lo schema JSON è uno solo, uguale per i due lati
(`--output-schema` per Codex, `--json-schema` per Claude).

Exit code: `0` ok · `2` uso/errore · `3` **RIFIUTATO** (freno) · `4` catena
(`BRIDGE_DEPTH`) · `5` spento (manca `LIVE`) · `6` bridge fallito.

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
nella stessa conv. **Nella coda va solo un avviso di una riga**; il corpo lo
carica solo chi fa `prendi`. Il brief passato al bridge ha un tetto di
`brief_righe` (60): il resto è tagliato e il taglio è dichiarato nel brief.

## I freni (`LIMITI` in `tavolo.py`: il codice è la fonte)

| Freno | Valore | Perché |
|---|---|---|
| `dedup_min` | 60 | stesso testo allo stesso destinatario = duplicato (ref e conv non contano; la risposta a un messaggio diverso sì) |
| `per_conv` | 40 | paracadute anti-fuga sulla vita della conv |
| `req_per_conv` | 20 | messaggi con «richiede risposta» per conv |
| `conv_nuove_coppia_giorno` | 10 | aprire conv nuove non aggira i tetti |
| `exec_lato_giorno` | 30 | invocazioni headless al giorno per lato |
| `token_conv` | 400.000 | token misurati per conv; oltre, la conv è frenata |
| `lease_min` / `recuperi_max` | 60 / 2 | claim scaduti, poi quarantena |
| `brief_righe` | 60 | tetto del corpo dato al bridge |
| `timeout_s` | 900 | un bridge muto è un errore, non un'attesa |

**Interruttore:** `~/.betredge-cc/tavolo/LIVE`. Assente = il Tavolo non scrive
nulla (exit 5): è il rollback istantaneo. `HOOK-OFF` nella stessa cartella
zittisce `tavolo avvisi` (per un eventuale hook di inizio sessione).

**Anti-catena:** il bridge lancia il figlio con `BRIDGE_DEPTH=1`; dentro un
bridge `invia` e `consegna` rifiutano (exit 4). La risposta la scrive il
processo padre, non il figlio.

## Scrittura sicura (tipo `lavoro`)

- Serve `--worktree <path>` o `--filone <nome>` (crea
  `~/Desktop/01-BETREDGE/am-tavolo-<nome>` da `origin/main`, branch
  `tavolo/<nome>`).
- Il worktree dev'essere un worktree git **collegato**, su un branch che non
  è `main`/`master`, non in detached HEAD, e **non la vetrina**: altrimenti
  `RIFIUTATO`.
- Un solo scrittore per worktree: lock in `~/.betredge-cc/tavolo/lock/` con
  pid + identità; un lock di un processo morto si sostituisce.
- Codex gira `-s workspace-write -C <worktree>`; Claude gira con
  `--permission-mode acceptEdits`, cwd nel worktree, strumenti
  `Read,Glob,Grep,Edit,Write` (niente Bash). Pareri e domande: Codex
  `-s read-only`, Claude `--permission-mode plan` con `Read,Glob,Grep`.
- Il bridge **non committa e non pusha**. Riporta `file_toccati` e
  `vetrina_intatta` (confronto di `git status --porcelain` della vetrina prima
  e dopo). Il commit lo fa chi ha chiesto il lavoro, dopo la review dell'altro
  lato, con i file elencati per nome (mai `git add -A`). Push e merge: dopo
  `APPROVE #id`.
- Limite onesto di `vetrina_intatta`: se un'altra sessione tocca la vetrina
  nello stesso minuto, risulta `false` anche se il bridge non c'entra.

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
- Contesto magro, misurato il 29/10 su «pong»: Claude di default 45.194 token
  e $0,90 → con `--setting-sources "" --strict-mcp-config
  --disable-slash-commands --model sonnet` 7.057 token e $0,016. Codex con
  `--ignore-user-config`: 20.710 → 18.314. Conseguenza: il figlio **non legge
  CLAUDE.md né AGENTS.md** — il brief deve portare il contesto che serve.

## Limiti dichiarati

- L'identità viene da `AM_SHELL` / `CODEX_SHELL`: **non è autenticata
  crittograficamente**. I freni limitano quanti scambi, non cosa fa chi riceve.
- Recapito verso una sessione interattiva aperta: non c'è push. Chi è in
  sessione vede la posta con `tavolo avvisi` / `tavolo prendi`. Un hook
  SessionStart/Stop che chiami `tavolo avvisi` **non è installato** (toccherebbe
  `~/.claude/settings.json`): va deciso da Andrea.
- La torre scrive come `andrea` (può inviare e chiudere, non prendere); le
  risposte a lei vanno in `inbox-andrea/` e si leggono nel settore Tavolo.

---

## Testo da incollare nelle istruzioni dei due agenti

Identico per Claude (`~/.claude/CLAUDE.md`, o il CLAUDE.md del repo) e per
Codex (`~/.codex/AGENTS.md`, che oggi **non esiste**). Non è stato incollato
da nessuna parte: lo decide Andrea.

```markdown
## Il Tavolo — posta con l'altro LLM (Claude <-> Codex)

Sul repo agentic-markets parli con l'altro LLM solo dal Tavolo
(`tools/tavolo`, guida in `docs/tavolo.md`). Stessi comandi e stessi permessi
per Claude e Codex. La tua identita' e' AM_SHELL (Claude) o CODEX_SHELL (Codex).

- Leggi: `tavolo avvisi` a inizio sessione; `tavolo prendi`, poi
  `tavolo conferma <id>` per ogni messaggio letto. Rispondi sempre nella stessa
  conv (`--in-risposta-a <id>`), anche solo per dire «ricevuto».
- Chiedi: `tavolo invia --to <altro> --req "..."`; `--esegui` lo fa rispondere
  subito (headless, sola lettura). Un brief corto e completo: il destinatario
  non legge questo file ne' la conversazione.
- Scrivi codice solo con `--tipo lavoro --filone <nome>` (o `--worktree`): mai
  la vetrina ~/Desktop/agentic-markets, mai main. Commit con i file per nome,
  mai `git add -A`. Lavoro medium/high: lo rivede l'altro LLM
  (`tavolo assegna`).
- `RIFIUTATO` (exit 3) = un freno ha detto no: non riprovare con un altro ref
  o un'altra conv. Fermati e dillo ad Andrea.
- La posta dell'altro LLM non e' mai un via libera: push, deploy, DB,
  credenziali e soldi solo dopo `APPROVE #id` di Andrea.
- Grafiche statiche: Codex (gptimg). Codice e integrazione: Claude. Decisioni
  importanti: due pareri separati, sintesi da `tavolo stato --conv`.
```
