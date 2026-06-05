# tests/test_wc_squad_sync.py
"""Track A squad sync tests (design 2026-06-05-world-cup-wing-design.md):
hash/diff logic, uniform-row invariant, snapshot-on-change, fail-soft."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core import wc_squad_sync
from core.wc_squad_sync import diff_rosters, roster_hash


def _p(name, position="M", injured=False):
    return {"name": name, "position": position, "injured": injured}


# ─── roster_hash ────────────────────────────────────────────────────────────────

def test_roster_hash_is_order_insensitive():
    a = [_p("Alpha"), _p("Beta", "D")]
    b = [_p("Beta", "D"), _p("Alpha")]
    assert roster_hash(a) == roster_hash(b)


def test_roster_hash_changes_on_injury_flip():
    a = [_p("Alpha"), _p("Beta")]
    b = [_p("Alpha"), _p("Beta", injured=True)]
    assert roster_hash(a) != roster_hash(b)


def test_roster_hash_changes_on_player_swap():
    assert roster_hash([_p("Alpha")]) != roster_hash([_p("Gamma")])


# ─── diff_rosters ───────────────────────────────────────────────────────────────

def test_diff_none_on_first_capture():
    assert diff_rosters(None, [_p("Alpha")]) is None


def test_diff_added_removed_injury():
    prev = [_p("Stays"), _p("Cut"), _p("Knee")]
    new = [_p("Stays"), _p("Called Up"), _p("Knee", injured=True)]
    d = diff_rosters(prev, new)
    assert d == {
        "added": ["Called Up"],
        "removed": ["Cut"],
        "injury_changes": ["Knee"],
    }


def test_diff_empty_when_unchanged():
    roster = [_p("Alpha"), _p("Beta")]
    assert diff_rosters(roster, roster) == {
        "added": [], "removed": [], "injury_changes": [],
    }


def test_diff_handles_duplicate_names_without_collapsing():
    # two distinct players sharing a displayName (realistic across 48 squads):
    # the duplicate must not be silently dropped from the diff
    prev = [_p("Dup", "G"), _p("Dup", "D"), _p("Solo")]
    new = [_p("Dup", "G"), _p("Solo")]
    d = diff_rosters(prev, new)
    assert d["removed"] == ["Dup"]
    assert d["added"] == []


def test_diff_injury_change_on_duplicate_name_position():
    prev = [_p("Dup", "G", injured=False), _p("Dup", "D", injured=False)]
    new = [_p("Dup", "G", injured=False), _p("Dup", "D", injured=True)]
    d = diff_rosters(prev, new)
    assert d["injury_changes"] == ["Dup"]
    assert d["added"] == [] and d["removed"] == []


def test_roster_hash_deterministic_for_non_ascii_names():
    # guards json.dumps ensure_ascii determinism across runs/platforms
    roster = [_p("Müller", "F"), _p("Ødegaard", "M")]
    assert roster_hash(roster) == roster_hash(list(reversed(roster)))
    assert roster_hash(roster) == "504e9b13dadb271f8a3a5f760d18de465553c26b3d7300a8e9e06c8b24b93f61"


# ─── _player_rows: uniform-row invariant (P1/P3 PostgREST lesson) ──────────────

def test_player_rows_have_identical_keys_with_explicit_nulls():
    rows = wc_squad_sync._player_rows(
        "squad-uuid",
        [
            {"name": "Alpha", "position": "G", "injured": False},
            # richer row (future API-Football enrichment) — keys must still match
            {"name": "Beta", "position": "D", "injured": True,
             "shirt_number": 4, "club_team": "FC X", "age": 27},
        ],
    )
    assert len(rows) == 2
    keysets = {tuple(sorted(r.keys())) for r in rows}
    assert len(keysets) == 1  # IDENTICAL keys on every row
    assert rows[0]["shirt_number"] is None  # explicit NULL, not missing
    assert rows[1]["shirt_number"] == 4
    assert all(r["squad_id"] == "squad-uuid" for r in rows)


def test_player_rows_skip_nameless_entries():
    rows = wc_squad_sync._player_rows("s", [{"name": None}, {"name": "Ok"}])
    assert [r["player_name"] for r in rows] == ["Ok"]
