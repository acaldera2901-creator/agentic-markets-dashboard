# Agentic Markets — Audit Go-Live

**Data:** 2026-05-29
**Eseguito da:** programmatore-andrea (Opus 4.8) + ml-engineer-agentic, audit read-only (nessuna modifica al codice)
**Metodo:** build reale, pytest, fit modelli, query DB produzione. Ogni bug ha una prova.

---

## 1. VERDETTO — in una riga

**Il sistema NON è pronto per clienti paganti.** Build e backend girano (562 test verdi), ma mancano due cose che per un prodotto a pagamento sono il cuore: **il controllo accessi server-side** e **predizioni affidabili che arrivino davvero al cliente**. Oggi chiunque conosca l'URL scarica le predizioni gratis, e i numeri che vede il cliente vengono da un modello naive — non dalla pipeline ML seria che hai costruito.

*Costruito ✅ — in parte Verificato ⚠️ — NON Operativo per vendere ❌*

---

## 2. COM'È FATTO IL SISTEMA (architettura reale)

```
BACKEND PYTHON (agents/ core/ models/ risk/)
  └─ Dixon-Coles MLE + FeatureAdjuster + conformal + risk engine
     └─ scrive nella tabella `predictions`  ←── QUESTI NUMERI NON ARRIVANO AL CLIENTE

FRONTEND / API TYPESCRIPT (app/ lib/)
  └─ Poisson naive (lib/poisson-model.ts)
     └─ scrive `match_predictions` → `unified_predictions`
        └─ /api/v2/predictions  ←── QUESTO è ciò che vede il cliente

DB: tutto su Supabase pooler (eu-west-1). [Nota: il "Python→Neon" che credevi NON è vero in config: DATABASE_URL Python punta a Supabase]
DEPLOY: Vercel, root del repo.
```

### ⚠️ La scoperta più importante
Ci sono **due pipeline predittive scollegate**. Tutto il lavoro ML "serio" (Dixon-Coles regolarizzato, conformal prediction, feature adjuster, risk engine, world cup gates) finisce nella tabella `predictions` e **non viene mai mostrato al cliente**. Il cliente vede solo il **Poisson naive in TypeScript**, senza regolarizzazione. Nessuno script collega le due. È il problema architetturale numero uno: stai pagando complessità ML che il prodotto non usa.

---

## 3. BUG PER SEVERITÀ

### 🔴 P0 — BLOCCANO IL GO-LIVE

| # | Bug | Dove | Prova | Fix |
|---|-----|------|-------|-----|
| 1 | **Predizioni e edge pubblici senza login.** Il GET non controlla piano/auth, il gating è solo nella UI (localStorage). Chi non paga scarica tutto con un `curl`. | `app/api/predictions/route.ts:364` (+ `/api/data`, `/tennis`, `/history`, `/live`, `/leaderboard`, `/v2/predictions`) | Le route fanno `SELECT *` e rispondono `Cache-Control: public` senza auth. Il README riga 23 vieta esplicitamente di esporre questi dati pre-pagamento. | Gating server-side: verifica sessione + piano lato server prima di rispondere. Finché l'auth è in localStorage non esiste gating reale. |
| 2 | **Edge inventato spacciato per reale.** Quando mancano le quote di mercato, il codice inventa le quote dalla probabilità e assegna un edge hardcoded (0.024 / 0.012), etichettandolo `is_paper:false` = "edge reale sul mercato". Il cliente non può distinguerlo da uno vero. | `app/api/predictions/route.ts:62-83`, `lib/unified-adapter.ts:156` | La partita live PSG-Arsenal ha `odds = NULL` → il path è **attivo in produzione adesso**. | Se mancano quote reali: `edge=null`, `is_paper=true`, nascondi dalla vista value-bet. |
| 3 | **Probabilità implausibili dal modello naive.** Forze squadra = rapporti grezzi gol, zero shrinkage. Su Champions/Europa (pochi match per squadra) i numeri impazziscono. | `lib/poisson-model.ts:108-114` | Live: PSG in casa dato all'**11%**, Arsenal in trasferta al **70%** (λ 0.71 vs 2.12). Numeri non difendibili. | Usare la pipeline Python regolarizzata, o aggiungere shrinkage + min-match per squadra + blocco CL/EL sotto soglia campione. |
| 4 | **pytest rotto out-of-the-box** per la cartella duplicata (vedi §5). La suite si interrompe a 0 test senza `--ignore`. CI/regressioni cieche. | `tests/conftest.py` vs `dashboard-web/tests/conftest.py` | `ImportPathMismatchError` alla collection. Con `--ignore=dashboard-web`: 562 pass, 1 fail. | Rimuovere la cartella annidata o aggiungere `--ignore` a `pytest.ini`. |

### 🟠 P1 — SERI (fixare prima del lancio pubblico)

| # | Bug | Dove | Note |
|---|-----|------|------|
| 5 | **SQL via `exec_sql` con interpolazione stringa + service-role.** Ogni query gira con `SERVICE_ROLE_KEY` (bypassa RLS) e i parametri sono interpolati a mano. Injection oggi mitigata dall'escaping, ma pattern fragile. Endpoint pubblici scrivono qui. | `lib/db.ts:18-46`, `app/api/track/route.ts:29`, `app/api/partner-request/route.ts:21` | Usare query parametrizzate reali (il pacchetto `postgres` è già in deps). |
| 6 | **Endpoint pubblici scrivibili senza auth né rate-limit.** `POST /api/track` e `/api/partner-request` accettano JSON arbitrario e scrivono su DB con service-role. Rischio spam/flood. | `app/api/track`, `app/api/partner-request` | Aggiungere rate-limit + validazione + secret. |
| 7 | **Conformal calibration con data leakage.** Il modello calibra gli intervalli di confidenza sugli stessi dati su cui è stato fittato → intervalli troppo stretti → overconfidence. Alimenta il risk sizing. | `agents/model.py:65-84` | Split temporale reale fit/calibrazione disgiunti. |
| 8 | **FeatureAdjuster è un no-op.** I campi che l'adjuster legge (form, xg_luck, h2h, motivation, injuries, weather) non vengono mai popolati dal data_collector. Capability dichiarata ma non operativa. | `agents/data_collector.py:205-220` vs `agents/model.py:161-179` | (Nella pipeline Python scollegata — non impatta il cliente oggi, ma è lavoro morto.) |
| 9 | **Nessun time-decay sulla storia.** 365 giorni pesati uniformemente; forma recente = stagione vecchia. Dixon-Coles prevede decay esponenziale (ξ), non applicato. | `lib/football-data.ts:65-76` | Decay esponenziale sulle partite. |
| 10 | **Test risk engine rosso** (config drift). Il test si aspetta `ci_width factor=0` con width 1.0, ma il config ha `max_ci_width=1.5` → factor 0.333. Tocca lo stake sizing. | `tests/test_risk_engine.py:196` vs `config/risk_config.yaml:45` | Allineare test al config (codice corretto, test stale). |

### 🟡 P2 — MINORI

- **Edge incoerente** tra `/api/predictions` (sintetizza) e `/api/v2/predictions` (usa NULL grezzo): stessa partita, due edge diversi. (`syncMatchPredictionsToUnified`)
- **`decimalOdds` clamp [0.05, 0.92]**: comprime i favoriti forti, distorce i value-bet. (`route.ts:58`)
- **Admin cookie = segreto in chiaro**: `admin_token` contiene `ADMIN_SECRET` testuale. Meglio token firmato. (`app/api/admin/login/route.ts`)
- **`middleware.ts` deprecato** in Next 16 (usare `proxy`). Funziona ancora.
- **`app/page.tsx` monolite da 5.943 righe / 265KB**: ogni modifica UI è rischiosa. Da spezzare.

---

## 4. SECURITY — cosa è OK

Lato esposizione segreti il progetto è **pulito**:
- `.env` mai committato in tutta la storia git (solo `.example`).
- Nessuna chiave AI/DB nel bundle client. Le `NEXT_PUBLIC_*` sono solo prezzi piani + `SUPABASE_URL` (pubblica per design).
- `SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `POLYMARKET_PRIVATE_KEY` usate solo server-side.

Il problema di sicurezza vero non è il leak di chiavi, è il **gating** (P0 #1) e il pattern `exec_sql` (P1 #5).

---

## 5. DEBITO TECNICO — pulizia

- **`dashboard-web/` (661M) è un secondo clone accidentale dello stesso repo GitHub** — non un submodule, non intenzionale. Contiene una copia completa del backend e persino `dashboard-web/dashboard-web/` (tripla nidificazione), con HEAD più vecchio. Vercel deploya dalla root quindi NON va in produzione, ma: rompe pytest, gonfia il repo, e crea il rischio di editare il file sbagliato. **Va eliminata** (recuperabile dal remote — è solo un clone vecchio). *Richiede tua conferma: è una cancellazione.*
- **Doppio virtualenv**: `.venv` (493M) e `venv` (683M), entrambi Python 3.14.4. Uno è ridondante, ~500M sprecati e confonde quale usare.

---

## 6. COSA MANCA PER IL GO-LIVE — checklist ordinata

**Bloccanti assoluti (senza questi non si vende):**
1. [ ] Gating server-side reale: account + sessioni + verifica piano lato server (P0 #1). Oggi l'auth è in localStorage = nessun gating.
2. [ ] Stop all'edge sintetico: mai mostrare edge senza quote di mercato reali (P0 #2).
3. [ ] Predizioni affidabili al cliente: o colleghi la pipeline Python regolarizzata a `unified_predictions`, o porti shrinkage/MLE/time-decay nel modello TS + blocco competizioni con campione insufficiente (P0 #3).

**Prima del lancio pubblico:**
4. [ ] Pulizia repo: elimina `dashboard-web/` annidata + un venv → ripristina pytest, dimezza la size (P0 #4 + §5).
5. [ ] Query parametrizzate + rate-limit endpoint pubblici (P1 #5, #6).
6. [ ] Fix test risk engine rosso (P1 #10) — zero bug noti prima di vendere.

**Igiene tecnica (riduce il rework futuro):**
7. [ ] Spezzare `app/page.tsx` (5.943 righe).
8. [ ] Fix conformal leakage prima di usare `ci_width` nel sizing reale (P1 #7).
9. [ ] Decidere il destino della pipeline Python: collegarla o rimuoverla (non tenere lavoro morto).

---

## 7. RACCOMANDAZIONE

Il prodotto è più indietro di quanto sembri dalla UI: la facciata è curata, ma sotto manca lo strato che lo rende **vendibile** (accessi) e **affidabile** (predizioni reali). Prima di qualsiasi spinta marketing/GTM, chiudere i 3 bloccanti P0 #1-#3. Sono settimane di lavoro, non giorni — ma sono esattamente le cose che, se vendute così, brucerebbero la fiducia dei primi clienti (e creerebbero esposizione legale sui claim di "value", P0 #2).

L'asset positivo: l'infrastruttura regge (build pulita, 562 test, secrets gestiti bene). La base c'è. Va completata, non rifatta.
