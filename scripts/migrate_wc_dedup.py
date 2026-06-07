"""#WC-DEDUP-1 — one-off migration: canonical source_id per le righe nazionali.

Per ogni riga ATTIVA (is_historical=false) in wc_model / friendly_model:
  1. calcola la chiave canonica national_dedup_key(league, starts_at, home, away)
  2. raggruppa per chiave: tiene la riga aggiornata più di recente,
     ELIMINA le altre (i duplicati da doppio provider id)
  3. aggiorna source_id della riga superstite alla chiave canonica

Senza questa migrazione il writer (che ora scrive chiavi canoniche) non
matcherebbe le righe esistenti e creerebbe un terzo duplicato al primo ciclo.

Default DRY-RUN: stampa il piano e non tocca nulla. Eseguire con --apply.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx

from config.settings import settings
from core.supabase_client import national_dedup_key

TABLES = ("wc_model", "friendly_model")


def _base() -> tuple[str, dict]:
    url = settings.SUPABASE_URL.rstrip("/")
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    if not url or not key:
        raise SystemExit("SUPABASE_URL / SERVICE_ROLE_KEY mancanti in .env")
    return f"{url}/rest/v1/unified_predictions", {
        "apikey": key,
        "authorization": f"Bearer {key}",
        "content-type": "application/json",
    }


async def main(apply: bool) -> None:
    base, headers = _base()
    async with httpx.AsyncClient(timeout=30.0) as c:
        plan: list[tuple[str, str, str]] = []  # (action, row_id, detail)
        for table in TABLES:
            resp = await c.get(
                base,
                params={
                    "source_table": f"eq.{table}",
                    "is_historical": "eq.false",
                    "select": "id,source_id,external_event_id,league,home_team,away_team,starts_at,updated_at",
                    "order": "updated_at.desc",
                },
                headers=headers,
            )
            resp.raise_for_status()
            rows = resp.json()
            groups: dict[str, list[dict]] = defaultdict(list)
            for r in rows:
                key = national_dedup_key(
                    r.get("league") or "", r.get("starts_at") or "",
                    r.get("home_team") or "", r.get("away_team") or "",
                )
                groups[key].append(r)  # già ordinate per updated_at desc

            for key, group in groups.items():
                keeper, *dupes = group
                for d in dupes:
                    plan.append(("DELETE", d["id"],
                                 f"{table} dup {d['source_id']} ({d['home_team']} vs {d['away_team']})"))
                if keeper["source_id"] != key:
                    plan.append(("UPDATE", keeper["id"],
                                 f"{table} {keeper['source_id']} -> {key}"))

        deletes = [p for p in plan if p[0] == "DELETE"]
        updates = [p for p in plan if p[0] == "UPDATE"]
        print(f"piano: {len(deletes)} DELETE (duplicati), {len(updates)} UPDATE source_id")
        for action, row_id, detail in plan:
            print(f"  {action} {row_id[:8]}…  {detail}")

        if not apply:
            print("\nDRY-RUN — nessuna modifica. Rilanciare con --apply dopo APPROVE.")
            return

        for action, row_id, detail in plan:
            if action == "DELETE":
                r = await c.delete(base, params={"id": f"eq.{row_id}"}, headers=headers)
            else:
                key = detail.rsplit(" -> ", 1)[1]
                r = await c.patch(
                    base, params={"id": f"eq.{row_id}"},
                    json={"source_id": key}, headers=headers,
                )
            status = "ok" if r.status_code in (200, 204) else f"ERRORE {r.status_code}: {r.text[:120]}"
            print(f"  {action} {row_id[:8]}… {status}")
        print("\nmigrazione applicata.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="esegue (default: dry-run)")
    asyncio.run(main(parser.parse_args().apply))
