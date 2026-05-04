from fastapi import FastAPI
from core.redis_client import get_redis
from core.db import AsyncSessionLocal, Bet
from agents.monitor import is_heartbeat_stale, compute_pnl, AGENT_HEARTBEAT_KEYS
from sqlalchemy import select
from config.settings import settings

app = FastAPI(title="Agentic Markets Dashboard")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/agents")
async def agents_status():
    r = await get_redis()
    status = {}
    for agent_key, hb_key in AGENT_HEARTBEAT_KEYS.items():
        hb = await r.get(f"health:{hb_key}")
        if hb is None:
            status[hb_key] = "offline"
        elif is_heartbeat_stale(hb, settings.HEARTBEAT_TIMEOUT):
            status[hb_key] = "stale"
        else:
            status[hb_key] = "running"
    return status


@app.get("/bets")
async def recent_bets(limit: int = 20):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Bet).order_by(Bet.placed_at.desc()).limit(limit))
        bets = result.scalars().all()
    return [{"id": b.id, "match": b.match_external_id, "selection": b.selection,
             "odds": b.odds, "stake": b.stake, "status": b.status,
             "paper": b.paper, "pnl": b.profit_loss} for b in bets]


@app.get("/pnl")
async def pnl_summary():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Bet))
        bets = result.scalars().all()
    bet_dicts = [{"stake": b.stake, "odds": b.odds, "status": b.status} for b in bets]
    return {
        "total_pnl": compute_pnl(bet_dicts),
        "total_bets": len(bet_dicts),
        "paper_mode": settings.PAPER_TRADING,
    }
