# BetRedge — UX Overhaul (casual-first) · Design

**Data:** 2026-07-10
**Autore:** Andrea via Claude Code
**Stato:** Design approvato (brainstorming) → prossimo passo: writing-plans per SP0+SP1
**Artifact (schema visivo):** https://claude.ai/code/artifact/fa719e39-348a-4fef-bba6-1d754155faa6
**Mockup:** card ([b77ebe30](https://claude.ai/code/artifact/b77ebe30-a7b6-441a-920c-f6e2b9247731)) · scheda espansa ([d632e9cf](https://claude.ai/code/artifact/d632e9cf-d66c-4b67-b758-56e65837c85e)) · primo giorno ([493daca8](https://claude.ai/code/artifact/493daca8-876a-4384-b4f1-162ecc6dd24e))

---

## 1. Problema e obiettivo

Rivedere **completamente** la user experience di BetRedge. I quattro driver (tutti confermati da Andrea):
- **Conversione bassa** — il valore non arriva prima del muro a pagamento.
- **Confusione/complessità** — troppe tab, troppo gergo sharp.
- **Look datato/poco pro** — sotto il livello dei competitor.
- **Debito tecnico** — la app cliente è **un unico file da 8.907 righe** (`app/app/page.tsx`, 109 `useState`); ogni modifica UX è ad alto rischio.

**Utente target dominante:** *tifoso casual* — ama calcio/tennis, non è esperto di scommesse. Vuole "chi vince, quanto è sicuro, perché" in linguaggio umano. La macchina sharp (edge, modello-vs-mercato, CLV) va **nascosta dietro le quinte** e rivelata solo a chi la cerca.

**Stella polare:** la UX generale — esperienza chiara, bella, veloce. Conversione e retention seguono di conseguenza, non si ottimizza una singola metrica.

**Approccio scelto:** **Feed-first / "una cosa per schermata"** (approccio A), con il *journey guidato* (approccio B) innestato come "percorso del primo giorno". Rifare la home come feed a componenti permette di **spezzare il monolite superficie-per-superficie** — il debito tecnico si risolve *mentre* si ridisegna.

**Criterio di successo:** una nuova UX casual-first, spedita per sotto-progetti verdi/mergeabili, dove un tifoso capisce un pronostico in ~2 secondi senza gergo e il monolite è sostituito da componenti isolati e testabili.

**Vincoli non negoziabili:**
- **FTC-safe:** nessun claim tipo "battiamo il mercato" / "vincita garantita". "Sicurezza" descrive la confidenza statistica del modello, non un esito certo.
- **Legale:** gate +18 e accettazione Termini/Privacy al signup; disclaimer gioco responsabile persistente (nel footer del feed, non sulla card — il claim è protagonista, il disclaimer no).
- **Zero AI-slop:** icone SVG a tratto consistente (stile Lucide), crest reali dall'asset pipeline. Mai emoji come icone, mai cerchietti-monogramma-gradiente.
- **Verde brand** `#23A559` (mai edge negativo), font Hanken Grotesk + JetBrains Mono, token `--am-*` esistenti.
- **Next.js del progetto ≠ quello noto:** l'implementazione deve leggere `node_modules/next/dist/docs/` prima di scrivere codice (vedi `AGENTS.md`).

---

## 2. Information Architecture

**Da 6 tab a 3 destinazioni.**

| Oggi (attuale) | Nuova destinazione | Contenuto |
|---|---|---|
| `bets` + `match-builder` | **Oggi** (home, il feed) | Feed verticale di card-pick del giorno, una per volta. È la app. |
| `history` + `leaderboard` | **Risultati** | Track record come prova di fiducia + leaderboard leggera. |
| `plans` + `invita` + account | **Profilo** | Account, piano, referral, impostazioni. |

- Bottom bar mobile a 3 voci (Oggi · Risultati · Profilo). Desktop = stessa IA, colonna centrale.
- `match-builder` **non è più una tab**: diventa azione contestuale dentro una card ("costruisci una combo con questo pick").
- La macchina sharp (edge, modello-vs-mercato, CLV) **non è una destinazione**: vive dentro la scheda espansa.

**Modello mentale contenuto** = `Signal → Explain → Decide → Track` (già esistente), ridistribuito: *Signal+Decide* nella card (Oggi), *Explain* nell'espansione, *Track* in Risultati.

---

## 3. La card del feed (l'atomo)

La card chiusa risponde in ~2 secondi: **chi vince · quanto è sicuro · perché**.

- **La decisione è protagonista** (`Vince l'Inter`, `Over 3.5 set`), grande. La **quota** è dettaglio secondario di fianco.
- **Sicurezza del modello**, non "edge": parola umana (**Alta / Media / Bassa**) + barra a 5 segmenti (verde=alta, ambra=media). La % piccola per chi la vuole.
- **Il "perché"** in una riga di linguaggio naturale, concreta e verificabile (forma, scontri diretti).
- **Un pick del giorno**: una card "eroe" col bordo verde in cima al feed → rituale quotidiano. Le altre sono card normali.
- **Il lock che vende**: l'utente free *vede* che esiste un pronostico sul big match, ma è sfocato → upgrade contestuale, non paywall astratto.
- **Azioni card:** `Perché questa previsione` (apre la scheda) · `Piazza la scommessa` (partner/affiliate) · `Salva`.

Stati definiti: pick del giorno (hero) · standard · bloccato (Pro).

---

## 4. La scheda espansa (progressive disclosure)

Il tap su "Perché questa previsione" **apre la stessa card** (non una pagina nuova): recap in cima identico alla card chiusa, poi la profondità.

1. **Perché** — spiegazione in linguaggio umano (forma, indisponibili, scontri diretti).
2. **Modello vs Mercato** — readout *numerico* (probabilità del modello vs implicita nella quota vs quota migliore). **Numeri, non barre** (rispetta lo standard scheda). È la macchina sharp resa leggibile per chi la cerca; resta invisibile al casual finché non scorre.
3. **Tutti i mercati, raggruppati** — ogni riga = `mercato · pronostico · sicurezza · quota`, con un pallino verde discreto dove il modello vede valore vs mercato:
   - **Esiti principali:** 1X2 · Doppia chance · Handicap
   - **Gol:** Over/Under · Gol/No Gol (BTTS) · gol attesi (modello)
   - **Marcatori:** top ~5 espandibile
   - **Mercati soft (PRO, sfocati per il free):** Corner · Cartellini · Falli

I mercati elencati sono quelli **realmente presenti** nel prodotto. I soft restano il gancio Pro naturale (visibili ma sfocati, upgrade contestuale dentro la scheda).

---

## 5. Il primo giorno (onboarding value-first)

Ribaltamento del funnel: da **muro a pagamento** a **valore prima, attrito dopo**.

- **Oggi:** `crea profilo → scegli piano → invia USDT → sblocca desk` (muro all'ingresso).
- **Nuovo:** `vedi il pick di oggi → account gratis (1 tap) → usa il free → upgrade quando serve`.

Cinque momenti:
1. **Arrivo anonimo** — pick del giorno visibile subito, resto sfocato. Nessun muro.
2. **Account gratis** — Google/Apple/email in 1 tap. Gate +18 e ToS qui. **Nessuna carta.** `signup ≠ pagamento`.
3. **Free generoso** — alcuni pick veri gratis ogni giorno → abitudine; i big match restano il gancio Pro.
4. **Upgrade contestuale** — il paywall compare nei momenti di desiderio (lock card, mercati soft), non in una schermata iniziale.
5. **Il ritorno** — una notifica push/giorno ("il pick di oggi è pronto") = il rituale che fa retention.

> **DECISIONE BUSINESS APERTA (gate Andrea/Michele):** la generosità del free (mostrare 1-2 pick reali anche ad anonimo/free) confligge con la policy di gating attuale (anonimo vede leaderboard + storico lockato + who-wins blur; board dietro login+piano). È la leva di conversione del casual, ma è una scelta di prodotto, non solo di UX. Da approvare prima di SP3.

---

## 6. Architettura FE (strangler, non big-bang)

Costruiamo il nuovo accanto al vecchio, superficie per superficie, dietro feature flag.

**Struttura target (feature-based):**
```
app/app/                     shell + routing (magro)
features/
  feed/        FeedScreen · PickCard · PickCardExpanded · ConfidenceMeter
               MarketList · MarketRow · ModelVsMarket · WhyBlock
  results/     TrackRecord · Leaderboard
  profile/     Account · Plan · Referral · Settings
  onboarding/  SignupSheet · UpgradeSheet · PaywallProvider
components/ui/ Button · Sheet · Chip · Crest · SportIcon    ← uccide l'AI-slop alla fonte
lib/           api-client · hooks (usePicks/usePick/useTrackRecord/useAccount) · types · tokens
```

- **Dal god-component a isole:** le 109 `useState` si dissolvono in (a) Server Components per i dati (App Router), (b) client islands piccole con stato locale dove serve interazione, (c) un `PaywallProvider` unico per free/Base/Pro invece di flag sparsi.
- **Design system alla fonte:** `Crest` (asset-map di crest reali) + set `SportIcon` SVG inline + token `--am-*` formalizzati. Nessun componente disegna più crest a mano: esiste solo `<Crest team={...}/>`.
- **Data layer tipizzato:** un hook per risorsa sopra un client tipizzato; la UI non sa da dove vengono i dati.
- **Isolamento/testabilità:** ogni componente ha uno scopo, un'interfaccia, dipendenze chiare; testabile su fixture senza backend.

---

## 7. Roadmap in sotto-progetti

Ognuno ha il suo ciclo spec→plan→build, il suo gate (medium/high → PROPOSAL + APPROVE), ed è spedibile da solo.

| # | Sotto-progetto | Spedisce | Dipende da |
|---|---|---|---|
| **SP0** | Fondamenta design system | Token, `Crest` (asset reali), `SportIcon`, UI primitives. Nessun cambiamento visibile; abilita tutto. | — |
| **SP1** ⭐ | Il feed "Oggi" | `FeedScreen` + `PickCard` chiusa su dati reali dietro flag + bottom-nav 3 voci. La nuova home. | SP0 |
| **SP2** | La scheda espansa | `PickCardExpanded` + tutti i mercati + `ModelVsMarket` + soft-lock Pro. | SP1 |
| **SP3** | Onboarding value-first | Feed anonimo, `SignupSheet`, `PaywallProvider`, upgrade contestuale. | SP0 · gate business |
| **SP4** | Risultati | Fusione history+leaderboard come prova di fiducia. | SP0 |
| **SP5** | Profilo | Account · piano · referral · impostazioni unificati. | SP0 |
| **SP6** | Rituale / retention | Notifiche push "pick del giorno" + PWA install. | SP1 |
| **SP7** | Cleanup | Demolizione monolite residuo, dead code, landing allineata. | SP1–SP6 |

**Sequenza:** SP0 → SP1 → (SP2 ∥ SP3) → SP4/SP5 → SP6 → SP7.
**Primo passo reale:** SP0 + SP1 — è lì che si vede il salto ed è la base tecnica di tutto.

---

## 8. Testing & verifica

- **Per componente:** test su fixture (TDD) prima del cablaggio ai dati reali — la card e il ConfidenceMeter si testano senza backend.
- **Per flusso:** e2e sui percorsi critici (arrivo anonimo → signup → free → upgrade) con browse/qa.
- **Visual check da loggato**, mai solo da anonimo.
- **Gate qualità:** ogni SP verde + review prima del merge; disciplina deploy (branch+PR, mai push ravvicinati su main, verifica dopo deploy).
- Costruito ≠ Verificato ≠ Operativo.

---

## 9. Rischi e questioni aperte

1. **Posizionamento** — si passa da "sharp/edge" a "casual". Gestire la percezione degli utenti sharp esistenti (Pro mode li serve, ma comunicarlo).
2. **Gating free** (§5) — decisione business Andrea/Michele, blocca SP3.
3. **Crest reali** — serve un asset pipeline di crest per calcio/tennis; da definire fonte/licenza in SP0.
4. **"Sicurezza" vs FTC** — validare il wording con legale-compliance prima del go-live.
5. **Convivenza col monolite** — durante lo strangler, feed vecchio e nuovo coesistono dietro flag: attenzione a doppie fetch/stato duplicato.

---

## 10. Prossimo passo

`writing-plans` per **SP0 (Fondamenta design system) + SP1 (Feed "Oggi")** — i due che sbloccano tutto e mostrano il salto. Gli altri sotto-progetti seguono con il proprio ciclo.
