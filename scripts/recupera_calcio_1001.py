"""#CALCIO-1001 — closes the sealed football picks left without a result.

NOT TO BE RUN with --apply without APPROVE from Andrea (prod write on
`pick_settlement`). Default is the dry-run: DB reads go through
tools/control_center/db.py::fetch_all (SET TRANSACTION READ ONLY); the only
network calls are public GETs to ESPN and football-data.org.

THE SET (measured 01/10): sealed football picks (`pick_ledger`, kickoff > 6h
ago) whose current settlement is `unresolved` or that have no settlement row.

WHERE EACH RESULT COMES FROM (every row declares it, in this order)
  servita        the served unified row is already closed with a score and,
                 for won/lost, verified (the b1 case of backfill_settle_1001)
  gemello        the SAME match served under another id (espn:/oddsapi:,
                 "Ajax Amsterdam"/"Ajax"), closed with a score
  espn-id        ESPN event by id (espn:<id>), month scoreboard or summary
  espn-data-nomi ESPN scoreboard of the kickoff month, matched on kickoff
                 (±20 min) AND one long name token per side, home with home —
                 the rule of lib/espn-results.ts::abbinaFinale; not exactly
                 one candidate = no match
  football-data  football-data.org match by numeric id
  All sources are read for every row; two scores that disagree, or a score
  against a postponement, leave the row unresolved ("conflitto").

GRADING: live (agents/result_settlement.py, core/supabase_client.py) grades
the SHOWN pick, unified_predictions.pick: 1X2 + home/draw/away -> won/lost; no
pick shown = under the floor -> void (#VOID-SENZA-PICK-0907). REGOLA 4, when
the register's sealed pick_ledger.pick differs: (4a) shown, not sealed ->
graded on the shown pick, correction_reason tagged "non-sigillata" (outside
the "sealed before kick-off" claim, countable); (4b) sealed, not shown ->
void, tagged "nessuna-pick-mostrata"; (4c) both, different -> NOT written,
"conflitto-sigillato-mostrato" (manual decision). Void for a match not played only on the source's own status:
ESPN STATUS_POSTPONED/STATUS_CANCELED, football-data POSTPONED/CANCELLED.
A 1X2 pick is graded on 90 minutes: only ESPN STATUS_FULL_TIME (or
football-data FINISHED with duration REGULAR) is a final; AET/PEN finals are
NOT graded ("supplementari: serve regola"). REGOLA 3 — same match (by id,
strong identity on both teams) played on another date: within 48h of the
sealed kickoff -> graded on it (90' rule); beyond 48h -> void, proof
"rinviata-oltre-48h:<date>" in correction_reason. Abandoned, still scheduled,
nothing found: NOT written, reported with the reason.

ORDER vs scripts/backfill_settle_1001.py: its b1 (football) is a no-op,
superseded by this script. If anything wrote the same (pick, revision) first,
--apply aborts and writes nothing.

SAFETY: INSERT only, ON CONFLICT (pick_settlement_pick_rev_key) DO NOTHING,
one transaction. A pick already closed `unresolved` gets revision current+1
(append-only correction, read through pick_settlement_current); a pick with
no row gets revision 1. is_backfill=TRUE, correction_reason starts with BATCH:
    DELETE FROM pick_settlement WHERE correction_reason LIKE 'recupero:CALCIO-1001%';
(UPDATE/DELETE are REVOKEd for the app roles: rollback runs as owner.)
unified_predictions is NOT touched (no UPDATE on existing rows): the served
rows stay 'unresolved' until a separate, gated step.

USAGE
  venv/bin/python -m scripts.recupera_calcio_1001             # dry-run
  venv/bin/python -m scripts.recupera_calcio_1001 --apply     # gated
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from scripts.backfill_sealed_orphans import _final_score_from_notes, outcome_from_score

BATCH = "recupero:CALCIO-1001"
GRACE = "6 hours"
TOLERANCE = timedelta(minutes=20)       # lib/espn-results.ts TOLLERANZA_MS
PLAYED_WITHIN = timedelta(hours=48)     # REGOLA 3: same match, moved up to 48h = graded on it
MIN_TOKEN = 4                           # lib/espn-results.ts MIN_TOKEN
ESPN_VOID = {"STATUS_POSTPONED", "STATUS_CANCELED"}
# A 1X2 pick is graded on 90 minutes. ESPN's score of an AET/PEN final
# includes extra time: not a 90' result, no rule yet -> never graded here.
ESPN_FULL_TIME = {"STATUS_FULL_TIME"}
ESPN_EXTRA_TIME = {"STATUS_FINAL_AET", "STATUS_FINAL_PEN"}
FD_VOID = {"POSTPONED", "CANCELLED"}
REPO = Path(__file__).resolve().parents[1]

# ── identity: Python port of lib/dedupe-fixtures.ts::tokenSquadra ───────────
_GENERIC = {
    "fc", "sc", "cf", "ac", "as", "sv", "tsv", "vfb", "vfl", "kv", "sk", "cs", "ad",
    "rc", "cd", "ud", "bsc", "ss", "ssc", "us", "sd", "afc", "fk", "nk", "hnk",
    "mfk", "ifk", "bk", "ofk", "rcd", "rkc", "pec",
    "kvc", "kaa", "krc", "kvk", "kfc", "rsc", "cfc", "acf", "fsv", "msv", "bc", "is",
}
_FOLD = [("ø", "o"), ("æ", "ae"), ("å", "a"), ("ß", "ss"), ("đ", "d"), ("ł", "l"),
         ("ð", "d"), ("þ", "th"), ("œ", "oe"), ("ħ", "h"), ("ı", "i")]


def _norm_name(name: str) -> str:  # lib/odds-api.ts::normName
    s = "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c))
    s = re.sub(r"\b(FC|CF|SC|AC|AS|SV|SS|US|SSC|AFC|Calcio)\b", "", s, flags=re.I)
    return re.sub(r"\s+", " ", s).strip().lower()


def token_squadra(name: str) -> list[str]:
    s = _norm_name(name or "")
    for a, b in _FOLD:
        s = s.replace(a, b)
    raw = re.sub(r"[^a-z0-9]+", " ", re.sub(r"['\u2019`]", "", s)).split()
    core = [t for t in raw if t not in _GENERIC]
    return core or raw


def _weak_identity(a: str, b: str) -> bool:
    """One long token in common (the abbinaFinale rule). NOT an identity:
    "Real Madrid"/"Real Betis" share "real". Used only to REPORT a doubt."""
    x = {t for t in token_squadra(a) if len(t) >= MIN_TOKEN}
    y = {t for t in token_squadra(b) if len(t) >= MIN_TOKEN}
    return bool(x & y)


def _strong_identity(a: str, b: str) -> bool:
    """Same team: one name's tokens fully contained in the other's ("Ajax" in
    "Ajax Amsterdam"), and the contained side carries a long token."""
    x, y = set(token_squadra(a)), set(token_squadra(b))
    small, big = (x, y) if len(x) <= len(y) else (y, x)
    return bool(small) and small <= big and any(len(t) >= MIN_TOKEN for t in small)


def _candidates(home: str, away: str, kickoff: datetime, cands: list[dict],
                same=_strong_identity) -> list[dict]:
    return [c for c in cands
            if c.get("kickoff") and abs(c["kickoff"] - kickoff) <= TOLERANCE
            and same(c["home"], home) and same(c["away"], away)]


def match_by_name(home: str, away: str, kickoff: datetime, cands: list[dict]) -> tuple[str, dict | None]:
    """('certo', hit) only for exactly one STRONG candidate, home with home.
    'ambigua' = several strong; 'debole' = only a shared-token look-alike."""
    hit = _candidates(home, away, kickoff, cands)
    if len(hit) == 1:
        return "certo", hit[0]
    if hit:
        return "ambigua", None
    if _candidates(home, away, kickoff, cands, same=_weak_identity):
        return "debole", None
    return "nessuno", None


def abbina(home: str, away: str, kickoff: datetime, cands: list[dict]) -> dict | None:
    """Exactly one candidate on kickoff (±20') with a strong identity per side."""
    return match_by_name(home, away, kickoff, cands)[1]


# ── sources ──────────────────────────────────────────────────────────────────

def espn_slugs() -> dict[str, str]:
    """League code -> ESPN slug, read from the TS maps (single source of truth:
    lib/summer-leagues.ts ESPN_SLUGS + lib/espn-results.ts ESPN_SLUG_BY_FD_LEAGUE),
    never copied here by hand."""
    out: dict[str, str] = {}
    for rel, const in (("lib/espn-results.ts", "ESPN_SLUG_BY_FD_LEAGUE"),
                       ("lib/summer-leagues.ts", "ESPN_SLUGS")):
        src = (REPO / rel).read_text()
        block = src.split(f"export const {const}", 1)[1].split("};", 1)[0]
        out.update(dict(re.findall(r'\b([A-Z0-9]+):\s*"([a-z]+\.[a-z0-9.]+)"', block)))
    return out


def _dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _goals(v) -> int | None:
    """A score only when it is a number: a missing score is never a 0."""
    if isinstance(v, dict):  # some summary payloads nest it
        v = v.get("value")
    m = re.fullmatch(r"(\d+)(\.0)?", str(v).strip()) if v is not None else None
    return int(m[1]) if m else None


def parse_espn_event(ev: dict) -> dict:
    st = ((ev.get("status") or {}).get("type") or {})
    comp = (ev.get("competitions") or [{}])[0]
    cs = comp.get("competitors") or []
    h = next((c for c in cs if c.get("homeAway") == "home"), {})
    a = next((c for c in cs if c.get("homeAway") == "away"), {})
    base = {"id": str(ev.get("id")), "kickoff": _dt(ev.get("date") or comp.get("date")),
            "home": (h.get("team") or {}).get("displayName", ""),
            "away": (a.get("team") or {}).get("displayName", ""),
            "status": str(st.get("name") or "")}
    hg, ag = _goals(h.get("score")), _goals(a.get("score"))
    if base["status"] in ESPN_EXTRA_TIME:
        return {**base, "kind": "supplementari"}
    if st.get("completed") and base["status"] in ESPN_FULL_TIME and hg is not None and ag is not None:
        return {**base, "kind": "final", "score": (hg, ag)}
    if base["status"] in ESPN_VOID:
        return {**base, "kind": "void"}
    return {**base, "kind": "pending"}


class Espn:
    def __init__(self, client):
        self.c = client
        self.months: dict[tuple[str, str], list[dict] | None] = {}
        self.calls = 0

    def month(self, slug: str, ym: str) -> list[dict] | None:
        key = (slug, ym)
        if key not in self.months:
            from core.espn_http import ESPN_HEADERS, ESPN_SITE_API  # noqa: PLC0415
            self.calls += 1
            r = self.c.get(f"{ESPN_SITE_API}/soccer/{slug}/scoreboard",
                           params={"dates": ym, "limit": 500}, headers=ESPN_HEADERS)
            self.months[key] = ([parse_espn_event(e) for e in r.json().get("events", [])]
                                if r.status_code == 200 else None)
            time.sleep(0.15)
        return self.months[key]

    def around(self, slug: str, kickoff: datetime) -> list[dict] | None:
        yms = sorted({(kickoff + d).strftime("%Y%m") for d in (timedelta(days=-1), timedelta(), timedelta(days=1))})
        evs = [self.month(slug, ym) for ym in yms]
        if all(e is None for e in evs):
            return None
        return [e for es in evs if es for e in es]

    def summary(self, slug: str, eid: str) -> dict | None:
        from core.espn_http import ESPN_HEADERS, ESPN_SITE_API  # noqa: PLC0415
        self.calls += 1
        r = self.c.get(f"{ESPN_SITE_API}/soccer/{slug}/summary", params={"event": eid},
                       headers=ESPN_HEADERS)
        time.sleep(0.15)
        if r.status_code != 200:
            return None
        comp = ((r.json().get("header") or {}).get("competitions") or [{}])[0]
        return parse_espn_event({"id": eid, "date": comp.get("date"), "status": comp.get("status"),
                                 "competitions": [comp]})


def fd_match(client, mid: str) -> dict | None:
    key = os.environ.get("FOOTBALL_DATA_ORG_API_KEY")
    if not key:
        from tools.control_center.db import load_env  # noqa: PLC0415
        key = load_env().get("FOOTBALL_DATA_ORG_API_KEY")
    if not key:
        return None
    for attempt in range(2):
        r = client.get(f"https://api.football-data.org/v4/matches/{mid}", headers={"X-Auth-Token": key})
        time.sleep(6.5)  # free tier: 10 requests/minute
        if r.status_code != 429:
            break
        if attempt == 0:
            time.sleep(61)  # rate-limit window
    if r.status_code != 200:
        # declared, never read as "nothing found"
        return {"kickoff": None, "status": f"fd-http-{r.status_code}", "kind": "errore-fonte"}
    m = r.json()
    ft = ((m.get("score") or {}).get("fullTime") or {})
    base = {"kickoff": _dt(m.get("utcDate")), "status": str(m.get("status") or ""),
            "home": (m.get("homeTeam") or {}).get("name", ""),
            "away": (m.get("awayTeam") or {}).get("name", "")}
    if base["status"] == "FINISHED" and (m.get("score") or {}).get("duration") not in (None, "REGULAR"):
        return {**base, "kind": "supplementari"}  # fullTime includes extra time
    if base["status"] == "FINISHED" and isinstance(ft.get("home"), int) and isinstance(ft.get("away"), int):
        return {**base, "kind": "final", "score": (ft["home"], ft["away"])}
    if base["status"] in FD_VOID:
        return {**base, "kind": "void"}
    return {**base, "kind": "pending"}


# ── decision ─────────────────────────────────────────────────────────────────

@dataclass
class Evidence:
    source: str
    kind: str                       # final | void | pending | supplementari | ambigua | debole | errore-fonte
    score: tuple[int, int] | None = None
    status: str | None = None
    detail: str | None = None       # the source's own names + kickoff (name matches)
    rule: str | None = None         # regola3-entro-48h | regola3-oltre-48h
    played: str | None = None       # REGOLA 3: the source's (new) kickoff


def grade(sealed_pick: str | None, market: str | None, hg: int, ag: int) -> str:
    pick = str(sealed_pick or "").strip().lower()
    if (market or "1X2") != "1X2" or pick not in ("home", "draw", "away"):
        return "void"
    actual = "draw" if hg == ag else ("home" if hg > ag else "away")
    return "won" if pick == actual else "lost"


_SAME = object()


def _pick(p) -> str | None:
    p = str(p or "").strip().lower()
    return p if p in ("home", "draw", "away") else None


def pick_case(sealed_pick, shown_pick) -> str | None:
    """REGOLA 4. 4a shown without sealed; 4b sealed without shown; 4c both,
    different; None when they agree (or both empty)."""
    a, b = _pick(sealed_pick), _pick(shown_pick)
    if a == b:
        return None
    if a is None:
        return "4a"
    if b is None:
        return "4b"
    return "4c"


def decide(sealed_pick, market, evs: list[Evidence], shown_pick=_SAME) -> dict:
    """shown_pick = unified_predictions.pick, what live grades on
    (agents/result_settlement.py); default: same as the sealed one."""
    if shown_pick is _SAME:
        shown_pick = sealed_pick
    out = {"result": None, "outcome": None, "final_score": None, "fonte": None,
           "conferme": [], "prova": None, "motivo": None, "pick_case": None}
    finals = [e for e in evs if e.kind == "final"]
    voids = [e for e in evs if e.kind == "void"]
    extra = sorted({e.status or "?" for e in evs if e.kind == "supplementari"})
    if extra:  # any score of that match may include extra time
        return {**out, "motivo": f"supplementari: serve regola ({', '.join(extra)})"}
    if finals:
        if len({e.score for e in finals}) > 1 or voids:
            seen = ", ".join(f"{e.source}={e.score or e.status}" for e in finals + voids)
            return {**out, "motivo": f"conflitto fra fonti ({seen})"}
        hg, ag = finals[0].score
        fs = f"{hg}-{ag}"
        case = pick_case(sealed_pick, shown_pick)
        if case == "4c":
            return {**out, "final_score": fs, "motivo": (
                f"conflitto-sigillato-mostrato: sigillato {sealed_pick}, mostrato {shown_pick}"
                " (decisione manuale)")}
        return {**out, "result": grade(shown_pick, market, hg, ag), "pick_case": case,
                "final_score": fs,
                "outcome": outcome_from_score(fs), "fonte": finals[0].source,
                "conferme": [e.source for e in finals[1:]]}
    if voids:
        return {**out, "result": "void", "fonte": voids[0].source, "prova": voids[0].status,
                "conferme": [e.source for e in voids[1:]]}
    if any(e.kind == "errore-fonte" for e in evs):
        st = sorted({e.status or "?" for e in evs if e.kind == "errore-fonte"})
        motivo = f"fonte non raggiungibile ({', '.join(st)}): rilanciare"
    elif any(e.kind == "pending" for e in evs):
        st = sorted({e.status or "?" for e in evs if e.kind == "pending"})
        motivo = f"non conclusa secondo la fonte ({', '.join(st)})"
    elif any(e.kind == "ambigua" for e in evs):
        motivo = "abbinamento ambiguo"
    elif any(e.kind == "debole" for e in evs):
        motivo = "abbinamento per nome debole (un solo token in comune)"
    else:
        motivo = "nessuna fonte"
    return {**out, "motivo": motivo}


def settlement_row(source_id: str, current_rev: int | None, d: dict) -> dict | None:
    if d["result"] is None:
        return None
    reason = f"{BATCH} fonte={d['fonte']}"
    if d["prova"]:
        reason += f" prova={d['prova']}"
    if d.get("pick_case") == "4a":
        reason += " non-sigillata"  # graded on a pick the register never sealed
    elif d.get("pick_case") == "4b":
        reason += " nessuna-pick-mostrata"
    return {"source_table": "match_predictions", "source_id": source_id,
            "model_version": "football-v4-xg-model", "result": d["result"],
            "outcome": d["outcome"], "final_score": d["final_score"],
            "settlement_revision": (current_rev or 0) + 1, "correction_reason": reason}


# ── IO ───────────────────────────────────────────────────────────────────────

_IRR_SQL = f"""
select l.source_id, l.league, l.home_team, l.away_team, l.commence_time, l.pick, l.market,
       s.result, s.settlement_revision, u.result, u.verification_state, u.notes, u.pick
from pick_ledger l
left join pick_settlement_current s using (source_table, source_id, model_version)
left join unified_predictions u on u.sport = 'football' and u.external_event_id = l.source_id
where l.source_table = 'match_predictions' and l.model_version = 'football-v4-xg-model'
  and l.commence_time < now() - interval '{GRACE}'
  and (s.id is null or s.result = 'unresolved')
order by l.commence_time
"""

_TWIN_SQL = """
select external_event_id, league, home_team, away_team, starts_at, result, notes
from unified_predictions
where sport = 'football' and result in ('won', 'lost', 'void')
  and notes like '%%final_score%%' and starts_at between %s and %s
"""


def _score(fs: str | None) -> tuple[int, int] | None:
    m = re.fullmatch(r"\s*(\d+)\s*-\s*(\d+)\s*", fs or "")
    return (int(m[1]), int(m[2])) if m else None


def id_evidence(source: str, e: dict, home: str, away: str, ko: datetime) -> Evidence:
    """Evidence from a source found BY ID. REGOLA 3 (symmetric to tennis): if
    the match was moved, it must be the same match by strong identity on both
    teams; played within 48h of the sealed kickoff -> graded on it (90' rule
    unchanged); beyond 48h -> void, the played/new date is the proof."""
    moved = e.get("kickoff") is not None and abs(e["kickoff"] - ko) > TOLERANCE
    if not moved:
        return Evidence(source, e["kind"], e.get("score"), e["status"])
    if e.get("home") and e.get("away") and not (
            _strong_identity(e["home"], home) and _strong_identity(e["away"], away)):
        return Evidence(source, "debole", detail=_detail(e))
    if abs(e["kickoff"] - ko) > PLAYED_WITHIN:
        return Evidence(source, "void", status=f"rinviata-oltre-48h:{e['kickoff'].date()}",
                        rule="regola3-oltre-48h", played=e["kickoff"].isoformat()[:16])
    return Evidence(source, e["kind"], e.get("score"), e["status"], rule="regola3-entro-48h",
                    played=e["kickoff"].isoformat()[:16])


def _detail(c: dict) -> str:
    return f"{c['home']} - {c['away']} @ {c['kickoff'].isoformat()[:16]}"


def gather(rows, twins, espn: Espn | None, fd_client, slugs) -> list[dict]:
    twin_c = [{"key": t[0], "league": t[1], "home": t[2], "away": t[3], "kickoff": t[4],
               "score": _score(_final_score_from_notes(t[6]))} for t in twins]
    twin_c = [t for t in twin_c if t["score"]]
    out = []
    for (sid, league, home, away, ko, pick, market, sres, srev, ures, uver, unotes, upick) in rows:
        evs: list[Evidence] = []
        # servita
        sc = _score(_final_score_from_notes(unotes))
        if sc and (ures == "void" or (ures in ("won", "lost") and uver == "verified")):
            evs.append(Evidence("servita", "final", sc))
        # gemello
        cands = [t for t in twin_c if t["key"] != sid and t["league"] == league]
        kind, hit = match_by_name(home, away, ko, cands)
        if hit:
            evs.append(Evidence("gemello", "final", hit["score"], detail=_detail(hit)))
        elif kind != "nessuno":
            evs.append(Evidence("gemello", kind))
        slug = slugs.get(league)
        if espn and slug:
            month_evs = espn.around(slug, ko) or []
            if sid.startswith("espn:"):
                eid = sid.removeprefix("espn:")
                e = next((x for x in month_evs if x["id"] == eid), None) or espn.summary(slug, eid)
                if e:
                    evs.append(id_evidence("espn-id", e, home, away, ko))
            else:
                kind, m = match_by_name(home, away, ko, month_evs)
                if m:
                    evs.append(Evidence("espn-data-nomi", m["kind"], m.get("score"), m["status"],
                                        detail=_detail(m)))
                elif kind != "nessuno":
                    evs.append(Evidence("espn-data-nomi", kind))
        if fd_client and sid.isdigit() and sres == "unresolved":
            f = fd_match(fd_client, sid)
            if f:
                evs.append(id_evidence("football-data", f, home, away, ko))
        d = decide(pick, market, evs, shown_pick=upick)
        out.append({"source_id": sid, "league": league, "match": f"{home} - {away}",
                    "kickoff": ko.isoformat(), "pick": pick, "pick_mostrato": upick, "stato_prima": sres or "NOSET",
                    "rev": srev, "decisione": d,
                    "regola3": [{"fonte": e.source, "regola": e.rule, "giocata": e.played,
                                 "esito_fonte": e.score or e.status}
                                for e in evs if e.rule],
                    "per_nome": [{"fonte": e.source, "fonte_nomi": e.detail,
                                  "punteggio": e.score, "stato": e.status}
                                 for e in evs if e.detail], "row": settlement_row(sid, srev, d),
                    "no_slug": slug is None})
    return out


def _apply(rows: list[dict]) -> int:
    import psycopg2  # noqa: PLC0415
    from tools.control_center.db import _dsn  # noqa: PLC0415

    sql = (
        "insert into pick_settlement (source_table, source_id, model_version, result,"
        " outcome, final_score, closing_odds, is_backfill, settlement_revision, correction_reason)"
        " values (%(source_table)s, %(source_id)s, %(model_version)s, %(result)s,"
        " %(outcome)s, %(final_score)s, null, true, %(settlement_revision)s, %(correction_reason)s)"
        " on conflict (source_table, source_id, model_version, settlement_revision) do nothing"
    )
    written = 0
    with psycopg2.connect(_dsn(), connect_timeout=8) as conn:  # one transaction
        with conn.cursor() as cur:
            for r in rows:
                cur.execute(sql, r)
                written += cur.rowcount
            # A skipped row means someone wrote that (pick, revision) first —
            # e.g. b1 of backfill_settle_1001. Never a silent partial batch:
            # the exception rolls the whole transaction back.
            if written != len(rows):
                raise RuntimeError(f"aborted: only {written} of {len(rows)} rows would be written;"
                                   " another writer holds the rest. Nothing written.")
    return written


def report(out: list[dict]) -> None:
    by_src, by_res, left = Counter(), Counter(), Counter()
    for o in out:
        d = o["decisione"]
        if d["result"]:
            by_src[d["fonte"]] += 1
            by_res[f"{o['stato_prima']}->{d['result']}"] += 1
        else:
            left[d["motivo"] + (" [lega senza slug ESPN]" if o["no_slug"] else "")] += 1
    print("ABBINAMENTI PER NOME (pick vs fonte) — da guardare:")
    for o in out:
        for m in o["per_nome"]:
            used = "USATO" if o["decisione"]["fonte"] == m["fonte"] else "conferma"
            print(f"  {o['kickoff'][:16]} {o['league']:5s} {o['match']}  <=>  {m['fonte_nomi']}"
                  f"  [{m['fonte']}, {m['punteggio'] or m['stato']}, {used}]")
    print("REGOLA 4 per sotto-caso:", dict(Counter(
        (o["decisione"]["pick_case"] or ("4c" if (o["decisione"]["motivo"] or "").startswith("conflitto-sigillato")
                                         else "-")) + (":scritta" if o["row"] else ":non scritta")
        for o in out).most_common()))
    for o in out:
        if (o["decisione"]["motivo"] or "").startswith("conflitto-sigillato"):
            print(f"  4c {o['kickoff'][:16]} {o['league']:5s} {o['match']} sigillato={o['pick']}"
                  f" mostrato={o['pick_mostrato']} punteggio={o['decisione']['final_score']}")
    print("REGOLA 3 (partita spostata di data): sigillata | giocata/nuova | regola | fonte -> esito")
    for o in out:
        for r in o["regola3"]:
            print(f"  {o['kickoff'][:16]} {o['league']:5s} {o['match']} | {r['giocata']} {r['esito_fonte']}"
                  f" | {r['regola']}"
                  f" | {r['fonte']} -> {o['decisione']['result'] or o['decisione']['motivo']}")
    conf = Counter(c for o in out for c in o["decisione"]["conferme"])
    print(f"irrisolti sigillati letti: {len(out)}")
    div = Counter(("sigillato" if o["pick"] else "-") + "/" + ("mostrato" if o["pick_mostrato"] else "-")
                  + ("" if (o["pick"] or "").upper() == (o["pick_mostrato"] or "").upper()
                     or not (o["pick"] and o["pick_mostrato"]) else " DIVERSI")
                  for o in out)
    print("pick sigillato/mostrato (valorizzato o null):", dict(div.most_common()))
    print("per fonte:", dict(by_src.most_common()))
    print("confermati anche da:", dict(conf.most_common()))
    print("per esito:", dict(sorted(by_res.items())))
    print("restano irrisolti:", dict(left.most_common()))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="#CALCIO-1001 (gated)")
    ap.add_argument("--apply", action="store_true", help="WRITE to prod (needs APPROVE)")
    ap.add_argument("--no-network", action="store_true", help="internal sources only")
    ap.add_argument("--dump", help="write every row's decision to this JSON file")
    a = ap.parse_args(argv)

    import httpx  # noqa: PLC0415
    from tools.control_center.db import fetch_all  # read-only transaction

    rows = fetch_all(_IRR_SQL)
    lo = min(r[4] for r in rows) - timedelta(days=2)
    hi = max(r[4] for r in rows) + timedelta(days=2)
    twins = fetch_all(_TWIN_SQL, (lo, hi))
    with httpx.Client(timeout=15.0) as c:
        espn = None if a.no_network else Espn(c)
        out = gather(rows, twins, espn, None if a.no_network else c, espn_slugs())
    report(out)
    if espn:
        print(f"chiamate ESPN: {espn.calls}")
    to_write = [o["row"] for o in out if o["row"]]
    print(f"righe da scrivere: {len(to_write)}  (marcatura {BATCH!r})")
    if a.dump:
        Path(a.dump).write_text(json.dumps(out, default=str, indent=1, ensure_ascii=False))
    if not a.apply:
        print("DRY-RUN: nulla scritto. --apply richiede APPROVE.")
        return 0
    n = _apply(to_write)
    print(f"scritte {n} righe")
    return 0


if __name__ == "__main__":
    sys.exit(main())
