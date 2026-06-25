import httpx
from config.settings import settings
from core.soft_markets.model import team_rate, IS_GENERIC

_DIRECT = "https://v3.football.api-sports.io"
MARKETS = ["corners", "cards", "fouls"]
WARMUP = 3

def _hdr():
    return {"x-apisports-key": settings.API_FOOTBALL_DIRECT_KEY}

async def fetch_team_recent(team_id, before_iso, window=12):
    """Ultima `window` partite FT della squadra prima di before_iso -> for/against per mercato."""
    out = {f"{m}_for": [] for m in MARKETS} | {f"{m}_against": [] for m in MARKETS}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(f"{_DIRECT}/fixtures", headers=_hdr(),
                        params={"team": team_id, "last": window * 2, "status": "FT"})
        if r.status_code != 200:
            return out
        prior = [f for f in r.json().get("response", []) if f["fixture"]["date"] < before_iso]
        # most-recent-first, then take the window (robust se l'API non garantisce l'ordine)
        prior.sort(key=lambda f: f["fixture"]["date"], reverse=True)
        fixtures = prior[:window]
        for f in fixtures:
            fid = f["fixture"]["id"]
            s = await c.get(f"{_DIRECT}/fixtures/statistics", headers=_hdr(), params={"fixture": fid})
            if s.status_code != 200:
                continue
            resp = s.json().get("response", [])
            mine = next((t for t in resp if t["team"]["id"] == team_id), None)
            opp  = next((t for t in resp if t["team"]["id"] != team_id), None)
            if not mine or not opp:
                continue
            def stat(team, *names):
                for st in team["statistics"]:
                    ty = (st.get("type") or "").lower()
                    if any(n in ty for n in names):
                        v = st.get("value"); return int(v) if isinstance(v,(int,float)) else 0
                return 0
            getters = {"corners": ("corner",), "cards": ("yellow","red"), "fouls": ("foul",)}
            for m, names in getters.items():
                if m == "cards":
                    mf = stat(mine,"yellow")+stat(mine,"red"); af = stat(opp,"yellow")+stat(opp,"red")
                else:
                    mf = stat(mine,*names); af = stat(opp,*names)
                out[f"{m}_for"].append(mf); out[f"{m}_against"].append(af)
    return out

async def build_rates(home_id, away_id, kickoff_iso):
    rh = await fetch_team_recent(home_id, kickoff_iso)
    ra = await fetch_team_recent(away_id, kickoff_iso)
    res = {}
    for m in MARKETS:
        hf, ha = rh[f"{m}_for"], rh[f"{m}_against"]
        af, aa = ra[f"{m}_for"], ra[f"{m}_against"]
        if min(len(hf), len(af)) < WARMUP:
            return None
        glob = (sum(hf)+sum(ha)+sum(af)+sum(aa)) / (len(hf)+len(ha)+len(af)+len(aa))
        if IS_GENERIC[m]:
            res[m] = {"a_h":1.0,"d_h":1.0,"a_a":1.0,"d_a":1.0,"glob":glob}
        else:
            res[m] = {"a_h":team_rate(hf,glob),"d_h":team_rate(ha,glob),
                      "a_a":team_rate(af,glob),"d_a":team_rate(aa,glob),"glob":glob}
    return res
