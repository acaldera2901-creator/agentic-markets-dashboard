#!/usr/bin/env python3
"""Asset social BetRedge — v2.
Correzioni post-review AD: (1) font in-kit incorporati in base64 (non dalla rete),
(2) lockup UFFICIALE betredge-logo-white.png (non ri-assemblato a mano),
(3) via la seconda riga verde (il lockup ne ha già una).

Uso:  python3 docs/social/gen-assets.py     (da qualunque cwd)
Dipendenze: Pillow, Google Chrome, rete (solo la prima volta, per i font).
"""
import base64, os, re, subprocess, tempfile, urllib.request
from PIL import Image

# percorsi relativi al file, non assoluti: lo script gira anche fuori dal worktree
HERE = os.path.dirname(os.path.abspath(__file__))
W    = os.path.abspath(os.path.join(HERE, "..", ".."))   # radice del repo
OUT  = os.path.join(HERE, "assets")
SP   = os.path.join(tempfile.gettempdir(), "betredge-social-build")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for d in (OUT, f"{SP}/html", f"{SP}/fonts"):
    os.makedirs(d, exist_ok=True)

b64 = lambda p: base64.b64encode(open(p, "rb").read()).decode()

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
GF = ("https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;800"
      "&family=JetBrains+Mono:wght@700&display=swap")

# ── font in-kit: solo il subset LATINO di ogni peso, incorporato ──────────────
_css_path = f"{SP}/fonts/api.css"
if not os.path.exists(_css_path):
    req = urllib.request.Request(GF, headers={"User-Agent": UA})
    open(_css_path, "wb").write(urllib.request.urlopen(req).read())
css = open(_css_path).read()
faces = []
for blk in re.findall(r"@font-face\s*\{[^}]*\}", css):
    fam = re.search(r"font-family:\s*'([^']+)'", blk).group(1)
    wgt = re.search(r"font-weight:\s*(\d+)", blk).group(1)
    ur  = re.search(r"unicode-range:\s*([^;]+)", blk)
    url = re.search(r"url\((https://[^)]+\.woff2)\)", blk).group(1)
    if ur and "U+0000-00FF" in ur.group(1):
        faces.append((fam, wgt, url))
print("subset latini:", [(f, w) for f, w, _ in faces])

FONTCSS = ""
for fam, wgt, url in faces:
    fn = f"{SP}/fonts/latin_{fam.replace(' ','')}_{wgt}.woff2"
    if not os.path.exists(fn):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 Chrome/127"})
        open(fn, "wb").write(urllib.request.urlopen(req).read())
    FONTCSS += (f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{wgt};"
                f"src:url(data:font/woff2;base64,{b64(fn)}) format('woff2');}}\n")
    print(f"  incorporato {fam} {wgt} ({os.path.getsize(fn)} B)")

MARK = b64(f"{OUT}/brand-mark-transparent.png")            # mark isolato (versionato)
LOCKUP = b64(f"{W}/public/logos/betredge-logo-white.png")   # lockup UFFICIALE
LOCK_AR = Image.open(f"{W}/public/logos/betredge-logo-white.png").size  # 1390x459

BG, ACCENT, TEXT, MUTED = "#0B0C0E", "#23A559", "#EDEFF2", "#AEB4BE"

BASE = f"""<style>
{FONTCSS}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{background:{BG};font-family:'Hanken Grotesk',sans-serif;-webkit-font-smoothing:antialiased}}
.mono{{font-family:'JetBrains Mono',monospace}}
</style>"""

def render(name, html, w, h):
    f = f"{SP}/html/{name}.html"
    open(f, "w").write(f"<!doctype html><html><head><meta charset=utf-8>{BASE}</head><body>{html}</body></html>")
    png = f"{OUT}/{name}.png"
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=1", f"--window-size={w},{h}",
                    f"--screenshot={png}", f"file://{f}"], check=True,
                   capture_output=True, timeout=120)
    return png

# AVATAR — il mark del brand su fondo scuro; sta nel cerchio inscritto (60% del lato)
def avatar(s):
    return (f"<div style=\"width:{s}px;height:{s}px;background:{BG};display:flex;"
            f"align-items:center;justify-content:center\">"
            f"<img src='data:image/png;base64,{MARK}' style='height:{round(s*0.54)}px'></div>")

# BANNER — lockup ufficiale + claim + riga mono, tutto dentro la safe-area
def banner(w, h, sw, sh, claim, mono, lock_w, claim_px, mono_px):
    return f"""<div style="width:{w}px;height:{h}px;background:{BG};display:flex;
      align-items:center;justify-content:center;overflow:hidden">
      <div style="width:{sw}px;height:{sh}px;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;gap:{round(sh*0.085)}px">
        <img src="data:image/png;base64,{LOCKUP}" style="width:{lock_w}px">
        <div style="font-size:{claim_px}px;font-weight:600;color:{TEXT};
                    letter-spacing:-0.01em;text-align:center;line-height:1.25">{claim}</div>
        <div class="mono" style="font-size:{mono_px}px;font-weight:700;color:{MUTED};
                    letter-spacing:0.16em;text-transform:uppercase">{mono}</div>
      </div>
    </div>"""

CLAIM = "Model-calibrated probabilities for football &amp; tennis"
MONO  = "Model vs market &middot; betredge.com &middot; 18+"

jobs = [
    ("tiktok-avatar-800",  avatar(800), 800, 800),
    ("youtube-avatar-800", avatar(800), 800, 800),
    ("discord-icon-512",   avatar(512), 512, 512),
    ("youtube-banner-2560x1440",
     banner(2560, 1440, 1546, 423, CLAIM, MONO, 520, 46, 20), 2560, 1440),
    ("discord-banner-960x540",
     banner(960, 540, 860, 430, CLAIM, MONO, 330, 28, 12), 960, 540),
    ("discord-invite-splash-1920x1080",
     banner(1920, 1080, 1500, 720, CLAIM, MONO, 560, 50, 22), 1920, 1080),
]
print()
for name, html, w, h in jobs:
    p = render(name, html, w, h)
    print(f"{name:38s} -> {Image.open(p).size}  {os.path.getsize(p)//1024} KB")
