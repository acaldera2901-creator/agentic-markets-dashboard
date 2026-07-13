#!/usr/bin/env python3
# build-icon-preview.py — genera la pagina di review delle nuove icone rail,
# inlinando le PNG come data-URI (CSP Artifact blocca risorse esterne).
import base64, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(ROOT, "public/icons/_candidates/processed")
ICONS = os.path.join(ROOT, "public/icons")
BAN = os.path.join(ROOT, "public/banners")
OUT = "/private/tmp/claude-501/-Users-calde/c5b93d11-83fe-46f8-91ee-881099f0ce0e/scratchpad/icon-preview.html"


def uri(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()

# nuove (processed): master + sm
NEW = {
    "leaderboard": ("Classifica", "leaderboard · rail Desk", "#g-rank"),
    "invite":      ("Invita", "invita · rail Desk", "#g-desk (generico)"),
    "weeklypick":  ("Weekly Pick", "weekly-pick · In evidenza", "#g-ticket"),
    "account":     ("Account", "account · dropdown / bar", "#g-acct"),
}
new_uri = {k: {"lg": uri(f"{PROC}/menu-{k}.png"), "sm": uri(f"{PROC}/menu-{k}-sm.png")} for k in NEW}

# esistenti per confronto (sm) + master per detail
EX = {
    "prediction": "Predizioni", "history": "Storico", "builder": "Match Builder",
    "plans": "Piani", "creator": "Creator Picks",
}
ex_uri = {k: uri(f"{ICONS}/menu-{k}-sm.png") for k in EX}
ex_master = {k: uri(f"{ICONS}/menu-{k}.png") for k in ("prediction", "history")}
wc_uri = uri(f"{BAN}/sport-worldcup-sm.png")

# ── rail mock: ordine reale dell'app ──
DESK = [
    ("prediction", "Predizioni", False), ("history", "Storico", False),
    ("leaderboard", "Classifica", True), ("builder", "Match Builder", False),
    ("invite", "Invita", True), ("plans", "Piani", False),
]
FEAT = [("wc", "World Cup", False), ("creator", "Creator Picks", False), ("weeklypick", "Weekly Pick", True)]


def img_sm(key, size=18):
    if key == "wc":
        src = wc_uri
    elif key in new_uri:
        src = new_uri[key]["sm"]
    else:
        src = ex_uri[key]
    return f'<img src="{src}" width="{size}" height="{size}" alt="" style="width:{size}px;height:{size}px;object-fit:contain;display:block;flex:0 0 auto">'


def rail_row(key, label, is_new):
    cls = "rail-item" + (" is-new" if is_new else "")
    badge = '<span class="tag">NUOVA</span>' if is_new else ""
    return f'<button class="{cls}">{img_sm(key)}<span class="rl">{label}</span>{badge}</button>'


rail_desk = "\n".join(rail_row(*r) for r in DESK)
rail_feat = "\n".join(rail_row(*r) for r in FEAT)

# ── card per ogni nuova icona ──
def card(key):
    label, ctx, old = NEW[key]
    u = new_uri[key]
    sizes = "".join(
        f'<div class="szc"><div class="szbox" style="width:{s}px;height:{s}px"><img src="{u["sm"]}" style="width:{s}px;height:{s}px;object-fit:contain"></div><span class="szn">{s}px</span></div>'
        for s in (17, 18, 20, 24)
    )
    return f"""<article class="card">
  <div class="card-hd"><h3>{label}</h3><span class="tag">NUOVA</span></div>
  <div class="hero"><img src="{u['lg']}" alt="{label}"></div>
  <div class="meta"><span class="k">Contesto</span><span class="v">{ctx}</span></div>
  <div class="meta"><span class="k">Sostituisce</span><span class="v mono">{old}</span></div>
  <div class="sizes-lab">Dimensioni reali d'uso</div>
  <div class="sizes">{sizes}</div>
</article>"""

cards = "\n".join(card(k) for k in NEW)

# ── striscia confronto stile: nuove accanto a esistenti @18px ──
cmp_new = "".join(f'<div class="cmp-i"><span class="cn">NUOVA</span>{img_sm(k,18)}<span class="cl">{NEW[k][0]}</span></div>' for k in NEW)
cmp_old = "".join(f'<div class="cmp-i">{img_sm(k,18)}<span class="cl">{EX[k]}</span></div>' for k in EX)

HTML = f"""<style>
:root {{
  --bg:#0b0f14; --surface:#0d1117; --surface2:#111823; --line:#1e2631;
  --text:#e6edf3; --dim:#8b98a9; --accent:#23A559; --gold:#d9b45b;
}}
:root[data-theme="light"] {{
  --bg:#eef1f4; --surface:#ffffff; --surface2:#f4f6f9; --line:#dce2ea;
  --text:#0d1520; --dim:#5a6675; --accent:#15803D; --gold:#a8801f;
}}
* {{ box-sizing:border-box; }}
body {{ margin:0; }}
.page {{
  font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
  background:var(--bg); color:var(--text); min-height:100vh;
  padding:40px 28px 72px; line-height:1.5;
  -webkit-font-smoothing:antialiased;
}}
.wrap {{ max-width:1080px; margin:0 auto; }}
.eyebrow {{ font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); font-weight:700; }}
h1 {{ font-size:30px; margin:8px 0 6px; letter-spacing:-.02em; text-wrap:balance; }}
.sub {{ color:var(--dim); font-size:14px; max-width:60ch; margin:0; }}
.tag {{ font-size:9px; font-weight:800; letter-spacing:.1em; color:var(--accent);
  border:1px solid color-mix(in srgb,var(--accent) 45%,transparent); border-radius:999px;
  padding:2px 7px; text-transform:uppercase; }}
h2.sec {{ font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--dim);
  margin:44px 0 16px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:8px; }}

/* ── rail mock ── */
.layout {{ display:grid; grid-template-columns:232px 1fr; gap:28px; align-items:start; }}
.rail {{ background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:14px 10px; display:flex; flex-direction:column; gap:3px; }}
.rail-lab {{ font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--dim); padding:6px 10px 4px; font-weight:700; }}
.rail-sep {{ height:1px; background:var(--line); margin:8px 6px; }}
.rail-item {{ display:flex; align-items:center; gap:11px; background:none; border:0; color:var(--text);
  font:inherit; font-size:13.5px; text-align:left; padding:8px 10px; border-radius:9px; cursor:default; width:100%; position:relative; }}
.rail-item:hover {{ background:var(--surface2); }}
.rail-item.is-new {{ background:color-mix(in srgb,var(--accent) 9%,transparent); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 26%,transparent); }}
.rail-item .rl {{ flex:1; }}
.rail-item .tag {{ font-size:8px; padding:1px 5px; }}
.rail-note {{ color:var(--dim); font-size:13px; align-self:start; }}
.rail-note b {{ color:var(--text); font-weight:600; }}

/* ── card grid ── */
.grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:16px; }}
.card {{ background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:18px; }}
.card-hd {{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }}
.card-hd h3 {{ margin:0; font-size:16px; letter-spacing:-.01em; }}
.hero {{ display:flex; align-items:center; justify-content:center; height:132px;
  background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 68%);
  border-radius:10px; margin-bottom:14px; }}
.hero img {{ width:104px; height:104px; object-fit:contain; filter:drop-shadow(0 6px 18px rgba(0,0,0,.5)); }}
.meta {{ display:flex; justify-content:space-between; gap:12px; font-size:12.5px; padding:5px 0; border-top:1px solid var(--line); }}
.meta .k {{ color:var(--dim); }}
.meta .v {{ text-align:right; }}
.mono {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11.5px; color:var(--gold); }}
.sizes-lab {{ font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--dim); margin:14px 0 8px; font-weight:700; }}
.sizes {{ display:flex; gap:14px; align-items:flex-end; }}
.szc {{ display:flex; flex-direction:column; align-items:center; gap:5px; }}
.szbox {{ display:flex; align-items:center; justify-content:center; }}
.szn {{ font-size:10px; color:var(--dim); font-variant-numeric:tabular-nums; }}

/* ── comparison ── */
.cmp {{ background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:18px 20px; }}
.cmp-row {{ display:flex; flex-wrap:wrap; gap:18px 22px; align-items:center; }}
.cmp-cap {{ font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--dim); font-weight:700; margin:0 0 12px; }}
.cmp-i {{ display:flex; align-items:center; gap:8px; }}
.cmp-i .cl {{ font-size:13px; }}
.cmp-i .cn {{ font-size:8px; font-weight:800; letter-spacing:.08em; color:var(--accent); }}
.cmp-div {{ height:1px; background:var(--line); margin:18px 0; }}
footer {{ color:var(--dim); font-size:12.5px; margin-top:40px; padding-top:18px; border-top:1px solid var(--line); }}
footer b {{ color:var(--text); }}
</style>
<div class="page"><div class="wrap">
  <div class="eyebrow">BetRedge · Maven Studio</div>
  <h1>4 nuove icone rail — review</h1>
  <p class="sub">Icone custom 3D (oro + smeraldo, scia di luce) per le voci del rail che usano ancora un glifo SVG. Stesso pattern raster delle esistenti: master 320px + variante <span class="mono" style="color:var(--gold)">-sm</span> 64px per i formati ≤24px. Sfondo scuro = contesto reale dell'app.</p>

  <h2 class="sec">Il rail, in situ (icone a 18px)</h2>
  <div class="layout">
    <nav class="rail" aria-label="mock rail">
      <span class="rail-lab">Desk</span>
      {rail_desk}
      <span class="rail-sep"></span>
      <span class="rail-lab">In evidenza</span>
      {rail_feat}
    </nav>
    <p class="rail-note">Le 3 righe evidenziate in verde sono i gap riempiti nel rail: <b>Classifica</b>, <b>Invita</b>, <b>Weekly Pick</b>. La 4ª, <b>Account</b>, vive nel dropdown/bar (stessa icona, sotto). Le altre righe sono le icone custom già live, per verificare la coerenza di stile a colpo d'occhio.</p>
  </div>

  <h2 class="sec">Dettaglio · le 4 nuove</h2>
  <div class="grid">
    {cards}
  </div>

  <h2 class="sec">Confronto di stile @18px</h2>
  <div class="cmp">
    <p class="cmp-cap">Nuove</p>
    <div class="cmp-row">{cmp_new}</div>
    <div class="cmp-div"></div>
    <p class="cmp-cap">Già live (riferimento)</p>
    <div class="cmp-row">{cmp_old}</div>
  </div>

  <footer>
    Asset in <b>public/icons/_candidates/processed/</b> — non ancora wired. Su tuo GO: sposto in <b>public/icons/</b>, estendo <b>MenuIcon</b> + <b>RAIL_ICONS</b>, sostituisco i glifi di Weekly Pick e Account, poi <b>branch + PROPOSAL</b> prima del merge/deploy.
  </footer>
</div></div>
"""

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    f.write(HTML)
print("wrote", OUT, os.path.getsize(OUT), "bytes")
