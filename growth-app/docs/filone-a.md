# Filone A — serie giornaliere, confronto col periodo precedente, catena per fonte

Branch `feat/growth-a` (da `feat/growth-standalone`). Snapshot rigenerato in **una**
transazione `REPEATABLE READ READ ONLY`: `dbNow 2026-10-05T22:10:32.438Z`
(= 06/10 00:10 a Roma), letture in 3,2 s. Nessuna scrittura, DDL o credenziale nuova.
`DATABASE_URL` letta solo in locale da `~/Desktop/agentic-markets/.env`.

## Cosa c'è

| Pezzo | File | Cosa fa |
|---|---|---|
| SQL | `core/sql.ts` (solo aggiunte) | `buildSeriesSql()` 3 query giornaliere (events · profiles · ordini Paygate+PayPal+Shopify), `buildChainSql(w)` catena per fonte |
| Logica | `core/series.ts` | giorni Europe/Rome, riempimento giorni vuoti, confronto, anomalie |
| Logica | `core/channels.ts` | catena: riduzione etichette (privacy.ts), somma, ordinamento, tassi, totali |
| Dati | `data/source.ts`, `snapshot-source.ts`, `live-source.ts` | campi opzionali `series` / `chain` nello snapshot; `GrowthExtras { trends, chain }` attaccato a `data` |
| UI | `ui/sections/Trends.tsx`, `ui/sections/Channels.tsx` | le due sezioni |
| Integrazione | `ui/GrowthDashboard.tsx` | **2 import + 1 riga** `<Trends data={d} /><Channels data={d} />` dopo «Acquisition» |
| Verifica | `scripts/verify.ts` (estensione) | SQL indipendente per ogni numero nuovo |

**Nota per l'integratore:** `GrowthExtras` vive in `data/source.ts` ed è opzionale perché non
potevo toccare `core/model.ts`. Il posto giusto è dentro `GrowthData` (TODO lasciato nel file).
Se una sorgente non fornisce gli extra, le sezioni dicono «non presente in questa sorgente»,
mai 0.

## Definizioni (quelle che decidono i numeri)

- **Giorni:** giorni di calendario Europe/Rome **interi**; oggi è escluso (parziale). Si leggono
  60 giorni: 30 mostrati + 30 di confronto. La finestra «Oggi» mostra il trend a 7 giorni.
- **Giorno senza dati:** la query restituisce solo i giorni con righe; `normalizeSeries` mette
  **0 solo se la query è riuscita**. Query fallita → serie `null` → riga «Lettura fallita», celle
  vuote. Un giorno fuori dall'intervallo atteso fa fallire la metrica (non viene scartato in
  silenzio).
- **Sessioni nella serie:** sessioni distinte *per giorno*, sommate nel confronto (una sessione a
  cavallo di mezzanotte conta 2). Dichiarato sotto l'etichetta.
- **Ordini pagati:** Paygate+PayPal (`paid_at`) + Shopify `orders/paid` — stesso perimetro del
  passo «Ordini pagati» del funnel.
- **Confronto:** ultimi N giorni interi vs gli N precedenti (N = 7 o 30). Delta assoluto sempre;
  percentuale **solo se la base precedente è ≥ 20**, altrimenti «campione piccolo». Base 0 → mai %.
  Flag «il periodo precedente comincia prima del primo dato registrato» quando il primo valore > 0
  della finestra di 60 giorni cade dentro il periodo precedente (es. `signup_completed` esiste dal
  22/08): gli zeri prima potrebbero essere «non ancora tracciato».
- **Anomalia:** giorno con |valore − media| > 2 σ (σ campionaria) dei 14 giorni precedenti; solo
  se ci sono ≥ 14 giorni dal primo valore > 0 (gli zeri iniziali non contano come storia); base
  piatta (σ = 0) non segnala nulla. Segnata con anello sulla sparkline, ▲/▼ in tabella e nota con
  media ± σ e z.
- **Catena per fonte:** due basi di attribuzione affiancate, mai divise fra loro:
  - *eventi* (sessioni con consenso): fonte = page_view d'ingresso della sessione (stessa regola
    della tabella «Sessioni per fonte»: utm_source → src → crm → ref → ref_host). I signup senza
    sessione e quelli con sessione senza page_view nella finestra hanno righe proprie.
  - *profili* (`profiles.acquisition`): utm_source → dominio del referrer; NULL = «(non registrata)»
    (tutti gli storici). Paganti = profili della finestra con base/premium da canale a pagamento,
    non scaduti (= «paganti verificati»).
  - Le etichette passano da `coarsenLabel` (referrer → dominio registrabile, ref → mascherato)
    **prima** di finire nello snapshot; le righe che collassano si sommano.
  - Percentuali: Sess→signup solo con ≥ 5 signup avviati; Prof→pag. solo con ≥ 5 profili.
    Sotto: solo conteggi («—»).
  - Il riquadro «Limiti dell'attribuzione» mostra, misurati nella finestra: % di page_view senza
    sessione, signup senza fonte, profili senza acquisition.

## Verifica

- `npm test`: 53 test unitari verdi (+2 integrazione LIVE con `GROWTH_LIVE_ENV_FILE`, verdi: anche
  serie e catena lette dal LIVE senza errori, e la scrittura rifiutata 25006). Test nuovi su: giorni
  Rome (UTC vs CEST/CET, cambio ora, fine mese), finestra senza oggi, giorno vuoto = 0 solo a query
  riuscita, query fallita = null, giorno fuori intervallo = errore, soglia 20 (19/20/0), periodo
  30 vs 30, storia parziale, anomalie (picco, calo, < 14 giorni di storia, σ = 0, solo finestra
  mostrata), catena (riduzione referrer, mascheramento ref, ordinamento, soglia 5, totali), SQL
  sola lettura e senza colonne personali, snapshot vecchio senza extra.
- `npm run typecheck`, `npm run lint`, `npm run build`: verdi.
- `npm run verify`: **105/105 scalari uguali + 0 divergenze per cella** (8 serie × 60 giorni,
  catena today/7d/30d × 5 colonne per fonte). SQL indipendente: giorno =
  `date(timezone('Europe/Rome', ts))`, limiti con aritmetica intera sulle date, totali di periodo
  con un solo `count(*)` a limiti timestamp, anomalie ricalcolate in SQL con window function
  (`stddev_samp OVER … 14 PRECEDING`), catena con formulazione a righe (`LEFT JOIN` evento→sessione,
  `substring(… from '://([^/]+)')` per il referrer).
- **Il verify sa fallire:** prova di mutazione — alterati a mano 3 valori dello snapshot
  (+1 page_view in un giorno, +1 sessione a una fonte 30d, +5 profili in un giorno) → 6 righe
  DIVERSO + 3 controlli per cella divergenti, ognuno sul valore toccato. Snapshot ripristinato
  (verificato con `cmp`).
- Screenshot (Chromium headless, `next start` locale con password locale): sezioni a 1280 px (7d,
  30d) e 390 px; nessuno scroll orizzontale della pagina (le tabelle scorrono dentro la card su
  mobile).

## NON verificato / limiti noti

- **LIVE in pagina** non provato nel browser (solo il test d'integrazione su `liveSource().load`):
  resta spento come da PROPOSAL #GROWTH-LIVE. Corsa a mezzanotte: se `dbNow` e le query cadono a
  cavallo della mezzanotte di Roma, le serie vanno in ERRORE per quel caricamento (fail loud, non
  numeri sbagliati).
- Il flag «storia parziale» guarda solo i 60 giorni letti: per metriche rade (click partner) il
  «primo dato» può essere solo il primo click, non l'inizio del tracciamento.
- `utm_source` non è normalizzato in maiuscole/minuscole («IG» e «ig» restano due righe), come
  nella tabella esistente.
- Le soglie (20 per la %, 5 signup, 2 σ su 14 giorni) sono quelle del brief, non calibrate sui dati.
- Su mobile le tabelle larghe scorrono orizzontalmente dentro la card.

## Output di `npm run verify` (snapshot dbNow 2026-10-05T22:10:32.438Z)



Snapshot dbNow: 2026-10-05T22:10:32.438Z

| Metrica | Finestra | Pagina (snapshot) | SQL indipendente | Esito |
|---|---|---:|---:|---|
| Page view | today | 5 | 5 | OK |
| Sessioni (con consenso) | today | 0 | 0 | OK |
| Signup avviati (eventi) | today | 0 | 0 | OK |
| Signup completati (eventi) | today | 0 | 0 | OK |
| Nuovi profili | today | 0 | 0 | OK |
| Account attivati | today | 0 | 0 | OK |
| Click partner | today | 0 | 0 | OK |
| Card aperte | today | 0 | 0 | OK |
| Errori client | today | 0 | 0 | OK |
| Ordini pagati Paygate+PayPal | today | 0 | 0 | OK |
| Page view | 7d | 521 | 521 | OK |
| Sessioni (con consenso) | 7d | 50 | 50 | OK |
| Signup avviati (eventi) | 7d | 13 | 13 | OK |
| Signup completati (eventi) | 7d | 2 | 2 | OK |
| Nuovi profili | 7d | 2 | 2 | OK |
| Account attivati | 7d | 1 | 1 | OK |
| Click partner | 7d | 2 | 2 | OK |
| Card aperte | 7d | 14 | 14 | OK |
| Errori client | 7d | 4 | 4 | OK |
| Ordini pagati Paygate+PayPal | 7d | 0 | 0 | OK |
| Page view | 30d | 3099 | 3099 | OK |
| Sessioni (con consenso) | 30d | 400 | 400 | OK |
| Signup avviati (eventi) | 30d | 66 | 66 | OK |
| Signup completati (eventi) | 30d | 24 | 24 | OK |
| Nuovi profili | 30d | 22 | 22 | OK |
| Account attivati | 30d | 15 | 15 | OK |
| Click partner | 30d | 18 | 18 | OK |
| Card aperte | 30d | 120 | 120 | OK |
| Errori client | 30d | 55 | 55 | OK |
| Ordini pagati Paygate+PayPal | 30d | 0 | 0 | OK |
| Paganti verificati | — | 4 | 4 | OK |
| Paganti incl. comp | — | 10 | 10 | OK |
| Comp / manuali / senza fonte | — | 6 | 6 | OK |
| Free | — | 38 | 38 | OK |
| Account team (admin_full) | — | 2 | 2 | OK |
| Incassato Paygate+PayPal totale (cent USD) | — | 2499 | 2499 | OK |
| Ordini pagati totali | — | 3 | 3 | OK |
| Ordini Shopify pagati totali | — | 1 | 1 | OK |
| Brier servito ×10⁴ (arrotondato) | — | 6008 | 6008 | OK |
| Page view — periodo (7g interi) | 7d | 516 | 516 | OK |
| Page view — periodo precedente | 7d | 1268 | 1268 | OK |
| Page view — n. anomalie | 7d | 0 | 0 | OK |
| Sessioni con consenso — periodo (7g interi) | 7d | 61 | 61 | OK |
| Sessioni con consenso — periodo precedente | 7d | 246 | 246 | OK |
| Sessioni con consenso — n. anomalie | 7d | 0 | 0 | OK |
| Signup avviati — periodo (7g interi) | 7d | 13 | 13 | OK |
| Signup avviati — periodo precedente | 7d | 11 | 11 | OK |
| Signup avviati — n. anomalie | 7d | 0 | 0 | OK |
| Signup completati — periodo (7g interi) | 7d | 2 | 2 | OK |
| Signup completati — periodo precedente | 7d | 4 | 4 | OK |
| Signup completati — n. anomalie | 7d | 0 | 0 | OK |
| Nuovi profili — periodo (7g interi) | 7d | 2 | 2 | OK |
| Nuovi profili — periodo precedente | 7d | 3 | 3 | OK |
| Nuovi profili — n. anomalie | 7d | 0 | 0 | OK |
| Click partner — periodo (7g interi) | 7d | 2 | 2 | OK |
| Click partner — periodo precedente | 7d | 1 | 1 | OK |
| Click partner — n. anomalie | 7d | 1 | 1 | OK |
| Errori client — periodo (7g interi) | 7d | 4 | 4 | OK |
| Errori client — periodo precedente | 7d | 23 | 23 | OK |
| Errori client — n. anomalie | 7d | 0 | 0 | OK |
| Ordini pagati — periodo (7g interi) | 7d | 0 | 0 | OK |
| Ordini pagati — periodo precedente | 7d | 0 | 0 | OK |
| Ordini pagati — n. anomalie | 7d | 0 | 0 | OK |
| Page view — periodo (30g interi) | 30d | 3094 | 3094 | OK |
| Page view — periodo precedente | 30d | 4778 | 4778 | OK |
| Page view — n. anomalie | 30d | 2 | 2 | OK |
| Sessioni con consenso — periodo (30g interi) | 30d | 454 | 454 | OK |
| Sessioni con consenso — periodo precedente | 30d | 212 | 212 | OK |
| Sessioni con consenso — n. anomalie | 30d | 4 | 4 | OK |
| Signup avviati — periodo (30g interi) | 30d | 66 | 66 | OK |
| Signup avviati — periodo precedente | 30d | 11 | 11 | OK |
| Signup avviati — n. anomalie | 30d | 3 | 3 | OK |
| Signup completati — periodo (30g interi) | 30d | 24 | 24 | OK |
| Signup completati — periodo precedente | 30d | 7 | 7 | OK |
| Signup completati — n. anomalie | 30d | 2 | 2 | OK |
| Nuovi profili — periodo (30g interi) | 30d | 22 | 22 | OK |
| Nuovi profili — periodo precedente | 30d | 11 | 11 | OK |
| Nuovi profili — n. anomalie | 30d | 2 | 2 | OK |
| Click partner — periodo (30g interi) | 30d | 18 | 18 | OK |
| Click partner — periodo precedente | 30d | 13 | 13 | OK |
| Click partner — n. anomalie | 30d | 2 | 2 | OK |
| Errori client — periodo (30g interi) | 30d | 55 | 55 | OK |
| Errori client — periodo precedente | 30d | 30 | 30 | OK |
| Errori client — n. anomalie | 30d | 3 | 3 | OK |
| Ordini pagati — periodo (30g interi) | 30d | 0 | 0 | OK |
| Ordini pagati — periodo precedente | 30d | 0 | 0 | OK |
| Ordini pagati — n. anomalie | 30d | 0 | 0 | OK |
| Catena: Σ sessioni | today | 0 | 0 | OK |
| Catena: Σ signup avviati | today | 0 | 0 | OK |
| Catena: Σ signup completati | today | 0 | 0 | OK |
| Catena: Σ profili | today | 0 | 0 | OK |
| Catena: Σ paganti | today | 0 | 0 | OK |
| Catena: profili senza attribuzione | today | 0 | 0 | OK |
| Catena: Σ sessioni | 7d | 50 | 50 | OK |
| Catena: Σ signup avviati | 7d | 13 | 13 | OK |
| Catena: Σ signup completati | 7d | 2 | 2 | OK |
| Catena: Σ profili | 7d | 2 | 2 | OK |
| Catena: Σ paganti | 7d | 0 | 0 | OK |
| Catena: profili senza attribuzione | 7d | 1 | 1 | OK |
| Catena: Σ sessioni | 30d | 400 | 400 | OK |
| Catena: Σ signup avviati | 30d | 66 | 66 | OK |
| Catena: Σ signup completati | 30d | 24 | 24 | OK |
| Catena: Σ profili | 30d | 22 | 22 | OK |
| Catena: Σ paganti | 30d | 0 | 0 | OK |
| Catena: profili senza attribuzione | 30d | 9 | 9 | OK |

105/105 uguali

| Controllo per cella | Finestra | Celle | Uguali | Divergenze |
|---|---|---:|---:|---|
| Serie «Page view», ogni giorno | 2026-08-07 → 2026-10-05 | 60 | 60 | 0 |
| Serie «Sessioni con consenso», ogni giorno | 2026-08-07 → 2026-10-05 | 60 | 60 | 0 |
| Serie «Signup avviati», ogni giorno | 2026-08-07 → 2026-10-05 | 60 | 60 | 0 |
| Serie «Signup completati», ogni giorno | 2026-08-07 → 2026-10-05 | 60 | 60 | 0 |
| Serie «Nuovi profili», ogni giorno | 2026-08-07 → 2026-10-05 | 60 | 60 | 0 |
| Serie «Click partner», ogni giorno | 2026-08-07 → 2026-10-05 | 60 | 60 | 0 |
| Serie «Errori client», ogni giorno | 2026-08-07 → 2026-10-05 | 60 | 60 | 0 |
| Serie «Ordini pagati», ogni giorno | 2026-08-07 → 2026-10-05 | 60 | 60 | 0 |
| Catena per fonte (0 fonti × 5 colonne) | today | 0 | 0 | 0 |
| Catena per fonte (5 fonti × 5 colonne) | 7d | 25 | 25 | 0 |
| Catena per fonte (9 fonti × 5 colonne) | 30d | 45 | 45 | 0 |

Controlli per cella: 0 divergenze
