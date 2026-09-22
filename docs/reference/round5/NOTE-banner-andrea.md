# Banner Codex di Andrea (22/09 15:35) — selezione e mappa AD

Andrea ha incollato in chat 20 PNG 1672×941 (headline + CTA + logo cotti dentro) chiedendo:
«aggiungi questi banner nella dimensione corretta sparsi per il sito, usa solo i necessari nei posti
giusti senza abbondare ma devono essere presenti». Protocollo «link Codex nudo» di
`~/.claude/agents/art-director.md`, applicato a file incollati.

## I due lotti

**Lotto buono — 16 file `Immagine Codex 22 set 2026, 15_35_08 … 15_36_31.png`** (blu/lime del
restyling). Verificato con md5: **13 sono byte-identici ai `docs/reference/codex-banners/exec-*.png`
già catalogati il 21/09** (`NOTE-selezione-AD.md`); **3 sono nuovi**, e sono esattamente le versioni
senza swoosh dei tre che avevo bocciato: `15_36_20` Odds Converter (maglia nera), `15_36_26` Weekly
Pick (visiera pulita), `15_36_31` Free Tools (petto pulito).

**Lotto vecchio — 4 file del 15/09 (`16_21_54 · 16_22_03 · 16_22_10 · 16_22_22`): NON USATI.**
Palette viola/verde neon di una sessione precedente, fuori dal royal/lime/indigo di questo
restyling. Segnalati ad Andrea, non aperti come candidati.

## Catalogo (b = ordine cronologico del lotto 22/09)

| # | file 15_xx | tema · headline | esito |
|---|---|---|---|
| b01 | 35_08 | Football · «Read the game» · Explore football | **promosso** dopo ritocco (swoosh petto + parastinco) = `football` |
| b02 | 35_19 | Tennis · «Beyond the ranking» · Explore tennis | **promosso** dopo ritocco (3 marchietti tallone/petto) = `tennis` |
| b03 | 35_24 | Best Bets A · sub «Find where model probability exceeds the market price» | scartato: stessa foto di b06, copy meno neutra (FTC) |
| b04 | 35_29 | Weekly Pick A | scartato: swoosh sulla visiera — sostituito da b15 |
| b05 | 35_33 | Match Builder B · pannelli etichettati (Match result/BTTS/Total goals/Cards/Corners) | scartato: etichette illeggibili sotto 600px, swoosh su pantaloncini+scarpini |
| b06 | 35_37 | Best Bets B · sub «Compare model and market probabilities» | **promosso** = `best-bets` |
| b07 | 35_41 | Deep Analysis · «See the why» · Explore Pro | **promosso** = `deep-analysis-pro` |
| b08 | 35_46 | Free Tools · football AMERICANO | scartato: sport fuori prodotto |
| b09 | 35_50 | Track Record · football AMERICANO | scartato: sport fuori prodotto — vedi nota Track Record |
| b10 | 35_54 | Match Builder A · pannelli a icone | **promosso** dopo ritocco (4 swoosh) = `match-builder` |
| b11 | 35_59 | EV Calculator · «Measure the value» | **promosso** = `ev-calculator` |
| b12 | 36_03 | Odds Converter A · maglia a strisce blu/nere (club-look) | scartato: b14 è la stessa scena con maglia neutra |
| b13 | 36_07 | Free Tools B · strisce + swoosh oro sul petto | scartato: marchio — sostituito da b16 |
| b14 | 36_20 | Odds Converter B · maglia nera (NUOVO) | **promosso** = `odds-converter` |
| b15 | 36_26 | Weekly Pick B · visiera pulita (NUOVO) | **promosso** = `weekly-pick` |
| b16 | 36_31 | Free Tools C · strisce, petto pulito (NUOVO) | **promosso** = `free-tools` |

**Track Record:** nel lotto di oggi c'è solo la versione football americano (b09). Ho derivato
`exec-40c84fb7` del lotto 21/09 (stessa serie Codex di Andrea, calciatore di spalle, già promosso
come `public/images/banners/track-record.png`, controllato: nessun swoosh, maglia a strisce
generica). **Andrea confermi** — è l'unico dei 10 che non viene dai file di oggi.

## Controllo marchi (ingrandito 2× e 4× per zona, poi ricontrollato sui JPEG consegnati)

- **Swoosh Nike certo** su b01 (petto ~1075,210 + parastinco ~1400,790), b04 (visiera), b05 e b10
  (pantaloncini ~1245,490 · scarpino sx ~1000,795 · parastinco dx ~1330,715 · scarpino dx ~1395,812),
  b13 (petto ~950,215). b04 e b13 hanno la versione pulita (b15, b16) → usata quella. **b01 e b10
  non ce l'hanno → inpaint locale** (OpenCV TELEA sui box elencati, master ritoccati in
  `andrea-picks-src/`). A 1120px il ritocco è invisibile; a 3× resta una sfumatura morbida →
  **non usare questi master sopra 1120px di larghezza**.
- **b02** aveva tre segnetti generici (tallone delle due scarpe, bustino): non swoosh riconoscibili,
  ma per «nel dubbio boccio» li ho tolti con lo stesso metodo.
- Puliti senza intervento: b06, b07, b11, b14, b15, b16, exec-40c84fb7.
- Le maglie a strisce blu/nere (free-tools, track-record) restano un «Inter-like» generico: nessun
  crest reale, accettato.

## Brand kit (stesso rilievo del 21/09, ancora aperto — decisione di Andrea, non nostra)

Lockup BETR/EDGE cotto nell'immagine: **B-mark blu** in 6 (free-tools, ev-calculator, match-builder,
track-record, best-bets, deep-analysis-pro), **B-mark verde** in 4 (odds-converter, weekly-pick,
football, tennis); wordmark avorio, non bianco. Il set non è uniforme; il logo ufficiale è
`public/logos/betredge-logo-white.png`. Headline in grotesk condensata Codex (non Hanken/Saira):
accettata come creativo pubblicitario, non è UI. Footer «18+ · Play responsibly» presente su tutti
e 10. Copy tutta in EN cotta: l'`alt`/`aria-label` va tenuto nelle 5 lingue dal codice.

## Derivati pronti — `public/banners/andrea-picks/`

I master sono 16:9 esatti (1672/941) e il testo occupa l'immagine dall'alto in basso: **non si
possono accorciare ritagliando** (già misurato il 10/09 sull'`.edge-split`) — si stringono. Per ogni
tema: `<nome>.jpg` **1120×630** (2× di uno slot da 560) e `<nome>-sm.jpg` **560×315**, JPEG q82
progressive, 150–185 KB e 51–60 KB. Usare `srcset="<nome>-sm.jpg 560w, <nome>.jpg 1120w"`.

## Mappa banner → pagina/posizione (per programmatore-andrea)

Regola AD: un banner è una pubblicità per una destinazione, sta dove l'utente NON è già. Un banner
«Open Match Builder» dentro il Match Builder è rumore, non presenza.

| banner | dove | slot / misura | link | note di wiring |
|---|---|---|---|---|
| `weekly-pick` | board Explore, `.edge-split` colonna destra (`app/app/page.tsx` ~2597) | `clamp(300px,32%,480px)` → 270px alti a 480 | `/weekly-model-case` | **SOSTITUISCE il pannello nativo `WeeklyPickPromo` (`.br-promo`, ~8353)**: quel pannello era nato alle 14:46 perché il creativo vecchio era del brand vecchio; alle 15:35 Andrea ha mandato il creativo nuovo e ha chiesto di metterlo → è la sostituzione approvata. Tenere l'`aria-label` 5-lingue di `etichetta` sul `Link`, `<img>` intera senza `cover`, `align-items:start` resta. |
| `best-bets` | board Explore, pool `desk-feed` intercalato nelle card | tile **span 2 colonne** (≈512px → 288px, «poco più di una card») | tab Model Edges (`nav_bestbets`) | Riaccendere `BOARD_HOUSE_FEED = true` (page.tsx:2349) e aggiungere 5 campagne `format:"billboard"` con questi creativi in `lib/house-banners.ts`. **Cambiare** `.am-grid > .house-banner.hb-cr-billboard` da `span 4` a `span 2` (globals.css:5911, e la variante tennis 5913): a piena riga farebbe 585px, è il motivo per cui gli Ole sono stati spenti. Tile = un solo `<Link>` con l'`<img>`; **niente footer con seconda CTA** (`hb-cr-foot-cta`): la CTA è già cotta. |
| `match-builder` | idem pool `desk-feed` | idem | tab `match-builder` | |
| `free-tools` | idem pool `desk-feed` | idem | `/tools` | Sull'hub `/tools` NON va: la CTA cotta «Explore free tools» sarebbe autoreferenziale. (Se Andrea vuole un'immagine sull'hub, la cella vuota della `.tl-grid` — 5 card su 3 colonne — è il posto; io consiglio di no.) |
| `track-record` | idem pool `desk-feed` | idem | tab `history` | |
| `deep-analysis-pro` | idem pool `desk-feed`, **solo audience anon/free** | idem | `/plans` | CTA «Explore Pro»: a un premium non va mostrato. |
| `ev-calculator` | pagine tool DIVERSE da EV: `/tools/odds-converter`, `/tools/margin-calculator`, gli altri slug (`components/tools/ToolShell.tsx`, sopra `<aside className="tl-cta">`) | `max-width:560px` centrato dentro `.tl-page` (1080) → 315px | `/tools/ev-calculator` | Cross-promo fra tool, un banner per pagina. |
| `odds-converter` | `/tools/ev-calculator`, stesso punto | idem | `/tools/odds-converter` | |
| `football` | landing `app/components/LandingCarousel.tsx`, slide `kind:"creative"` | slot 16:9 già esistente, `sizes 580px` | board filtrato Football (href che già esiste per il filtro sport) | **Sostituisce `ole-football-signal.jpg`** (brand vecchio verde). |
| `tennis` | idem carousel | idem | board filtrato Tennis | **Sostituisce `ole-tennis-insight.jpg` e `ole-tennis-signal.jpg`**. Le 3 slide `ole-multisport-*` restano brand vecchio: da ritirare, ma non ho un sostituto multisport in questo lotto — decide Andrea. |

Frequenza sul board: massimo **1 tile ogni 6 card e non più di 2 tile per caricamento**, mai due
dello stesso tema di seguito — «senza abbondare». Le pagine sport SEO (`/ai-football-predictions`,
`/ai-tennis-predictions`) sono `h1` + testo senza slot immagine: non toccate.

## Provenienza

- Sorgenti: `~/Downloads/Immagine Codex 22 set 2026, 15_3*.png` (16) · `docs/reference/codex-banners/exec-40c84fb7*.png` (Track Record).
- Master ritoccati (PNG 1672×941): `docs/reference/round5/andrea-picks-src/{football,tennis,match-builder}.png`.
- Gli 8 originali del 21/09 in `public/images/banners/*.png` (2–2,4 MB ciascuno, con swoosh su 4) restano
  in `public/` non wired: da **rimuovere** quando `andrea-picks/` è collegata, per non spedire in
  produzione né i 20 MB né i marchi.
