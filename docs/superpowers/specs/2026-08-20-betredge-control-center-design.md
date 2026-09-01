# BetRedge Control Center — design

**Data:** 2026-08-20 · **Owner:** Andrea · **Stato:** spec in review
**ID:** #BRCC-0820

## 1. Problema

I dati di BetRedge esistono ma sono sparsi: `app/admin` (business), `/api/health`
(heartbeat agenti), `/api/diagnostics/data-pipeline` (copertura), 9 cron su
Vercel, ~20 LaunchAgent sul Mac di Andrea, canali social su piattaforme terze.
Non esiste una superficie che li legga insieme. Conseguenza misurata durante la
sonda del 2026-08-20: tre daemon con ultimo exit code diverso da 0 (incluso il
controllore di salute stesso), `pick_settlement` fermo da 12h, quota
`api_football` al 51% a metà giornata — nessuno di questi segnali era visibile.

## 2. Obiettivo e criterio di successo

Una pagina che, aperta a freddo, risponde in meno di 10 secondi a due domande:
"i risultati stanno andando bene?" e "cosa è rotto adesso?".

**Done quando:**
1. La pagina si apre in locale e mostra tutte le sei zone con dati reali.
2. Ogni numero visualizzato porta la sua età (`measured_at`) e la sua fonte.
3. Una rottura reale iniettata a mano (es. fermare un launchd di scope) produce
   una notifica entro due cicli del collector.
4. Nessun tile mostra un numero quando la fonte non è disponibile: mostra
   `unknown` con il motivo.

**Fuori scope:** progetti non BetRedge (Maven, demo ristoranti, Slottr, Lumio,
trading). Niente azioni di scrittura: la dashboard osserva, non rimedia.

## 3. Decisioni prese

| Decisione | Scelta | Motivo |
|---|---|---|
| Dove vive | Locale, `127.0.0.1` | Vede launchd, log su disco, DB e API esterne; zero rischio prod; non deve stare su internet |
| Forma | Collector + server separati, stile `macmon` | La pagina resta veloce e non consuma quota a ogni refresh; regge anche se una fonte è giù |
| Allerta | Notifica sulle transizioni verde→rosso | Un cron morto alle 3 di notte non deve aspettare che Andrea apra la pagina |
| Stack | Python stdlib + `psycopg` dal venv del repo | Nessuna dipendenza nuova; precedente `macmon` collaudato |
| Non scelto | Pagina Next.js in `app/` | Legherebbe la torre di controllo alla cosa da controllare; e finirebbe deployata |

## 4. Architettura

Tre processi, un file di stato.

    collector.py  (launchd, ogni 5 min)
      esegue N check isolati -> Verdict ciascuno
      scrive atomicamente:
        ~/.betredge-cc/state.json      snapshot corrente (unica verita' condivisa)
        ~/.betredge-cc/history.jsonl   una riga per run, per gli sparkline
      confronta col livello precedente -> notifica solo sulle transizioni
    server.py  (launchd, 127.0.0.1:8790)
      serve index.html + /api/state + /api/history
      legge SOLO lo snapshot: non interroga mai le fonti

### Contratto di un check

    Check   = { id, group, label, ttl_seconds, fn }
    Verdict = { level, headline, value, evidence, measured_at, source }
    level in { "green", "amber", "red", "unknown" }

Tre proprieta' vincolanti:

- **`unknown` e' distinto da `red`.** Credenziale mancante, timeout, tabella
  vuota producono `unknown` con il motivo esplicito. Mai uno zero travestito da
  dato misurato.
- **Isolamento.** Ogni check gira in try/except con timeout proprio. Un check che
  esplode diventa `unknown` con lo stack in `evidence`; lo snapshot esce comunque.
- **Tracciabilita' per costruzione.** `measured_at` e `source` sono obbligatori.
  I check costosi hanno un `ttl_seconds`: il collector li riesegue solo se la
  misura precedente e' piu' vecchia del TTL, cosi' un check giornaliero non
  consuma 288 chiamate.

### File

    ~/.betredge-cc/
      collector.py        orchestrazione, snapshot, diff, notifiche
      server.py           HTTP stdlib su 127.0.0.1:8790
      index.html          pagina (HTML/CSS/JS a mano, nessun bundler)
      checks/
        platform.py  pipeline.py  daemons.py  results.py  business.py  channels.py
      state.json  history.jsonl  (generati)

## 5. Zone della pagina

Una colonna, ordine fisso, preceduta da una **barra del verdetto**: un semaforo e
una frase sola ("3 rossi: settle fermo da 12h - softmarkets giu' - quota
api_football 51%"). Nel caso normale la pagina e' progettata per non essere letta
oltre la prima riga.

1. **Cosa e' rotto adesso** — i soli tile rossi e ambra, promossi da qualunque
   zona. Vuota quando tutto va bene; vuota e' il messaggio.
2. **Piattaforma** — sito, deploy, DB, endpoint.
3. **Pipeline dati** — freschezza, copertura, quota API.
4. **Daemon & cron** — launchd di scope + 9 cron Vercel.
5. **Risultati** — track record.
6. **Business & canali** — abbonati, incassi, CRM, social.

Ogni tile: label, semaforo, valore, headline, e in piccolo eta' della misura +
fonte. Click apre l'`evidence` grezza. Sparkline solo dove la tendenza *e'* il
dato (abbonati, quota, bankroll quando esistera').

## 6. Catalogo dei check

### Piattaforma
- `web_home`, `web_pages` — `betredge.com` piu' tre pagine nominate e verificate
  200 il 2026-08-20: `/predictions`, `/plans`, `/weekly-pick`. Rosso se almeno
  una non risponde 2xx/3xx.
  **Regola sulle rotte dietro feature flag.** `/risultati` e `/oggi` esistono su
  `main` e sono nello sha deployato, ma rispondono 404 *per progetto*: fanno
  `notFound()` quando `NEXT_PUBLIC_UX_NEW` non vale `1`, e in prod non vale `1`.
  Non entrano nel check di disponibilita'. Una rotta flag-gated si sorveglia solo
  insieme allo stato atteso del suo flag, altrimenti il tile nasce rosso per
  sempre e insegna a ignorare i rossi. Verificato durante la stesura: era
  esattamente l'errore che stavo per cablare. **Da confermare prima di cablare:** in sonda
  `www.betredge.com/oggi` ha risposto 404; verificare se il path canonico e'
  `/it/oggi` prima di trattarlo come rottura.
- `api_version` — `/api/version` risponde e riporta lo sha.
- `db_latency` — ambra oltre 800 ms, rosso oltre 3 s o errore.
- `vercel_last_deploy` — ultimo deploy e suo esito (richiede token Vercel; senza
  token il tile e' `unknown`, non verde).
- `errors_24h` — righe in `error_patterns_log` nelle 24h.

### Pipeline dati
- `odds_freshness` — eta' di `max(odds_snapshots.captured_at)`; rosso oltre 60 min.
- `predictions_freshness` — `max(match_predictions.computed_at)`; rosso oltre 4h
  (il cron e' ogni 2h).
- `tennis_freshness` — `max(tennis_predictions.computed_at)`; rosso oltre 6h.
- `coverage_football` — eventi con quote / eventi totali; floor 70 come soglia
  ambra, coerente con la soglia gia' usata nel progetto copertura calcio.
- `api_quota` — un tile per provider da `source_quota_log`: ambra al 70% del
  limite giornaliero, rosso al 90%.

### Daemon & cron
- `launchd_<nome>` — per ogni LaunchAgent di scope BetRedge: caricato, pid vivo,
  **ultimo exit code**. Exit diverso da 0 e' rosso, con la coda del rispettivo
  `.err.log` in `evidence`.
- `cron_<nome>` — per ognuno dei 9 cron Vercel il check verifica **l'artefatto
  atteso**, non l'invocazione: `settle` -> scrittura recente su
  `pick_settlement`; `crm` -> riga di oggi in `crm_trigger_sends`;
  `paygate-reconcile` -> touch su `paygate_orders`; e cosi' via. Rosso se
  l'artefatto manca oltre l'intervallo del cron x 2, anche se Vercel risponde 200.
  Motivo: un daemon puo' uscire 0 e non produrre nulla.

### Risultati
Fonte: `pick_ledger` join `pick_settlement` su `(source_table, source_id)`,
filtrando `is_backfill = false`.
- `track_record` — pick chiusi, hit rate, ROI a quote di chiusura, edge previsto
  vs realizzato. Finestre 7g / 30g / totale.
- `track_by_sport` — lo stesso split per sport e campionato.
- `picks_today` — i pick di oggi con esito quando disponibile.
Due guardie: sotto 30 pick chiusi la finestra mostra "campione insufficiente"
invece di un ROI privo di significato; le righe con `closing_odds_is_fuzzy` sono
escluse dal ROI e contate a parte.
- `bankroll_curve` — `bankroll_history` e' vuota (0 righe, misurato 2026-08-20):
  il tile resta `unknown` con motivo "tabella vuota" finche' Andrea non decide se
  popolarla. Non si stima.

### Business & canali
- `subscribers` — conteggi per piano da `profiles`, nuovi 7g/30g.
- `revenue` — incassato da `paygate_orders`, `paypal_orders`, `stripe_events`,
  `weekly_pick_purchases`.
- `crm_sends` — invii di oggi in `crm_trigger_sends` vs attesi.
- `traffic` — eventi e visite recenti.
- `telegram_members` — `getChatMemberCount` via bot API (token in env, funzionante).
- `reddit_karma` — endpoint JSON pubblico di u/Betredge.
- `instagram_followers`, `tiktok_followers` — `unknown` con motivo "credenziale
  mancante" e cosa serve per sbloccarli. Nessun numero inventato.

## 7. Allerta

Dopo lo snapshot il collector confronta ogni check col livello precedente:

- verde o ambra -> **rosso**, confermato per **2 run consecutivi** (10 min):
  notifica. Il doppio run elimina i falsi positivi da timeout singolo.
- rosso -> verde: una notifica di rientro.
- ambra: mai notificata. Vive sulla pagina, non sul telefono.
- de-duplica: un check gia' rosso e notificato non ripete prima di 6h.

Canali: notifica macOS piu' Telegram sul chat id personale (`TELEGRAM_CHAT_ID`).
Mai sul canale pubblico. Lo stato precedente vive in `state.json`, quindi
l'isteresi sopravvive a un riavvio del collector.

## 8. Sicurezza e vincoli

- Il server ascolta **solo** su `127.0.0.1`. Nessuna esposizione, nessun tunnel.
- Le credenziali si leggono dal `.env` del repo; nessun segreto viene scritto
  in `state.json`, in `history.jsonl` o reso dalla pagina.
- Trappola nota: `DATABASE_URL` e' in forma SQLAlchemy
  (`postgresql+asyncpg://`). `psql` e `psycopg` la ignorano silenziosamente e
  cadono sul socket locale. Va normalizzata a `postgresql://` in un solo punto.
- Tutte le query sono in sola lettura. Nessuna scrittura sul DB di prod.
- `state.json` si scrive su file temporaneo e poi si rinomina, cosi' il server
  non legge mai uno snapshot a meta'.

## 9. Fasi di implementazione

Trenta check non entrano in un piano solo, e non devono: la prima fase deve
consegnare valore da sola. L'ordine segue quanto ogni zona pesa se manca.

**Fase 1 — lo scheletro piu' cio' che si e' gia' rotto.** Collector, snapshot
atomico, server, `index.html`, barra del verdetto, zona "cosa e' rotto adesso",
piu' le zone **Piattaforma** e **Daemon & cron**, allerta inclusa. Criterio: la
dashboard rileva da sola le tre rotture che la sonda del 2026-08-20 ha trovato a
mano (`softmarkets.collect` exit 126, `daemon-health` exit 1,
`weeklypick-morning` exit 1) e ne notifica almeno una. Con questa sola fase la
dashboard e' gia' utile ogni giorno.

**Fase 2 — Pipeline dati e Risultati.** Freschezza, copertura, quota, track
record. Criterio: ROI e hit rate a 30 giorni coincidono con la stessa query
lanciata a mano su `pick_ledger`.

**Fase 3 — Business & canali.** Abbonati, incassi, CRM, Telegram, Reddit, e i due
tile `unknown` per IG e TikTok. Criterio: i conteggi per piano coincidono con
`app/admin`, che resta la fonte di confronto.

Le fasi 2 e 3 aggiungono file in `checks/` e non modificano il collector: se il
contratto del check e' giusto, ogni fase e' additiva. Se una fase costringe a
riaprire il collector, il contratto era sbagliato ed e' un segnale, non un dettaglio.

## 10. Assunzioni dichiarate

1. Il track record entra nella v1: nella scelta dei blocchi Andrea non l'ha
   selezionato, ma il brief iniziale diceva "sia i risultati" e ha aggiunto
   "tutto quello che riguarda betredge". Da tagliare su sua parola.
2. Lo scope dei launchd da sorvegliare e' l'insieme BetRedge/Agentic Markets;
   Maven, Lumio, Maketelier, Mia Valentina e i bot personali restano fuori.
3. Il tile del deploy Vercel richiede un token: senza, resta `unknown`.
