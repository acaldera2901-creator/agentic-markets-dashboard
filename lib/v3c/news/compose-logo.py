# Composes the OFFICIAL BetRedge logo (white, transparent PNG from public/logos) on the top-left of a card.
# Local, deterministic: the model never draws the logo. Usage: compose-logo.py base.png out.png logo.png
import sys
from PIL import Image
base_p, out_p, logo_p = sys.argv[1:4]
base = Image.open(base_p).convert("RGBA")
logo = Image.open(logo_p).convert("RGBA")
bb = logo.getbbox()
if bb: logo = logo.crop(bb)
w = int(base.width * 0.30)
h = int(logo.height * w / logo.width)
base.alpha_composite(logo.resize((w, h), Image.LANCZOS), (int(base.width * 0.045), int(base.height * 0.032)))
base.convert("RGB").save(out_p)
print(w, h, base.size)
