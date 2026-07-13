#!/usr/bin/env python3
# process-menu-icon.py — porta un render sorgente (fondo piatto bianco o magenta)
# al formato icona di casa: knockout sfondo -> alpha (flood-fill dal bordo, protegge
# i pixel chiari DENTRO l'oggetto), autocrop, pad quadrato con margine, master 320px
# + variante -sm 64px. Stesso output del set #MENU-ICONS esistente.
#
# Uso: process-menu-icon.py <src.png> <out_basename> [out_dir]
#   -> <out_dir>/<out_basename>.png (320) + <out_dir>/<out_basename>-sm.png (64)
import sys, os
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

WORK = 768        # risoluzione di keying (edge puliti al downscale)
TOL = 42          # distanza colore per considerare un pixel "sfondo"
MARGIN = 0.07     # margine trasparente attorno all'oggetto (frazione del lato)


def knockout(src_path):
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    scale = WORK / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    arr = np.asarray(im).astype(np.int16)
    H, W = arr.shape[:2]
    # colore di sfondo = mediana dei pixel di bordo
    border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]], axis=0)
    bg = np.median(border, axis=0)
    dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))
    cand = dist < TOL                       # pixel candidati-sfondo (per colore)
    # flood-fill dal bordo: solo lo sfondo CONNESSO al bordo diventa trasparente,
    # i pixel chiari interni all'oggetto (highlight oro) restano opachi.
    isbg = np.zeros((H, W), bool)
    dq = deque()
    for x in range(W):
        for y in (0, H - 1):
            if cand[y, x] and not isbg[y, x]:
                isbg[y, x] = True; dq.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if cand[y, x] and not isbg[y, x]:
                isbg[y, x] = True; dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and cand[ny, nx] and not isbg[ny, nx]:
                isbg[ny, nx] = True; dq.append((ny, nx))
    alpha = np.where(isbg, 0, 255).astype(np.uint8)
    rgb = np.asarray(im).astype(np.uint8).copy()
    # despill magenta: se lo sfondo era magenta, smorza l'alone viola sui bordi
    if bg[0] > 180 and bg[1] < 90 and bg[2] > 180:
        edge = (alpha > 0) & (alpha < 255)
        r, g, b = rgb[..., 0].astype(np.int16), rgb[..., 1].astype(np.int16), rgb[..., 2].astype(np.int16)
        cap = g + 30
        mag = edge | ((r > g + 40) & (b > g + 40))
        rgb[..., 0] = np.where(mag, np.minimum(r, cap), r).astype(np.uint8)
        rgb[..., 2] = np.where(mag, np.minimum(b, cap), b).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb, alpha]), "RGBA")
    # ammorbidisci il bordo alpha (antialias)
    a = out.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    out.putalpha(a)
    return out


def finalize(out, base, out_dir):
    bbox = out.getbbox()
    out = out.crop(bbox)
    w, h = out.size
    side = max(w, h)
    canvas = round(side * (1 + 2 * MARGIN))
    sq = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    sq.paste(out, ((canvas - w) // 2, (canvas - h) // 2), out)
    os.makedirs(out_dir, exist_ok=True)
    master = sq.resize((320, 320), Image.LANCZOS)
    master.save(os.path.join(out_dir, base + ".png"))
    sm = sq.resize((64, 64), Image.LANCZOS)
    sm.save(os.path.join(out_dir, base + "-sm.png"))
    print(f"{base}: {os.path.join(out_dir, base + '.png')} (320) + -sm (64)")


if __name__ == "__main__":
    src, base = sys.argv[1], sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else "public/icons/_candidates/processed"
    finalize(knockout(src), base, out_dir)
