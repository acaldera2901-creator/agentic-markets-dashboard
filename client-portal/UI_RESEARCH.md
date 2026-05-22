# UI Research — Agentic Markets Client Portal Upgrade
*Ricerca condotta il 2026-05-17 dall'agente UI Andrea*

---

## Stato Attuale (baseline osservato)

Il portal funziona con dark theme su `#0a0a0a`, area chart verde Recharts, KPI cards flat con bordi sottili, sidebar fissa 220px. Il look è pulito ma assomiglia a un shadcn starter kit: nessuna animazione di entry sulle card, nessun effetto visivo che comunichi "capitale gestito professionalmente". La gerarchia visiva è piatta — tutte le card hanno lo stesso peso, il chart e i KPI non hanno differenziazione di importanza.

---

## 1. TOP 10 COMPONENTI DA IMPLEMENTARE

### 1. Number Ticker (KPI counter animation)
**Fonte:** Magic UI — `magicui.design/docs/components/number-ticker`
**Perche:** I valori di saldo, P&L e win rate sono statici al mount. Il Number Ticker anima il conteggio da 0 al valore reale quando la card entra in viewport. Impatto visivo massimo su KPI cards, zero dipendenze extra oltre framer-motion. Pattern usato da ogni fintech premium (Robinhood, Stripe Dashboard, Linear).
**Installazione:** `npx shadcn@latest add "https://magicui.design/r/number-ticker"`

### 2. Border Beam (KPI card highlight)
**Fonte:** Magic UI — `magicui.design/docs/components/border-beam`  
**Perche:** Un fascio di luce che scorre lungo il bordo della card selezionata o al hover. Perfetto per la card "Saldo Attuale" o per la card del P&L — crea un effetto premium immediato senza essere rumoroso. Il fascio è un singolo div animato via CSS, nessun impatto su performance.
**Installazione:** `npx shadcn@latest add "https://magicui.design/r/border-beam"`

### 3. Magic Card (hover glow effect)
**Fonte:** Magic UI — `magicui.design/docs/components/magic-card`
**Perche:** Aggiunge un glow radiale che segue il cursore mouse sulle KPI cards. Mode "orb" con colore verde `#00ff88` segue il pattern accent già stabilito. Le card del portal attualmente non hanno stato hover visivamente ricco — questo risolve con una riga di wrapper.
**Installazione:** `npx shadcn@latest add "https://magicui.design/r/magic-card"`

### 4. Shimmer Button (CTA depositi)
**Fonte:** Magic UI — `magicui.design/docs/components/shimmer-button`
**Perche:** Il bottone "Richiedi Deposito" nella sezione depositi è attualmente un button shadcn standard. Shimmer Button aggiunge un effetto shimmer che scorre lungo il bordo — usato da Linear, Vercel, Resend per i CTA principali. Comunica urgency senza essere aggressivo.
**Installazione:** `npx shadcn@latest add "https://magicui.design/r/shimmer-button"`

### 5. Blur Fade (page entry animation)
**Fonte:** Magic UI — `magicui.design/docs/components/blur-fade`
**Perche:** Sostituisce l'attuale `animate-slide-up` con un fade+blur combinato. I componenti appaiono sequenzialmente con delay configurabile — dashboard → KPI cards → chart → tabella, ognuno con +0.1s delay. Effetto molto più premium dell'attuale slide-up flat.
**Installazione:** `npx shadcn@latest add "https://magicui.design/r/blur-fade"`

### 6. Animated Beam (sidebar navigation indicator)
**Fonte:** Magic UI — `magicui.design/docs/components/animated-beam`
**Perche:** Un beam che connette i nodi del nav. Nella sidebar attuale il nav attivo è solo un background highlight. Con Animated Beam si può creare un indicatore animato che "scorre" verso la voce selezionata. Alternativa: usarlo nella sezione Depositi per connettere visivamente i metodi di pagamento disponibili.
**Installazione:** `npx shadcn@latest add "https://magicui.design/r/animated-beam"`

### 7. Meteors (background hero section)
**Fonte:** Magic UI — `magicui.design/docs/components/meteors`
**Perche:** Aggiunge meteore/particelle che attraversano il background del header di pagina (la sezione "Ciao, demo" in cima alla dashboard). Effetto sottile se ridotto in quantità (3-5 meteore) — simile a quello usato da molti crypto e fintech dashboard per dare profondità al background nero.
**Installazione:** `npx shadcn@latest add "https://magicui.design/r/meteors"`

### 8. Background Paths (login/landing page)
**Fonte:** 21st.dev — `21st.dev/community/components/kokonutd/background-paths/default`
**Perche:** SVG paths animati che attraversano il background come circuiti. Perfetto per la login page del portal — suggerisce trading algorithms, dati in movimento. Usa solo framer-motion. Non adatto alla dashboard principale (troppo rumoroso per un contesto data-heavy) ma eccellente per onboarding/login.
**Installazione:** `npx shadcn@latest add "https://21st.dev/r/kokonutd/background-paths"`

### 9. Shine Border / Neon Button (status pills e badge)
**Fonte:** 21st.dev Borders — `21st.dev/community/components/magicui/shine-border/default`
**Perche:** I status pills WON/LOST/PENDING attuali sono buoni ma piatti. Aggiungere un Shine Border animato al pill "WON" (verde) quando una bet è appena registrata come won darebbe un feedback visivo premium. Alternativa leggera: classe CSS con `background: linear-gradient` animato.
**Installazione:** `npx shadcn@latest add "https://magicui.design/r/shine-border"`

### 10. Bento Grid (layout alternativo dashboard)
**Fonte:** 21st.dev — `21st.dev/community/components/kokonutd/bento-grid/default`
**Perche:** Il layout attuale della dashboard è rigidamente a righe. Un Bento Grid permetterebbe di dare al chart equity una cella grande (2x2), ai KPI celle piccole, e all'allocazione pie una cella media. Pattern usato da Vercel, Linear, Notion per dashboard di prodotto. Richiede refactor del layout ma impatto visivo massimo.
**Installazione:** `npx shadcn@latest add "https://21st.dev/r/kokonutd/bento-grid"`

---

## 2. PALETTE E STILE RACCOMANDATO

### Colori (basati su pattern esistente + upgrade glassmorphism 2026)

```
Background principale:   #080808  (leggermente più scuro dell'attuale #0a0a0a)
Panel background:        rgba(255, 255, 255, 0.03)  (glass invece di #1a1a1a)
Panel border:            rgba(255, 255, 255, 0.07)  (invariato — già buono)
Panel glass hover:       rgba(255, 255, 255, 0.05)

Accent positivo (P&L +): #00ff88  (invariato — già consolidato)
Accent negativo (P&L -): #ff4444  (invariato)
Accent secondario:       #00d4ff  (azzurro elettrico — per "Bet Attive" e status PENDING)
Accent neutro:           #888888  (per label secondari)

KPI value color:         #ffffff  (bianco puro per massimo contrasto)
KPI label color:         rgba(255,255,255,0.45)  (upgrade da opacità attuale)

Chart line:              #00ff88 su gradiente #00ff8820 → transparent
Chart tooltip bg:        rgba(10, 10, 10, 0.95) backdrop-blur(12px)

Glassmorphism cards:
  background:            rgba(255,255,255,0.03)
  backdrop-filter:       blur(12px)
  border:                1px solid rgba(255,255,255,0.08)
  box-shadow:            0 8px 32px rgba(0,0,0,0.4), 
                         inset 0 1px 0 rgba(255,255,255,0.05)
```

### Font system (upgrade da Inter puro)

```
Display / KPI values:    Inter 800  (invariato)
UI Labels uppercase:     Inter 500 / ui-monospace  (invariato)
Numero grandi (saldo):   "Tabular Nums" — aggiungere font-variant-numeric: tabular-nums
                         Questo allinea le cifre verticalmente nelle KPI cards
Body / tabella:          Inter 400, size 13px  (invariato)

NEW — aggiungere a globals.css:
  font-variant-numeric: tabular-nums;  su tutti i valori monetari
  font-feature-settings: "tnum";
```

### Spacing system

Il sistema attuale (16px padding cards, 8/12/16/24/32 scale) è solido. L'upgrade riguarda:
- **Gap tra KPI cards:** da `gap-4` a `gap-3` (le card sembrano più parte di un sistema coeso)
- **Chart container:** aggiungere `padding: 24px` interno invece degli attuali 16px
- **Header section:** aggiungere `padding-bottom: 32px` sotto il titolo di pagina per più respiro

---

## 3. ANIMAZIONI PRIORITARIE

### Entry animations (implementazione raccomandata)

**Sequenza dashboard al mount:**
```
1. Header "Ciao, [nome]"        → BlurFade delay=0ms     duration=400ms
2. KPI Card 1 (Saldo)           → BlurFade delay=100ms   duration=400ms
3. KPI Card 2 (P&L)             → BlurFade delay=150ms   duration=400ms
4. KPI Card 3 (Win Rate)        → BlurFade delay=200ms   duration=400ms
5. KPI Card 4 (Bet Attive)      → BlurFade delay=250ms   duration=400ms
6. Equity Chart container       → BlurFade delay=300ms   duration=500ms
7. Allocation Pie               → BlurFade delay=350ms   duration=500ms
8. Tabella scommesse            → BlurFade delay=400ms   duration=400ms
```

**Number Ticker sui KPI (specifiche):**
```
Saldo:     ticker da 0 a €X.XXX in 1200ms easing easeOut
P&L:       ticker da 0 a +€XXX in 1000ms — colore cambia da white a #00ff88 alla fine
Win Rate:  ticker da 0% a 75.0% in 800ms — aggiunge "%" solo dopo animation complete
Bet Attive: ticker istantaneo (numero intero piccolo — nessuna animazione necessaria)
```

**Hover effects:**
```
KPI cards:   scale(1.01) + border-color da rgba(255,255,255,0.07) a rgba(255,255,255,0.15)
             transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)
Tabella row: background da transparent a rgba(255,255,255,0.02)
             (invariato — già implementato, buono)
Sidebar nav: background highlight già presente, aggiungere
             left border accent verde con width transition 0→3px in 150ms
```

**Chart interactivity:**
```
Recharts AreaChart — aggiungere:
  activeDot={{ r: 6, fill: '#00ff88', stroke: '#080808', strokeWidth: 2 }}
  Il punto attivo al hover diventa più visibile e di qualità premium
```

**Page transition (route change):**
```
Wrappare ogni page in <AnimatePresence> con:
  initial: { opacity: 0, y: 8 }
  animate: { opacity: 1, y: 0 }
  exit:    { opacity: 0, y: -8 }
  transition: { duration: 0.2 }
```

---

## 4. 3D ASSESSMENT — Vale la pena Three.js/R3F?

### Valutazione diretta

**Risposta breve: NO per il MVP, SI per una specifica feature opzionale.**

Il progetto usa React 19 + Next.js 16. React Three Fiber (R3F) è compatibile con React 19 dalla versione 8.x, ma aggiunge:
- Bundle size: +500-800KB gzipped
- Complessità setup: SSR richiede `dynamic(() => import(...), { ssr: false })`
- Tempo implementazione: 1-3 giorni per qualcosa di qualità
- Rischio: WebGL non è supportato su tutti i device mobili entry-level

### Dove Three.js/R3F avrebbe senso (feature futura, non MVP)

**Globo 3D nella sezione "Allocazione geografica"** (se il fondo espande a sport internazionali):
- Libreria: `react-globe.gl` (wrapper Three.js, molto più semplice di R3F puro)
- Esempio diretto: `vasturiano.github.io/react-globe.gl/`
- Permette di mostrare punti luminosi sulle città dove ci sono partite attive
- Impatto visivo estremo — è il tipo di feature che impressiona investitori in una demo
- npm: `react-globe.gl` — 4.2KB gzip, zero Three.js knowledge richiesto

**Particelle background nel login screen** (alternativa a Background Paths):
- Libreria: `@tsparticles/react` o il Particles component di Magic UI
- Configurazione: 30-50 particelle verdi su background nero, movimento lento
- Molto più leggero di Three.js completo
- npm: `@tsparticles/engine` + `@tsparticles/react`

### Link a esempi concreti trovati

- Globe 3D finance: `https://vasturiano.github.io/react-globe.gl/` (demo ufficiale)
- Heat Globe (Next.js 15 + R3F + finance data): `https://dev.to/heat_globe/how-i-built-a-real-time-3d-interactive-data-globe-with-visualization-platform-55ci`
- Money Visualizer (Three.js + R3F finance): `https://discourse.threejs.org/t/money-visualizer-interactive-3d-currency-visualization/90198`

### Conclusione 3D

Per il portal attuale, investire in Three.js non è il ROI migliore. Le animazioni 2D di framer-motion + glassmorphism + Number Ticker danno il 90% dell'impatto visivo con il 10% della complessità. Aggiungere un globo come feature opzionale nella sezione "Performance" (es. una card "Mercati coperti" con globo rotante) è una feature da pianificare per v2.

---

## 5. LISTA LIBRERIE NPM DA INSTALLARE

### Critica — compatibilità React 19 verificata

Il progetto usa `react@19.2.4` e `next@16.2.6`. Nota: framer-motion 12.x non è ufficialmente compatibile con React 19 secondo i canali ufficiali. Tuttavia:
- Magic UI e 21st.dev usano entrambi `motion` (il nuovo nome) che è React 19 compatible
- L'import corretto per React 19 è `from "motion/react"` non `from "framer-motion"`

```bash
# STEP 1 — Animation core (usa motion, non framer-motion)
npm install motion

# STEP 2 — Magic UI components (copy-paste via shadcn CLI)
# Installazione individuale, nessun npm install diretto necessario
# (il codice viene copiato nel progetto tramite shadcn CLI)
npx shadcn@latest add "https://magicui.design/r/number-ticker"
npx shadcn@latest add "https://magicui.design/r/border-beam"
npx shadcn@latest add "https://magicui.design/r/magic-card"
npx shadcn@latest add "https://magicui.design/r/shimmer-button"
npx shadcn@latest add "https://magicui.design/r/blur-fade"
npx shadcn@latest add "https://magicui.design/r/meteors"
npx shadcn@latest add "https://magicui.design/r/shine-border"

# STEP 3 — 21st.dev components (stesso sistema shadcn CLI)
npx shadcn@latest add "https://21st.dev/r/kokonutd/background-paths"
npx shadcn@latest add "https://21st.dev/r/kokonutd/bento-grid"

# STEP 4 — Utilities già presenti (verificate in package.json)
# clsx ✓, tailwind-merge ✓, lucide-react ✓, sonner ✓

# OPZIONALE — Globe 3D (solo se si decide di fare la feature globo)
npm install react-globe.gl

# OPZIONALE — Particelle (alternativa a Meteors per login)
npm install @tsparticles/react @tsparticles/engine @tsparticles/slim
```

### Versioni testate compatibili React 19

```
motion:          ^12.x (ex framer-motion, React 19 native)
react-globe.gl:  ^2.x (Three.js wrapper, lazy loadable)
```

---

## 6. QUICK WINS — 3 modifiche in 30 minuti con impatto massimo

### Quick Win #1 — Number Ticker sui KPI (impatto: ALTO, tempo: 20 min)

Sostituire i valori statici nelle 4 KPI cards con Number Ticker di Magic UI.

**Procedura:**
1. `npx shadcn@latest add "https://magicui.design/r/number-ticker"`
2. Nel componente KPI card, wrappare ogni valore numerico:
   ```tsx
   import NumberTicker from "@/components/magicui/number-ticker";
   // Invece di: <span>€{saldo.toLocaleString()}</span>
   // Usare:     <NumberTicker value={saldo} />
   ```
3. Aggiungere `prefix="€"` e `decimalPlaces={2}` dove necessario

**Risultato:** La dashboard "prende vita" al caricamento. I KPI animano il count-up. È la singola modifica con il ROI visivo più alto — cambia la percezione del prodotto da "tabella di dati" a "sistema live".

---

### Quick Win #2 — Glassmorphism upgrade sulle KPI cards (impatto: ALTO, tempo: 15 min)

Modificare le classi Tailwind delle 4 KPI cards da background piatto a glass.

**Modifica in `globals.css` o direttamente nelle classi:**
```css
/* Prima */
background: #1a1a1a;
border: 1px solid rgba(255,255,255,0.07);

/* Dopo */
background: rgba(255, 255, 255, 0.03);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
```

**Risultato:** Le card sembrano "galleggiare" sul background scuro invece di essere blocchi di grigio. La percezione di profondità cambia completamente. Questa modifica da sola trasforma il look da "admin panel" a "fintech SaaS premium".

**Nota tecnica:** `backdrop-filter` funziona solo se il parent non ha `overflow: hidden`. Verificare che le card non siano dentro wrapper con questo stile.

---

### Quick Win #3 — Border Beam sulla card P&L (impatto: MEDIO-ALTO, tempo: 10 min)

Aggiungere un border beam animato alla card P&L Totale — la metrica più importante visivamente.

**Procedura:**
1. `npx shadcn@latest add "https://magicui.design/r/border-beam"`
2. Wrappare la KPI card P&L:
   ```tsx
   import BorderBeam from "@/components/magicui/border-beam";
   
   <div className="relative">
     <KPICard title="P&L TOTALE" value={pnl} />
     <BorderBeam 
       size={100} 
       duration={8} 
       colorFrom="#00ff88" 
       colorTo="#00d4ff" 
     />
   </div>
   ```

**Risultato:** La card più importante del portal ha un indicatore visivo animato che la distingue dalle altre. I clienti capiscono immediatamente che P&L è la metrica chiave. Costo: 0 — nessuna dipendenza extra se già installato motion.

---

## Note competitive (hedge fund / trading portals visti)

**Cosa fanno i portali premium reali:**
- Citadel.com: video background full-screen, headline bold, zero clutter — comunicano "esclusività" con lo spazio, non con la quantità di dati
- Trading dashboard di qualità (via Behance): toolbar densa con indicatori tradingview, tabelle con P&L colorato, no glassmorphism — molto più "Bloomberg terminal" che "SaaS startup"
- Keith Mascheroni Hedge Fund Dashboard (portfolio UX): moduli isolabili, navigation contestuale che si adatta ai pattern dell'utente, grid cells con sparklines inline

**Insight chiave per Agentic Markets:** Il portal si posiziona a metà tra "Bloomberg terminal" (denso, monospace, dati puri) e "SaaS fintech" (pulito, animato, qualità percepita alta). La scelta giusta è avvicinarsi al secondo per i clienti retail/HNW che non sono trader professionisti — vogliono capire la performance a colpo d'occhio, non fare analisi tecnica.

**Pattern da evitare:** Troppo glassmorphism sopra i dati (chart dentro card glass su background glass = leggibilità zero). Applicare il glass solo alle card container, mai direttamente sopra i chart Recharts.

---

*Fine ricerca. Aggiornare `ui_memory.md` dopo la prima implementazione.*
