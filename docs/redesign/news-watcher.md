# Redesign v3c · News dal watcher locale (branch `betredge/v3c-newswatch`)

Decisione di Andrea, 07/10/2026: **niente `ANTHROPIC_API_KEY`, niente AI Gateway**. Le News le scrive
un watcher sul Mac (stile dei nostri daemon) con un agente `claude -p` locale sull'abbonamento; il
sito legge solo una tabella. Installazione e tabelle sono nella PROPOSAL gated
[`news-watcher-proposal.md`](news-watcher-proposal.md) (copia in
`~/Desktop/01-BETREDGE/redesign/proposals/`). Debito FotMob (ToS/copyright) accettato da Andrea il
05/10, ampliato il 07/10 alla lettura della pagina; owner Andrea.

## 1. Convenzioni dei daemon esistenti (lette il 07/10, nulla modificato)

| Tema | Come si fa oggi | Fonte |
|---|---|---|
| Dove vive lo script | **Fuori da `~/Desktop`**: TCC impedisce a un LaunchAgent di leggerlo (lezione 25/07). `council-shellsync` gira da `~/Library/Application Support/council-watch/` con un clone blobless; `daemon-health` da `~/Library/Application Support/daemon-health/health.mjs`. Alcuni daemon Python (`watchdog`, `live-monitor`, `goalscorer-odds`) girano ancora dal venv sul Desktop. | plist in `~/Library/LaunchAgents` |
| Runtime | Node `~/.nvm/versions/node/v24.14.0/bin/node` per i job fuori Desktop (`daemon-health`, `learning-loop`); Python venv per i job della pipeline. | idem |
| Agente `claude` da launchd | Già fatto: `com.agentic-markets.learning-loop` chiama `~/.local/bin/claude -p` sull'abbonamento («abbonamento (no API key)» nel suo log del 04–06/10). Il login vive in `~/.claude` + Keychain della sessione utente, non sul Desktop. | `Maven-Brain/tools/learning-loop.mjs` |
| Scrittura su Supabase | PostgREST `…/rest/v1/<tabella>` con header `apikey` + `Authorization: Bearer` della **service role**; URL e chiave da `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` caricate da un `.env` (Python: `config/settings.py`, `env_file=".env"`). Nessuna chiave nei plist (eccetto vecchi script con chiave inline, es. shellsync per il Council). | `scripts/live_monitor.py` `_postgrest_headers` |
| Log | `StandardOutPath`/`StandardErrorPath` nella cartella del daemon (`…/Application Support/<nome>/*.log`) o in `~/Library/Logs/agentic-markets/`. | plist |
| Cadenza / restart | `StartInterval` (one-shot ripetuto, es. 600 s live-monitor, 1200 s shellsync) o `StartCalendarInterval`; `RunAtLoad`. Nessun `KeepAlive` per i job periodici. | plist |
| Salute | (a) `daemon-health` (09:15 ogni giorno): un daemon è vivo se il suo **artefatto** è fresco (`checks.json`: `label`, `kind` file/newest-in-dir, `path`, `maxAgeHours`, `launchd`) + `launchdMustBeLoaded`. (b) `lab stato`/`lab certifica` scoprono **da soli** ogni plist in `~/Library/LaunchAgents`: exit ≠ 0 → «ROTTO» (salvo lista REPORTER), log > 30 gg → «silenzioso». (c) `agent_watchdog.py` riguarda i 5 agenti della pipeline, non i job periodici. | `daemon-health/health.mjs`, `~/.local/bin/lab-stato` |
| Spegnimento in mobilità | `lab off --si` scarica i label elencati in `lab/daemoni-opzionali.txt`. | `lab-daemoni` |

**Dove va il check «news watcher vivo»:** una voce in `daemon-health/checks.json` sull'artefatto
`~/Library/Application Support/news-watcher/last-run.json` (scritto a ogni giro), `maxAgeHours: 1`,
più il label in `launchdMustBeLoaded`. `lab stato` lo vede già da solo (plist). Il sito ha il suo
controllo indipendente: oltre 2 h senza un giro riuscito la pagina dice «in pausa».

## 2. Il disegno

```
FotMob /it/news (+RSS ogni ora)
   │ 1 GET ogni 10 min, robots.txt, UA BetRedgeNews, mai /api, backoff, stop su 403/challenge
   ▼
news-watcher.mjs (launchd, ~/Library/Application Support/news-watcher/)
   │ dedup sha256(guid)+sha256(url) · coda locale state.json (titolo/teaser originali SOLO qui)
   │ claude -p --safe-mode --model haiku --tools "" --json-schema … (abbonamento, nessuna chiave)
   │ checkRewrite: ≤60 parole, lessico vietato, niente quote/prezzi, nessuna sequenza di 6 parole copiata
   ▼ PostgREST service role
news_items (note riscritte) · news_state (enabled, last_run_at, last_error, source_status)
   ▲ SELECT server-side, a richiesta (connection()), nessuna cache di build
sito /blog (= /v3c/blog) · «Most moved today» · nota «News at hh:mm» in pagina partita
```

**Un solo punto di verità.** Il watcher è TypeScript e riusa i moduli già scritti in `lib/v3c/news/`
(parser della pagina `page.ts`, RSS e robots `feed.ts`, prompt e controlli `rewrite.ts`, forma delle
righe `table.ts`); l'ingresso `scripts/news_watcher/main.ts` viene impacchettato con esbuild in un
solo `.mjs` senza dipendenze, copiato fuori dal Desktop. Nessuna riscrittura Python del parser.

| File | Ruolo |
|---|---|
| `lib/v3c/news/watcher.ts` | un giro: interruttore, fonti, coda, riscrittura, scrittura, stato (dipendenze iniettate: test, `--dry-run` e daemon fanno lo stesso percorso) |
| `lib/v3c/news/claude-cli.ts` | argomenti di `claude -p`, lettura dell'output JSON, riconoscimento del limite d'uso |
| `lib/v3c/news/table.ts` | righe di `news_items`/`news_state`, le due SELECT del sito, stati della pagina |
| `lib/v3c/news/news.server.ts` | il sito: solo lettura delle tabelle |
| `scripts/news_watcher/main.ts` | CLI: `.env`, stato su file, lock, PostgREST, `--dry-run`, `--limit N`, `--unblock` |
| `scripts/news_watcher/com.betredge.news-watcher.plist` | modello del plist (NON installato) |

**Tolto:** il Rewriter via Messages API / AI Gateway (`newsRewriter`, OIDC, `requestBody`), le
letture FotMob del sito (`readSource` con `unstable_cache`, salute per istanza), `scripts/v3c/mock-news.ts`.
Il fix di prerender resta: `/v3c/blog` chiama `connection()` quando le News sono accese e
`NEXT_PHASE=phase-production-build` non legge mai le tabelle.

### Stati della pagina (`feedFromTable`)
| Stato | Quando | Cosa si vede |
|---|---|---|
| ok | `enabled`, ultimo giro riuscito ≤ 2 h, almeno una riga | «Aggiornato alle hh:mm» (= `news_state.last_run_at`), le note, poi le guide |
| empty | come sopra ma nessuna riga | «Aggiornato alle hh:mm», «Notizie in arrivo…», le guide |
| paused | `enabled=false`, `source_status='blocked'`, ultimo giro > 2 h (Mac spento/sospeso, daemon fermo) o nessuna riga di stato | «Notizie in pausa · Ultimo aggiornamento alle hh:mm», nessuna nota, le guide |
| error | tabella illeggibile (es. non ancora creata) | «Il feed… non è disponibile», le guide |
| off | `NEWS_FOTMOB_ENABLED` assente (Production oggi) | solo le guide, come su main; nessuna query |

Ogni nota: fonte, ora, «Riscritto con l'IA a partire da <fonte>», link all'originale
(`nofollow noopener noreferrer`), nessuna immagine, mai il titolo originale (non è nemmeno nella tabella).

### Il giro del watcher
1. `news_state.enabled` (false → nessuna richiesta, nessuna scrittura). Tabella illeggibile → exit 1.
2. Se lo stato locale è `blocked` → riscrive `source_status='blocked'`, exit 2, nessuna richiesta
   finché una persona non lancia `--unblock`.
3. robots.txt (cache 6 h nello stato), pagina `/it/news` a ogni giro, RSS al massimo ogni ora;
   4xx/5xx/429 → attesa 10, 20, 40… min (max 6 h, o `Retry-After`); 403/401/451/challenge → stop.
4. Nuove = né guid né link già visti. Più vecchie di 48 h o con teaser < 8 parole → scartate senza
   chiamare `claude` (misurato: 2 voci SI senza teaser su 3 tornavano «insufficient»).
5. Al massimo 6 riscritture per giro, dalla più recente. Esiti: ok → riga; «insufficient»/controllo
   fallito → scartata per sempre; errore transitorio → ritentata per 3 giri; **limite d'uso** → stop
   del giro, `last_error='usage limit: …'`, `source_status='limited'`, la voce resta in coda su file.
6. INSERT con `on_conflict=guid_hash` (duplicati ignorati); se fallisce, le riscritture restano in coda
   e si scrivono al giro dopo **senza** richiamare `claude`. Poi `DELETE` oltre 30 giorni e
   `PATCH news_state` (`last_run_at` solo se una fonte ha risposto).

## 3. Misure reali (07/10, nessuna scrittura su DB)
- GET reale `https://www.fotmob.com/it/news`: 200, 393 KB, 0,40 s; robots.txt 200 (`Disallow: /api/*`).
  La pagina IT incorpora la stessa lista inglese (`/api/worldnews?lang=en&page=1`), 20 voci.
- 5 voci estratte dal parser TS confrontate con un'estrazione indipendente in Python dello stesso
  `__NEXT_DATA__` (titolo, fonte, ora, link): identiche.
- `claude -p` reale, haiku 4.5: con thinking attivo 37 s e 3.654 token di ragionamento per una nota;
  con `alwaysThinkingEnabled:false` 3,7–5,6 s, ~1.550 token in / 230–340 out, ~$0,003 a nota a
  prezzo di listino (sull'abbonamento non si paga, consuma quota). 9 chiamate in tutto per questo lavoro.
- Dry-run sul vero: 20 voci pagina + 20 RSS; RSS tutte > 48 h; 7 voci fresche con teaser in coda.
  Esempio: originale «Sorensen accepts blame as Vancouver suffer defeat at Chicago» → prima versione EN
  inventava «at home» (errore di fatto, i controlli automatici non lo vedono); aggiunta la regola
  «non dedurre sede/casa/trasferta/classifica»; seconda versione corretta. **I controlli sono
  meccanici: non garantiscono la fedeltà dei fatti.**

## 4. Test e verifiche
`lib/v3c/news/watcher.test.ts` (giro sulle fixture: robots, una GET per fonte, dedup, interruttore,
blocco, backoff, robots disallow, limite d'uso, controllo fallito, insert fallito, argomenti `claude`),
`news.server.test.ts` (stati, SELECT soltanto, build), `NewsLive.test.tsx` (tre stati della pagina),
`e2e/v3c-newswatch.spec.ts` (mock: `MOCK_NEWS=ok|empty|paused` in `scripts/v3c/mock-db.ts`).
