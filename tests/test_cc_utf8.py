import json

from tools.control_center import cervello, snapshot
from tools.control_center.contract import green


def test_cervello_writes_utf8_and_reads_back(tmp_path):
    path = tmp_path / "graph.json"
    data = {"title": "Città → 東京 ⚽"}
    cervello._scrivi(data, path)
    assert json.loads(path.read_text(encoding="utf-8")) == data


def test_snapshot_and_history_preserve_unicode(tmp_path):
    path = tmp_path / "state.json"
    data = {"title": "Città → 東京 ⚽"}
    snapshot.write_state(data, path)
    assert json.loads(path.read_text(encoding="utf-8")) == data
    assert snapshot.read_state(path) == data
    history = tmp_path / "history.jsonl"
    snapshot.append_history({"東京": green("ok", "test", value="⚽")}, "now", history)
    assert json.loads(history.read_text(encoding="utf-8"))["checks"]["東京"]["value"] == "⚽"
