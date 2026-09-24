# Round 15 — deriva le icone NAV dai master 1254² in src-icons/<name>.png → public/icons/, in place.
#   nav-{home,live,football,tennis,tools}.png + -sm.png           (nav in alto, NavIcon in app/components/menu-icon.tsx)
#   bottomnav-{home,live,watchlist,tools,profile}.png + -sm.png   (bottom bar mobile, wiring a cura di programmatore-andrea)
# Home/Live/Tools: stesso master per entrambi i set (una voce = una icona in tutto il sito).
# Stessa ricetta del round 4/14: alpha del corpo (Codex esce a 252–253) normalizzata a 255 sopra 250; thumbnail LANCZOS centrata.
import sys, os
from PIL import Image
ROOT=os.path.dirname(os.path.abspath(__file__)); WT=os.path.abspath(ROOT+'/../../..'); SRC=ROOT+'/src-icons/'
TARGETS={'nav-home':'home','nav-live':'live','nav-football':'football','nav-tennis':'tennis','nav-tools':'tools',
         'bottomnav-home':'home','bottomnav-live':'live','bottomnav-watchlist':'watchlist','bottomnav-tools':'tools','bottomnav-profile':'profile'}
def load(p):
    im=Image.open(p).convert('RGBA'); im.putalpha(im.getchannel('A').point(lambda v:255 if v>=250 else v)); return im
def out(im,s,dest):
    o=im.copy(); o.thumbnail((s,s),Image.LANCZOS); c=Image.new('RGBA',(s,s),(0,0,0,0)); c.alpha_composite(o,((s-o.width)//2,(s-o.height)//2)); c.save(dest); return c
done=[]
for dest,src in TARGETS.items():
    p=SRC+src+'.png'
    if not os.path.exists(p): print('MANCA master',p); continue
    im=load(p); out(im,320,f'{WT}/public/icons/{dest}.png'); out(im,64,f'{WT}/public/icons/{dest}-sm.png'); done.append(dest)
print(len(done),'icone derivate (x2 dim.):',', '.join(done))
# foglio di verifica dai DERIVATI (non dai master): 320→96 e -sm→44/32/24/22, su pannello scuro e chiaro
if len(sys.argv)>1:
    names=sorted(set(TARGETS.values()), key=list(TARGETS.values()).index)
    def first(n): return next(d for d,s in TARGETS.items() if s==n)
    cols=len(names); sheet=Image.new('RGB',(cols*150,2*175),(90,90,90))
    for k,bg in enumerate([(13,35,67),(255,252,244)]):
        row=Image.new('RGB',(cols*150,175),bg)
        for i,n in enumerate(names):
            d=first(n)
            big=Image.open(f'{WT}/public/icons/{d}.png').resize((96,96),Image.LANCZOS); row.paste(big,(i*150+27,5),big)
            sm=Image.open(f'{WT}/public/icons/{d}-sm.png')
            for j,w in enumerate([44,32,24,22]):
                s=sm.resize((w,w),Image.LANCZOS); row.paste(s,(i*150+5+j*36,110+(50-w)//2),s)
        sheet.paste(row,(0,k*175))
    sheet=sheet.resize((sheet.width*2,sheet.height*2),Image.NEAREST); sheet.save(sys.argv[1]+'/nav-final-check.png'); print('sheet ok')
