import json
from datetime import date

import pytest

from scripts import refresh_history_snapshot as refresh


def match(day):
    return dict(homeTeam="A", awayTeam="B", homeGoals=1, awayGoals=0, date=day)


@pytest.mark.parametrize("failed", [[], ["BAD"], ["OK", "BAD"]])
def test_refresh_reports_each_league_and_preserves_failed_data(tmp_path, monkeypatch, failed):
    target = tmp_path / "data/summer_leagues/history.json"
    target.parent.mkdir(parents=True)
    old = {"matches": [match("2026-05-01")], "fetched_at": "2026-05-02T00:00:00+00:00"}
    target.write_text(json.dumps({"generated_at": "2026-05-02", "leagues": {"OK": old, "BAD": old}}), encoding="utf-8")
    monkeypatch.setattr(refresh, "NEW_LEAGUES", {"OK": ("AAA", None), "BAD": ("BBB", None)})
    monkeypatch.setattr(refresh, "MMZ_LEAGUES", {})
    monkeypatch.setattr("sys.argv", ["refresh", "--out", str(tmp_path)])

    def collect(code, *args):
        if code in failed:
            raise OSError("source unavailable")
        return [match("2026-09-20")], set()

    monkeypatch.setattr(refresh, "collect_new_league", collect)
    assert refresh.main() == (1 if failed else 0)
    assert b"\r\n" not in target.read_bytes(), "snapshot newlines must be portable LF"
    doc = json.loads(target.read_text(encoding="utf-8"))
    assert doc["refresh_status"] == ("failed" if len(failed) == 2 else "partial" if failed else "ok")
    assert doc["failed_leagues"] == failed
    assert doc["generated_at"] == ("2026-05-02" if failed else str(date.today()))
    for code, block in doc["leagues"].items():
        assert block["attempted_at"] == doc["refresh_attempted_at"]
        assert block["source"].startswith("https://www.football-data.co.uk/")
        if code in failed:
            assert block["matches"] == old["matches"]
            assert block["fetched_at"] == old["fetched_at"]
            assert block["last_match_at"] == "2026-05-01"
            assert block["refresh_status"] == "failed"
            assert block["refresh_error"]
        else:
            assert block["fetched_at"] == doc["refresh_attempted_at"]
            assert block["last_match_at"] == "2026-09-20"
            assert block["refresh_status"] == "ok"


def test_missing_league_and_empty_source_are_explicit_failure(tmp_path, monkeypatch):
    target = tmp_path / "data/summer_leagues/history.json"
    target.parent.mkdir(parents=True)
    target.write_text('{"leagues": {}}', encoding="utf-8")
    monkeypatch.setattr(refresh, "NEW_LEAGUES", {"NEW": ("AAA", None)})
    monkeypatch.setattr(refresh, "MMZ_LEAGUES", {})
    monkeypatch.setattr(refresh, "collect_new_league", lambda *args: ([], set()))
    monkeypatch.setattr("sys.argv", ["refresh", "--out", str(tmp_path)])
    assert refresh.main() == 1
    block = json.loads(target.read_text(encoding="utf-8"))["leagues"]["NEW"]
    assert block["fetched_at"] is None
    assert block["last_match_at"] is None
    assert block["matches"] == []


def test_mmz_does_not_call_partial_season_fetch_success(monkeypatch):
    from core import football_data_uk as fd
    monkeypatch.setattr(refresh, "make_mapper", lambda *args: (lambda n: (n, True, 0), "test"))
    monkeypatch.setattr(fd, "download_csv", lambda *args: (_ for _ in ()).throw(OSError("unavailable")))
    with pytest.raises(OSError):
        refresh.collect_mmz_league("SB", "I2", "ita.2", date(2025, 9, 21), set())


@pytest.mark.parametrize("empty_season", ["Div,Date,HomeTeam,AwayTeam,FTHG,FTAG\n", "", "<html>Not available</html>"])
def test_mmz_rejects_a_successful_but_empty_required_season(monkeypatch, empty_season):
    from core import football_data_uk as fd
    monkeypatch.setattr(refresh, "make_mapper", lambda *args: (lambda n: (n, True, 0), "test"))
    replies = iter(["Div,Date,HomeTeam,AwayTeam,FTHG,FTAG\nI2,10/05/2026,A,B,1,0\n", empty_season])
    monkeypatch.setattr(fd, "download_csv", lambda *args: next(replies))
    with pytest.raises(ValueError, match="empty season"):
        refresh.collect_mmz_league("SB", "I2", "ita.2", date(2025, 9, 21), set())
