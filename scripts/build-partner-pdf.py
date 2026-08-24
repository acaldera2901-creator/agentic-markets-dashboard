#!/usr/bin/env python3
"""#WIDGET-LANDING-0824 — genera il PDF della guida partner.

Uso:  python3 scripts/build-partner-pdf.py [output.pdf]

Le due schermate del widget vengono catturate DAL SITO IN ESECUZIONE (dev su
:3010 o produzione) e incorporate come data URI: un PDF che mostra un mockup
invecchia in silenzio, uno che mostra il widget vero no.
"""
import base64, io, sys, subprocess
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs/partners/widget-guide.html"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Desktop" / "BetRedge-Widget-Partner-Guide.pdf"
BASE = "http://localhost:3010"

SHOTS = [
    ("__LIGHT__", f"{BASE}/embed?sport=all&limit=3&lang=it&theme=light&host=partner-site.com", 560),
    ("__DARK__",  f"{BASE}/embed?sport=tennis&limit=4&lang=en&theme=dark&host=partner-site.com", 360),
]

def shot(pw, url, width):
    pg = pw.new_page(viewport={"width": width, "height": 700}, device_scale_factor=2)
    pg.goto(url, wait_until="networkidle"); pg.wait_for_timeout(900)
    png = pg.query_selector(".br-w").screenshot()
    pg.close()
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im.thumbnail((1000, 1000), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def main():
    html = SRC.read_text()
    with sync_playwright() as p:
        b = p.chromium.launch()
        for token, url, w in SHOTS:
            html = html.replace(token, shot(b, url, w))
        tmp = ROOT / ".widget-guide.build.html"
        tmp.write_text(html)
        pg = b.new_page()
        pg.goto(tmp.as_uri(), wait_until="networkidle"); pg.wait_for_timeout(1200)
        pg.pdf(path=str(OUT), format="A4", print_background=True,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        b.close()
        tmp.unlink()
    print(f"PDF: {OUT} ({OUT.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
