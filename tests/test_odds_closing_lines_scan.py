"""Closing-line marking must not scan the whole odds_snapshots table (#CLOSING-LINES-SCAN-0828).

Measured against production on 2026-08-28: `odds_snapshots` is 23.1M rows / 9.0 GB,
and the only index covering `commence_time` is PARTIAL —
`idx_odds_snapshots_commence (commence_time) WHERE is_closing = false`.

Two independent defects had killed `mark_closing_lines()`:
  (a) the query did not filter `is_closing`, so it could not use that partial index
      and seq-scanned 23M rows -> Supabase statement timeout 57014, reproduced even
      on a one-hour window;
  (b) PostgREST caps responses at 1000 rows whatever `limit` asks for, so the single
      `limit=10000` request was silently truncated to the newest sliver of the window
      even back when it did complete.
Consequence in production: the last closing line was marked on 2026-06-27 — the
function had been dead for two months in total silence, because every failure in it
is fail-soft by contract.

These tests pin the properties that, if broken, bring either defect back.
"""
from datetime import datetime, timedelta, timezone

import pytest

import core.odds_api_client as oac


def _params_to_dict(params):
    """PostgREST repeats keys (ANDed ranges); keep every value per key."""
    out: dict[str, list[str]] = {}
    for k, v in params:
        out.setdefault(k, []).append(v)
    return out


class _Recorder:
    """Fake httpx.AsyncClient recording every GET/PATCH and replaying canned pages."""

    def __init__(self, pages, closed_rows=None, get_status=200, patch_status=204):
        # pages: list of row-lists, handed out in order to the CANDIDATE queries
        self.pages = list(pages)
        self.closed_rows = closed_rows or []
        self.get_status = get_status
        self.patch_status = patch_status
        self.gets: list[dict] = []
        self.patches: list[dict] = []

    def install(self, monkeypatch):
        rec = self

        class FakeResp:
            def __init__(self, payload, status):
                self._payload = payload
                self.status_code = status

            def json(self):
                return self._payload

        class FakeClient:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def get(self, url, params=None, **k):
                p = _params_to_dict(params or [])
                rec.gets.append(p)
                if p.get("is_closing") == ["eq.true"]:
                    return FakeResp(rec.closed_rows, rec.get_status)
                payload = rec.pages.pop(0) if rec.pages else []
                return FakeResp(payload, rec.get_status)

            async def patch(self, url, params=None, json=None, **k):
                rec.patches.append({"params": dict(params or {}), "json": json})
                return FakeResp({}, rec.patch_status)

        monkeypatch.setattr(oac.settings, "SUPABASE_URL", "https://x.supabase.co")
        monkeypatch.setattr(oac.settings, "SUPABASE_SERVICE_ROLE_KEY", "svc-key")
        monkeypatch.setattr(oac.httpx, "AsyncClient", FakeClient)
        return self

    @property
    def candidate_gets(self):
        return [g for g in self.gets if g.get("is_closing") == ["eq.false"]]


def _row(mid, cap_iso):
    return {"match_id": mid, "captured_at": cap_iso}


def _iso(dt):
    return dt.isoformat()


NOW = datetime.now(timezone.utc)


# ── (a) the index path ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_every_candidate_query_filters_is_closing_false(monkeypatch):
    """Without `is_closing = false` the partial index is unusable and the query
    seq-scans 23M rows into a statement timeout. This is the whole fix."""
    rec = _Recorder(pages=[[]]).install(monkeypatch)
    await oac.mark_closing_lines(lookback_hours=6)
    assert rec.candidate_gets, "nessuna query candidati eseguita"
    for g in rec.candidate_gets:
        assert g["is_closing"] == ["eq.false"], (
            "una query sui candidati senza is_closing=eq.false: torna il seq scan"
        )


@pytest.mark.asyncio
async def test_no_query_orders_by_captured_at(monkeypatch):
    """`ORDER BY captured_at DESC` over the window sorts ~213k rows and times out
    regardless of the predicate. The latest capture is computed in Python instead."""
    rec = _Recorder(pages=[[]]).install(monkeypatch)
    await oac.mark_closing_lines(lookback_hours=6)
    for g in rec.gets:
        for order in g.get("order", []):
            assert "captured_at" not in order, f"ordinamento server-side su captured_at: {order}"


@pytest.mark.asyncio
async def test_candidate_queries_are_windowed_not_open_ended(monkeypatch):
    """Each request must carry BOTH range bounds: an open-ended commence_time
    filter walks the whole table however good the index is."""
    rec = _Recorder(pages=[[]]).install(monkeypatch)
    await oac.mark_closing_lines(lookback_hours=6)
    for g in rec.candidate_gets:
        bounds = g.get("commence_time", [])
        assert any(b.startswith("gte.") for b in bounds), f"manca il bound inferiore: {bounds}"
        assert any(b.startswith("lt.") for b in bounds), f"manca il bound superiore: {bounds}"


# ── (b) the 1000-row cap ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_full_page_triggers_pagination(monkeypatch):
    """PostgREST returns at most 1000 rows whatever `limit` says. A full page means
    'there is more' — stopping there is exactly the silent truncation that made the
    old single request useless."""
    base = NOW - timedelta(hours=2)
    full = [_row(f"m{i}", _iso(base)) for i in range(oac.CLOSING_PAGE_SIZE)]
    tail = [_row("m-tail", _iso(base))]
    rec = _Recorder(pages=[full, tail]).install(monkeypatch)
    await oac.mark_closing_lines(lookback_hours=3)
    offsets = [g.get("offset", ["0"])[0] for g in rec.candidate_gets]
    assert len(rec.candidate_gets) >= 2, "pagina piena e nessuna richiesta successiva"
    assert str(oac.CLOSING_PAGE_SIZE) in offsets, f"offset della 2a pagina assente: {offsets}"
    assert any(p["params"]["match_id"] == "eq.m-tail" for p in rec.patches), (
        "il match della seconda pagina non e' stato marcato: troncamento silenzioso"
    )


@pytest.mark.asyncio
async def test_short_page_stops_pagination(monkeypatch):
    """A page shorter than the cap means the slice is exhausted: no pointless extra
    round-trip against a 9 GB table."""
    base = NOW - timedelta(hours=2)
    rec = _Recorder(pages=[[_row("m1", _iso(base))]]).install(monkeypatch)
    await oac.mark_closing_lines(lookback_hours=3)
    assert len(rec.candidate_gets) == 1, "pagina corta ma la paginazione e' continuata"


# ── correctness the server-side sort used to provide ──────────────────────────

@pytest.mark.asyncio
async def test_latest_capture_wins_across_pages(monkeypatch):
    """Rows no longer arrive captured_at DESC, so `setdefault` (the old logic) would
    now pin the FIRST capture seen. The closing line is the LAST pre-kickoff batch:
    picking an earlier one silently corrupts the CLV reference."""
    base = NOW - timedelta(hours=2)
    older = base - timedelta(minutes=30)
    newer = base - timedelta(minutes=1)
    full = [_row("m1", _iso(older))] + [
        _row(f"pad{i}", _iso(older)) for i in range(oac.CLOSING_PAGE_SIZE - 1)
    ]
    tail = [_row("m1", _iso(newer))]
    rec = _Recorder(pages=[full, tail]).install(monkeypatch)
    await oac.mark_closing_lines(lookback_hours=3)
    m1 = [p for p in rec.patches if p["params"]["match_id"] == "eq.m1"]
    assert len(m1) == 1, f"m1 marcato {len(m1)} volte"
    assert m1[0]["params"]["captured_at"] == f"eq.{_iso(newer)}", (
        "marcata una cattura piu' vecchia: la closing line e' l'ULTIMA pre-kickoff"
    )


@pytest.mark.asyncio
async def test_already_marked_match_is_not_marked_again(monkeypatch):
    """Filtering `is_closing = false` hides the row that is already the closing line,
    so without the explicit already-closed lookup the match would get a SECOND one."""
    base = NOW - timedelta(hours=2)
    rec = _Recorder(
        pages=[[_row("m1", _iso(base)), _row("m2", _iso(base))]],
        closed_rows=[{"match_id": "m1"}],
    ).install(monkeypatch)
    marked = await oac.mark_closing_lines(lookback_hours=3)
    marked_ids = {p["params"]["match_id"] for p in rec.patches}
    assert "eq.m1" not in marked_ids, "match gia' chiuso ri-marcato: doppia closing line"
    assert marked_ids == {"eq.m2"}
    assert marked == 1


# ── bounded work, draining backlog, fail-soft ─────────────────────────────────

@pytest.mark.asyncio
async def test_page_budget_is_honoured(monkeypatch):
    """One run must never be able to run away against a 23M-row table."""
    base = NOW - timedelta(hours=2)
    full = [_row(f"m{i}", _iso(base)) for i in range(oac.CLOSING_PAGE_SIZE)]
    rec = _Recorder(pages=[list(full) for _ in range(50)]).install(monkeypatch)
    await oac.mark_closing_lines(lookback_hours=36, max_pages=5)
    assert len(rec.gets) <= 5, f"budget sforato: {len(rec.gets)} richieste"


@pytest.mark.asyncio
async def test_slices_are_walked_oldest_first(monkeypatch):
    """Oldest-first is what drains the backlog: a marked match keeps its other rows,
    so newest-first would spend the budget on the same recent slices every run."""
    rec = _Recorder(pages=[[] for _ in range(20)]).install(monkeypatch)
    await oac.mark_closing_lines(lookback_hours=12)
    lower = [
        g["commence_time"][0]
        for g in rec.candidate_gets
        if g.get("commence_time") and g["commence_time"][0].startswith("gte.")
    ]
    assert len(lower) >= 2, "meno di due slice: il test non misura nulla"
    assert lower == sorted(lower), f"slice non in ordine crescente di tempo: {lower}"


@pytest.mark.asyncio
async def test_slice_width_stays_within_the_statement_timeout(monkeypatch):
    """A 36h window times out; a 3h slice completes. Pin the width so nobody widens
    it back without re-measuring against production."""
    rec = _Recorder(pages=[[] for _ in range(20)]).install(monkeypatch)
    await oac.mark_closing_lines(lookback_hours=12)
    g = rec.candidate_gets[0]
    lo = datetime.fromisoformat(g["commence_time"][0][len("gte."):])
    hi = datetime.fromisoformat(g["commence_time"][1][len("lt."):])
    assert (hi - lo) <= timedelta(hours=oac.CLOSING_SLICE_HOURS)
    assert oac.CLOSING_SLICE_HOURS <= 6, "slice troppo larga: misurata in timeout a 36h"


@pytest.mark.asyncio
async def test_non_200_is_fail_soft(monkeypatch):
    """A DB refusal must return, not raise: this runs at the end of every collector
    cycle and an exception here would abort the cycle."""
    rec = _Recorder(pages=[[]], get_status=500).install(monkeypatch)
    assert await oac.mark_closing_lines(lookback_hours=6) == 0
    assert rec.patches == []


@pytest.mark.asyncio
async def test_no_credentials_is_a_noop(monkeypatch):
    monkeypatch.setattr(oac.settings, "SUPABASE_URL", "")
    monkeypatch.setattr(oac.settings, "SUPABASE_SERVICE_ROLE_KEY", "")
    assert await oac.mark_closing_lines() == 0
