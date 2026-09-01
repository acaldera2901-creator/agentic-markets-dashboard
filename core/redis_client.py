import logging

import redis.asyncio as aioredis
import redis.exceptions
from config.settings import settings

logger = logging.getLogger(__name__)

# #REDIS-TIMEOUT-0830 — until now from_url() was called with NO timeouts at all.
# redis-py defaults socket_timeout and socket_connect_timeout to None, which
# means "wait forever": a half-open socket did not raise, it PARKED the calling
# task. A parked task cannot be rescued by a try/except, because nothing is ever
# raised — which is why the guard added in #HEARTBEAT-GUARD-0830 covers only
# half the failure surface on its own. These timeouts turn "hangs forever" into
# "raises after N seconds", the shape the callers' guards already handle.
#
# It also explains a single agent falling silent while Redis kept answering
# everyone else: this client is a process-wide singleton, but a stalled call
# holds one connection of the pool — its own task parks, the others carry on.

# consume() issues a BLOCKING XREADGROUP for this long. redis-py does NOT grow
# socket_timeout for blocking commands, so the socket timeout must stay strictly
# above it, or every idle stream read would die on the socket instead of
# returning empty. This is the one way this change could break something that
# works today, so the ordering is asserted in tests/test_redis_timeouts.py.
STREAM_BLOCK_MS = 5_000

# Bounded on BOTH sides, and neither bound is arbitrary:
#   lower — must exceed STREAM_BLOCK_MS (5s), see above;
#   upper — SOCKET_TIMEOUT + HEARTBEAT_INTERVAL must stay UNDER HEARTBEAT_TIMEOUT,
#           or one stalled write is enough to let the heartbeat key expire: the
#           MonitorAgent would read the agent as dead and kickstart the WHOLE
#           orchestrator, which is exactly the storm we are here to stop.
#           10 + 30 = 40 < 60. Both bounds are asserted mechanically.
SOCKET_TIMEOUT = 10.0
SOCKET_CONNECT_TIMEOUT = 5.0
# Ping connections idle for this long before reusing them: this is what actually
# retires a half-open socket instead of handing it to the next caller.
HEALTH_CHECK_INTERVAL = 30
# retry_on_timeout is deliberately NOT set: a retry doubles the worst-case stall
# and would break the upper bound above. Retrying is the caller's decision — the
# heartbeat loop already retries on its own tick.

_client: aioredis.Redis | None = None

async def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = await aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=SOCKET_TIMEOUT,
            socket_connect_timeout=SOCKET_CONNECT_TIMEOUT,
            health_check_interval=HEALTH_CHECK_INTERVAL,
        )
    return _client

async def publish(stream: str, data: dict) -> None:
    r = await get_redis()
    await r.xadd(stream, data)

async def set_heartbeat(agent_name: str, ttl: int, value: str) -> None:
    r = await get_redis()
    await r.setex(f"health:{agent_name}", ttl, value)

async def get_heartbeat(agent_name: str) -> str | None:
    r = await get_redis()
    return await r.get(f"health:{agent_name}")

# #CONSUME-GUARD-0830 — misurato in prod da Andrea dopo #REDIS-TIMEOUT-0830.
# Il socket_timeout ha fatto il suo lavoro (l'appeso infinito e' diventato
# eccezione) ma ha scoperto un secondo problema, che il timeout non ha creato:
# ha solo smesso di nasconderlo. Redis e' sano (slowlog max 10,8 ms) mentre il
# NOSTRO event loop stalla oltre 10s sul fit CPU-sincrono del ModelAgent: tutte
# le letture in volo scadono INSIEME, a grappoli, e con l'eccezione non gestita
# uccidono piu' agenti in cascata. Cioe' il timeout misurava il nostro loop
# bloccato, non Redis.
#
# Senza guardia il bilancio era ambiguo (appeso infinito vs crash a cascata);
# con la guardia uno stallo transitorio torna a essere quello che era prima,
# un ritardo, e l'appeso infinito resta curato.
CONSUME_RETRIES = 1  # un ritentativo, poi si cede il turno: il chiamante ricicla

# Per consumatore, non globale: due agenti che falliscono non devono contarsi
# a vicenda ne' zittirsi il primo WARNING a testa.
_consume_failures: dict[str, int] = {}


async def consume(stream: str, group: str, consumer: str, count: int = 10) -> list:
    """Leggi dal gruppo, sopravvivendo a un Redis che scade.

    Tornare [] NON perde messaggi: con XREADGROUP ">" le entry non lette
    restano PENDING nel gruppo e arrivano alla chiamata successiva. Il costo di
    un tick saltato e' un ritardo, non un buco — ed e' l'unica ragione per cui
    qui e' lecito degradare invece di propagare.

    Le rotture si sopravvivono ma non si ingoiano: primo fallimento WARNING,
    ripetizioni DEBUG (un Redis lento non deve allagare il log a ogni tick), e
    la ripresa si annuncia. `RedisError` copre timeout e connessione ma NON
    CancelledError (che e' BaseException) ne' gli errori di programmazione:
    quelli devono continuare a esplodere.
    """
    r = await get_redis()
    try:
        await r.xgroup_create(stream, group, id="$", mkstream=True)
    except Exception:
        pass
    key = f"{stream}:{group}:{consumer}"
    last_error: Exception | None = None
    for _attempt in range(CONSUME_RETRIES + 1):
        try:
            entries = await r.xreadgroup(
                group, consumer, {stream: ">"}, count=count, block=STREAM_BLOCK_MS
            ) or []
        except redis.exceptions.RedisError as exc:
            last_error = exc
            continue
        failed_before = _consume_failures.pop(key, 0)
        if failed_before:
            logger.info(
                "%s: stream reads recovered after %d failed tick(s)", key, failed_before
            )
        return entries
    failures = _consume_failures.get(key, 0) + 1
    _consume_failures[key] = failures
    if failures == 1:
        logger.warning(
            "%s: stream read failed, entries stay pending and are retried next tick: %s",
            key, last_error,
        )
    else:
        logger.debug("%s: stream read still failing (%d ticks): %s", key, failures, last_error)
    return []
