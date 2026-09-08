"""#FLEET-CODE-SHA-0908 — every heartbeat says which commit the fleet runs.

The defect: on 07/09/2026 the fleet graded for hours with pre-#361 code while
`main` had the fix; heartbeats carried no version, so nothing could say so.
`core.code_version` resolves the SHA once (env → git → None) and
`BaseAgent._serialize_status_detail` stamps it FIRST into every payload.

Invariants asserted below:
  1. env override wins and is validated (hex, 7-40 chars); junk is ignored;
  2. without env the sha comes from `git rev-parse` in the repo root, and a
     failing git gives None — an honest unknown, never a made-up value;
  3. a None detail becomes the stamp alone (the row is no longer empty);
  4. a dict detail keeps every key and gets the stamp PREPENDED;
  5. the stamp survives the 4000-char truncation of a large detail;
  6. a stamp key set by an agent cannot override the real one.
"""
import json
import subprocess

import pytest

import core.code_version as cv
from agents.base import BaseAgent


class _Probe(BaseAgent):
    async def _main_loop(self) -> None:  # never used here
        pass


@pytest.fixture(autouse=True)
def _fresh_cache():
    cv.code_sha.cache_clear()
    yield
    cv.code_sha.cache_clear()


# --- resolution -------------------------------------------------------------

def test_env_override_wins_and_is_validated(monkeypatch):
    monkeypatch.setenv("FLEET_CODE_SHA", "D6B266D5")
    assert cv.code_sha() == "d6b266d5"


@pytest.mark.parametrize("junk", ["", "   ", "abc", "not-a-sha!", "g" * 8])
def test_env_junk_is_ignored_and_falls_through_to_git(monkeypatch, junk):
    monkeypatch.setenv("FLEET_CODE_SHA", junk)
    monkeypatch.setattr(cv, "_read_git_sha", lambda root: "0123abcd")
    assert cv.code_sha() == "0123abcd"


def test_git_is_read_in_the_repo_root(monkeypatch):
    monkeypatch.delenv("FLEET_CODE_SHA", raising=False)
    seen = {}

    def fake_run(cmd, cwd, **kw):
        seen["cmd"], seen["cwd"] = cmd, cwd
        return subprocess.CompletedProcess(cmd, 0, stdout="d6b266d5\n", stderr="")

    monkeypatch.setattr(cv.subprocess, "run", fake_run)
    assert cv.code_sha() == "d6b266d5"
    assert seen["cmd"][:2] == ["git", "rev-parse"]
    assert seen["cwd"] == cv._ROOT
    assert (cv._ROOT / "agents").is_dir()  # parents[1] of core/ is the repo root


def test_failing_git_gives_none_not_a_fake(monkeypatch):
    monkeypatch.delenv("FLEET_CODE_SHA", raising=False)
    monkeypatch.setattr(
        cv.subprocess, "run",
        lambda *a, **k: subprocess.CompletedProcess(a, 128, stdout="", stderr="fatal: not a git repository"),
    )
    assert cv.code_sha() is None


def test_git_exception_gives_none(monkeypatch):
    monkeypatch.delenv("FLEET_CODE_SHA", raising=False)

    def boom(*a, **k):
        raise FileNotFoundError("git")

    monkeypatch.setattr(cv.subprocess, "run", boom)
    assert cv.code_sha() is None


def test_resolved_once_per_process(monkeypatch):
    monkeypatch.delenv("FLEET_CODE_SHA", raising=False)
    calls = []
    monkeypatch.setattr(cv, "_read_git_sha", lambda root: calls.append(1) or "d6b266d5")
    assert cv.code_sha() == cv.code_sha() == "d6b266d5"
    assert len(calls) == 1


# --- serialization ----------------------------------------------------------

@pytest.fixture
def stamped(monkeypatch):
    monkeypatch.setenv("FLEET_CODE_SHA", "d6b266d5")
    monkeypatch.setattr(cv, "BOOT_AT", "2026-09-07T13:18:24+00:00")
    return {"code_sha": "d6b266d5", "boot_at": "2026-09-07T13:18:24+00:00"}


def test_none_detail_becomes_the_stamp_alone(stamped):
    agent = _Probe("Probe")
    assert json.loads(agent._serialize_status_detail()) == stamped


def test_dict_detail_keeps_keys_and_gets_stamp_first(stamped):
    agent = _Probe("Probe")
    agent.set_status_detail({"type": "tennis_collection", "fixtures_collected": 37})
    raw = agent._serialize_status_detail()
    payload = json.loads(raw)
    assert payload == {**stamped, "type": "tennis_collection", "fixtures_collected": 37}
    assert list(payload)[:2] == ["code_sha", "boot_at"]
    assert raw.startswith('{"code_sha":"d6b266d5"')


def test_stamp_survives_truncation_of_a_large_detail(stamped):
    # DataCollector's detail measured 3263 chars on prod (08/09); make one that
    # overflows the 4000 cap and check the sha is still in the kept prefix.
    agent = _Probe("Probe")
    agent.set_status_detail({"world_cup": {"registry": ["x" * 50] * 200}})
    raw = agent._serialize_status_detail()
    assert len(raw) == 4000
    assert raw.startswith('{"code_sha":"d6b266d5","boot_at":"2026-09-07T13:18:24+00:00"')
    with pytest.raises(json.JSONDecodeError):
        json.loads(raw)  # truncated → the TS side must regex it (see lib/fleet-version.test.ts)


def test_agent_cannot_override_the_stamp(stamped):
    agent = _Probe("Probe")
    agent.set_status_detail({"code_sha": "deadbeef", "boot_at": "1970-01-01", "ok": True})
    payload = json.loads(agent._serialize_status_detail())
    assert payload["code_sha"] == "d6b266d5"
    assert payload["boot_at"] == "2026-09-07T13:18:24+00:00"
    assert payload["ok"] is True


def test_unknown_sha_is_null_not_missing(monkeypatch):
    monkeypatch.delenv("FLEET_CODE_SHA", raising=False)
    monkeypatch.setattr(cv, "_read_git_sha", lambda root: None)
    agent = _Probe("Probe")
    payload = json.loads(agent._serialize_status_detail())
    assert "code_sha" in payload and payload["code_sha"] is None


def test_string_detail_is_kept_under_text(stamped):
    agent = _Probe("Probe")
    agent.set_status_detail("collector idle")
    assert json.loads(agent._serialize_status_detail()) == {**stamped, "text": "collector idle"}
