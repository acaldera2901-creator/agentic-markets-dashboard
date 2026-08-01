"""#HISTORY-REFRESH-0801 — rigenera data/summer_leagues/history.json per TUTTE le
leghe off-free-tier in un solo passaggio, scaricando da sé le sorgenti.

PERCHÉ ESISTE. Lo snapshot è la META' storica del modello Poisson delle leghe che
non stanno sul free tier di football-data.org (le 5 estive + Serie B + le
euro-minors + Belgio): il route lo legge a ogni ciclo e ci costruisce sopra il
modello. Fino a oggi lo si rigenerava con QUATTRO script diversi
(am-lab/gen_summer_history.py, gen_euro_minors_history.py, gen_batch2_history.py
e le loro copie in scripts/gen_summer_league_history.py,
scripts/gen_serie_b_history.py), ognuno con path hardcoded sulla macchina di
Michele, ognuno che scriveva o mergiava lo stesso file in un ordine preciso, e
tutti che leggevano CSV scaricati A MANO in am-lab/summer_*.csv.

Risultato misurato il 2026-08-01: lo snapshot in main era stato rigenerato il
27/07 ma i CSV locali si fermavano al 17/05/2026, quindi il modello NON aveva
nemmeno una partita di giugno-luglio 2026 per NESSUNA lega — comprese le cinque
estive, che a giugno-luglio sono in pieno campionato — e le neopromosse della
stagione nuova non esistevano nel roster, quindi le loro partite venivano
SALTATE dal gate fail-closed (mai indovinate: giusto, ma invisibili).

COSA FA, in un passaggio unico:
  1. scarica le sorgenti (football-data.co.uk "new leagues" per i 9 paesi in quel
     formato, mmz4281 via core/football_data_uk per Serie B e Belgio);
  2. tiene gli ultimi 365 giorni (stessa finestra mobile di prima);
  3. rimappa i nomi squadra sui displayName ESPN con la STESSA logica dei
     generatori precedenti (norm → esatto → contenimento → SequenceMatcher a
     0.72, stessi alias manuali): nessun drift sui nomi già in produzione;
  4. scrive il file completo, e stampa il diff rispetto allo snapshot precedente
     (squadre entrate/uscite, partite aggiunte per lega).

FAIL-CLOSED SULLE SORGENTI: se una sorgente non risponde o torna zero partite,
il blocco di quella lega NON viene sovrascritto — si tiene quello precedente e
lo si segnala. Un download andato male non deve mai degradare il board (era il
buco di gen_summer_history.py, che riscriveva il file da zero).

Run (dalla radice del repo, nessun path da modificare):
    PYTHONUTF8=1 python scripts/refresh_history_snapshot.py [--out <altro-repo>]

Cadenza: SETTIMANALE. Il modello pesa 0.3 nel blend servito (0.7 è mercato), ma
un modello fermo a due mesi prima è comunque un modello sbagliato, e le
neopromosse restano invisibili finché non passa un refresh.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import unicodedata
import urllib.request
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

FD_NEW = "https://www.football-data.co.uk/new/{cc}.csv"
WINDOW_DAYS = 365
FUZZY_MIN = 0.72  # soglia identica ai generatori precedenti
STOP = {"fc", "if", "ik", "bk", "afc", "sk", "fk", "ff", "aif", "cf", "sc", "club", "cd"}

# Formato "new leagues" (colonne Country,League,Season,Date,Time,Home,Away,HG,AG).
# code interno -> (codice paese football-data, slug ESPN o None se ESPN non copre)
NEW_LEAGUES: dict[str, tuple[str, str | None]] = {
    "ELI": ("NOR", "nor.1"),
    "ALL": ("SWE", "swe.1"),
    "VEI": ("FIN", "fin.1"),  # ESPN fin.1 è vuoto per le fixture, ma i nomi /teams ci sono
    "LOI": ("IRL", "irl.1"),
    "CSL": ("CHN", "chn.1"),
    "AUT": ("AUT", "aut.1"),
    "DNK": ("DNK", "den.1"),
    "POL": ("POL", None),  # ESPN non ha l'Ekstraklasa: si tengono i nomi CSV
    "SWZ": ("SWZ", "sui.1"),
}

# Formato PRINCIPALE mmz4281 (HomeTeam/AwayTeam/FTHG/FTAG) via core/football_data_uk.
# code interno -> (divisione football-data, slug ESPN)
MMZ_LEAGUES: dict[str, tuple[str, str]] = {
    "SB": ("I2", "ita.2"),
    "BEL": ("B1", "bel.1"),
}

# Alias manuali dove il fuzzy non può arrivare (ø/ł non decomponibili da NFKD, o
# nomi proprio diversi). Ripresi verbatim dai generatori precedenti.
ALIASES: dict[str, dict[str, str]] = {
    "DNK": {
        "FC Copenhagen": "F.C. København",
        "Aarhus": "AGF",
        "Sonderjyske": "Sønderjyske Fodbold",
    },
    "BEL": {"Oud-Heverlee Leuven": "OH Leuven"},
    # #HISTORY-REFRESH-0801: "HamKam" (nome football-data) e "Hamarkameratene"
    # (displayName ESPN, cioè il nome che arriva nelle fixture) non condividono
    # abbastanza token per il fuzzy a 0.72 → la squadra restava fuori dal roster
    # del modello e OGNI sua partita veniva saltata dal gate fail-closed, per
    # tutta la stagione. Verificato sul roster ESPN nor.1 del 2026-08-01.
    "ELI": {"HamKam": "Hamarkameratene"},
}

# Sotto questa soglia la risposta di ESPN /teams è considerata NON attendibile
# (endpoint vuoto o parziale) e il vocabolario di remap ricade sui nomi dello
# snapshot precedente invece che sui nomi sorgente. Vedi make_mapper.
ESPN_MIN_TEAMS = 8


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(w for w in s.lower().replace("/", " ").replace("-", " ").split() if w not in STOP)


def espn_teams(slug: str) -> list[str]:
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=25) as r:  # noqa: S310 (host fidato)
        data = json.load(r)
    out: list[str] = []
    for lg in data.get("sports", [{}])[0].get("leagues", []):
        for t in lg.get("teams", []):
            dn = t.get("team", {}).get("displayName")
            if dn:
                out.append(dn)
    return out


def make_mapper(code: str, slug: str | None, prev_names: set[str]):
    """Nome sorgente -> displayName ESPN. Identico ai generatori precedenti:
    esatto, poi contenimento, poi fuzzy >= 0.72; sotto soglia si TIENE il nome
    sorgente e si segnala (mai indovinare).

    GUARD (#HISTORY-REFRESH-0801): ESPN /teams a volte torna VUOTO — misurato il
    2026-08-01 su fin.1 e irl.1, mentre il 27/07 irl.1 rispondeva. Con la sola
    logica di prima il refresh sarebbe ricaduto sui nomi sorgente e avrebbe
    RINOMINATO squadre già in produzione ("Drogheda United" → "Drogheda"),
    rompendo il match con le fixture: una regressione silenziosa peggiore dello
    snapshot stantìo. Se ESPN non è attendibile si usa come vocabolario il
    roster dello snapshot PRECEDENTE, che è già in nomi ESPN → continuità
    garantita, e lo si dice a voce alta."""
    # Nessuno slug ESPN (Ekstraklasa): i nomi restano quelli della sorgente, come
    # nei generatori precedenti. Il match con le fixture lo fa matchModelTeam a
    # serve-time, coi suoi vincoli fail-closed.
    if not slug:
        return (lambda name: (name, True)), "nomi sorgente (nessuno slug ESPN)"

    names: list[str] = []
    try:
        names = espn_teams(slug)
    except Exception as e:  # noqa: BLE001
        print(f"     ! {code}: ESPN {slug} non raggiungibile ({type(e).__name__})")
    origin = f"ESPN {slug} ({len(names)} squadre)"
    # MODO DEGRADATO: ESPN non attendibile. Si usa il roster dello snapshot
    # precedente SOLO per non rinominare ciò che è già in produzione, e solo per
    # corrispondenza normalizzata ESATTA. Niente contenimento né fuzzy: in modo
    # degradato "Wisla" verrebbe agganciata a "Wisla Plock" e una neopromossa
    # finirebbe nello storico di un'ALTRA squadra — la stessa classe di bug del
    # matcher chiusa il 27/07 (#TEAM-MATCH-SAFETY-0727), qui a monte. Un nome
    # nuovo resta il nome sorgente: fail-closed.
    strict = len(names) < ESPN_MIN_TEAMS
    if strict:
        if not prev_names:
            print(f"     ! {code}: ESPN vuoto e nessuno snapshot precedente → nomi sorgente")
            return (lambda name: (name, True)), "nomi sorgente (fallback)"
        print(f"     ! {code}: ESPN {slug} ha reso {len(names)} squadre (<{ESPN_MIN_TEAMS}) → "
              f"modo degradato: solo match esatti sui {len(prev_names)} nomi dello snapshot precedente")
        names = sorted(prev_names)
        origin = "snapshot precedente (match esatti)"
    espn_norm = {norm(n): n for n in names}

    def mapper(name: str) -> tuple[str, bool]:
        n = norm(name)
        if n in espn_norm:
            return espn_norm[n], True
        if strict:
            return name, False
        for en, orig in espn_norm.items():
            if n and (n in en or en in n):
                return orig, True
        best, score = None, 0.0
        for en, orig in espn_norm.items():
            r = SequenceMatcher(None, n, en).ratio()
            if r > score:
                best, score = orig, r
        if best and score >= FUZZY_MIN:
            return best, True
        return name, False

    return mapper, origin


def parse_date(s: str) -> date | None:
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None


def fetch_new_league(cc: str) -> list[dict]:
    url = FD_NEW.format(cc=cc)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=45) as r:  # noqa: S310 (host fidato)
        text = r.read().decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


def collect_new_league(code: str, cc: str, slug: str | None, since: date,
                       prev_names: set[str]) -> tuple[list[dict], set[str]]:
    rows = fetch_new_league(cc)
    mapper, _origin = make_mapper(code, slug, prev_names)
    al = ALIASES.get(code, {})
    matches: list[dict] = []
    unmatched: set[str] = set()
    for r in rows:
        d = parse_date(r.get("Date") or "")
        if d is None or d < since:
            continue
        try:
            hg, ag = int(float(r["HG"])), int(float(r["AG"]))
        except (KeyError, TypeError, ValueError):
            continue
        raw_h, raw_a = r["Home"].strip(), r["Away"].strip()
        h, hm = mapper(al.get(raw_h, raw_h))
        a, am = mapper(al.get(raw_a, raw_a))
        if not hm:
            unmatched.add(raw_h)
        if not am:
            unmatched.add(raw_a)
        matches.append({"homeTeam": h, "awayTeam": a, "homeGoals": hg, "awayGoals": ag, "date": str(d)})
    matches.sort(key=lambda m: m["date"])
    return matches, unmatched


def collect_mmz_league(code: str, div: str, slug: str, since: date,
                       prev_names: set[str]) -> tuple[list[dict], set[str]]:
    from core import football_data_uk as fd

    fd.DIVISION_MAP[code] = div
    mapper, _origin = make_mapper(code, slug, prev_names)
    al = ALIASES.get(code, {})
    matches: list[dict] = []
    unmatched: set[str] = set()
    # Due stagioni: quella in corso (spesso non ancora pubblicata a inizio agosto)
    # e la precedente, che da sola copre il resto della finestra dei 365 giorni.
    today = date.today()
    cur = today.year if today.month >= 7 else today.year - 1
    for yr in (cur - 1, cur):
        try:
            fdms = fd.parse_csv(fd.download_csv(code, yr), code)
        except Exception as e:  # noqa: BLE001
            print(f"  · {code} stagione {yr}/{yr + 1} non disponibile ({type(e).__name__}) — normale prima del via")
            continue
        for m in fdms:
            if m.date < since:
                continue
            h, hm = mapper(al.get(m.home_team, m.home_team))
            a, am = mapper(al.get(m.away_team, m.away_team))
            if not hm:
                unmatched.add(m.home_team)
            if not am:
                unmatched.add(m.away_team)
            matches.append({
                "homeTeam": h, "awayTeam": a,
                "homeGoals": m.home_goals, "awayGoals": m.away_goals,
                "date": str(m.date),
            })
    matches.sort(key=lambda m: m["date"])
    return matches, unmatched


def teams_of(block: dict) -> set[str]:
    return {t for m in block.get("matches", []) for t in (m["homeTeam"], m["awayTeam"])}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=REPO,
                    help="radice del repo/worktree su cui scrivere (default: quello dello script)")
    args = ap.parse_args()
    target = args.out / "data" / "summer_leagues" / "history.json"
    if not target.exists():
        print(f"ERRORE: {target} non esiste — --out deve puntare alla radice di un repo del prodotto")
        return 2

    since = date.today() - timedelta(days=WINDOW_DAYS)
    doc = json.loads(target.read_text(encoding="utf-8"))
    prev = doc.get("leagues", {})
    print(f"snapshot precedente: generated_at={doc.get('generated_at')} · leghe={len(prev)}")
    print(f"finestra: dal {since} a oggi\n")

    kept_stale: list[str] = []
    for code, (cc, slug) in NEW_LEAGUES.items():
        try:
            matches, unmatched = collect_new_league(code, cc, slug, since, teams_of(prev.get(code, {})))
        except Exception as e:  # noqa: BLE001
            print(f"{code}: SORGENTE NON RAGGIUNTA ({type(e).__name__}) — tengo il blocco precedente")
            kept_stale.append(code)
            continue
        if not matches:
            print(f"{code}: zero partite in finestra — tengo il blocco precedente (fail-closed)")
            kept_stale.append(code)
            continue
        report(code, prev.get(code, {}), matches, unmatched)
        doc["leagues"][code] = {"espn_slug": slug or "", "matches": matches}
        doc.setdefault("unmatched", {})[code] = sorted(unmatched)

    for code, (div, slug) in MMZ_LEAGUES.items():
        try:
            matches, unmatched = collect_mmz_league(code, div, slug, since, teams_of(prev.get(code, {})))
        except Exception as e:  # noqa: BLE001
            print(f"{code}: SORGENTE NON RAGGIUNTA ({type(e).__name__}) — tengo il blocco precedente")
            kept_stale.append(code)
            continue
        if not matches:
            print(f"{code}: zero partite in finestra — tengo il blocco precedente (fail-closed)")
            kept_stale.append(code)
            continue
        report(code, prev.get(code, {}), matches, unmatched)
        doc["leagues"][code] = {"espn_slug": slug, "matches": matches}
        doc.setdefault("unmatched", {})[code] = sorted(unmatched)

    doc["generated_at"] = str(date.today())
    doc["window_days"] = WINDOW_DAYS
    target.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nscritto {target} ({target.stat().st_size // 1024} KB, leghe: {sorted(doc['leagues'])})")
    if kept_stale:
        print(f"⚠ blocchi NON aggiornati (sorgente assente): {kept_stale} — riprovare al prossimo refresh")
    return 0


def report(code: str, before: dict, matches: list[dict], unmatched: set[str]) -> None:
    tb, ta = teams_of(before), {t for m in matches for t in (m["homeTeam"], m["awayTeam"])}
    last_before = max((m["date"] for m in before.get("matches", [])), default="—")
    line = (f"{code}: {len(matches)} match ({len(matches) - len(before.get('matches', [])):+d}) "
            f"· {matches[0]['date']} → {matches[-1]['date']} (prima finiva {last_before}) · squadre {len(ta)}")
    print(line)
    if ta - tb:
        print(f"     + entrate nel modello: {sorted(ta - tb)}")
    if tb - ta:
        print(f"     − uscite dalla finestra: {sorted(tb - ta)}")
    if unmatched:
        print(f"     ! nomi non mappati su ESPN (tenuti come da sorgente): {sorted(unmatched)}")


if __name__ == "__main__":
    raise SystemExit(main())
