# Agentic Markets — Football Prediction Trading Desk
**Date:** 2026-05-04  
**Status:** Approved  

---

## Problema

I prediction market calcistici (Betfair Exchange, bookmaker tradizionali) presentano inefficienze sistematiche che un umano non può sfruttare: troppi dati da processare in real-time, finestre di arbitraggio da secondi, bias cognitivi. Un sistema multi-agente AI può identificare ed eseguire queste opportunità in autonomia.

---

## Soluzione

Un trading desk autonomo composto da 7 agenti Python indipendenti che comunicano via Redis, con Claude API come cervello decisionale. Il primo mercato target è il calcio mondiale (campionati di rilevanza: Premier League, Serie A, La Liga, Bundesliga, Ligue 1, Champions League, Europa League, Conference League).

---

## Architettura

**Pattern:** Microservizi con message queue (Redis Streams).  
Ogni agente è un processo Python separato con heartbeat monitoring. Nessuna dipendenza diretta tra agenti — comunicano solo via Redis.

```
DATA LAYER (API-Football · The Odds API · Betfair WS · Scraper)
                         │
                      Redis  ← message bus + cache
         ┌───────────────┼───────────────┐
    Model Agent    Analyst Agent   Strategist Agent
         └───────────────┼───────────────┘
                    Risk Manager
                         │
                    Trader Agent ──→ Betfair Exchange + Polymarket
                         │
                   Monitor Agent ──→ Telegram · PostgreSQL · Dashboard
```

---

## Data Layer

### Dati Statistici (ogni 15min + pre-match)
- **API-Football**: fixtures, lineups, form, xG, head-to-head, infortuni
- **football-data.org**: fallback gratuito per dati storici

### Dati di Mercato (real-time)
- **The Odds API**: quote da 40+ bookmaker, aggiornate ogni 5min
- **Betfair Exchange API**: orderbook live, volume, movimento quote (WebSocket)
- **Polymarket API**: eventi major (Mondiale, Europei, CL winner)

### Dati di Sentiment (pre-match)
- Scraper news: BBC Sport, Sky Sport, transfermarkt
- X/Twitter API: sentiment hashtag partita nelle 6h pre-kick off
- RSS conferenze stampa: lineup hints, dichiarazioni allenatori

### Modello Probabilistico
- **Dixon-Coles** corretto per home advantage + forma recente (finestra mobile 10 partite)
- Output: `P(home_win)`, `P(draw)`, `P(away_win)` per ogni match
- Value bet identificata quando: `edge = model_probability - market_implied_probability > 3%`
- Retraining automatico ogni domenica notte con risultati settimana

---

## Agent Layer

### 1. Data Collector Agent
- Loop ogni 15min (ogni 1min nelle 2h pre-match)
- Fetcha API-Football + The Odds API + sentiment
- Normalizza e pubblica su Redis Stream `market:data`
- Nessuna AI — solo raccolta e normalizzazione

### 2. Model Agent
- Ascolta `market:data`, ricalcola Dixon-Coles su ogni aggiornamento
- Pubblica probabilità su `model:probabilities`
- Mantiene storia parametri modello in PostgreSQL

### 3. Analyst Agent *(Claude-powered)*
- Ascolta `model:probabilities` + feed mercato Betfair
- Identifica: value bet (edge > 3%), arbitraggio cross-venue, steam moves
- Pubblica opportunità rankate su `analyst:opportunities`

### 4. Strategist Agent *(Claude-powered)*
- Legge `analyst:opportunities` + contesto partita
- Formula thesis testuale per ogni trade
- Filtra false positives, pubblica su `strategy:approved`

### 5. Risk Manager Agent
- Kelly Criterion per sizing: `f = edge / (odds - 1)`
- Hard limits: max 2% bankroll per bet, max 10% esposizione totale
- Blocca nuovi bet se drawdown mensile > 15%
- Pubblica ordini dimensionati su `risk:orders`

### 6. Trader Agent
- Esegue su Betfair Exchange via `betfairlightweight` SDK
- Gestisce placement, monitoring posizione, cash-out automatico se thesis invalidata
- Pubblica risultati su `trader:executions`

### 7. Monitor Agent *(watchdog)*
- **Heartbeat**: ogni agente pubblica ping ogni 30s su `health:<agent_name>`. Se manca per 60s → restart automatico + alert Telegram
- **Anomaly detection**: probabilità > 1.0, bet fuori limiti Kelly, silenzio anomalo su giornate con partite live
- **P&L tracking**: win rate per campionato, drawdown, ROI real-time
- **Log aggregation**: centralizzata su file + PostgreSQL
- **Dashboard**: FastAPI con stato real-time ogni agente
- Report Telegram quotidiano alle 8:00

---

## Error Handling

| Scenario | Risposta |
|---|---|
| API-Football down | Fallback su football-data.org |
| Betfair rifiuta ordine | Retry 3x con backoff esponenziale, poi skip + notifica |
| Claude API timeout | Usa last known output, log critico, Monitor allerta |
| Agente crashed | Monitor rileva heartbeat mancante → restart entro 60s |
| Drawdown > 15% | RiskManager blocca tutti gli ordini, alert immediato |
| Quote cambiate pre-execution | Trader ricontrolla edge, cancella se edge < 1% |

---

## Tech Stack

| Layer | Tecnologia |
|---|---|
| Linguaggio | Python 3.11+ |
| Message bus | Redis 7 (Streams + Pub/Sub) |
| Database | PostgreSQL 16 |
| Agent AI | Claude API (claude-sonnet-4-6) con prompt caching |
| Betfair | `betfairlightweight` Python SDK |
| Odds data | The Odds API (REST) |
| Football data | API-Football (REST) |
| Sentiment | `feedparser` + `tweepy` + `httpx` |
| Modello statistico | `scipy` + `numpy` (Dixon-Coles custom) |
| Notifications | `python-telegram-bot` |
| Dashboard | FastAPI + WebSocket |
| Local dev | Docker Compose |
| VPS deploy | Docker + systemd |

---

## Struttura Progetto

```
agentic-markets/
├── agents/
│   ├── data_collector.py
│   ├── model.py
│   ├── analyst.py
│   ├── strategist.py
│   ├── risk_manager.py
│   ├── trader.py
│   └── monitor.py
├── core/
│   ├── redis_client.py
│   ├── db.py
│   ├── betfair_client.py
│   ├── odds_api_client.py
│   └── claude_client.py
├── models/
│   └── dixon_coles.py
├── dashboard/
│   └── main.py
├── config/
│   └── settings.py
├── docker-compose.yml
├── .env.example
└── run.py
```

---

## Roadmap (fasi unificate)

### Sprint Unico — MVP + Multi-agent (3-4 settimane)

**Settimana 1**
- Setup Docker Compose (Redis + PostgreSQL)
- Data Collector + Model Agent (Dixon-Coles)
- Paper trading attivo su Serie A + Premier League

**Settimana 2**
- Analyst + Strategist + Risk Manager
- Pipeline sentiment
- Monitor Agent con heartbeat e auto-restart

**Settimana 3**
- Trader Agent in paper mode
- Dashboard FastAPI
- Backtesting su stagione precedente

**Settimana 4**
- Tuning soglie (edge threshold, Kelly fraction)
- Validazione win rate > 55% su paper trading
- Preparazione deploy VPS

### Fase successiva — Live su VPS
- Deploy Docker su Hetzner
- `PAPER_TRADING = False` con bankroll iniziale €200-500

---

## Paper Trading Mode

```python
PAPER_TRADING = True  # False = denaro reale
```

Con `True`: Trader simula senza chiamare Betfair, P&L virtuale in PostgreSQL. Switch a produzione = una variabile.

---

## Metriche di Successo

- **Uptime**: > 99%, latenza detection→execution < 10s
- **Modello**: edge medio > 3%, ROI paper trading > 5% mensile
- **Rischio**: drawdown mensile mai > 15% bankroll
