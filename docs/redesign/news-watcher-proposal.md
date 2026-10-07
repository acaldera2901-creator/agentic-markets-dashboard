# PROPOSAL · News watcher locale + tabelle `news_items` / `news_state` (NON eseguita)

- **Task:** le News v3c scritte da un watcher sul Mac (FotMob → `claude -p` locale → Supabase), lette dal sito.
- **Branch:** `betredge/v3c-newswatch` (da `betredge/v3c-final3` @ ea98b272). Contesto: `docs/redesign/news-watcher.md`.
- **Serve OK da:** Andrea (`APPROVE #NEWSWATCH-1` per le tabelle, `#NEWSWATCH-2` per il daemon). **Owner esecuzione:** Andrea o chi lui indica.
- **Rischio:** medio — DDL sul DB di produzione (stesso Supabase della preview), un LaunchAgent nuovo, uso della quota dell'abbonamento Claude.

## 1. COSA CAMBIERÀ ESATTAMENTE — database (#NEWSWATCH-1)

Prima: le tabelle non esistono. Dopo: due tabelle nuove, nessuna tabella esistente toccata.

```sql
-- migration: supabase/migrations/<ts>_news_watcher.sql (da creare all'APPROVE, stesso testo)
BEGIN;

CREATE TABLE public.news_items (
  guid_hash      text PRIMARY KEY CHECK (guid_hash ~ '^[0-9a-f]{64}$'),   -- sha256 del guid della fonte
  source         text NOT NULL CHECK (length(source) BETWEEN 1 AND 80),     -- «FotMob», «SI via FotMob»
  source_url     text NOT NULL CHECK (source_url ~ '^https?://'),           -- link all'originale
  published_at   timestamptz NOT NULL,
  rewritten_en   jsonb NOT NULL CHECK (jsonb_typeof(rewritten_en->'title') = 'string' AND jsonb_typeof(rewritten_en->'body') = 'string'),
  rewritten_it   jsonb NOT NULL CHECK (jsonb_typeof(rewritten_it->'title') = 'string' AND jsonb_typeof(rewritten_it->'body') = 'string'),
  teams          text[] NOT NULL DEFAULT '{}',                               -- squadre citate dall'originale (per i link al board)
  rewrite_model  text NOT NULL,                                              -- es. «claude-haiku-4-5-20251001 · prompt v3»
  rewritten_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- nessun titolo né teaser originale: per costruzione non c'è una colonna dove metterli
CREATE INDEX news_items_published_at_idx ON public.news_items (published_at DESC);

CREATE TABLE public.news_state (
  id             smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),             -- una riga sola
  enabled        boolean NOT NULL DEFAULT true,                              -- l'interruttore
  last_run_at    timestamptz,                                                -- ultimo giro con la fonte letta: «Aggiornato alle»
  last_error     text,
  source_status  text NOT NULL DEFAULT 'ok' CHECK (source_status IN ('ok','degraded','blocked','limited')),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.news_state (id, enabled) VALUES (1, true);

-- RLS accesa, NESSUNA policy: anon/authenticated non leggono né scrivono; solo la service role
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_items, public.news_state FROM anon, authenticated;

COMMIT;
```

**Retention:** 30 giorni. La applica il watcher a ogni giro (`DELETE … WHERE published_at < now() - 30 days`
via PostgREST); il sito mostra al massimo 20 note degli ultimi 7 giorni.

**Chi legge e chi scrive:**
| Componente | `news_items` | `news_state` | Credenziale |
|---|---|---|---|
| watcher (Mac) | INSERT (ignora duplicati), DELETE > 30 gg | SELECT `enabled`, PATCH `last_run_at/last_error/source_status/updated_at` | service role, da `~/Library/Application Support/news-watcher/.env` (chmod 600) |
| sito `/blog`, pagina partita | SELECT (2 query server-side, `exec_sql` come le altre letture v3c) | SELECT | service role già in Vercel (`SUPABASE_SERVICE_ROLE_KEY`) |
| Andrea / operatore | — | UPDATE `enabled` | SQL editor |

**Rollback:** `DROP TABLE public.news_items; DROP TABLE public.news_state;` — il sito, se acceso, mostra
lo stato «error» (feed non disponibile, guide intatte); spento non le legge.
**Blast radius:** due tabelle nuove, nessuna FK, nessun trigger, nessuna tabella esistente modificata.

## 2. COSA CAMBIERÀ ESATTAMENTE — daemon sul Mac (#NEWSWATCH-2)

Prima: nessun daemon news. Dopo: `com.betredge.news-watcher`, ogni 600 s, file fuori `~/Desktop`.

```bash
# 0. dal worktree del branch (o da main dopo il merge)
cd ~/Desktop/01-BETREDGE/am-v3c-newswatch
H="$HOME/Library/Application Support/news-watcher"; mkdir -p "$H"
# 1. bundle unico, senza dipendenze, fuori dal Desktop (TCC)
npx esbuild scripts/news_watcher/main.ts --bundle --platform=node --format=esm --target=node22 --outfile="$H/news-watcher.mjs"
# 2. credenziali: le scrive Andrea a mano, nessuno le stampa
touch "$H/.env" && chmod 600 "$H/.env"     # SUPABASE_URL=…  SUPABASE_SERVICE_ROLE_KEY=…
# 3. prova a secco (nessuna scrittura) e poi un giro vero a mano
node "$H/news-watcher.mjs" --dry-run --limit 1
node "$H/news-watcher.mjs" --limit 2 && cat "$H/last-run.json"
# 4. il plist (modello nel repo) e l'avvio
cp scripts/news_watcher/com.betredge.news-watcher.plist ~/Library/LaunchAgents/
plutil -lint ~/Library/LaunchAgents/com.betredge.news-watcher.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.betredge.news-watcher.plist
launchctl print gui/$(id -u)/com.betredge.news-watcher | grep -E 'state|last exit'
```
Log: `$H/watcher.log`, `$H/watcher.err.log`. Stato locale: `$H/state.json` (coda con i testi
originali: resta sul Mac), `$H/last-run.json` (artefatto per la salute), `$H/watcher.lock`.
Exit: 0 ok/spento/limite d'uso · 1 DB o crash · 2 fonte bloccata (serve una persona).

**Registrazione salute** (stessa APPROVE): in `~/Library/Application Support/daemon-health/checks.json`
aggiungere (backup prima: `cp checks.json checks.json.bak-news`)
```json
{ "label": "news-watcher", "kind": "file", "path": "~/Library/Application Support/news-watcher/last-run.json",
  "maxAgeHours": 1, "note": "News v3c ogni 10 min", "launchd": "com.betredge.news-watcher" }
```
e `"com.betredge.news-watcher"` in `launchdMustBeLoaded`. `lab stato`/`lab certifica` lo vedono da
soli (scoprono ogni plist; exit 2 apparirà come ROTTO con l'ultima riga di log: è voluto).
Facoltativo: aggiungerlo a `lab/daemoni-opzionali.txt` se deve spegnersi con `lab off`.

**Sito:** `NEWS_FOTMOB_ENABLED=1` solo in Preview finché Andrea non decide la produzione (gate a parte).

## 3. Interruttore
- **Pausa immediata, senza redeploy:** `UPDATE public.news_state SET enabled = false WHERE id = 1;`
  → il sito mostra «in pausa» alla richiesta successiva; il watcher al giro dopo non fa più richieste.
- **Fermare il daemon:** `launchctl bootout gui/$(id -u)/com.betredge.news-watcher` → dopo 2 h il sito va in «pausa» da solo.
- **Togliere le note dal sito:** togliere `NEWS_FOTMOB_ENABLED` (richiede redeploy) o `enabled=false`.
- **Rimuovere una notizia (takedown):** `DELETE FROM public.news_items WHERE source_url = '…';` (il watcher non la riscrive: è nei visti per 7 giorni, e dopo 48 h la voce è troppo vecchia per essere ripresa).

## 4. Rollback completo
```bash
launchctl bootout gui/$(id -u)/com.betredge.news-watcher
rm ~/Library/LaunchAgents/com.betredge.news-watcher.plist
rm -rf "$HOME/Library/Application Support/news-watcher"        # contiene .env: cancellarlo
cp "…/daemon-health/checks.json.bak-news" "…/daemon-health/checks.json"
```
```sql
DROP TABLE public.news_items; DROP TABLE public.news_state;
```

## 5. Piano di verifica dopo l'installazione
1. `launchctl print …` → `state = not running`/`running`, `last exit code = 0`.
2. Dopo 15 min: `last-run.json` fresco; `SELECT enabled, last_run_at, source_status, last_error FROM news_state;` → `last_run_at` < 15 min, `ok`.
3. `SELECT count(*), max(published_at), max(rewritten_at) FROM news_items;` > 0; 3 righe lette a occhio contro l'originale (fatti, nessuna copia di 6 parole, nessuna quota).
4. Preview con `NEWS_FOTMOB_ENABLED=1`: /blog mostra «Aggiornato alle hh:mm» uguale a `last_run_at` (fuso locale); `enabled=false` → «in pausa» al refresh; di nuovo `true`.
5. `node health.mjs` → riga `✅ news-watcher`.
6. Dopo 24 h: numero di chiamate `claude` (righe `rewrite` nel log) e nessun `usage limit` inatteso.

## 6. Rischi
- **Mac spento / sospeso / sessione chiusa:** nessun giro → dopo 2 h la pagina dice «in pausa» (onesto, non stantio). Il Keychain con il login di `claude` è disponibile solo con la sessione utente aperta, come per `learning-loop`.
- **Limiti d'uso dell'abbonamento:** fino a 6 note per giro (≤36/h, nella pratica ~35–40 notizie al giorno, ~0,003 $ a nota a listino con haiku senza thinking). Sul limite il watcher si ferma per quel giro, scrive `last_error`, non perde la notizia. Quota condivisa con le sessioni di lavoro di Andrea: se serve, abbassare `--limit` nel plist.
- **Fedeltà dei fatti:** i controlli automatici (lunghezza, lessico, prezzi, anti-copia 6 parole) non vedono un fatto inventato. Visto il 07/10 («at home» su una sconfitta in trasferta), corretto con una regola nel prompt; resta un rischio residuo. Mitigazione: etichetta «Riscritto con l'IA», link all'originale, takedown in 24 h.
- **ToS FotMob / copyright:** debito accettato da Andrea il 05/10, ampliato il 07/10 alla lettura della pagina; **owner Andrea**. Una GET ogni 10 min, robots rispettato, mai `/api`, nessuna immagine, nessun titolo originale pubblicato; stop automatico su 403/challenge.
- **Credenziale:** la service role sta in un file del Mac (chmod 600) fuori dal Desktop, letta solo dal processo; mai nei plist né nei log.
- **Blocco della fonte:** exit 2 ripetuto, `lab stato` lo segna ROTTO; riattivazione solo con `--unblock` dopo verifica umana.
