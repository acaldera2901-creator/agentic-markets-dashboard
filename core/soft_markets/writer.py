import re
from core.soft_markets.model import predict_lambda, p_over, MAIN_LINE, IS_GENERIC

MODEL_VERSION = "soft-leagueagnostic-v1"
_NOISE = re.compile(r"\b(FC|CF|SC|AC|AS|SV|SS|US|SSC|AFC|Calcio)\b", re.I)

def norm_name(s):
    s = _NOISE.sub("", s or "")
    return re.sub(r"\s+", " ", s).strip().lower()

def build_rows(home, away, kickoff_iso, league, rates):
    date = kickoff_iso[:10]
    key = f"{norm_name(home)}|{norm_name(away)}|{date}"
    rows = []
    for m, r in rates.items():
        lam = predict_lambda(m, r["a_h"], r["d_h"], r["a_a"], r["d_a"], r["glob"])
        line = MAIN_LINE[m]
        rows.append({
            "match_key": key, "league": league, "home_team": home, "away_team": away,
            "kickoff": kickoff_iso, "market": m, "expected": round(lam, 2),
            "main_line": line, "p_over": round(p_over(lam, line), 4),
            "confidence": None, "is_generic": IS_GENERIC[m], "model_version": MODEL_VERSION,
        })
    return rows
