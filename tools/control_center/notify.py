"""Consegna delle notifiche. Mai sul canale pubblico, solo a Andrea."""

import subprocess

import requests

from .db import load_env

_ICONA = {"down": "\U0001F534", "up": "\U0001F7E2"}


def _testo(notifiche: list[dict]) -> str:
    return "\n".join(
        f"{_ICONA.get(n['kind'], '-')} {n['title']}\n{n['body']}" for n in notifiche
    )


def _macos(notifiche: list[dict]) -> None:
    titolo = notifiche[0]["title"] if len(notifiche) == 1 else f"BetRedge - {len(notifiche)} cambi"
    corpo = (
        notifiche[0]["body"]
        if len(notifiche) == 1
        else "; ".join(n["check_id"] for n in notifiche)
    )
    script = f"display notification {corpo!r} with title {titolo!r}"
    subprocess.run(["osascript", "-e", script], capture_output=True, timeout=10, check=False)


def _telegram(notifiche: list[dict], token: str, chat_id: str) -> None:
    requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": _testo(notifiche), "disable_notification": False},
        timeout=15,
    )


def send(notifiche: list[dict], env: dict | None = None) -> list[str]:
    """Manda su tutti i canali disponibili. Un canale rotto non blocca gli altri."""
    if not notifiche:
        return []
    valori = env if env is not None else load_env()
    usati: list[str] = []

    try:
        _macos(notifiche)
        usati.append("macos")
    except Exception:  # noqa: BLE001 - la notifica e' best effort, non un check
        pass

    token = valori.get("TELEGRAM_BOT_TOKEN")
    chat_id = valori.get("TELEGRAM_CHAT_ID")
    if token and chat_id:
        try:
            _telegram(notifiche, token, chat_id)
            usati.append("telegram")
        except Exception:  # noqa: BLE001
            pass

    return usati
