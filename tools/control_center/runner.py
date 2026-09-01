"""Esecuzione dei check: isolata, con timeout, e con riuso a TTL."""

import traceback
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from datetime import datetime, timezone

from .contract import Check, Verdict, unknown, verdict_from_dict


def _age_seconds(verdict_dict: dict, now: datetime) -> float:
    stamp = verdict_dict.get("measured_at")
    if not stamp:
        return float("inf")
    try:
        measured = datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return float("inf")
    return (now - measured).total_seconds()


def run_checks(
    checks: list[Check],
    previous: dict | None = None,
    now: datetime | None = None,
) -> dict[str, Verdict]:
    """Esegue i check e restituisce un verdict per ognuno, sempre.

    Nessun check puo' impedire allo snapshot di uscire: un'eccezione o un
    timeout diventano unknown col motivo. Una dashboard che va in bianco
    perche' un provider e' giu' e' peggio di non averla.
    """
    moment = now or datetime.now(timezone.utc)
    prev = previous or {}
    out: dict[str, Verdict] = {}
    pending: dict = {}

    pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="cc")
    try:
        for chk in checks:
            cached = prev.get(chk.id)
            if chk.ttl_seconds and cached and _age_seconds(cached, moment) < chk.ttl_seconds:
                # Riuso: un check giornaliero non deve consumare 288 chiamate.
                out[chk.id] = verdict_from_dict(cached)
                continue
            pending[chk.id] = (pool.submit(chk.fn), chk)

        for check_id, (future, chk) in pending.items():
            try:
                result = future.result(timeout=chk.timeout_seconds)
            except FutureTimeout:
                # Il thread resta appeso fino a che la sua I/O non scade, ma
                # non trattiene lo snapshot: lo shutdown qui sotto e' senza
                # attesa. Accettato: i check fanno HTTP e DB con timeout
                # propri. Se un giorno un check bloccasse per sempre,
                # servirebbe un processo separato, non un thread.
                out[check_id] = unknown(
                    f"timeout dopo {chk.timeout_seconds:g}s", f"check:{check_id}", now=moment
                )
                continue
            except Exception as exc:  # noqa: BLE001 - qualsiasi errore diventa unknown
                out[check_id] = unknown(
                    str(exc) or exc.__class__.__name__,
                    f"check:{check_id}",
                    evidence={"traceback": traceback.format_exc(limit=4)},
                    now=moment,
                )
                continue
            if not isinstance(result, Verdict):
                out[check_id] = unknown(
                    f"il check non ha restituito un Verdict ma {type(result).__name__}",
                    f"check:{check_id}",
                    now=moment,
                )
                continue
            out[check_id] = result
    finally:
        # wait=False e' il punto: un check appeso non deve ritardare la
        # scrittura dello snapshot. Senza questo, il context manager
        # attenderebbe il thread lento e vanificherebbe il timeout.
        pool.shutdown(wait=False, cancel_futures=True)

    return out
