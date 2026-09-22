"""Check writer payloads against checked-in SQL, without permissive DB mocks."""
import re
from pathlib import Path


def assert_unified_schema(row):
    migrations = Path(__file__).resolve().parents[1] / "db/migrations"
    schema = (migrations / "001_unified_predictions.sql").read_text(encoding="utf-8")
    body = schema.split("CREATE TABLE IF NOT EXISTS unified_predictions (", 1)[1].split("\n);", 1)[0]
    definitions = dict(re.findall(r"^  (\w+)\s+((?:TEXT|UUID|NUMERIC|INTEGER|BOOLEAN|TIMESTAMPTZ)[^\n]*)", body, re.M))
    columns = set(definitions)
    for migration in migrations.glob("*.sql"):
        columns.update(re.findall(r"ALTER TABLE (?:public\.)?unified_predictions ADD COLUMN IF NOT EXISTS (\w+)", migration.read_text(encoding="utf-8"), re.I))
    assert set(row) <= columns, f"Unknown columns: {set(row) - columns}"
    required = {name for name, ddl in definitions.items() if "NOT NULL" in ddl and "DEFAULT" not in ddl}
    assert required <= row.keys(), f"Missing required columns: {required - row.keys()}"
    assert all(row[key] is not None for key in required)
