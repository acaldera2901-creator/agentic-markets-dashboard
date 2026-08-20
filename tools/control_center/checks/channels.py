"""I canali. Dove manca la credenziale il tile lo dice, non mostra uno zero."""

import requests

from ..contract import Check, Verdict, info, unknown
from ..db import load_env

REDDIT_USER = "Betredge"
UA = "betredge-control-center/1.0"


def check_telegram() -> Verdict:
    env = load_env()
    token = env.get("TELEGRAM_BOT_TOKEN")
    canale = env.get("TELEGRAM_CHANNEL_ID")
    if not token:
        return unknown("credenziale mancante: TELEGRAM_BOT_TOKEN", "telegram bot api")
    if not canale:
        # TELEGRAM_CHAT_ID e' la chat personale di Andrea, non il canale
        # pubblico: usarla qui riporterebbe 1 iscritto e sarebbe un numero
        # vero che risponde alla domanda sbagliata.
        return unknown(
            "manca TELEGRAM_CHANNEL_ID: l'id del canale pubblico non e' in env",
            "telegram bot api",
        )
    try:
        resp = requests.get(
            f"https://api.telegram.org/bot{token}/getChatMemberCount",
            params={"chat_id": canale}, timeout=15,
        )
        resp.raise_for_status()
        n = int(resp.json()["result"])
    except Exception as exc:  # noqa: BLE001
        return unknown(f"telegram non risponde: {exc}", "telegram bot api")
    return info(f"{n} iscritti al canale", "telegram bot api", value=n)


def check_reddit() -> Verdict:
    try:
        resp = requests.get(
            f"https://www.reddit.com/user/{REDDIT_USER}/about.json",
            headers={"User-Agent": UA}, timeout=15,
        )
        resp.raise_for_status()
        d = resp.json()["data"]
    except Exception as exc:  # noqa: BLE001
        # Verificato il 2026-08-20: 403 anche con uno User-Agent da browser, e
        # old.reddit redirige. L'endpoint pubblico non basta piu': serve OAuth.
        # Il motivo giusto conta — "non risponde" farebbe cercare un guasto
        # dove c'e' una credenziale che manca.
        testo = str(exc)
        if "403" in testo:
            return unknown(
                "Reddit blocca l'endpoint pubblico: serve un'app OAuth "
                "(client id e secret)",
                f"reddit:u/{REDDIT_USER}",
            )
        return unknown(f"reddit non raggiungibile: {exc}", f"reddit:u/{REDDIT_USER}")
    karma = int(d.get("total_karma", 0))
    return info(
        f"u/{REDDIT_USER}: {karma} karma",
        f"reddit:u/{REDDIT_USER}", value=karma,
        evidence={"link_karma": d.get("link_karma"), "comment_karma": d.get("comment_karma")},
    )


def _social_bloccato(nome: str, variabile: str, fonte: str) -> Verdict:
    return unknown(
        f"credenziale mancante: serve {variabile} per leggere {nome}", fonte
    )


def check_instagram() -> Verdict:
    env = load_env()
    if not env.get("IG_ACCESS_TOKEN"):
        return _social_bloccato("@betr.edge", "IG_ACCESS_TOKEN", "instagram graph api")
    return unknown("token presente ma lettura non implementata", "instagram graph api")


def check_tiktok() -> Verdict:
    env = load_env()
    if not env.get("TIKTOK_ACCESS_TOKEN"):
        return _social_bloccato("@betr.edge", "TIKTOK_ACCESS_TOKEN", "tiktok api")
    return unknown("token presente ma lettura non implementata", "tiktok api")


def checks() -> list[Check]:
    return [
        Check("telegram", "canali", "Telegram", check_telegram, ttl_seconds=3600, timeout_seconds=20),
        Check("reddit", "canali", "Reddit", check_reddit, ttl_seconds=3600, timeout_seconds=20),
        Check("instagram", "canali", "Instagram", check_instagram, ttl_seconds=3600),
        Check("tiktok", "canali", "TikTok", check_tiktok, ttl_seconds=3600),
    ]
