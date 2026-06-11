# House Banners — Design Spec

**Data:** 2026-06-11
**Owner:** Andrea (via Claude Code)
**Stato:** Design approvato (mappa di posizionamento) — in attesa di APPROVE per esecuzione codice.

## Obiettivo

Sistema di **banner pubblicitari proprietari (house ads)** dentro BetRedge: promuovono i prodotti/feature/piani della piattaforma stessa (non ad di terzi, non affiliate sportsbook). Devono essere **visibili ma non invadenti**, contestuali a chi guarda, coerenti col design system Sleek Coral.

Copertura: **due superfici** — landing pubblica (`app/page.tsx`) e desk prodotto (`app/app/page.tsx`).

Tono copy: **probabilità / edge** (Dixon-Coles + xG, probabilità calibrate). NIENTE linguaggio gambling diretto ("vinci/guadagna garantito") — coerente con la raccomandazione non-gambling.

## Forma tecnica

Componenti React come **fonte di verità** + capacità di **export immagine** per usi esterni (social, email). L'export in v1 è una route di preview a dimensioni esatte da cui catturare PNG (Chrome headless); pipeline di export automatica = fase 2.

## Look approvato

Direzione "sport-rich / formato ad": glifi sport reali del design system (`SportGlyphSprite`, già montati in entrambe le superfici), accento coral `#FF6A5E`, font Hanken Grotesk + JetBrains Mono, fondo dark `#0B0C0E`/`#131519`. Elementi: eyebrow mono (pill sport o label LIVE), headline grande, subcopy, CTA coral, opzionale ticker match con edge, glifi sport sul fondo, X per chiudere.

## Formati (v1)

| Formato | Dimensioni | Uso |
|---|---|---|
| Leaderboard | 728×90 (mobile 320×100) | Top desk — barra sottile |
| Rectangle | 300×250 | Inline nel feed bets |
| Billboard | 970×250 (responsive full-width) | Bottom desk + landing |

Half Page 300×600 = fase 2 (non in v1).

## Logica di posizionamento

### Desk prodotto (`/app`) — 3 punti, su slot già predisposti
1. **Top** → contenitore `portal-top-banner` (già nel codice, oggi `visibility:hidden;height:0`): si riattiva, ospita **Leaderboard**.
2. **Feed** → **Rectangle**, inserito **1 ogni ~6 card** nel flusso del feed bets. Mai due banner consecutivi.
3. **Bottom** → contenitore `portal-bottom-banner` (già nel codice, oggi nascosto): si riattiva, ospita **Billboard**, sopra la `promo-strip` esistente (che resta invariata).

### Landing (`/`) — 1 punto
4. **Billboard** brand/awareness tra la sezione `.lp-cards` e il `.lp-foot`.

## Logica anti-invadenza (4 regole)

1. **Contestuale** — il contenuto cambia per audience:
   - `anon` (non loggato) / `free` → banner **upgrade** (Registrati / Passa a Pro).
   - `pro` (sbloccato) → **nessun** push commerciale; solo feature/eventi (World Cup, Creator Picks).
   - Audience derivata dallo stato esistente: `hasClientProfile`, `isFreeClient`, `isClientUnlocked`.
2. **Parsimonioso** — feed: max 1 rectangle ogni ~6 card (1–2 per scroll).
3. **Dismissible** — ogni banner ha X di chiusura; id memorizzato in `localStorage` (`br_house_dismissed`) → non si ripresenta nella sessione.
4. **Nativo** — stesso design system; sembra prodotto, non ad di terzi.

## Architettura componenti

### `components/HouseBanner.tsx` (NUOVO)
Componente isolato presentazionale.
- **Props:** `format: "leaderboard" | "rectangle" | "billboard"`, `campaign: HouseCampaign`, `lang: "it" | "en"`, `onDismiss?: () => void`, `onClick?: () => void`.
- Renderizza eyebrow/headline/subcopy/CTA/glifi/ticker/X secondo il formato.
- Nessuna logica di business: riceve la campaign già risolta.
- CTA: `next/link` su deep-link interni (es. `/app?tab=account`).

### `lib/house-banners.ts` (NUOVO)
- `type HouseAudience = "anon" | "free" | "pro"`.
- `type HouseSlot = "desk-top" | "desk-feed" | "desk-bottom" | "landing"`.
- `type HouseCampaign = { id; slot; format; audiences: HouseAudience[]; copy: { it: {...}; en: {...} }; cta: { href; labelIt; labelEn }; ... }`.
- `HOUSE_CAMPAIGNS: HouseCampaign[]` — config dichiarativa (single source of truth dei contenuti).
- `pickCampaign(slot, audience): HouseCampaign | null` — seleziona la campaign giusta; ritorna `null` se nessuna match (slot non mostrato).
- `audienceFromState({ hasProfile, isFree, isPro }): HouseAudience`.

### Tracking
Riusa `trackEvent` esistente. Eventi: `house_banner_view`, `house_banner_click`, `house_banner_dismiss` con `meta: { campaign_id, slot }`. Verificare che `/api/track` accetti questi `event_type` (whitelist) — se c'è una whitelist, aggiungerli.

### Export immagine (v1)
Route `app/banners-preview/page.tsx` (admin-gated come `/admin`): renderizza tutti i formati a dimensioni px esatte su fondo neutro, da cui catturare PNG via Chrome headless (tecnica `@page margin:0` già documentata). Nessun tool di terze parti aggiunto.

## File toccati

| File | Tipo | Cosa |
|---|---|---|
| `components/HouseBanner.tsx` | NUOVO | Componente presentazionale |
| `lib/house-banners.ts` | NUOVO | Config campaign + picker + tipi |
| `app/banners-preview/page.tsx` | NUOVO | Route preview/export (admin-gated) |
| `app/globals.css` | EDIT | Stili `.house-banner*`; sblocco `.portal-top-banner`/`.portal-bottom-banner` quando popolati (via classe modifier, non rimuovendo l'hidden di default) |
| `app/app/page.tsx` | EDIT chirurgico | Popola top (~6066) e bottom (~6280) banner; inserisce rectangle nel feed (dentro `UnifiedBetsTab`) |
| `app/page.tsx` | EDIT chirurgico | Billboard tra `.lp-cards` e `.lp-foot` |

Vincolo: monolite `app/app/page.tsx` (6.3k righe) → solo inserimenti puntuali, nessun refactor. Max ~300 righe per iterazione.

## Fuori scope (v1)

- Half Page 300×600.
- Pipeline di export automatica / generazione batch immagini.
- CMS/admin per editare le campaign da UI (config in codice per ora).
- A/B testing dei banner.
- Ad di terzi / network pubblicitari.
- Modifiche alla `promo-strip` esistente.

## Piano di verifica

1. `tsc` clean (no errori tipo).
2. Visual check **da loggato** (cookie Chrome) su dark+light, IT+EN: top/feed/bottom desk + billboard landing.
3. Targeting: verificare anon→upgrade, pro→feature (cambiando stato profilo).
4. Dismiss: X chiude e non riappare dopo reload (localStorage).
5. Responsive: leaderboard→mobile 320×100, billboard full-width, rectangle nel feed mobile.
6. Tracking: confermare arrivo eventi view/click/dismiss in `/api/track`.
7. Route preview: tutti i formati a px esatti.

## Nota implementazione (AGENTS.md)

Next.js custom con breaking changes: **leggere `node_modules/next/dist/docs/`** prima di scrivere codice route/componenti.
