"""Il sito, il deploy, il database: cio' che rende BetRedge raggiungibile."""

import requests

from ..contract import Check, Verdict, amber, green, red, unknown
from ..db import DbUnavailable, fetch_all, measure_latency

BASE = "https://www.betredge.com"

WATCHED_PAGES = ("/", "/predictions", "/plans", "/weekly-pick")

# Rotte deliberatamente NON sorvegliate. Esistono su main e sono nello sha
# deployato, ma rispondono 404 per progetto: fanno notFound() quando il flag
# non e' attivo. Sorvegliarle significa nascere con un rosso falso permanente.
FLAG_GATED_PAGES = {
    "/risultati": "NEXT_PUBLIC_UX_NEW",
    "/oggi": "NEXT_PUBLIC_UX_NEW",
}

# La soglia sta sulla QUERY, non su connessione+query: l'handshake verso il
# pooler in eu-west-1 costa ~650 ms stabili e non dice niente sulla salute del
# database. Misurato il 2026-08-20: query 65-132 ms, connessione 626-789 ms.
DB_QUERY_AMBER_S = 0.4
DB_QUERY_RED_S = 2.0
ERRORS_AMBER = 1


def _ok(code: int) -> bool:
    return 200 <= code < 400


def check_web_pages() -> Verdict:
    codici: dict[str, int] = {}
    try:
        for path in WATCHED_PAGES:
            codici[path] = requests.get(
                BASE + path, timeout=12, allow_redirects=False
            ).status_code
    except Exception as exc:  # rete, DNS, TLS: non misurato, non rotto
        return unknown(f"impossibile raggiungere il sito: {exc}", f"http:{BASE}")

    rotte = [p for p, c in codici.items() if not _ok(c)]
    if rotte:
        return red(
            f"non rispondono: {', '.join(rotte)}",
            f"http:{BASE}",
            value=f"{len(WATCHED_PAGES) - len(rotte)}/{len(WATCHED_PAGES)}",
            evidence=codici,
        )
    return green(
        f"{len(WATCHED_PAGES)} pagine su {len(WATCHED_PAGES)} rispondono",
        f"http:{BASE}",
        value=f"{len(WATCHED_PAGES)}/{len(WATCHED_PAGES)}",
        evidence=codici,
    )


def check_api_version() -> Verdict:
    try:
        resp = requests.get(f"{BASE}/api/version", timeout=12)
        sha = (resp.json() or {}).get("id", "")
    except Exception as exc:
        return unknown(f"/api/version non risponde: {exc}", f"http:{BASE}/api/version")
    if not sha:
        return red(
            "risponde senza sha",
            f"http:{BASE}/api/version",
            evidence={"body": resp.text[:200]},
        )
    return green(f"deployato {sha[:7]}", f"http:{BASE}/api/version", value=sha[:7])


def check_db_latency() -> Verdict:
    try:
        connessione, query = measure_latency()
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:select 1")
    ms = f"{query * 1000:.0f} ms"
    prove = {"query_ms": round(query * 1000), "connessione_ms": round(connessione * 1000)}
    if query >= DB_QUERY_RED_S:
        return red(f"query lentissima: {ms}", "db:select 1", value=ms, evidence=prove)
    if query >= DB_QUERY_AMBER_S:
        return amber(f"query lenta: {ms}", "db:select 1", value=ms, evidence=prove)
    return green(
        f"query in {ms} (connessione {prove['connessione_ms']} ms)",
        "db:select 1", value=ms, evidence=prove,
    )


def check_errors_24h() -> Verdict:
    try:
        righe = fetch_all(
            "select count(*) from error_patterns_log "
            "where logged_at > now() - interval '24 hours'"
        )
    except DbUnavailable as exc:
        return unknown(f"database non raggiungibile: {exc}", "db:error_patterns_log")
    n = int(righe[0][0]) if righe else 0
    if n >= ERRORS_AMBER:
        return amber(f"{n} pattern di errore nelle 24h", "db:error_patterns_log", value=n)
    return green("nessun pattern di errore nelle 24h", "db:error_patterns_log", value=0)


def checks() -> list[Check]:
    return [
        Check("web_pages", "piattaforma", "Pagine chiave", check_web_pages, timeout_seconds=60),
        Check("api_version", "piattaforma", "Sha deployato", check_api_version, timeout_seconds=20),
        Check("db_latency", "piattaforma", "Latenza database", check_db_latency, timeout_seconds=20),
        Check("errors_24h", "piattaforma", "Errori 24h", check_errors_24h, timeout_seconds=20),
    ]
