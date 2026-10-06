# Growth v6 — direzione di design per `/` e `/lavoro` (fase 1: AD → ui-andrea)

Branch `design/growth-v6` da `feat/growth-v5`. Solo `growth-app/docs/design-v6/`: nessun codice dell'app è stato toccato. Fase 2 (ui-andrea) scrive il codice partendo da qui.

**I numeri nei mockup sono SOLO segnaposto di layout.** Non sono dati, non vanno mai copiati nel codice, nei test o nelle fixture: le cifre vere arrivano da `core/` e `data/` come oggi. Allo stesso modo il «BetRedge» scritto nei mockup è un segnaposto: in codice va il lockup SVG ufficiale (`~/Desktop/01-BETREDGE/redesign/brand/svg/betredge-lockup-color-on-light.svg` sul tema carta, `…-color-on-dark.svg` sul navy), mai un marchio ridisegnato dall'AI.

## 1. Direzione scelta e perché
Steve apre la dashboard ogni mattina e deve capire in 30 secondi «cosa è cambiato e cosa non devo fidarmi di leggere». Oggi la pagina apre con il database (banner, legenda, avviso) e poi offre 44 tile con lo stesso peso, 17 delle quali vuote. La critica di GPT (`critica-gpt.md`, punti 1-13 con le mie decisioni) conferma la diagnosi; da lì la direzione:
- **Una home che risponde prima e spiega dopo**: «Oggi in 30 secondi» in testa (cosa è cambiato · non fidarti di), poi i conteggi delle fasi, poi i KPI con gerarchia, poi canali/andamento, infine «Dati che non abbiamo ancora».
- **Onestà come struttura, non come nota**: lo stato di ogni numero è un chip con icona + etichetta; i mancanti non hanno mai la posizione di un numero; grezzo e stimato restano nella stessa card; il funnel si chiama «Conteggi delle fasi» finché non esiste un id utente (G01).
- **Tema carta di default**, navy come alternativa a token invariati. La carta regge meglio una lettura lunga di testo denso e il contrasto AA si ottiene con meno sforzo; i token sono quelli del brand kit (`~/Desktop/obsidian-brain/Maven-Brain/brandkits/betredge.json`), quindi la scelta finale fra i due resta una decisione di Andrea/Steve senza rifare nulla.
- **`/lavoro` come spazio di lavoro con avanzamento visibile**, senza controlli finti: lo stato viene dai JSON di `content/` e si cambia con un commit.

## 2. Mockup → componente/sezione esistente
| Mockup (`mockups/`) | Cosa mostra | Dove va in codice |
|---|---|---|
| `home-desktop-light.png` | Home 1440, tema carta: barra · Oggi in 30 secondi · Conteggi delle fasi · KPI principali · Fonti | `ui/GrowthDashboard.tsx` (nuovo blocco «Oggi» in testa, sostituisce banner+legenda+avviso; Funnel → Conteggi) |
| `home-desktop-dark.png` | Stessa home, tema navy (alternativa, stessi token) | idem, via `data-theme` |
| `home-mobile-light.png` | Home 390: barra su due righe, cambiamenti, conteggi come righe, KPI 2 colonne | idem, breakpoint `<md` |
| `kpi-section-light.png` | Sezione Acquisition: nav fissa, 2 principali grandi, secondari in tabella con «perché ▸» espanso | `Section`/`Tile`/`TileGrid` in `GrowthDashboard.tsx` → `PrimaryCard` + `SecondaryRow`; nav nuova |
| `missing-data-light.png` | «Dati che non abbiamo ancora · 17» raggruppati per gap, con cosa serve e chi sblocca | nuova sezione in fondo a `/`, alimentata da `MISSING_KPIS` (`core/kpi`) + `content/tracking-gaps.json` |
| `lavoro-desktop-light.png` | `/lavoro`: 4 riquadri di avanzamento-tab, lista gap con stepper in sola lettura, pannello dettaglio, anteprima esperimenti a colonne | `ui/work/WorkPage.tsx` (`Section`, `ResponsiveTable`, `Pill`) |
| `lavoro-mobile-light.png` | `/lavoro` 390: chip di avanzamento scorrevoli, gap come card | idem, `<md` |
| `states-sheet.png` | Anatomia della card KPI, i 5 stati, marcatori, in carta e navy | `StatusBadge`, `Tile` → componenti condivisi |

Andamento 30 giorni (`ui/sections/Trends.tsx`) non ha un mockup dedicato: resta la tabella attuale con tre modifiche — il contatore di anomalie per riga apre l'elenco (oggi è sempre esteso), σ e formula nel dettaglio, il testo introduttivo diventa «perché ▸». Canali (`ui/sections/Channels.tsx`): una tabella sola fonte · ingressi · sessioni · signup attribuiti, «(nessuna fonte)» riga esplicita.

## 3. Design token proposti (semantici, dal brand kit)
Base — carta: `--bg #F3EDDC` · `--panel #FFFCF4` · `--line #E9E1CC` · `--ink #14171C` · `--ink-2 #4A515B` · `--action #144BD6`. Navy: `--bg #071329` · `--panel #0D2343` · `--line rgba(129,217,255,.20)` · `--ink #EDEFF2` · `--ink-2 #A8BDD6` · `--action #145AFF` (link `#6EA4FF`).

Stati (icona + etichetta sempre insieme, il colore da solo non porta significato):
| Stato (`KpiStatus`) | Etichetta UI | Icona | Carta (testo / fondo) | Navy (testo, bordo 1px) |
|---|---|---|---|---|
| `LIVE` | Contato | `●` | `#1E7F5C` / `#E3F4EB` | `#34D399` |
| `PROXY` | Proxy | `◐` | `#0E6FA8` / `#E2F2FB` | `#81D9FF` |
| `PROXY` + badge STIMATO | Stimato | `≈` | `#4C7A00` / `#F2F8D9` | `#D3FE50` |
| `ERRORE` | Errore | `△` | `#B42318` / `#FBE9E7` | `#F87171` |
| `MANCA` | non misurato | lucchetto | `--ink-2`, nessun fondo, **mai nella posizione del numero** | idem |
Marcatori separati dallo stato: anomalia `▲` `#8A5A00` (carta) / `#FFE818` (navy); priorità P0 `#B42318`, P1 `#8A5A00`, P2 `--ink-2`; delta ▲▼ in `--ink`, non colorato (un calo non è «male» senza contesto).

Tipografia: **Big Shoulders** 800 (opsz 72) per i titoli di sezione in maiuscolo; **Archivo** per tutto il resto — numeri `wdth 75 / wght 800 / tabular-nums`. Scala: numero principale 40px, secondario 24px, corpo 14px, metadati 12px (minimo assoluto), titoli sezione 20px. Spaziatura: griglia 12 col, gutter 24, margine pagina 24 (16 su mobile), card padding 16, angoli 8, riga tabella 44px.

## 4. Regole di layout responsive
- `≥1280`: nav fissa 200px a sinistra con ancore e contatori; contenuto max 1200. «Oggi in 30 secondi» 7/12 + 5/12. KPI principali 6 per riga (3 se `<1280`).
- `768–1279`: nav diventa riga di ancore in alto; principali 3 per riga; secondari restano tabella.
- `<768`: una colonna, margini 16, barra su due righe; cambiamenti subito sotto il selettore; conteggi delle fasi come righe etichetta/valore; principali 2 per riga; tabelle → elenchi (già `ResponsiveTable`); riquadri di avanzamento di `/lavoro` → chip scorrevoli. Nessuno scroll orizzontale, touch target ≥44px.
- Il «perché ▸» apre in linea sotto la riga/card, mai in un pannello laterale.

## 5. Cosa cambia / cosa NON si tocca
Cambia (solo `ui/` e `app/globals.css` + font): ordine dei blocchi della home; banner+legenda+avviso → «Oggi in 30 secondi»; `Funnel` → «Conteggi delle fasi» senza frecce né %; `Tile` → `PrimaryCard`/`SecondaryRow`/riga «non misurato»; nuova sezione «Dati che non abbiamo ancora»; nav con ancore; etichetta `MISURATO` → «Contato»; token e tema; `/lavoro` con riquadri di avanzamento e stepper in sola lettura.
**Non si tocca**: `core/` (kpi, estimate, model), `data/`, le query, `proxy.ts`/auth, `scripts/verify`, i JSON di `content/` (schema invariato: se serve `status` oltre ad «aperto», è un campo già previsto, non una migrazione), i test esistenti. Nessun dato nuovo viene calcolato lato UI: «cosa è cambiato» è la top-N delle anomalie/delta già prodotti da `Trends`.

## 6. Checklist di accettazione (verificabile)
1. Su `/` a 1440 il primo schermo mostra «Oggi in 30 secondi» senza scroll; banner, legenda e avviso non precedono più il contenuto.
2. Ogni numero in pagina ha accanto un chip con icona e etichetta (`●◐≈△`); nessun chip usa solo il colore. Verificato con simulazione daltonismo (DevTools › Rendering).
3. Nessun KPI `MANCA` occupa una card: compaiono tutti e solo in «Dati che non abbiamo ancora» (conteggio = `MISSING_KPIS.length`) e come riga grigia nella sezione d'origine. Nessun `0` o `—` al posto di un mancante (già coperto da `verify`: resta verde).
4. Grezzo (`● Contato`) e stimato (`≈ Stimato`) stanno nella stessa card, sempre.
5. «Conteggi delle fasi»: nessuna freccia, nessuna percentuale di conversione, titolo con «unità diverse».
6. Contrasto ≥4,5:1 per tutto il testo in entrambi i temi (axe o Polypane): 0 violazioni AA. Nessun testo sotto 12px.
7. A 390px: nessuno scroll orizzontale, tutte le tabelle in elenco, touch target ≥44px; «Cosa è cambiato» visibile entro il primo schermo.
8. `/lavoro`: i 4 riquadri mostrano conteggi derivati dai JSON (es. gap chiusi/totali); nessun controllo che modifichi stato senza persistenza.
9. Il lockup è l'SVG ufficiale, non testo né immagine generata.
10. `npm run build`, `vitest`, `scripts/verify` verdi; screenshot prima/dopo delle 8 viste nel PR.

## 7. Prompt usati
- `prompts/01-consult-ux-review.md` → risposta integrale in `prompts/01-consult-output.md` (codex exec, read-only, 7 screenshot allegati).
- `prompts/02-mockups.sh` → gli 8 mockup, `gptimg -r`, una chiamata alla volta con `</dev/null`; rilanciabile per un solo nome (`bash 02-mockups.sh home-mobile-light`).
- `reference/` → gli screenshot v5 dati a GPT come riferimento.

## 8. Deviazioni nei mockup (viste dall'AD, da NON copiare) e cosa non è verificato
Tutti gli 8 PNG sono stati guardati uno per uno. Dove l'image-gen ha deviato dal brief, vale il brief:
- I **delta** nei mockup sono colorati verde/rosso: in codice restano in `--ink` (regola §3). L'indicatore di anomalia in navy è `#FFE818`, non l'ambra scritta nello sheet.
- `lavoro-desktop-light`: le card degli esperimenti portano chip di stato dati (Proxy/Contato/non misurato) — errore dell'immagine, un esperimento ha solo `idea · in corso · deciso` e, se deciso, `scale/fix/kill`. `lavoro-mobile-light`: lo stato «in corso» usa l'icona `◐` di Proxy — vietato riusare le icone di stato dati per gli stati di lavoro (usare cerchio vuoto/mezzo/pieno senza colore di stato).
- `kpi-section-light`: la voce di nav «Funnel» va letta «Conteggi delle fasi»; le righe «Google (organico) · Diretto · Twitter/X · Altre» sono inventate dall'immagine, le fonti vere escono da `Channels`. `missing-data-light`: la nav mostra «Panoramica/Lavoro», vale la lista di §4.
- Il tema carta nei mockup è leggermente più caldo dei token: usare i valori di §3, non il colore campionato dai PNG.
Non verificato: nessun render in browser (non esiste ancora codice v6), nessuna misura di contrasto sui token proposti (va fatta in fase 2, checklist 6), nessun test con Steve. La selezione carta vs navy è una proposta dell'AD, non una decisione registrata.
