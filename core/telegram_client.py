import html
import httpx
import logging
from datetime import datetime, timezone, timedelta
from config.settings import settings

logger = logging.getLogger(__name__)


async def send(text: str, tier: str = "pro") -> bool:
    """Pubblica su un canale Telegram.

    `tier` esiste per il canale FREE (#TG-FREE-0810) e vale "pro" di default:
    i cinque call site esistenti (analyst, strategist, risk_manager,
    result_settlement, live_monitor) restano invariati e continuano a scrivere
    sul canale a pagamento, esattamente come prima.

    Il canale free è OPT-IN: senza TELEGRAM_CHAT_ID_FREE configurato un invio
    con tier="free" è un no-op che ritorna False — la stessa postura
    fail-closed che il client ha sempre avuto sul token mancante. Così il
    codice si può deployare PRIMA che il canale esista, senza errori.
    """
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = (
        settings.TELEGRAM_CHAT_ID_FREE if tier == "free" else settings.TELEGRAM_CHAT_ID
    )
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
    # Escape dynamic fragments: parse_mode=HTML rejects the whole message
    # ("can't parse entities") on raw '&'/'<' — e.g. "Brighton & Hove Albion".
    return f"<b>{html.escape(home)} vs {html.escape(away)}</b>  [{html.escape(league)}]\n🕐 {ko_str}"
