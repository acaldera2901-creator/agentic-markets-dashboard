import anthropic
from config.settings import settings

_client: anthropic.AsyncAnthropic | None = None

def get_claude() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client

async def ask(system: str, prompt: str, cache_system: bool = True) -> str:
    client = get_claude()
    system_block: dict = {
        "type": "text",
        "text": system,
    }
    if cache_system:
        system_block["cache_control"] = {"type": "ephemeral"}

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=[system_block],
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
