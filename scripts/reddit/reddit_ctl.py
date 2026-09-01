#!/usr/bin/env python3
"""reddit_ctl — strumento operativo di u/Betredge per l'agente `reddit-betredge`.

Sottocomandi
  scan     thread candidati nei sub target (sola lettura)
  health   i nostri commenti sono ancora vivi? quanti giorni di silenzio?
  check    validatore meccanico di una bozza, senza rete
  send     pubblica un commento o un post
  verify   ricontrolla ciò che abbiamo pubblicato e segna le rimozioni
  log      mostra il registro

Il validatore gira SEMPRE prima di send e non è aggirabile: è l'unica cosa che
sta fra un errore di forma e la perdita dell'unico account del brand.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

import requests

ROOT = Path(__file__).resolve().parents[2]
STATE_DIR = ROOT / "data" / "reddit"
LOG_PATH = STATE_DIR / "sent_log.json"

ACCOUNT = "Betredge"
UA = "macos:com.agenticmarkets.redditctl:1.0 (by /u/Betredge)"
ATOM = "{http://www.w3.org/2005/Atom}"

# --- perimetro: dove l'account può parlare ------------------------------------
ALLOWED_SUBS = {
    "algobetting": "commenti + post di metodologia, dati, registro esiti",
    "sportsanalytics": "SOLO commenti, o post senza mercato/quote",
    "datasets": "solo post di dataset gratuiti",
    "SideProject": "solo i calcolatori, come prodotto gratuito",
    "InternetIsBeautiful": "solo i calcolatori",
    "SoccerBetting": "SOLO dentro il Daily Picks Thread",
}
SCAN_SUBS = ["algobetting", "sportsanalytics"]

# thread su cui non si commenta mai: pick, slip, risultati
# Thread su cui non si commenta mai: pick, slip, e i log di risultati. Il criterio non è
# «contiene un numero» (i thread migliori ne sono pieni) ma «espone un record».
SKIP_TITLE = re.compile(
    r"\b(picks?|parlay|slip|bet\s*slip|tail|bankroll\s+update|power\s+rankings?|"
    r"journal|tracker|model\s+log|now\s+logged|confirmed\s+results|flat[-\s]?stake|"
    r"today'?s\s+(plays|bets)|units?\s+(up|down))\b|\+\d+(\.\d+)?u\b", re.I)

# argomenti su cui abbiamo cicatrici vere (per il ranking di `scan`)
TOPICS = {
    "calibration": 3, "calibrated": 3, "brier": 3, "ece": 3, "reliability": 2,
    "closing line": 3, "clv": 3, "de-?vig": 3, "overround": 3, "margin": 2,
    "backtest": 3, "leak": 3, "lookahead": 3, "look-ahead": 3, "walk.?forward": 3,
    "data quality": 3, "join": 2, "match id": 3, "dedup": 3, "normalis|normaliz": 2,
    "sample size": 2, "sanity check": 2, "settlement": 3, "void": 2, "retire": 2,
    "tennis": 2, "surface": 2, "elo": 2, "xg": 2, "odds api": 2, "scraper": 1,
}

# --- validatore ---------------------------------------------------------------
EM_DASHES = "—–‒―"
BANNED = [
    (re.compile(r"\bclv[\s-]*verified\b", re.I), "claim «CLV verified»: è falso, 0 pick su 1.474 ha un CLV"),
    (re.compile(r"\bbetredge\b", re.I), "nomina il brand: non si nomina per primi"),
    (re.compile(r"https?://|www\.", re.I), "contiene un link: mai nei post, e nei commenti solo se richiesto"),
    (re.compile(r"\b(guarantee\w*|risk[\s-]free|sure\s+thing|easy money|profit\s+guarantee)\b", re.I),
     "claim da tout"),
    (re.compile(r"\b(subscribe|our\s+(plan|tier|pro)|per\s+month|\$\d|€\d)\b", re.I),
     "vende o cita il prezzo: su Reddit non si vende"),
    (re.compile(r"\bdm\s+me\b|\bhit\s+me\s+up\b", re.I), "invito al DM"),
]
NOT_X_BUT_Y = re.compile(
    r"\b(it'?s|its|this is|that'?s)\s+not\s+[^.;,]{2,60}[.,;]\s*(it'?s|its|but)\b", re.I)

_ABBREV = re.compile(r"(?<![\d.])(\b\d{1,2})\.(?=\s)")     # "1. FC Kaiserslautern", non "3.51. Poi"
_DECIMAL = re.compile(r"(?<=\d)\.(?=\d)")                  # 58.9 / 3.51


def split_sentences(text: str) -> list[str]:
    # l'ordine conta: _ABBREV deve vedere il testo grezzo, altrimenti il sentinello
    # del decimale nasconde la cifra e "z=3.51. Point" smette di essere due frasi.
    t = _ABBREV.sub(lambda m: m.group(1) + "\x01", text)
    t = _DECIMAL.sub("\x00", t)
    parts = re.split(r"(?<=[.!?])\s+(?=[\"'(\[]?[A-Z0-9])", t.strip())
    out = [p.replace("\x00", ".").replace("\x01", ".").strip() for p in parts if p.strip()]
    return out


def validate(text: str, kind: str, sub: str | None) -> tuple[list[str], list[str]]:
    """Ritorna (errori, avvisi). Un solo errore blocca l'invio."""
    err: list[str] = []
    warn: list[str] = []
    t = text.strip()

    if not t:
        return (["bozza vuota"], [])
    if sub and sub.lower() not in {s.lower() for s in ALLOWED_SUBS}:
        err.append(f"r/{sub} non è nel perimetro consentito: {', '.join(ALLOWED_SUBS)}")

    for ch in EM_DASHES:
        if ch in t:
            err.append(f"contiene {unicodedata.name(ch).lower()}: è uno dei tell che quel sub usa per riconoscere un LLM")
            break
    if NOT_X_BUT_Y.search(t):
        err.append("struttura «non è X, è Y»: è un tell")
    for rx, why in BANNED:
        if rx.search(t):
            err.append(why)
    if not re.search(r"\d", t):
        err.append("nessun numero: un commento senza una misura non regge da solo")

    n = len(split_sentences(t))
    if kind == "comment":
        if n > 4:
            err.append(f"{n} frasi: il massimo è 4, oltre quello è un post")
        if len(t) > 1200:
            err.append(f"{len(t)} caratteri: troppo lungo per un commento")
        if len(t) < 120:
            warn.append(f"{len(t)} caratteri: molto corto, verifica che dica qualcosa di specifico")
    else:
        if len(t) < 400:
            warn.append("post molto corto")

    if re.search(r"\bwe\s+(offer|provide|built a (site|platform|product))\b", t, re.I):
        warn.append("suona promozionale: riscrivi al passato e in prima persona singolare")
    if t.count("\n\n") >= 3 and kind == "comment":
        warn.append("troppi paragrafi per un commento: la prosa levigata è il tell principale")
    return err, warn


# --- registro -----------------------------------------------------------------
def load_log() -> dict:
    if LOG_PATH.exists():
        return json.loads(LOG_PATH.read_text())
    return {"sent": [], "removals": []}


def save_log(d: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(d, indent=2, ensure_ascii=False))


def now() -> datetime:
    return datetime.now(timezone.utc)


# --- rete (sola lettura, via RSS) ---------------------------------------------
def rss(url: str, tries: int = 5) -> ET.Element | None:
    for i in range(tries):
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
            if r.status_code == 200 and r.text.strip():
                return ET.fromstring(r.text)
            if r.status_code != 429:
                print(f"  ! {url} HTTP {r.status_code}", file=sys.stderr)
        except Exception as e:  # rete instabile, non è un difetto nostro
            print(f"  ! {url}: {e}", file=sys.stderr)
        time.sleep(8 * (i + 1))
    return None


def entries(feed: ET.Element | None) -> list[dict]:
    if feed is None:
        return []
    out = []
    for e in feed.findall(f"{ATOM}entry"):
        link = e.find(f"{ATOM}link")
        content = e.find(f"{ATOM}content")
        body = re.sub(r"<[^>]+>", " ", content.text or "") if content is not None else ""
        out.append({
            "title": (e.findtext(f"{ATOM}title") or "").strip(),
            "url": (link.get("href") if link is not None else "") or "",
            "updated": (e.findtext(f"{ATOM}updated") or "")[:19],
            "author": (e.findtext(f"{ATOM}author/{ATOM}name") or "").strip(),
            "body": re.sub(r"\s+", " ", body).strip(),
        })
    return out


# --- comandi ------------------------------------------------------------------
def cmd_scan(a) -> int:
    print(f"Scansione: {', '.join('r/' + s for s in SCAN_SUBS)}\n")
    rows = []
    for sub in SCAN_SUBS:
        for e in entries(rss(f"https://www.reddit.com/r/{sub}/new/.rss")):
            title = e["title"]
            if SKIP_TITLE.search(title):
                continue
            hay = (title + " " + e["body"]).lower()
            score = sum(w for rx, w in TOPICS.items() if re.search(rx, hay))
            if score:
                rows.append((score, sub, e))
    rows.sort(key=lambda r: -r[0])
    if not rows:
        print("Nessun thread su cui abbiamo una risposta migliore della loro. "
              "Non forzare: un commento debole costa più di un giorno saltato.")
        return 0
    for score, sub, e in rows[:a.limit]:
        tid = re.search(r"/comments/([a-z0-9]+)/", e["url"])
        print(f"[{score:>2}] r/{sub} · {e['updated'][:10]} · {e['author']}")
        print(f"     {e['title'][:100]}")
        print(f"     id={tid.group(1) if tid else '?'}  {e['url']}")
    return 0


def cmd_health(a) -> int:
    log = load_log()
    ours = entries(rss(f"https://www.reddit.com/user/{ACCOUNT}/comments.rss"))
    control = entries(rss("https://www.reddit.com/r/algobetting/new/.rss"))

    print(f"Feed di u/{ACCOUNT}: {len(ours)} commenti visibili")
    if not ours:
        if not control:
            print("  ⚠️  ANCHE IL CONTROLLO È VUOTO → sei rate-limited, NON è una rimozione. "
                  "Riprova fra qualche minuto prima di dire qualsiasi cosa.")
            return 2
        print("  ⛔ Il controllo ha entries e il nostro feed no: i commenti NON sono più pubblici. "
              "Guardare dall'account loggato prima di pubblicare altro.")
        return 1

    for e in ours[:10]:
        print(f"  · {e['updated'][:10]}  {e['body'][:80]}")

    sent = log.get("sent", [])
    last = max([e["updated"] for e in ours] + [s["at"][:19] for s in sent], default=None)
    if last:
        try:
            d = (now() - datetime.fromisoformat(last).replace(tzinfo=timezone.utc)).days
        except ValueError:
            d = -1
        print(f"\nUltima attività: {last} → **{d} giorni di silenzio**")
        if d >= 2:
            print("  ⛔ CADENZA ROTTA. Due giorni consecutivi = settimana fallita. "
                  "Tre settimane fallite = chiusura anticipata del canale.")
    dead = datetime(2026, 9, 30, tzinfo=timezone.utc)
    print(f"Giorni al verdetto del 30/09: {(dead - now()).days}")
    return 0


def cmd_check(a) -> int:
    text = Path(a.file).read_text() if a.file else sys.stdin.read()
    err, warn = validate(text, a.kind, a.sub)
    n = len(split_sentences(text.strip()))
    print(f"{len(text.strip())} caratteri · {n} frasi · tipo={a.kind}"
          + (f" · r/{a.sub}" if a.sub else ""))
    for w in warn:
        print(f"  ⚠️  {w}")
    for e in err:
        print(f"  ⛔ {e}")
    print("\n" + ("PASSA" if not err else "BLOCCATO"))
    return 0 if not err else 1


def _token() -> str:
    cid, sec = os.environ.get("REDDIT_CLIENT_ID"), os.environ.get("REDDIT_CLIENT_SECRET")
    usr, pwd = os.environ.get("REDDIT_USERNAME"), os.environ.get("REDDIT_PASSWORD")
    missing = [k for k, v in {
        "REDDIT_CLIENT_ID": cid, "REDDIT_CLIENT_SECRET": sec,
        "REDDIT_USERNAME": usr, "REDDIT_PASSWORD": pwd}.items() if not v]
    if missing:
        raise SystemExit("Credenziali mancanti: " + ", ".join(missing) +
                         "\nCrea un'app di tipo «script» su reddit.com/prefs/apps e mettile in .env")
    r = requests.post("https://www.reddit.com/api/v1/access_token",
                      auth=(cid, sec), data={"grant_type": "password", "username": usr, "password": pwd},
                      headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    tok = r.json().get("access_token")
    if not tok:
        raise SystemExit(f"OAuth fallito: {r.text[:300]}")
    return tok


def _cadence_guard(log: dict, force: bool) -> list[str]:
    """Limiti che proteggono l'account. Solo Andrea può scavalcarli, con --force."""
    stop = []
    sent = log.get("sent", [])
    day = [s for s in sent if s["at"][:10] == now().strftime("%Y-%m-%d")]
    if len(day) >= int(os.environ.get("REDDIT_MAX_PER_DAY", "3")):
        stop.append(f"già {len(day)} invii oggi: il tetto è {os.environ.get('REDDIT_MAX_PER_DAY','3')}")
    if sent:
        try:
            gap = (now() - datetime.fromisoformat(sent[-1]["at"])).total_seconds() / 60
            if gap < 45:
                stop.append(f"ultimo invio {gap:.0f} minuti fa: servono almeno 45 minuti fra due")
        except ValueError:
            pass
    recent_removal = [r for r in log.get("removals", [])
                      if r["at"] >= (now() - timedelta(days=7)).isoformat()]
    if recent_removal:
        stop.append(f"{len(recent_removal)} rimozione/i negli ultimi 7 giorni: fermarsi e capire perché")
    return [] if force else stop


def cmd_send(a) -> int:
    if os.environ.get("REDDIT_SEND_ENABLED") != "1":
        print("⛔ Invio disarmato. Metti REDDIT_SEND_ENABLED=1 nell'ambiente per armarlo.\n"
              "   È l'interruttore di Andrea: finché è spento lo strumento è in sola lettura.")
        return 1

    text = Path(a.file).read_text().strip()
    err, warn = validate(text, a.kind, a.sub)
    for w in warn:
        print(f"  ⚠️  {w}")
    if err:
        for e in err:
            print(f"  ⛔ {e}")
        print("\nNon invio. Il validatore non si scavalca.")
        return 1

    log = load_log()
    stop = _cadence_guard(log, a.force)
    if stop:
        for s in stop:
            print(f"  ⛔ {s}")
        return 1

    tok = _token()
    h = {"Authorization": f"bearer {tok}", "User-Agent": UA}
    if a.kind == "comment":
        if not a.thing:
            raise SystemExit("serve --thing t3_<id post> oppure t1_<id commento>")
        r = requests.post("https://oauth.reddit.com/api/comment",
                          data={"api_type": "json", "thing_id": a.thing, "text": text},
                          headers=h, timeout=30)
    else:
        if not (a.sub and a.title):
            raise SystemExit("per un post servono --sub e --title")
        r = requests.post("https://oauth.reddit.com/api/submit",
                          data={"api_type": "json", "sr": a.sub, "kind": "self",
                                "title": a.title, "text": text},
                          headers=h, timeout=30)
    r.raise_for_status()
    j = r.json().get("json", {})
    if j.get("errors"):
        print(f"⛔ Reddit ha rifiutato: {j['errors']}")
        return 1
    things = j.get("data", {}).get("things") or []
    data = (things[0].get("data") if things else {}) or j.get("data", {})
    name = data.get("name") or data.get("id", "?")
    url = data.get("permalink") or data.get("url", "")
    if url.startswith("/"):
        url = "https://www.reddit.com" + url

    log.setdefault("sent", []).append({
        "at": now().isoformat(timespec="seconds"), "kind": a.kind, "sub": a.sub,
        "thing": a.thing, "name": name, "url": url,
        "chars": len(text), "sentences": len(split_sentences(text)),
        "source": a.file, "alive": None,
    })
    save_log(log)
    print(f"✅ pubblicato {name}\n   {url}\n   registrato in {LOG_PATH}")
    print("   Ricontrolla con `verify` fra un'ora: il filtro antispam è silenzioso.")
    return 0


def cmd_verify(a) -> int:
    log = load_log()
    sent = log.get("sent", [])
    if not sent:
        print("Registro vuoto.")
        return 0
    ours = entries(rss(f"https://www.reddit.com/user/{ACCOUNT}/comments.rss"))
    control = entries(rss("https://www.reddit.com/r/algobetting/new/.rss"))
    if not ours and not control:
        print("⚠️  Sia il nostro feed sia il controllo sono vuoti: sei rate-limited. "
              "Nessuna conclusione possibile adesso.")
        return 2
    visible = " ".join(e["url"] for e in ours)
    changed = 0
    for s in sent:
        if s["kind"] != "comment":
            continue
        alive = (s["name"].split("_")[-1] in visible) if s.get("name") else False
        if s.get("alive") is not False and not alive:
            log.setdefault("removals", []).append(
                {"at": now().isoformat(timespec="seconds"), "name": s["name"], "url": s["url"]})
            changed += 1
        s["alive"] = alive
        print(f"  {'✅' if alive else '⛔'} {s['at'][:10]}  {s['name']}  {s['url']}")
    save_log(log)
    if changed:
        print(f"\n⛔ {changed} rimozione/i nuove. L'invio è bloccato per 7 giorni: "
              "una rimozione è un dato, dice che quel sub non ci vuole.")
        return 1
    return 0


SELFTEST = [
    ("Uno. Due. Tre.", 3),
    ("Hit 58.9% against 72.1% on the same model, z=3.51. Point by point will not help.", 2),
    ('The "1" in 1. FC Kaiserslautern got read as a token, while 1899 Hoffenheim needs its digits.', 1),
    ("A 1.07 / 1.09 / 1.09 line de-vigs to a third each. That is the whole problem.", 2),
]


def cmd_selftest(a) -> int:
    """Il conteggio delle frasi decide se una bozza parte. Se sbaglia, sbaglia in silenzio."""
    bad = 0
    for text, want in SELFTEST:
        got = len(split_sentences(text))
        ok = got == want
        bad += not ok
        print(f"  {'ok' if ok else 'ROTTO'}  atteso {want}, ottenuto {got}  | {text[:52]}")
    cases = [
        ("no numbers at all in this sentence about models.", "nessun numero"),
        ("We measured 12 things \u2014 and it worked.", "dash"),
        ("Checked 478 events. It's not luck, it's the benchmark.", "non è X, è Y"),
        ("See 3 examples at https://www.betredge.com for more.", "link"),
        ("Our CLV verified record covers 900 picks.", "CLV verified"),
    ]
    for text, why in cases:
        err, _ = validate(text, "comment", "algobetting")
        ok = bool(err)
        bad += not ok
        print(f"  {'ok' if ok else 'ROTTO'}  blocca «{why}»: {'sì' if ok else 'NO'}")
    err, _ = validate("Checked 478 football events and 21% had an overround above 20%, up to 191%.",
                      "comment", "sportsbook")
    ok = any("perimetro" in e for e in err)
    bad += not ok
    print(f"  {'ok' if ok else 'ROTTO'}  blocca un sub fuori perimetro: {'sì' if ok else 'NO'}")
    print("\n" + ("TUTTO VERDE" if not bad else f"{bad} ROTTI"))
    return 0 if not bad else 1


DIGEST_DIR = STATE_DIR / "digest"


def _alert(title: str, body: str) -> None:
    """Suona solo quando serve. Un allarme che suona ogni giorno non è un allarme."""
    chat = os.environ.get("REDDIT_DIGEST_CHAT_ID")
    tok = os.environ.get("TELEGRAM_BOT_TOKEN")
    if chat and tok:
        try:
            requests.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                          data={"chat_id": chat, "text": f"{title}\n\n{body}"}, timeout=20)
        except Exception as e:
            print(f"  ! Telegram: {e}", file=sys.stderr)
    try:
        import subprocess
        subprocess.run(["osascript", "-e",
                        f'display notification {json.dumps(body[:200])} with title {json.dumps(title)}'],
                       check=False, capture_output=True)
    except Exception:
        pass


def cmd_daily(a) -> int:
    """Il giro quotidiano, non presidiato. Scrive il digest e suona solo se c'è un problema."""
    import io
    from contextlib import redirect_stdout

    buf = io.StringIO()
    codes = {}
    for name, fn in (("health", cmd_health), ("verify", cmd_verify), ("scan", cmd_scan)):
        buf.write(f"\n## {name}\n\n")
        with redirect_stdout(buf):
            try:
                codes[name] = fn(argparse.Namespace(limit=6))
            except Exception as e:
                codes[name] = 99
                print(f"  ! {name} è esploso: {e}")
    body = buf.getvalue()

    DIGEST_DIR.mkdir(parents=True, exist_ok=True)
    day = now().strftime("%Y-%m-%d")
    path = DIGEST_DIR / f"{day}.md"
    path.write_text(f"# Reddit u/{ACCOUNT} — giro del {day}\n{body}")
    print(body)
    print(f"\nDigest: {path}")

    # l'allarme suona solo per le due cose che hanno già ucciso il canale una volta
    problemi = []
    if codes.get("health") == 1:
        problemi.append("l'account non è visibile pubblicamente, oppure la cadenza è rotta")
    if codes.get("verify") == 1:
        problemi.append("una rimozione nuova: invio bloccato per 7 giorni")
    if problemi:
        _alert("Reddit u/Betredge", " · ".join(problemi) + f"\nDigest: {path}")
        return 1
    return 0


def cmd_log(a) -> int:
    print(json.dumps(load_log(), indent=2, ensure_ascii=False))
    return 0


def main() -> int:
    p = argparse.ArgumentParser(prog="reddit_ctl", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest="cmd", required=True)

    s = sp.add_parser("scan", help="thread candidati")
    s.add_argument("--limit", type=int, default=8)
    s.set_defaults(fn=cmd_scan)

    s = sp.add_parser("health", help="commenti vivi? giorni di silenzio?")
    s.set_defaults(fn=cmd_health)

    s = sp.add_parser("check", help="valida una bozza, senza rete")
    s.add_argument("file", nargs="?")
    s.add_argument("--kind", choices=["comment", "post"], default="comment")
    s.add_argument("--sub")
    s.set_defaults(fn=cmd_check)

    s = sp.add_parser("send", help="pubblica")
    s.add_argument("--file", required=True)
    s.add_argument("--kind", choices=["comment", "post"], default="comment")
    s.add_argument("--thing", help="t3_<id> per rispondere a un post, t1_<id> a un commento")
    s.add_argument("--sub")
    s.add_argument("--title")
    s.add_argument("--force", action="store_true", help="scavalca SOLO i limiti di cadenza")
    s.set_defaults(fn=cmd_send)

    s = sp.add_parser("verify", help="ricontrolla ciò che abbiamo pubblicato")
    s.set_defaults(fn=cmd_verify)

    s = sp.add_parser("daily", help="giro quotidiano non presidiato: digest + allarme")
    s.set_defaults(fn=cmd_daily)

    s = sp.add_parser("selftest", help="verifica il validatore (girare dopo ogni modifica)")
    s.set_defaults(fn=cmd_selftest)

    s = sp.add_parser("log", help="mostra il registro")
    s.set_defaults(fn=cmd_log)

    a = p.parse_args()
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
