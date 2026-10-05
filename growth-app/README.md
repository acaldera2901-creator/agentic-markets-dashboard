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

- **Preview su SNAPSHOT** reale (`data/snapshot.json`): aggregati letti dal DB di
  produzione in un'unica transazione `REPEATABLE READ READ ONLY`. In pagina: banner
  «Snapshot del … — non live».
- **LIVE**: scritto e testato in locale (`data/live-source.ts`), **non attivo** in
  nessun deploy. Si accende solo con la PROPOSAL sotto, dopo APPROVE.

## Struttura (pensata per essere incorporata)

```
core/            logica pura, zero I/O — si copia così com'è nel CRM
  kpi.ts         finestre, split paganti, rapporti (null, mai 0 finto), MISSING_KPIS
  sql.ts         le query aggregate read-only (identiche alla PR #516)
  model.ts       contratto sorgente→UI: RawResults → normalize() → GrowthData
  privacy.ts     referrer ridotti al dominio, codici referral mascherati
  auth.ts        controllo password condivisa (Basic auth), puro e testato
data/            accesso ai dati — l'unica parte che cambia fra ambienti
  source.ts      interfaccia GrowthSource { load(window) → { data, meta } }
  snapshot-source.ts   (a) SNAPSHOT — attiva ora
  live-source.ts       (b) LIVE via SQL read-only — pronta, spenta
  index.ts       sceglie la sorgente (default snapshot)
ui/GrowthDashboard.tsx  un componente React: riceve data + meta + hrefFor, non sa
                        da dove arrivano i numeri, non fa auth né routing
app/page.tsx     5 righe: sorgente → componente
proxy.ts         password condivisa su tutte le rotte (fail-closed)
scripts/         snapshot.ts (genera il JSON) · verify.ts (SQL indipendente)
```

Per aggiungere un KPI che oggi è MANCA: query in `core/sql.ts` → campo in
`core/model.ts` → tile in `ui/GrowthDashboard.tsx` → togli la voce da
`MISSING_KPIS`. Nessuna sorgente da riscrivere.

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
