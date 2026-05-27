import redis.asyncio as aioredis
from config.settings import settings

_client: aioredis.Redis | None = None

async def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
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

async def consume(stream: str, group: str, consumer: str, count: int = 10) -> list:
    r = await get_redis()
    try:
        await r.xgroup_create(stream, group, id="$", mkstream=True)
    except Exception:
        pass
    return await r.xreadgroup(group, consumer, {stream: ">"}, count=count, block=5000) or []
