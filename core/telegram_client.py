import httpx
import logging
from datetime import datetime, timezone, timedelta
from config.settings import settings

logger = logging.getLogger(__name__)


async def send(text: str) -> bool:
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )
            if r.status_code != 200:
                logger.warning(f"telegram {r.status_code}: {r.text[:200]}")
            return r.status_code == 200
    except Exception as e:
        logger.warning(f"telegram send failed: {e}")
        return False


def is_near_kickoff(kickoff_str: str, hours: int = 24) -> bool:
    try:
        ko = datetime.fromisoformat(kickoff_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        return timedelta(0) <= (ko - now) <= timedelta(hours=hours)
    except Exception:
        return False


def match_header(data: dict) -> str:
    league = data.get("league", "")
    home = data.get("home_team", "?")
    away = data.get("away_team", "?")
    kickoff = data.get("kickoff", "")
    try:
        ko = datetime.fromisoformat(kickoff.replace("Z", "+00:00"))
        ko_str = ko.strftime("%d/%m %H:%M UTC")
    except Exception:
        ko_str = kickoff
    return f"<b>{home} vs {away}</b>  [{league}]\n🕐 {ko_str}"
