# PROPOSAL #NEWSWATCH-2 · watcher locale v6: riparazioni, immagine per nota, intervallo, anti-sleep, sentinella (NON eseguita)

- **Task:** aggiornare il watcher News sul Mac (FotMob → `claude -p` → Supabase) senza spostarlo dal PC
  (decisione di Andrea 26/10: niente Vercel/cron/chiave API cloud). Cinque pezzi: (1) bundle nuovo,
  (2) fino a 2 riparazioni sulle note scartate, (3) un'immagine per nota dietro flag, (4) intervallo
  3/5 min + anti-sleep + sentinella, (5) proposta UI sulla soglia «pausa» (non toccata).
- **Branch:** `betredge/v3c-newswatch`, worktree `~/Desktop/01-BETREDGE/am-v3c-newswatch`, commit di questo pacchetto sopra `1932f315`.
- **Owner esecuzione:** Andrea (o chi indica). **Serve OK da:** Andrea — `APPROVE #NEWSWATCH-2`.
  L'opzione A delle immagini (bucket + colonna) è un **APPROVE separato** (`#NEWSWATCH-2-IMG`), non incluso qui.
- **Rischio:** medio. Si sostituisce il bundle del daemon in esecuzione e si caricano 2 LaunchAgent nuovi.
  Nessuna DDL in questo APPROVE. Nessuna chiave nuova.

## Misure (29/10, dati reali, nessuna scrittura su DB)

**Scarto delle note, prima → dopo.**
- Prima (prod, bundle v4, `watcher.log` 07/10–29/10): **300 ok · 261 scartate = 46,5%**. Prime cause:
  «copies a 6-word run» 69, «facts: it: name «…»» 42, verificatore 13, «it: goal/scorer» 12, «en: record» 11.
- Dopo (dry-run del bundle v6 su 11 note vere di FotMob lette oggi, `NEWS_WATCHER_HOME` temporanea senza `.env`):
  passate al **primo tiro 7/11** (scarto 36%), passate **dopo ≤ 2 riparazioni 10/11 (scarto 9%)**: 3 recuperate
  al 2° tiro, tutte poi passate anche la seconda lettura (sonnet). L'unica persa: «facts: it: name «murali»»
  dopo 3 tiri (la stessa voce che in prod era scartata per «murales»: il modello traduce un nome).
  Campione piccolo e appaiato (stesse note, stesso run): indica la direzione, non è il tasso a regime.
- Costo in tempo: nota al 1° tiro 14–25 s (riscrittura + verifica); riparata 24–38 s; persa dopo 3 tiri 40 s.

**Limite d'uso — bug trovato misurando.** Il primo dry-run (11:31) ha esaurito la quota 5-hour
dell'abbonamento (condivisa con le sessioni). Messaggio: «You've hit your 5-hour limit · resets 2:30pm».
`LIMIT_RE` di v4/v5 non lo riconosceva → «transient». In prod, oggi: **15 righe, 5 note ritentate 3 giri
dentro il limite e perse**. Corretto e testato in v6.

**Immagini (dry-run con `NEWS_WATCHER_IMAGES=1`, `NEWS_WATCHER_IMAGE_PUBLISH=supabase` a secco, 3 note vere).**
- Ordine: le 3 `WOULD INSERT` alle 14:38:17, la prima immagine pronta alle 14:39:22 → **nota prima, immagine dopo**.
- 3/3 generate, controllate e passate al **1° tentativo**: 65 s, 49 s, 44 s (gptimg + sips + cwebp + controllo);
  1200×675; webp 75 / 95 / 132 KB (< 150 KB); png 1,1–1,2 MB. Nomi opachi, es.
  `news-60a5f27ee9febc6a-martinez-praises-leverkusen-passion-dfb-pokal.webp` (nessun id FotMob).
- Guardate a occhio da me: huddle rosso di spalle, allenatore di spalle + due giocatori rossi lontani, stadio
  blu vuoto; nessun volto, logo, testo leggibile visto. La terza nota («Alonso confident…») è caduta nella
  scena «other» (stadio vuoto): la tabella segnali non ha «confident».
- Controllo visivo automatico (claude -p sonnet, solo Read) sulle 6 immagini di art-director del 29/10
  (4 approvate + 2 bocciate a mano per swoosh sulle scarpe e maglia a strisce): **18/18 letture concordi
  col giudizio umano** (3 giri × 6), 4–6 s a immagine. Ha trovato da solo lo swoosh e le strisce.

**Richieste a FotMob al giorno** (pagina a ogni giro + RSS ogni ora + robots ogni 6 h).
| Intervallo | Teorico (Mac sempre sveglio) | Misurato |
|---|---|---|
| 10 min (oggi) | 144 + 24 + 4 = 172 | pagina: mediana ~110/giorno, max 143 (Mac sveglio ~76% del tempo); RSS ~19 |
| 5 min | 288 + 24 + 4 = **316** | non misurato (stima ~240 col 76% di veglia, ~316 con caffeinate su corrente) |
| 3 min | 480 + 24 + 4 = **508** | non misurato (stima ~390 / ~508) |
In 22 giorni di log: **0** risposte 403/429/challenge. Self-stop su 403/401/451/challenge invariato (test verdi).
Con 3 min un giro con un'immagine dura fino a ~2,5 min: entra un solo tentativo d'immagine per giro (test).


## COSA CAMBIERÀ ESATTAMENTE

### File nel repo (già committati sul branch, nessun push)

| File | Prima → dopo |
|---|---|
| `lib/v3c/news/rewrite.ts` | 1 riparazione solo per «copies a 6-word run» → fino a `MAX_REPAIRS = 2` su ogni scarto meccanico o di fatti (`repairable`: `check: …`, `facts: …`, `not JSON`). Il turno di riparazione riceve la nota scartata, il motivo e un'istruzione mirata (righe copiate, titolo IT troppo lungo, parola vietata nominata, nomi/fatti non nell'originale). `PROMPT_VERSION` v5 → **v6**. Mai riparati: «insufficient» e la seconda lettura (sonnet): richiedere finché il verificatore dice sì consumerebbe la barriera. |
| `lib/v3c/news/claude-cli.ts` | ciclo di riparazione (max 1 + 2 riscritture + 1 verifica per nota); `attempts` nell'esito e nel log. **Bug corretto:** `LIMIT_RE` non riconosceva «You've hit your **5-hour** limit» → letto come errore transitorio, la voce ritentata 3 giri dentro il limite e poi **scartata** (misurato in prod il 29/10: 15 righe, 5 note perse). Ora è `limit`: il giro si ferma e la voce resta in coda. |
| `lib/v3c/news/image.ts` (nuovo) | parte pura dell'immagine: SCENA dalla tabella segnali di art-director (10 tipi), TINTA = un solo colore del club protagonista (mai una coppia: «blue and black» → strisce reali), STYLE fisso; nome file `news-<16 hex opachi>-<slug del NOSTRO titolo>`; prompt e schema del controllo visivo. |
| `lib/v3c/news/club-tints.json` (nuovo) | istantanea dei colori primari di `lib/news/clubs.ts` (branch `feat/news-fotmob-prod-1026`): 153 club, esclusi gli `unsure`. Da sostituire con l'import quando i due branch sono su main. |
| `lib/v3c/news/image-gen.ts` (nuovo) | un tentativo: `gptimg` (stdin chiuso = `</dev/null`, timeout 240 s) → `sips` ritaglio 16:9 + 1200×675 → `cwebp` < 150 KB → controllo visivo `claude -p` sonnet con il solo tool Read. Un'immagine bocciata va in `_rejected/`, mai servita. `storagePublisher` = opzione A (vedi sotto), dietro flag. |
| `lib/v3c/news/watcher.ts` | passo 8 «immagini» **dopo** insert e `news_state`: la nota esce subito (con l'immagine di tipo lato UI), l'immagine segue. Un tentativo per nota per giro, in serie, solo se entra nella finestra del giro (`IMAGE_ATTEMPT_MS = 150 s`); 3 tentativi bocciati → fallback definitivo all'immagine di tipo. Coda `images` nello `state.json` (campo opzionale, stesso formato v1). Un errore d'immagine non cambia mai l'exit del giro. |
| `scripts/news_watcher/main.ts` | flag d'ambiente (tutti **spenti** di default): `NEWS_WATCHER_INTERVAL_S` (finestra del giro), `NEWS_WATCHER_IMAGES=1`, `NEWS_WATCHER_IMAGE_PUBLISH=supabase`. `last-run.json` ora ha `lastOkAt` (ultimo giro che ha letto la fonte) e `intervalS`. |
| `scripts/news_watcher/com.betredge.news-watcher.plist` | `StartInterval 600` → `__INTERVAL_S__` (template), + `NEWS_WATCHER_INTERVAL_S`, `NEWS_WATCHER_IMAGES=0`, `/opt/homebrew/bin` nel PATH (cwebp). |
| `scripts/news_watcher/com.betredge.caffeinate.plist` (nuovo) | `/usr/bin/caffeinate -s`, `KeepAlive`. |
| `scripts/news_watcher/com.betredge.news-sentinel.plist` + `sentinel.mjs` (nuovi) | ogni 300 s legge solo `last-run.json`: nessun giro riuscito da > 15 min → una notifica macOS per fermo + exit 3 (→ `lab stato` lo mostra «ROTTO (exit 3)» con la riga del motivo, **senza toccare `lab-stato`**, che scopre i plist da solo). Rientro → una riga «rientrato». `enabled=false` non è un fermo. |
| `scripts/news_watcher/render-launchd.sh` (nuovo) | `render-launchd.sh 180\|300 <dir>`: scrive i 3 plist con l'intervallo scelto e li valida con `plutil -lint`. Non installa nulla. |
| test | `facts.test.ts`, `watcher.test.ts`, `image.test.ts` (nuovo): riparazioni, limite 5-hour, immagini (ordine nota→immagine, cap 3, finestra, publish che fallisce e riprova senza rigenerare, limite d'uso), nome opaco, publisher su fetch finto. |

### Sul Mac (passi dell'esecuzione, SOLO dopo `APPROVE #NEWSWATCH-2`)

```bash
H="$HOME/Library/Application Support/news-watcher"
WT=~/Desktop/01-BETREDGE/am-v3c-newswatch
# 0. backup (rollback)
cp "$H/news-watcher.mjs" "$H/news-watcher.mjs.bak-v4"
cp ~/Library/LaunchAgents/com.betredge.news-watcher.plist "$H/com.betredge.news-watcher.plist.bak-v4"
# 1. bundle v6 (stesso comando di #NEWSWATCH-1)
cd "$WT" && npx esbuild scripts/news_watcher/main.ts --bundle --platform=node --format=esm --target=node22 --outfile="$H/news-watcher.mjs"
node "$H/news-watcher.mjs" --dry-run --limit 1          # a secco sul vero, nessuna scrittura
# 2. sentinella fuori dal Desktop
cp scripts/news_watcher/sentinel.mjs "$H/sentinel.mjs" && node "$H/sentinel.mjs" --dry-run
# 3. plist con l'intervallo scelto da Andrea (180 o 300)
scripts/news_watcher/render-launchd.sh 300 /tmp/nw-plists
cp /tmp/nw-plists/com.betredge.*.plist ~/Library/LaunchAgents/
launchctl bootout gui/$(id -u)/com.betredge.news-watcher
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.betredge.news-watcher.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.betredge.news-sentinel.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.betredge.caffeinate.plist
# 4. daemon-health: "note" della voce news-watcher → «News v3c ogni 5 min» (maxAgeHours 1 resta)
```

| Cosa | Prima | Dopo |
|---|---|---|
| bundle `news-watcher.mjs` | v4 (7/10, sha256 `3e7f65f0…`), senza riparazioni, senza la correzione del 26/10 | v6 (sha256 nel log di build all'esecuzione) |
| `com.betredge.news-watcher` | ogni 600 s | ogni 180 o 300 s (scelta di Andrea), immagini **spente** |
| `com.betredge.news-sentinel` | — | nuovo, ogni 300 s |
| `com.betredge.caffeinate` | — | nuovo, sempre vivo (`-s`) |
| DB | — | **nessuna modifica** in questo APPROVE |

### Rollback (≤ 1 min)
```bash
cp "$H/news-watcher.mjs.bak-v4" "$H/news-watcher.mjs"
cp "$H/com.betredge.news-watcher.plist.bak-v4" ~/Library/LaunchAgents/com.betredge.news-watcher.plist
launchctl bootout gui/$(id -u)/com.betredge.news-watcher && launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.betredge.news-watcher.plist
launchctl bootout gui/$(id -u)/com.betredge.news-sentinel; launchctl bootout gui/$(id -u)/com.betredge.caffeinate
rm ~/Library/LaunchAgents/com.betredge.news-sentinel.plist ~/Library/LaunchAgents/com.betredge.caffeinate.plist
```
`state.json` resta compatibile in entrambe le direzioni (il campo `images` è opzionale; v4 lo ignora).

### Blast radius
- Solo il Mac di Andrea e le righe che il watcher già scrive (`news_items` INSERT, `news_state` PATCH). Il sito non cambia.
- Note con prompt v6 marcate `rewrite_model … prompt v6 [· repaired] · verified …` → distinguibili e revocabili come oggi.
- Quota dell'abbonamento Claude **condivisa** con le sessioni interattive: più riparazioni (fino a 2 chiamate haiku in più per nota scartata) e, a immagini accese, una chiamata sonnet con immagine per tentativo. Il 29/10 la quota 5-hour si è esaurita (sessioni + watcher) e — per il bug di `LIMIT_RE` — il watcher ha perso 5 note: corretto in v6.
- FotMob: più richieste al giorno (tabella sotto). Backoff e stop su 403/challenge invariati (in 22 giorni di log: **0** 403/429/challenge).
- `caffeinate -s` tiene sveglio il Mac **solo su corrente**: più consumo, ventole. A batteria non fa nulla; coperchio chiuso senza monitor esterno → il Mac dorme comunque.

### Piano di verifica (dopo l'esecuzione)
1. `node "$H/news-watcher.mjs" --dry-run --limit 1` → `rewrite ok|final …` + `run: exit 0`.
2. Dopo 2 intervalli: `tail "$H/watcher.log"` mostra 2 giri `exit 0`, `last-run.json` ha `lastOkAt` fresco e `intervalS` giusto.
3. `launchctl list | grep -E "news-|caffeinate"` → 3 label; `pmset -g assertions | grep caffeinate` → `PreventSystemSleep 1` (su corrente).
4. Sentinella: `launchctl bootout …news-watcher` per 20 min (o `NEWS_SENTINEL_MAX_MIN=1 node "$H/sentinel.mjs"`) → arriva la notifica, `lab stato` mostra `com.betredge.news-sentinel ROTTO (exit 3)` con il motivo; rimesso il watcher → «rientrato».
5. Dopo 24 h: tasso di scarto dal log (`rewrite final` / (`ok`+`final`)) contro il 46,5% di v4, e conteggio GET/giorno.

## Immagini generate a runtime: dove vivono (PROBLEMA APERTO)

Oggi le 4 immagini fatte a mano stanno in `public/images/news/` del repo (`feat/news-fotmob-prod-1026`,
`NOTE_IMAGES` scritto a mano): **ogni nuova immagine = un commit + un deploy**. Con ~14 note/giorno non
scala, e un daemon che committa e pusha da solo sarebbe peggio. Il codice v6 genera e controlla
l'immagine **sul Mac** (`$H/images/`) e si ferma lì: la pubblicazione è dietro
`NEWS_WATCHER_IMAGE_PUBLISH`, **spento**.

Vincolo nuovo di Andrea (29/10): nulla sul sito deve riportare a FotMob → il nome pubblico è
`news-<16 hex di sha256("news-image:"+guid_hash)>-<slug del nostro titolo>.webp`: né id FotMob né
guid_hash (che è lo sha256 del guid FotMob e si potrebbe ricalcolare).

| | **A · Supabase Storage, bucket pubblico** (consigliata, implementata dietro flag) | **B · Vercel Blob** |
|---|---|---|
| Come | il watcher fa POST del webp su `storage/v1/object/news-images/<nome>` con la **stessa service role** che già usa, poi `PATCH news_items SET image_url` | il watcher fa PUT su Blob con un token `BLOB_READ_WRITE_TOKEN` nuovo nel `.env` del Mac, poi la stessa PATCH |
| Scritture prod | crea bucket pubblico `news-images` + migrazione additiva `ALTER TABLE news_items ADD COLUMN image_url text CHECK (image_url ~ '^https://')` → **APPROVE separato** | stessa colonna (APPROVE) + store Blob nuovo sul progetto Vercel |
| Credenziali | nessuna nuova | una chiave nuova sul Mac, con scrittura sullo store del progetto |
| Costo | ~120 KB/nota (solo webp; il png da ~1,1 MB resta sul Mac) × ~14/giorno ≈ 1,7 MB/giorno ≈ 50 MB a 30 gg. Banda: dipende dal traffico (piano Supabase da verificare: NON letto) | storage simile; banda/operazioni a consumo sul piano Vercel |
| Sito | legge `image_url` nella SELECT esistente; `<img>` in `<picture>` (CSP `img-src https:` già lo permette, niente `remotePatterns`) | idem |
| Rischi | bucket pubblico = chiunque con l'URL legge l'immagine (sono pubbliche per natura); file **non** cancellati quando la riga scade a 30 gg (debito: pulizia del bucket da aggiungere) | un vendor/segreto in più; stesso debito di pulizia |
| Rollback | flag spento; `image_url` NULL → la UI usa l'immagine di tipo | idem |

**Implementato (dietro flag spento):** solo A — `storagePublisher` + `attachImage`. In dry-run stampa
`WOULD UPLOAD` / `WOULD UPDATE … image_url`. **Mai eseguito contro il progetto reale** (né bucket né colonna esistono).
Lato UI serve poi: `image_url` nella SELECT e in `NewsCard`, `noteImage()` che lo preferisce a `NOTE_IMAGES` → branch UI, non toccato.

## Soglia «pausa» del sito (branch `feat/news-fotmob-prod-1026`, NON toccato)

Oggi `feedFromTable` (`lib/news/table.ts`): `enabled=false`, `blocked` **o** nessun giro da > 2 h
(`STALE_MS`) → `paused` **senza note**: se il Mac dorme 2 h, il sito svuota la sezione anche se le
note già pubblicate sono valide. Proposta per quel branch:
- `paused` per **Mac fermo** (nessun giro > 2 h): mostra comunque le note (stessi filtri: 7 giorni, max 20, mai le `rejected · …`) con la riga «Ultimo aggiornamento alle hh:mm» al posto di «Aggiornato alle»; nessuna scritta «in pausa».
- `paused` **senza note** solo per le cause volute: `enabled=false` (interruttore) o `source_status='blocked'`.
- `STALE_MS` resta 2 h e decide solo l'etichetta, non la visibilità.
- Da rivedere nello stesso giro, per la regola di Andrea del 29/10 (letto sul branch @ `6836983f`, non toccato): il link all'originale è già tolto, ma la **fonte resta come etichetta**; e le 4 immagini fatte a mano hanno l'**id FotMob nel nome** (`/images/news/news-1h64s2rd5exkn16klbwyxxlsns-….webp`, mappa `NOTE_IMAGES` per id FotMob) → da rinominare con lo stesso schema opaco.

## Costruito · verificato · NON verificato

**Costruito e committato** (branch `betredge/v3c-newswatch`, `ddc41b8c` codice + il commit di questo documento; nessun push):
riparazioni v6, fix `LIMIT_RE`, immagine per nota (flag spento), publisher opzione A (flag spento),
intervallo configurabile, sentinella, plist caffeinate/sentinella/watcher-template, `render-launchd.sh`.

**Verificato davvero:**
- `vitest` `lib/v3c` + `components/v3c`: **970/970 verdi** (38 file); `lib/v3c/news`: 160/160. `tsc` pulito sui file toccati, `eslint` 0.
- Bundle esbuild v6: `news-watcher.mjs` 84 KB, sha256 `ab4b693f…` (scratchpad, NON copiato in `Application Support`). Installato oggi: v4, sha256 `3e7f65f0…`.
- 3 dry-run reali (FotMob vero, `claude -p` vero, `gptimg` vero, DB finto che stampa): numeri sopra.
- Sentinella in dry-run su 7 casi (nessun file, fresco, fermo 40 min, heartbeat vecchio formato, interruttore spento, bloccato, heartbeat reale di prod in sola lettura): esiti attesi, exit 0/3.
- `render-launchd.sh 300` e `180`: 3 plist validi (`plutil -lint`); 240 rifiutato.
- Il plist installato oggi è identico al template di `HEAD~1` (diff vuoto).

**NON verificato:**
- Nulla installato, nessun `launchctl`, nessuna scrittura su DB, nessun push (vincoli del brief).
- `gptimg` e il controllo visivo **lanciati da launchd** (ambiente del LaunchAgent, auth Codex/Claude fuori dal terminale): provati solo da shell.
- `caffeinate -s` come LaunchAgent, `osascript` della sentinella da launchd, riga di `lab stato` (ricavata leggendo `lab-stato`, non vista girare).
- Opzione A contro Supabase reale (bucket e colonna non esistono); piano Supabase/costi di banda non letti.
- Tasso di scarto v6 a regime: 11 note sono poche; si misura dopo 24 h in prod (piano di verifica §5).
- Richieste/giorno a 3 e 5 min: solo calcolo, non misurate.
- Il controllo visivo su immagini nuove: 3/3 passate e a occhio pulite, ma nessuna bocciata dal vivo in questo giro → il ramo «rigenera» è coperto solo dai test e dalle 2 bocciate storiche.
- Lato UI (`image_url`, soglia pausa, fonte come etichetta, nomi file con id FotMob): solo proposta.

**Debiti dichiarati:** pulizia dei file nel bucket dopo 30 gg (opzione A); `club-tints.json` è una copia
di `lib/news/clubs.ts` da sostituire con l'import a merge; la sentinella non vede un giro che legge la fonte
ma non riesce a riscrivere (es. OAuth di `claude` scaduto: 19 righe nel log di prod) — lo vede `last_error`.
