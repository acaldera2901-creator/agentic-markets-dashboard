# Agentic Markets — Football Prediction Trading Desk
**Aggiornato:** 2026-05-06
**Status:** Operativo (Paper Mode)

---

## Architettura Reale (come funziona ora)

Il sistema è **ibrido**: una parte gira su Vercel (dashboard pubblica, sempre online) e una parte gira localmente su Mac (agenti Python che usano Redis + Betfair).

```
╔══════════════════════════════════════════════════════════════╗
║  VERCEL (sempre online — Next.js 16)                        ║
║                                                              ║
║  Dashboard → /api/predictions  → football-data.org          ║
║                                → The Odds API               ║
║                                → Understat (xG)             ║
║                                → API-Football (injuries)     ║
║                                → OpenWeatherMap             ║
║                                → Neon PostgreSQL             ║
║                                                              ║
║  Dixon-Coles + Pi Rating + xG calcolati server-side Vercel  ║
╚══════════════════════════════════════════════════════════════╝
                         ↕ heartbeat POST ogni 30s
╔══════════════════════════════════════════════════════════════╗
║  LOCALE (python run.py — Mac)                               ║
║                                                              ║
║  DataCollector → Redis → ModelAgent → AnalystAgent          ║
║  StrategistAgent → RiskManagerAgent → TraderAgent → Betfair  ║
║  ResearchAgent → Ollama (llama3.2) → /api/research (Neon)  ║
║  AHCollectorAgent → Pinnacle/SBOBet → Redis ah:odds         ║
║  MonitorAgent → PSI check · Monte Carlo · Telegram alerts   ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Cosa usa cosa

### Dashboard Vercel (NON usa Ollama, NON dipende dagli agenti Python)
- **Dixon-Coles model**: implementato in TypeScript, gira su Vercel serverless
- **Pi Rating**: calcolato da historical results in-process su Vercel
- **xG data**: Understat (scraping Python-side in Next.js via fetch)
- **Odds**: The Odds API (fetch diretto da Next.js)
- **Injuries/Predictions**: API-Football (fetch diretto)
- **Weather**: OpenWeatherMap
- **AI Research summaries**: scritti dagli agenti Python via Ollama, salvati su Neon, letti dalla dashboard

### Agenti Python (girano SOLO in locale con `python run.py`)
- **DataCollector**: raccoglie fixture e odds → pubblica su Redis `market:data`
- **ModelAgent**: Dixon-Coles locale + conformal prediction → `model:probabilities`
- **AnalystAgent**: calcola edge, filtra per MIN_EDGE → `analyst:opportunities`
- **StrategistAgent**: conviction score (Claude API o rule-based) → `strategy:approved`
- **RiskManagerAgent**: Kelly sizing, adaptive edge, data completeness gate → `risk:orders`
- **TraderAgent**: paper/live execution su Betfair + Telegram alert → `trader:executions`
- **MonitorAgent**: heartbeat check, PSI drift, Monte Carlo domenicale, report Telegram
- **ResearchAgent**: Ollama llama3.2 → analisi match → POST `/api/research` (Neon)
- **AHCollectorAgent** (S7): Asian Handicap da Pinnacle/SBOBet/OddsAPI → `ah:odds`

---

## Modelli Statistici

### Dixon-Coles (principale)
- Regressione Poisson su risultati storici (max 12 mesi)
- Parametri: attack/defense per team, home advantage, rho (correlazione score basso)
- Output: p_home, p_draw, p_away + lambda_home, lambda_away

### Conformal Prediction (uncertainty)
- Calibrato sull'ultimo 20% della history per league
- Output: [ci_low, ci_high] per ogni probabilità
- Gate: skip bet se width > MAX_CONFIDENCE_INTERVAL_WIDTH (0.15)

### Pi Rating (forza relativa)
- Elo-style aggiornato dopo ogni partita
- Influenza predizione: affianca Dixon-Coles nel reasoning

---

## Value Engine

```
edge = p_model - p_implied_market
p_implied_market = 1 / odds

stake = min(kelly_fraction × kelly_full, max_bet_pct × bankroll)
      = min(0.25 × (edge / (odds-1)) × bankroll, 0.03 × bankroll)

edge_threshold:
  Pinnacle/sharp source → 2% (EDGE_MIN_SHARP)
  Altri bookmaker       → 5% (EDGE_MIN_SOFT)

Gate di qualità:
  data_completeness_score < 0.75 → dead letter queue, no bet
  ci_width > 0.15               → skip bet (alta incertezza)
  monthly_drawdown > 15%        → blocco totale
```

---

## Fonti Dati Attive

| Fonte | Cosa fornisce | Dove usata |
|-------|--------------|------------|
| football-data.org | Fixtures, storia (365gg) | Vercel + Python |
| The Odds API | Quote H2H da 40+ bmaker | Vercel + Python |
| Understat | xG, xGA, npxG per squadra | Vercel |
| API-Football | Infortuni, predizioni indip. | Vercel |
| OpenWeatherMap | Meteo stadio match-day | Vercel |
| Ollama (locale) | AI narrative research | Python ResearchAgent |
| Betfair Exchange | Esecuzione bet, orderbook | Python TraderAgent |
| Pinnacle/SBOBet (S7) | Asian Handicap lines | Python AHCollectorAgent |

---

## Database (Neon PostgreSQL)

```sql
match_predictions    -- previsioni calcolate (con enrichment JSONB)
bets                 -- esecuzioni paper/live
match_research       -- AI summaries da Ollama
agent_heartbeats     -- status agenti Python
dead_letter_predictions  -- predizioni con dati incompleti
monte_carlo_results  -- simulazioni bankroll domenicali
understat_cache      -- cache xG per league (6h TTL)
```

---

## Variabili d'Ambiente Necessarie

### Vercel (.env.local nella dashboard)
```
DATABASE_URL          # Neon PostgreSQL
FOOTBALL_DATA_ORG_API_KEY
API_FOOTBALL_KEY
ODDS_API_KEY
OPENWEATHERMAP_API_KEY
RESEARCH_SECRET       # condiviso con Python per auth /api/research e /api/health
```

### Python (.env nella root del progetto)
```
DASHBOARD_URL=https://agentic-markets-roan.vercel.app  # IMPORTANTE: deve puntare a Vercel
RESEARCH_SECRET       # stesso segreto della dashboard
REDIS_URL             # Redis locale o cloud
DATABASE_URL          # stesso Neon
TELEGRAM_BOT_TOKEN    # per alerts
TELEGRAM_CHAT_ID
BETFAIR_APP_KEY / USERNAME / PASSWORD
ANTHROPIC_API_KEY     # opzionale: se non settato, fallback rule-based
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
BANKROLL=500.0
KELLY_FRACTION=0.25
MAX_BET_PCT=0.03
```

---

## Come Avviare

```bash
# 1. Avvia Redis
docker-compose up -d redis

# 2. Avvia Ollama (per AI research)
ollama serve
ollama pull llama3.2

# 3. Avvia tutti gli agenti Python
cd ~/Desktop/sistema-andrea/agentic-markets
python run.py

# Dashboard: sempre disponibile su https://agentic-markets-roan.vercel.app
```

---

## Monitoring Attivo

- **Heartbeat**: ogni agente posta su `/api/health` ogni 30s → dashboard mostra alive/stale/offline
- **PSI**: Population Stability Index su 4 feature ogni 24h → WARNING se > 0.1
- **Monte Carlo**: ogni domenica notte — P5/P50/P95 su 500 bet × 1000 sim
- **Telegram**: alert in tempo reale su value bet piazzate (edge > 3%)
- **Daily report**: ogni mattina alle 8 UTC via Telegram

---

## Stato Attuale (2026-05-06)

- ✅ Dashboard Vercel operativa con Dixon-Coles + Pi Rating + xG
- ✅ Conformal prediction calibrata per league
- ✅ Adaptive Kelly + edge tier (sharp/soft)
- ✅ Agent heartbeat via DB
- ✅ AHCollectorAgent (S7) implementato
- ✅ PSI monitoring + Monte Carlo in MonitorAgent
- ✅ Telegram value bet alerts
- ⏳ Agenti Python: richiedono `python run.py` in locale
- ⏳ Ollama: richiede `ollama serve` in locale
- ⏳ Champion/challenger model: struttura pronta, da testare su 200+ predizioni
