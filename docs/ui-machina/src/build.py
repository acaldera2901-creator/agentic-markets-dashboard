#!/usr/bin/env python3
"""Ricostruisce la preview autonoma di #UI-MACHINA-0802.

Inlina font, immagini e dati in un unico file: si apre offline, senza rete.
Uso:  python3 build.py en|it  <cartella-assets>  <file-uscita.html>

Gli assets attesi nella cartella: hanken.woff2, jbmono.woff2, i file in img/
(scene, oggetti, icone del rail, banner di Ole, logo). Vedi README.md.
"""
import base64, json, pathlib, re, sys

lang, assets, outp = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
here = pathlib.Path(__file__).parent
title = ("BetRedge — Predictive Sports Intelligence" if lang == "en"
         else "BetRedge — frontend nuovo, pagina per pagina")
html = (f"<title>{title}</title>\n\n<style>\n" + (here.parent / "machina.css").read_text()
        + "\n</style>\n\n" + (here / f"preview-body-{lang}.html").read_text())
html = html.replace("{{DATA}}", json.dumps(json.load(open(here / f"data-{lang}.json")),
                                           ensure_ascii=False, separators=(",", ":")))
SUB = {
    "HANKEN": "hanken.woff2", "JBMONO": "jbmono.woff2",
    "S_STADIUM": "img/s-stadium.jpg", "S_COURT": "img/s-court.jpg", "S_CLAY": "img/s-clay.jpg",
    "STADIUM_CROWD": "img/stadium-crowd.jpg", "FOOTBALL_PITCH": "img/football-pitch.jpg",
    "O_FOOTBALLER": "img/o-footballer.webp", "O_TENNIS": "img/o-tennisplayer.webp",
    "O_BOOT": "img/o-boot.webp",
    "BAN1": "img/ban-1.jpg", "BAN2": "img/ban-2.jpg", "BAN3": "img/ban-3.jpg",
    "IC_FOOTBALL": "img/ic-football.png", "IC_TENNIS": "img/ic-tennis.png",
    "M_PREDICTION": "img/m-prediction.png", "M_HISTORY": "img/m-history.png",
    "M_LEADERBOARD": "img/m-leaderboard.png", "M_BUILDER": "img/m-builder.png",
    "M_INVITE": "img/m-invite.png", "M_PLANS": "img/m-plans.png",
    "M_CREATOR": "img/m-creator.png", "M_WEEKLY": "img/m-weeklypick.png",
    "M_PARTNER": "img/m-partner.png", "LOGO_W": "img/betredge-logo-white.webp",
    "P_FORTUNEPLAY": "img/p-fortuneplay.svg", "P_YBETS": "img/p-ybets.svg",
    "P_BETSCORE": "img/p-betscore.svg", "P_FELICEBET": "img/p-felicebet.webp",
    "P_VELOBET": "img/p-velobet.webp", "P_CASEA": "img/p-casea.webp",
    "P_SLOTSBONUS": "img/p-slotsbonus.svg", "P_STAKE": "img/p-stake.svg",
    "P_ROOBET": "img/p-roobet.svg",
}
for key, rel in SUB.items():
    p = assets / rel
    if not p.exists():          # placeholder assente = errore rumoroso, non silenzioso
        sys.exit(f"asset mancante: {p}")
    html = html.replace("{{" + key + "}}", base64.b64encode(p.read_bytes()).decode())
left = re.findall(r"\{\{\w+\}\}", html)
if left:
    sys.exit(f"placeholder non sostituiti: {sorted(set(left))}")
outp.write_text(
    f'<!doctype html>\n<html lang="{lang}">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    '<meta name="robots" content="noindex">\n</head>\n<body>\n' + html + "\n</body>\n</html>\n")
print(outp, round(outp.stat().st_size / 1024 / 1024, 2), "MB")
