# Redesign — schede Partner & Account (BetRedge)

**Data:** 2026-06-19 · **File toccato:** `app/app/page.tsx` (+ `app/globals.css` per le classi card) · **Branch:** `feat/redesign-partner-account`

## Problema
Le pagine Partner e Account sono percepite (Andrea) come vuote/sparse, generiche/templated, con gerarchia sbagliata e non sleek. Vanno trasformate mantenendo il mood **Sleek Coral** (dark `#0B0C0E`, coral `#FF6A5E`, Hanken Grotesk + JetBrains Mono per le label).

## Direzione approvata (da mockup)
- **Account** → layout **Bento**: tile modulari di dimensioni diverse. Focus **piano & billing** (revenue-first).
- **Partner** → **Spotlight + griglia**: partner ufficiale (FortunePlay) in evidenza, gli altri in griglia. Focus **conversione**.
- **Card rifinite** (entrambe): base "vetro" (gradiente verticale + hairline di luce sul bordo alto + ombra), dot-grid sottile sfumato, **glow coral mirato** sulle card chiave, **watermark del logo** che sborda dall'angolo. FortunePlay usa il **logo SVG reale** (`/logos/fortuneplay.svg`), non emoji.

## Account — struttura nuova
Mantiene la subnav esistente **Account / Piani**.
- **Pane "Account"** = griglia Bento:
  - Tile grande (2×2) **Piano attuale**: nome piano, prezzo, stato (dot) + rinnovo, carta (se disponibile), CTA **"Gestisci abbonamento"**. Glow coral + watermark "PRO".
  - Tile **Membro dal** (da `profile.created_at`, dato reale dell'account).
  - Tile **Stato account** (piano badge / attivo). *(NB: NON usare le statistiche globali del prodotto tipo "Pick oggi/Hit 100g" — sono board-wide, non dell'utente: nel mockup erano filler, vanno escluse per non essere fuorvianti.)*
  - Tile **Cambia piano** (chips Free/Base/Pro, corrente evidenziato → porta al pane Piani).
  - Tile **Impostazioni** (lingua/fuso → apre SettingsTab esistente).
  - Tile **Sessione** (logout).
- **Pane "Piani"** = `PlansTab` esistente (upgrade/pagamento), invariato nella logica.

## Partner — struttura nuova
- **Spotlight hero** = partner `featured` (FortunePlay): logo reale, nome, descrizione, CTA "Vai a FortunePlay →" (link affiliato reale), glow + watermark logo.
- **Griglia** sotto = restanti partner attivi (Stake, Roobet) come card rich con CTA "Visita →".
- Mantiene: disclosure affiliate (`*Affiliate link…`), nota **18+ / gioca responsabilmente**, `rel="nofollow sponsored noopener"` sui link esterni.
- I 3 contatori grandi (Attivi/Trattativa/Coming) attuali: **rimossi** (erano parte del "sparse" e con "Trattativa/Coming" a 0 dopo la rimozione del placeholder). Nessuna sostituzione, nessun placeholder reintrodotto.

## Vincoli (NON rompere)
- **Funzionalità invariata:** tutti i props/handler di `AccountTab` (`profile,onOpenDesk,onPaymentSubmit,onActivateFree,onLogout,onUnlock,onSave`), `PlansTab`, `SettingsTab`, `ClientAreaTab`. La logica piano/pagamento/gating resta quella esistente.
- **i18n**: tutte le stringhe in 5 lingue (IT default, EN/ES/FR/RU) come il resto del file; nessuna stringa hardcoded nuova senza chiave.
- **Dati partner reali**: `PARTNERS` array (FortunePlay/Stake/Roobet) e relativi URL/`logo_image` invariati; il dropdown "Piazza scommessa" e il geo-gate sono separati, non toccati.
- **Tema**: funziona in **dark + light** (usare i token `--am-*`, mai colori hardcoded che rompono il light).
- **Responsive**: bento → 2 colonne / stack su mobile; griglia partner → stack.
- **Architettura**: monolite CSS-context esistente (NO nuove dipendenze, NO shadcn drop-in). Le classi card rich vanno in `app/globals.css` come utility riusabili (es. `.am-card`, `.am-card-glow`, `.am-card-wm`).
- **Surgical**: si riscrivono `PartnersTab`/`PartnerCard` e il pane Account; non si toccano altre tab/componenti.

## ⚠️ Contenuti reali (no fabbricazione — FTC)
- Il **bonus** mostrato nei mockup ("100% + free bet") è **placeholder inventato**. NON spedire claim di bonus specifici finché il testo reale non è fornito da Andrea/Tommy (e verificato per la geo). Default: CTA neutra ("Vai a FortunePlay →") senza numeri di bonus.
- Le metriche "Pick oggi / Hit 100g" nelle tile Account devono usare **dati reali** già disponibili (gli stessi della testata Prediction), non valori inventati; se un dato non è disponibile per quel profilo, la tile si nasconde (fail-soft), non mostra placeholder.

## Verifica
- `tsc` pulito; build Vercel verde.
- **Visual check da loggato** (regola Andrea): Account (free/base/pro) + Partner, in **dark e light**, desktop + mobile.
- Nessuna regressione su: cambio piano, pagamento, logout, link affiliati, lingua.

## Fuori scope
- Stripe go-live (env/dashboard — task separato `#FORTUNEPLAY/Stripe`).
- Testi bonus reali, nuove metriche non già esistenti, redesign di altre tab.
