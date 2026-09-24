# Round 15 — icone NAV (top + bottom bar mobile) nel linguaggio elettrico (AD, 2026-09-24)

**Perché:** Andrea su mobile: «vedo icone stilizzate non nel nostro stile». La bottom bar (`.am-bottomnav`, Home · Live · Watchlist · Strumenti · Profilo) usava ancora le SVG flat del round 3 (`components/ui/icons.tsx`); la nav in alto le icone "argilla" royal+lime del round 5/6 (`public/icons/nav-*.png`). Il resto del sito parla la lingua del round 14 (`tool-*.png`: corpo royal `#2A5BFF`, bordo sky `#7FC4FF`, arcs sottili, un solo accento lime ≤15%).

**Metodo:** `prompts-round15.sh` — blocco `STYLE2` **identico** a `am-restyling-0921/docs/reference/round14/prompts-round14.sh`, 7 soggetti, `gptimg -r` uno alla volta. Master 1254² alpha in `src-icons/` (untracked, come i round precedenti). Derivati con `derive-nav-icons.py` → 320² + `-sm` 64², alpha del corpo normalizzata a 255.

**Una voce = una icona:** Home, Live e Tools sono lo stesso master sia in `nav-*` (top) che in `bottomnav-*` (bottom bar), così la stessa voce ha la stessa faccia ovunque.

| Soggetto | Accento lime | File in `public/icons/` (ciascuno + `-sm.png`) |
|---|---|---|
| casa a tetto spiovente | la porta | `nav-home.png`, `bottomnav-home.png` |
| segnale: sfera + due archi | la sfera | `nav-live.png`, `bottomnav-live.png` |
| pallone (pannelli royal/navy) | un pentagono | `nav-football.png` |
| racchetta + pallina | la pallina | `nav-tennis.png` |
| chiave inglese regolabile | la vite di regolazione | `nav-tools.png`, `bottomnav-tools.png` |
| segnalibro con tacca a V | un punto in alto | `bottomnav-watchlist.png` |
| busto senza volto | il collarino | `bottomnav-profile.png` |

**Verifica (sui derivati, non sui master):** `check/nav-final-check.png` (96/44/32/24/22px) e `check/nav-zoom-24-22-18.png` (8× nearest a 24/22/18px) su pannello scuro `#0D2343` e chiaro `#FFFCF4`: 7/7 leggibili su entrambi, lime visibile anche a 18px. Controllo fisso: nessun testo, lettera, cifra o marchio terzo. Nessuna rigenerazione necessaria (il pallone sul pannello scuro è il più cupo del set ma legge «pallone» grazie a sagoma tonda + cuciture sky + pentagono lime — stesso livello delle tool accettate nel round 14).

**Incidente di produzione:** `prompts-round15.sh` lanciato in background si è bloccato su `watchlist` dopo 5 master, pur avendo `</dev/null` su ogni chiamata; il processo `codex exec` è morto da solo. Le due mancanti (watchlist, profile) rigenerate in foreground con timeout 300s, una alla volta: fine in ~60s ciascuna. Regola per il futuro: gptimg **in foreground con timeout**, non in uno script in background.

**Per programmatore-andrea:**
- `nav-*.png` / `nav-*-sm.png`: **sovrascritti in place**, `NavIcon` (`app/components/menu-icon.tsx`) li pesca già → zero wiring.
- `bottomnav-*.png` / `bottomnav-*-sm.png`: **nuovi**, oggi la bottom bar (`app/app/page.tsx`, `BOTTOM_TABS` → `<Icon name={b.icon} size={22} />` da `components/ui/icons.tsx`) usa ancora le SVG: va agganciata a un componente `<img>` sul modello di `NavIcon` con soglia `size <= 24 → -sm`. Mappa `BOTTOM_TABS.icon` → file: `home`→`bottomnav-home`, `live`→`bottomnav-live`, `bookmark`→`bottomnav-watchlist`, `tools`→`bottomnav-tools`, `profile`→`bottomnav-profile`. Lo stato attivo oggi è `color: var(--am-royal-t)` sull'SVG (`globals.css` ~8802): con un PNG serve un altro segnale (label o indicatore), non il colore del glifo.
- Commit dei 20 PNG **per nome** (mai `git add -A`) + controllo 200 sulla preview (lezione round 5).
