"""
Genera data/summer_leagues/history.json per il branch michele/summer-leagues.

Per ognuna delle 5 leghe estive (#SUMMER-LEAGUES-1): prende gli ultimi ~365gg
di risultati dai CSV football-data ("new leagues", am-lab/summer_*.csv) e
RIMAPPA i nomi squadra sui displayName ESPN (fetch live di /teams per slug),
cosi' il Poisson del route TS costruito su questo storico trova ESATTAMENTE i
nomi delle fixtures ESPN a serve-time. Fuzzy-match normalizzato; i nomi non
mappati restano col nome CSV (innocui: quelle squadre semplicemente non
matchano fixtures) e finiscono nel report 'unmatched' per review.

Run: PYTHONUTF8=1 <venv>/python.exe C:/Users/bragh/am-lab/gen_summer_history.py
Output: C:/Users/bragh/am-lab-wt-summer/data/summer_leagues/history.json
"""
from __future__ import annotations
import csv, io, json, unicodedata, urllib.request
from datetime import date, timedelta
from difflib import SequenceMatcher
from pathlib import Path

LAB = Path(r"C:\Users\bragh\am-lab")
OUT = Path(r"C:\Users\bragh\am-lab-wt-summer\data\summer_leagues")
LEAGUES = {  # code -> (csv file, espn slug)
    "ELI": ("summer_NOR.csv", "nor.1"),
    "ALL": ("summer_SWE.csv", "swe.1"),
    "VEI": ("summer_FIN.csv", "fin.1"),
    "LOI": ("summer_IRL.csv", "irl.1"),
    "CSL": ("summer_CHN.csv", "chn.1"),
}
SINCE = date.today() - timedelta(days=365)
STOP = {"fc","if","ik","bk","afc","sk","fk","ff","aif","cf","sc","club","cd"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    words = [w for w in s.lower().replace("/", " ").replace("-", " ").split() if w not in STOP]
    return " ".join(words)


def espn_teams(slug: str) -> list[str]:
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=20) as r:
        data = json.load(r)
    out = []
    for lg in data.get("sports", [{}])[0].get("leagues", []):
        for t in lg.get("teams", []):
            dn = t.get("team", {}).get("displayName")
            if dn: out.append(dn)
    return out


def parse_date(s):
    from datetime import datetime
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try: return datetime.strptime(s.strip(), fmt).date()
        except ValueError: continue
    return None


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    result = {"generated_at": str(date.today()), "window_days": 365, "leagues": {}, "unmatched": {}}
    for code, (csvf, slug) in LEAGUES.items():
        espn = espn_teams(slug)
        espn_norm = {norm(n): n for n in espn}
        def map_name(csv_name: str) -> tuple[str, bool]:
            n = norm(csv_name)
            if n in espn_norm: return espn_norm[n], True
            # substring containment, then fuzzy
            for en, orig in espn_norm.items():
                if n and (n in en or en in n): return orig, True
            best, score = None, 0.0
            for en, orig in espn_norm.items():
                r = SequenceMatcher(None, n, en).ratio()
                if r > score: best, score = orig, r
            if best and score >= 0.72: return best, True
            return csv_name, False
        matches, unmatched = [], set()
        with io.open(LAB / csvf, encoding="utf-8-sig", errors="replace") as fh:
            for r in csv.DictReader(fh):
                d = parse_date(r.get("Date") or "")
                if d is None or d < SINCE: continue
                try: hg, ag = int(float(r["HG"])), int(float(r["AG"]))
                except (KeyError, TypeError, ValueError): continue
                h, hm = map_name(r["Home"].strip()); a, am = map_name(r["Away"].strip())
                if not hm: unmatched.add(r["Home"].strip())
                if not am: unmatched.add(r["Away"].strip())
                matches.append({"homeTeam": h, "awayTeam": a, "homeGoals": hg, "awayGoals": ag, "date": str(d)})
        result["leagues"][code] = {"espn_slug": slug, "matches": matches}
        result["unmatched"][code] = sorted(unmatched)
        mapped = sum(1 for m in matches)  # all rows kept
        print(f"{code}: {len(matches)} match ultimi 365gg · ESPN teams {len(espn)} · unmatched CSV names: {sorted(unmatched) or 'NESSUNO'}")
    (OUT / "history.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(f"\nscritto {OUT / 'history.json'} ({(OUT / 'history.json').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
