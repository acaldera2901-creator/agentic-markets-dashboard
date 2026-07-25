# BetRedge — Direzione visiva "LEVEL-UP" (elevare, non semplificare)

**Data:** 2026-07-12 · **Autore:** Art Director (Maven Studio) · **Stato:** DIREZIONE per OK di Andrea (nessun codice toccato)
**Mockup live (Artifact):** vedi URL consegnato in chat
**Fonti:** app LIVE (audit first-hand `docs/ui/2026-07-12-app-ux-audit.md`), referenza pulsanti `slotsbonus.bet`, brand kit BetRedge.

> **Principio guida.** Il pavimento di qualità è l'app attuale (ricca, onesta, human-made). Si **sale** sopra: più autorevolezza, gerarchia più decisa, mobile vero. Il POV "motore di probabilità, non bookmaker" resta protagonista. Niente feed casual, niente redesign da zero.

---

## Token (allineati alla app LIVE, come da brief Andrea)

- **Verde accento:** `#23A559` (unico accento) · hover/bright `#2FD074` · dim `#15803D` · wash `rgba(35,165,89,0.12)`
- **Dark:** bg `#0B0C0E` · surface `#12151B` · surface-2 `#171B23` · surface-3 `#1E232D`
- **Loss/void:** rosso `#E8392E` (mai riempimento decorativo — solo semantica loss/annulla)
- **Testo:** `#F4F7FA` · muted `#8A93A6` · muted-2 `#5C6474` · line `rgba(255,255,255,.09)`
- **Font:** Hanken Grotesk (display/body) + JetBrains Mono 700 (numeri, label, **pulsanti**)
- **Light mode:** ricalibrato (non invertito), verde resta semantico e leggibile su bianco.

> Nota: il toolkit Maven Studio riporta green `#3DA268`/bg `#0A0C10` per le **card social**; per l'**app** si usano i token LIVE `#23A559`/`#0B0C0E` (brief esplicito). Da NON confondere le due palette.

---

## 1. Button system tattico (nuovo)

**Cosa prendo dalla referenza slotsbonus:** la **forma e l'energia** — peso bold, testo **mono-uppercase**, contrasto alto, stati decisi, senso "live/hot". **Cosa NON prendo:** gold/red da gambling, urgenza aggressiva, emoji-fiamma. L'energia "hot" della referenza la sposto in un **badge skewato LIVE/EDGE** (parallelogramma mono), così i pulsanti restano puliti e leggibili e lo skew vive dove è semantico (stato), non sull'azione.

**Foundation.** Label `JetBrains Mono 700`, uppercase, letter-spacing 0.05em. Raggio **`0px` — spigolo vivo pieno** (scelta di Andrea 2026-07-12: taglio tattico coerente con slotsbonus). Altezze **S 32 / M 40 / L 48 px**. Focus ring verde 2px sempre (tastiera, non negoziabile).

### Firma tattica: spigolo vivo (controlli) + smusso obliquo (pannelli)

I **pulsanti** sono a spigolo vivo (0px). Le **card/pannelli** (card Edge, lab pulsanti, stat-tile, empty state, card mobile, item audit) hanno un **angolo tagliato in diagonale (chamfer)** su angoli opposti (alto-sx + basso-dx), leggero e di gusto: `--ch` = **14px** sui pannelli grandi, **10px** su quelli piccoli. Insieme danno una firma unica: controlli decisi + superfici tattiche, non arrotondate né banalmente rettangolari.

**Nota tecnica per l'implementazione (bordo obliquo pulito).** `clip-path` da solo cancella l'hairline lungo la diagonale (il border viene tagliato → il taglio mostra il colore dietro, senza linea). Soluzione a **doppio layer via pseudo-elementi**, zero markup extra:
- `.panel::before` = layer colore-bordo (`inset:0`, `clip-path` chamfer, bg = colore linea);
- `.panel::after` = layer superficie (`inset:1px` = spessore bordo, stesso `clip-path`, bg = surface);
- contenuto reale a `z-index:1` sopra i due layer.

Così il bordo resta uniforme (~1px) anche sul taglio diagonale. In produzione: incapsularlo in una utility (es. `.chamfer` con `--ch`/`--bd`/`--surf`/`--bcol`) e applicarla ai contenitori-pannello. Meter/bar/chip/badge restano pill (non chamfer); i sub-pannelli interni (readout) vanno a spigolo vivo per coerenza. Rispettare `prefers-reduced-motion` invariato. Su hover di pulsanti vicini al bordo card, il micro-glow può essere clippato dal `clip-path` del pannello: dare padding interno sufficiente (già previsto).

| Variante | Uso | Resa |
|---|---|---|
| **Primary** | azione dominante (Apri scheda, Sblocca Pro, Piazza) | verde `#23A559` pieno, testo quasi-nero `#06210F` (contrasto AA). Hover: `#2FD074` + micro-glow verde (`0 6px 22px -8px`). Active: `#15803D` + `translateY(1px)`. |
| **Secondary** | azione parallela (Match Builder) | surface-2 + hairline verde, label verde. Hover: wash verde + bordo pieno. |
| **Ghost** | terziario (Filtra, Salva) | trasparente, muted. Hover: superficie + testo pieno. |
| **Danger** | annulla/void | **solo outline rosso** (rosso = loss/void, mai fill decorativo). Hover: wash rosso. |

**Stati completi:** rest / hover(+glow) / active(press -1px) / focus(ring 2px) / disabled(opacity .38, no glow) / loading(spinner mono, larghezza invariata). Tutti resi nel mockup, sezione 01.

**Anti-slop:** un solo accento (verde); glow **solo** su hover/focus e a bassa opacità (non ambient/gradient di sfondo); nessun bordo-sinistro colorato decorativo; mono = strumento, non moda.

---

## 2. Direzione "level-up" (elevare la ricchezza esistente)

**Tipografia/gerarchia.** Una card = un messaggio dominante letto in <5s: **chi vince → quanto sicuro → perché**. Mono usato come "readout strumento" su numeri/label; Hanken per claim e prosa. Scala tipografica dichiarata, pesi intenzionali.

**Profondità e spazio.** Superfici a 3 livelli (surface/surface-2/surface-3) + hairline `rgba(255,255,255,.09)` invece di ombre pesanti; band-header sulle card per dare struttura; radial-glow verde ambientale bassissimo solo dietro l'header (atmosfera, non decorazione).

**Confidenza = un solo cue (audit CHI1).** Oggi la sicurezza è spalmata su 3 segnali (% modello + 4 dots + quota). Consolido in **barra fiducia + label** ("Fiducia alta") come cue primario; il % resta dettaglio. Non aggiungo elementi: unifico.

**Edge leggibile al tifoso (audit QW4).** Sotto il readout Modello/Mercato una riga in chiaro: *"il modello dà 10 punti % in più rispetto al mercato"*. Valori estremi da cappare/contestualizzare (gancio ai flag di dominio dell'audit).

**Stat-tile 99 / 55 / 66.1% elevate.** Restano (ricchezza), ma con sparkline sull'hit-rate e didascalia onesta ("su pick tracciati, WON e LOST"); mostrate **solo dove informano** (Previsioni/Storico), non su Classifica (audit QW3).

**Badge LIVE/EDGE.** Chip skewato mono con pulse (`prefers-reduced-motion` rispettato): dà l'energia "live" della referenza senza toccare i pulsanti.

**Micro-interazioni.** Transizioni brevi (60–160ms), freccia CTA che avanza di 2px su hover, press -1px. Nessuna animazione ambientale continua.

**Empty state (audit QW2).** Ogni vuoto insegna il next step: titolo + cosa apparirà + **ghost row** d'esempio + **CTA inline**. Mai "Nessun dato disponibile" in un void nero. Reso nel mockup.

**Mobile — bottom tab bar (audit MOB1).** Fine della striscia di 10 chip orizzontali. **Bottom tab bar persistente a 5** (Edge · Storico · Classifica · Builder · Pro), riusando il craft già hardened della bottom-bar landing. Card a colonna singola, target ≥44px, safe-area inset. Reso nel mockup (frame ~300px).

**Cosa NON tocco (preservare).** Modale scheda completa (standard di qualità della casa), World Cup Intelligence Hub, light mode, storico WON/LOST onesto, filtri/ticker completi, landing editoriale.

---

## 3. Mappa audit → risposta visiva

| ID | Voce audit | Risposta level-up |
|---|---|---|
| QW1 | Widget Tawk copre contenuto | Safe-area/padding-bottom: mai sopra card/CTA/dati |
| QW2 | Empty state placeholder | Ghost row + CTA inline (mockup mobile) |
| QW3 | Header ripetuto | Subtitle per pagina + stat-tile contestuali |
| QW4 | Edge gergo | Riga in chiaro + cap valori estremi |
| QW5 | KPI landing wrap | Slot KPI uniformi (valore+unità+didascalia) |
| MOB1 | Nav striscia orizzontale | Bottom tab bar a 5 (mockup) |
| MOB2 | Densità/tocco 360–414px | Target ≥44px, colonna singola verificata su device |
| CHI1 | "Quanto sicuro" sparso | Un cue dominante: barra+label fiducia |
| EST1 | Tabelle ariose | Cap misura o colonne utili |
| EST2 | Weekly Pick metà vuota | Rail/artefatto a destra + dedup KPI |
| ONB1/2 | Funnel anonimo / hero sport | Verifica funnel + hero solo 3 sport reali |

---

## 4. Prossimo passo

Dopo l'OK di Andrea: implementazione **chirurgica** (Karpathy surgical changes) sui componenti esistenti, con `design-review` sul renderizzato reale (desk + mobile device reale + dark/light). Priorità di rollout suggerita: **button system + card Edge (CHI1/QW4)** → **bottom tab bar (MOB1)** → **empty state (QW2) + header (QW3)** → resto.

---

*Firma invariante rispettata: logo, verde unico accento semantico, mono per i numeri, un messaggio per card, solo realtà. Nessun claim FTC. Verde mai negativo.*
