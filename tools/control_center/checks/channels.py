"""I canali social. Le credenziali si leggono dove sono, non si copiano qui.

Stato misurato il 2026-08-20:
  - Telegram: funziona, l'id del canale pubblico e' TELEGRAM_CHAT_ID_FREE nel
    progetto accelerator/studio (distinto da TELEGRAM_CHAT_ID, che e' la chat
    personale di Andrea: usare quella riporterebbe 1 iscritto, un numero vero
    che risponde alla domanda sbagliata);
  - Instagram: i token esistono in accelerator/studio-instagram ma sono
    SCADUTI (errore 190, "cannot parse access token"). "Scaduto" e "mancante"
    portano ad azioni diverse, quindi il tile dice quale dei due;
  - TikTok: nessuna credenziale in nessun progetto — l'account @betr.edge
    esiste ma non e' Business, quindi non c'e' API;
  - Reddit: l'endpoint pubblico e' bloccato (403 anche con UA da browser),
    serve un'app OAuth.
"""

import requests

from ..contract import Check, Verdict, info, unknown
from ..db import load_all_env

GRAPH = "https://graph.facebook.com/v21.0"
REDDIT_USER = "Betredge"
UA = "betredge-control-center/1.0"

PROFILI_IG = (
    ("instagram_en", "@betr.edge (EN)", "EN"),
    ("instagram_it", "@betr.edge_ita (IT)", "IT"),
)


def check_telegram() -> Verdict:
    env = load_all_env()
    token = env.get("TELEGRAM_BOT_TOKEN")
    canale = env.get("TELEGRAM_CHAT_ID_FREE")
    if not token:
        return unknown("credenziale mancante: TELEGRAM_BOT_TOKEN", "telegram bot api")
    if not canale:
        return unknown(
            "manca TELEGRAM_CHAT_ID_FREE: l'id del canale pubblico "
            "(TELEGRAM_CHAT_ID e' la chat personale, non il canale)",
            "telegram bot api",
        )
    try:
        iscritti = requests.get(
            f"https://api.telegram.org/bot{token}/getChatMemberCount",
            params={"chat_id": canale}, timeout=15,
        ).json()
        chat = requests.get(
            f"https://api.telegram.org/bot{token}/getChat",
            params={"chat_id": canale}, timeout=15,
        ).json()
    except Exception as exc:  # noqa: BLE001
        return unknown(f"telegram non raggiungibile: {exc}", "telegram bot api")

    if not iscritti.get("ok"):
        return unknown(
            f"telegram rifiuta: {iscritti.get('description', '?')}", "telegram bot api"
        )
    n = int(iscritti["result"])
    titolo = (chat.get("result") or {}).get("title") if chat.get("ok") else None
    username = (chat.get("result") or {}).get("username") if chat.get("ok") else None
    prove = {"iscritti": n, "titolo": titolo, "username_pubblico": username}
    coda = "" if username else " · nessun username pubblico"
    return info(
        f"{n} iscritti a “{titolo or 'canale'}”{coda}",
        "telegram bot api", value=n, evidence=prove,
    )


def _instagram(lang: str, etichetta: str) -> Verdict:
    env = load_all_env()
    token = env.get(f"IG_ACCESS_TOKEN_{lang}")
    uid = env.get(f"IG_USER_ID_{lang}")
    if not token or not uid:
        manca = []
        if not token:
            manca.append(f"IG_ACCESS_TOKEN_{lang}")
        if not uid:
            manca.append(f"IG_USER_ID_{lang}")
        return unknown(
            f"credenziale mancante per {etichetta}: {', '.join(manca)}",
            "instagram graph api",
        )
    try:
        d = requests.get(
            f"{GRAPH}/{uid}",
            params={"fields": "username,followers_count,media_count", "access_token": token},
            timeout=20,
        ).json()
    except Exception as exc:  # noqa: BLE001
        return unknown(f"instagram non raggiungibile: {exc}", "instagram graph api")

    if "error" in d:
        errore = d["error"]
        if errore.get("code") == 190:
            # Distinzione che conta: il token c'e', e' scaduto. Rigenerarlo e'
            # un'azione diversa da procurarselo.
            return unknown(
                f"token SCADUTO per {etichetta} (errore 190): va rigenerato dal "
                "Business Manager, non manca",
                "instagram graph api",
                evidence={"codice": 190, "messaggio": errore.get("message", "")[:200]},
            )
        return unknown(
            f"instagram rifiuta ({errore.get('code')}): {errore.get('message', '')[:120]}",
            "instagram graph api",
        )
    return info(
        f"@{d.get('username')}: {d.get('followers_count')} follower, {d.get('media_count')} post",
        "instagram graph api",
        value=d.get("followers_count"),
        evidence={"username": d.get("username"), "post": d.get("media_count")},
    )


def check_tiktok() -> Verdict:
    env = load_all_env()
    if not env.get("TIKTOK_ACCESS_TOKEN"):
        return unknown(
            "nessuna credenziale TikTok in nessun progetto: l'account @betr.edge "
            "non e' Business, quindi non ha API",
            "tiktok api",
        )
    return unknown("token presente ma lettura non implementata", "tiktok api")


def check_reddit() -> Verdict:
    env = load_all_env()
    client = env.get("REDDIT_CLIENT_ID")
    if not client:
        # Verificato il 2026-08-20: 403 anche con uno User-Agent da browser, e
        # old.reddit redirige. L'endpoint pubblico non basta piu'.
        return unknown(
            "Reddit blocca l'endpoint pubblico (403 anche con UA da browser): "
            "serve un'app OAuth, cioe' REDDIT_CLIENT_ID e REDDIT_CLIENT_SECRET",
            f"reddit:u/{REDDIT_USER}",
        )
    try:
        resp = requests.get(
            f"https://www.reddit.com/user/{REDDIT_USER}/about.json",
            headers={"User-Agent": UA}, timeout=15,
        )
        resp.raise_for_status()
        d = resp.json()["data"]
    except Exception as exc:  # noqa: BLE001
        return unknown(f"reddit non raggiungibile: {exc}", f"reddit:u/{REDDIT_USER}")
    return info(
        f"u/{REDDIT_USER}: {int(d.get('total_karma', 0))} karma",
        f"reddit:u/{REDDIT_USER}", value=int(d.get("total_karma", 0)),
        evidence={"link_karma": d.get("link_karma"), "comment_karma": d.get("comment_karma")},
    )


def checks() -> list[Check]:
    fatti = [
        Check("telegram", "canali", "Telegram", check_telegram,
              ttl_seconds=1800, timeout_seconds=25),
    ]
    fatti += [
        Check(cid, "canali", etichetta, lambda l=lang, e=etichetta: _instagram(l, e),
              ttl_seconds=1800, timeout_seconds=25)
        for cid, etichetta, lang in PROFILI_IG
    ]
    fatti += [
        Check("tiktok", "canali", "TikTok", check_tiktok, ttl_seconds=3600),
        Check("reddit", "canali", "Reddit", check_reddit, ttl_seconds=3600, timeout_seconds=20),
    ]
    return fatti
