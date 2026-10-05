# betredge-growth — la dashboard KPI di Steve, standalone

**Origine:** PR #516 (`/admin/growth` dentro il prodotto), estratta in un'app Next.js
separata per poterla unire al CRM di Michele. Stesse query, stessa logica, stessi
stati (MISURATO / PROXY / MANCA / ERRORE), nessuna dipendenza dal prodotto
(né `ADMIN_SECRET`, né `lib/db`, né il layout `/admin`).

## Done quando

Steve apre la dashboard ogni giorno su dati **live** (non snapshot) letti con un
ruolo DB **read-only dedicato**, dietro password, e i numeri chiave coincidono con
`npm run verify` (0 righe DIVERSO). Fino ad allora è una preview su snapshot.

## Stato

- **v4 (06/10, branch `feat/growth-v4`)**: «Ingressi con fonte» + tabella «Ingressi per fonte»
  (page view d'ingresso con utm/src/crm/ref/ref_host, MISURATO, anche senza consenso; la quota
  senza fonte è sui page view, limite superiore) · «Page view probabilmente umani» (PROXY,
  badge STIMATO, criterio in `core/estimate.ts` dalla diagnosi #SESSIONI-1006, grezzo sempre
  visibile) · banner «Lettura diretta del database alle …» in modalità live · postgres.js
  `max: 2`. Snapshot rigenerato (`dbNow 2026-10-05T23:02:17Z`): `npm run verify` 125/125
  uguali, 0 divergenze per cella. Live provato in locale (0 ERRORE, ~1,7–2,6 s).
  **Deploy live NON eseguito**: il comando `vercel deploy --prod … -e GROWTH_PASSWORD=…` è
  stato rifiutato dal controllo di isolamento del worktree; `GROWTH_DATA_SOURCE` rimossa di
  nuovo dal progetto (resta solo `GROWTH_DATABASE_URL`, Production).
- **Preview v3 su SNAPSHOT** reale (`data/snapshot.json`, `dbNow 2026-10-05T22:47:16.553Z`
  = 06/10 00:47 a Roma): aggregati letti dal DB di produzione in un'unica transazione
  `REPEATABLE READ READ ONLY`; `npm run verify` 116/116 uguali, 0 divergenze per cella.
- **Audit PROXY (v3, 06/10)**: 9 tile PROXY → 3 diventano reali (Signup completati da
  `profiles`, Paganti con comp come voce separata, Ordini Shopify con rimborsi a parte),
  6 restano PROXY perché il dato vero non esiste in nessuna fonte letta. Per queste,
  `PROXY_TILES` in `core/kpi.ts` dice il KPI del PDF approssimato e cosa le renderà reali;
  i gap corrispondenti (campi `tiles`/`dependsOn` in `content/tracking-gaps.json`) sono
  tenuti allineati da un test.
  In pagina: banner «Snapshot del … — non live».
- **LIVE**: scritto e testato in locale (`data/live-source.ts`), **non attivo** in
  nessun deploy. Si accende solo con la PROPOSAL sotto, dopo APPROVE.

## Struttura (v2: dashboard + filone A + /lavoro del filone B)

Due pagine, entrambe dietro la stessa password (`proxy.ts` copre tutte le rotte),
con un link fra loro in testa a ciascuna:

- `/` — **Numeri**: KPI per finestra (Oggi / 7 / 30 giorni), andamento giornaliero
  con confronto e anomalie, catena per fonte. Dettagli del filone A in
  [`docs/filone-a.md`](docs/filone-a.md).
- `/lavoro` — **Lavoro**: tracking gaps, backlog esperimenti, memo settimanale,
  accessi e fonti. Contenuto versionato in `content/` (si cambia con un commit).
  Dettagli in [`docs/filone-b.md`](docs/filone-b.md) e `content/README.md`.

```
core/            logica pura, zero I/O — si copia così com'è nel CRM
  kpi.ts         finestre, split paganti, rapporti (null, mai 0 finto), MISSING_KPIS
  sql.ts         le query aggregate read-only (+ serie giornaliere e catena per fonte)
  model.ts       contratto sorgente→UI: RawResults + RawExtras → normalize() → GrowthData
                 (GrowthData contiene anche trends e chain: lettura mancante/fallita = ERRORE, mai 0)
  series.ts      giorni Europe/Rome, confronto col periodo precedente, anomalie
  channels.ts    catena fonte → sessioni → signup → profili → paganti
  privacy.ts     referrer ridotti al dominio, codici referral mascherati
  auth.ts        controllo password condivisa (Basic auth), puro e testato
data/            accesso ai dati — l'unica parte che cambia fra ambienti
  source.ts      interfaccia GrowthSource { load(window) → { data, meta } } + formato snapshot
  snapshot-source.ts   (a) SNAPSHOT — attiva ora
  live-source.ts       (b) LIVE via SQL read-only — pronta, spenta
  index.ts       sceglie la sorgente (default snapshot)
  snapshot.json  gli aggregati congelati (solo numeri e etichette ridotte)
ui/              presentazione: nessuna auth, nessun I/O, nessuna conoscenza della sorgente
  GrowthDashboard.tsx  riceve data + meta + hrefFor (+ workHref opzionale)
  sections/            Trends.tsx · Channels.tsx (filone A)
  work/                WorkPage.tsx + content.ts (validazione dei JSON di content/)
content/         i dati di /lavoro: tracking-gaps.json, experiments.json, sources.json, memo/
app/             page.tsx (/) e lavoro/page.tsx: poche righe, sorgente → componente
proxy.ts         password condivisa su tutte le rotte (fail-closed)
scripts/         snapshot.ts (genera il JSON) · verify.ts (SQL indipendente)
docs/            filone-a.md · filone-b.md (definizioni, verifiche, limiti)
```

Per aggiungere un KPI che oggi è MANCA: query in `core/sql.ts` → campo in
`core/model.ts` → tile in `ui/GrowthDashboard.tsx` → togli la voce da
`MISSING_KPIS`. Nessuna sorgente da riscrivere.

## Aggiornare lo snapshot

```bash
cd growth-app
npm run snapshot -- --env-file ~/Desktop/agentic-markets/.env   # una sola transazione REPEATABLE READ READ ONLY
npm run verify   -- --env-file ~/Desktop/agentic-markets/.env   # deve dire «N/N uguali» e «0 divergenze»
npm test                                                          # lo snapshot deve passare i test di privacy
```

`DATABASE_URL` si legge **solo in locale** da `~/Desktop/agentic-markets/.env`: non va
mai su Vercel né nel repo. Lo script scrive `data/snapshot.json` solo se **tutte** le
letture riescono; poi commit del JSON e nuovo deploy preview. Il banner in pagina
mostra il `dbNow` della transazione in ora di Roma («Snapshot del … — non live»).

## Attivare il LIVE

Due variabili sul progetto Vercel `betredge-growth` (mai sul progetto prodotto):
`GROWTH_DATA_SOURCE=live` e `GROWTH_DATABASE_URL=<connection string del ruolo read-only>`.
Senza la prima resta lo snapshot; con la prima ma senza la seconda la pagina fallisce
apertamente. Nessuna modifica al codice. Il ruolo DB dedicato e le env passano dalla
PROPOSAL #GROWTH-LIVE qui sotto (serve APPROVE). Al posto del banner snapshot compare
«Ultimo aggiornamento».

## Ruotare la password

La password è condivisa (Basic auth, utente qualsiasi, ≥12 caratteri) e vive solo
nella env `GROWTH_PASSWORD`. Per ruotarla: generane una nuova (es. 32 caratteri
alfanumerici casuali), salvala in un file locale `chmod 600` o nel password manager,
**mai** in chat, commit o ticket, e rifai il deploy passandola alla singola deployment:

```bash
vercel deploy --scope betredge -e GROWTH_PASSWORD="$(cat <file-password>)"
```

Il deployment precedente continua ad accettare la vecchia: se la vecchia è
compromessa, rimuovi quel deployment (`vercel rm <url> --scope betredge`) dopo aver
verificato il nuovo. Se si passa a una env di progetto (`vercel env add GROWTH_PASSWORD`),
ogni cambio richiede un redeploy.

## Incorporare nel CRM

1. Copia `core/` e `ui/` così come sono (nessuna dipendenza da `app/`, `data/`, `proxy.ts`).
2. Scrivi una `GrowthSource` sopra l'accesso dati del CRM: deve produrre `RawResults`
   (una `Result<Row[]>` per ogni query di `core/sql.ts`) e `RawExtras` (serie e catena,
   o `undefined` se non le legge: diventano ERRORE, mai 0) e chiamare `normalize()`.
   In alternativa riusa `data/live-source.ts` col ruolo `growth_ro`.
3. Monta `<GrowthDashboard data meta hrefFor workHref />` e `<WorkPage content dashboardHref />`
   in due rotte del CRM, dietro l'auth del CRM (la Basic auth di `proxy.ts` resta qui).
4. Gira i test di `core/` e `ui/work/` nel CRM e `scripts/verify.ts` contro la sua sorgente.

## Uso locale

```bash
cd growth-app
npm install
GROWTH_PASSWORD='<almeno 12 caratteri>' npm run dev      # http://localhost:3210 (utente qualsiasi)

# rigenerare lo snapshot (sola lettura, serve DATABASE_URL del repo):
npm run snapshot -- --env-file ~/Desktop/agentic-markets/.env
npm run verify   -- --env-file ~/Desktop/agentic-markets/.env   # tabella pagina-vs-SQL

npm test                     # unit (logica, auth, privacy, snapshot)
GROWTH_LIVE_ENV_FILE=~/Desktop/agentic-markets/.env npm test   # + integrazione LIVE (prova anche che scrivere è rifiutato)
npm run lint && npm run typecheck && npm run build
```

Variabili: `GROWTH_PASSWORD` (obbligatoria, ≥12 caratteri, altrimenti 503).
`GROWTH_DATA_SOURCE=live` + `GROWTH_DATABASE_URL` accendono il LIVE — **non
impostarle senza APPROVE** (vedi PROPOSAL).

---

## PROPOSAL #GROWTH-LIVE — collegamento live (attende APPROVE di Andrea)

**Task:** far leggere alla dashboard i numeri in tempo reale invece dello snapshot.

**Approccio scelto:** ruolo Postgres dedicato, solo `SELECT` sulle 10 tabelle lette,
transazioni read-only forzate a livello di ruolo; l'app lo usa via una sola env var
sul progetto Vercel della dashboard (mai sul progetto prodotto).

**COSA CAMBIERÀ ESATTAMENTE**

1. *DB prod (Supabase, progetto `izscgffubtakzvwxchqt` secondo la memoria del 13/06 — da riconfermare)* — un ruolo nuovo, nessuna tabella toccata:
   ```sql
   CREATE ROLE growth_ro LOGIN PASSWORD '<generata, 32+ caratteri>'
     NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION CONNECTION LIMIT 5;
   ALTER ROLE growth_ro SET default_transaction_read_only = on;
   ALTER ROLE growth_ro SET statement_timeout = '60s';
   GRANT USAGE ON SCHEMA public TO growth_ro;
   GRANT SELECT ON events, profiles, paygate_orders, paypal_orders, shopify_events,
     odds_snapshots, match_predictions, tennis_predictions, error_patterns_log,
     prediction_log TO growth_ro;
   ```
   Nota: `profiles` contiene dati personali; il ruolo può leggerli a livello DB
   anche se le query dell'app selezionano solo aggregati. Alternativa più stretta
   (da scegliere in APPROVE): una `VIEW` per query con `security_barrier` e GRANT solo
   sulle view — più sicura, ma ogni nuovo KPI richiede una migration.
2. *Vercel, progetto `betredge-growth` (team betredge, NON il progetto `betredge`)* —
   env `GROWTH_DATA_SOURCE=live` e `GROWTH_DATABASE_URL=postgresql://growth_ro:…@<pooler>:6543/postgres`
   (Sensitive), solo Production del progetto dashboard. Nessuna env sul prodotto.
3. *Refresh:* nessun cron. Il LIVE legge a ogni caricamento (≈13 query aggregate,
   ~2–5 s misurati). Se il carico preoccupa: cache 5 min nella pagina (`revalidate`).
4. *Codice:* nessuna modifica — `data/index.ts` sceglie già la sorgente dall'env.

**Reversibilità / rollback:** togliere `GROWTH_DATA_SOURCE` → torna allo snapshot al
deploy successivo. `DROP ROLE growth_ro;` (previo `REVOKE ALL … FROM growth_ro`) lo
elimina senza toccare dati.

**Blast radius:** lettura su 10 tabelle prod; massimo 5 connessioni; nessuna
scrittura possibile (ruolo read-only + transazioni `READ ONLY` nell'app, provato:
SQLSTATE 25006). Rischio residuo: carico query su `events` (indice su `created_at`
da verificare con `EXPLAIN` prima dell'APPROVE) e leak della connection string →
mitigato da ruolo read-only, password ruotabile, limite connessioni.

**Piano di verifica:** `npm run verify` puntato al ruolo nuovo → 0 DIVERSO;
prova di scrittura col ruolo → rifiutata; `EXPLAIN ANALYZE` delle 3 query su
`events` < 1 s; pagina live con banner «Ultimo aggiornamento» invece di «Snapshot».

**Owner esecuzione:** Calde (agente) dopo APPROVE. **Serve OK da:** Andrea (DB +
credenziali prod).

### Ipotesi di integrazione nel CRM di Michele (da validare con Michele)

Nel repo e nelle memorie **non esiste un «CRM di Michele» come app separata**: il
«CRM» è il motore lifecycle email dentro il prodotto (`lib/crm.ts`,
`app/api/cron/crm`, Resend), su cui Michele ha lavorato (#CRM-I18N-5LANG). Il
backoffice separato citato dalla torre è di **Tommy**, non di Michele. Quindi due
strade, a seconda di cosa Michele intende:

- **CRM = app React/Next.js:** si copiano `core/` e `ui/` così come sono, si
  implementa `GrowthSource` sopra l'accesso dati del CRM (o si riusa
  `live-source.ts` col ruolo `growth_ro`), e si monta `<GrowthDashboard>` in una
  rotta del CRM dietro la sua auth. `proxy.ts` e `app/` restano qui.
- **CRM = altro stack / tool esterno:** la dashboard resta un'app a sé con link
  dal CRM; per incorporarla in iframe va tolto `X-Frame-Options: DENY` e messa una
  `frame-ancestors` col dominio del CRM.
