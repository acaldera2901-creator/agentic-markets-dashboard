# BetRedge — Audit UX/Design app LIVE (produzione)

**Data:** 2026-07-12 · **Autore:** ui-andrea · **Sessione:** loggata come "profa finale" (PRO)
**Ambito:** desk `www.betredge.com/app` (Previsioni, Storico, Classifica, Match Builder, Piani, World Cup, Creator Picks, Weekly Pick) + landing `www.betredge.com/`. Dark + Light.
**Mandato:** l'app attuale è il **pavimento di qualità** (il redesign "casual feed" semplificato è stato bocciato). Si **migliora chirurgicamente**, non si stravolge, non si semplifica-a-perdere.

> **Nota di verifica onesta (mobile).** L'ambiente browser non porta l'`innerWidth` sotto ~1512px (DPR2 + min-window; limite già documentato in `ui_memory`). Le media query mobile NON scattano a runtime. Le osservazioni mobile qui sotto derivano da **ispezione diretta del CSS responsive** (`app/globals.css`) e del markup, incrociata con la memoria di progetto — NON da rendering visivo reale. Vanno **riconfermate su device/preview reale** prima di implementare.

---

## Verdetto anti-slop (checklist §5) — l'app NON è slop

L'impianto è **human-made**, con decisioni visibili a ogni livello. Da preservare:
- **POV dichiarato e specifico:** "motore di probabilità, non un bookmaker; il modello ha *una* opinione, non opinioni da bar." Copy che un competitor non potrebbe incollare.
- **Vincolo reale:** dark sportsbook + **un** accent verde (`#23A559`) razionato (pick, edge, stato attivo) + tipografia con voce (Hanken Grotesk display + JetBrains Mono come "readout strumento" su numeri/label). Niente indigo/viola, niente Inter di brand, niente blob/glass.
- **Gerarchia da più leve** (size + case + mono + colore + spazio), griglia reale, focal point per schermata.
- **Compliance UI presente:** disclaimer +18 / "non è garanzia di vincita" nel modale, footer GamCare/BeGambleAware, copy FTC-safe ("nessuna promessa aggressiva di battere il mercato").

Le proposte sotto sono **rifiniture e correzioni mirate**, non ridiscussione dell'impianto.

---

## COSA FUNZIONA (non toccare)

1. **Modale "scheda completa" (zoom):** eccellente. Pick coral + "% modello · conf." + quota, mercati raggruppati (1X2 / Gol / Marcatore) con badge FORTUNEPLAY/BEST, quota combinata + CTA + disclaimer +18. Ricco e leggibile. È lo standard di qualità della casa.
2. **World Cup Intelligence Hub:** pagina forte. Layout asimmetrico board 2/3 + rail-contesto 1/3 (Track Record 2×2, "Who wins?" con barre, Explore). Modello replicabile altrove.
3. **Card "Edge del giorno · Modello vs Mercato"** e la card partita (pick, %modello, conf dots, edge chip, "perché" in prosa): densità giusta, onesta.
4. **Live ticker "IN PLAY", filtri (sport/competizione/superficie/ordina), search:** completi e coerenti.
5. **Light mode:** ben eseguito (superfici/testo/accent ricalibrati, non invertiti). Coral/verde leggibile su bianco.
6. **Landing:** hero carosello + headline editoriale "Non battiamo il banco. Lo rendiamo leggibile" + Edge Scanner terminal-style + "Come funziona" 4-step. On-brand, ricca, bassa frizione ("Inizia gratis · Senza carta").
7. **Storico** mostra WON **e** LOST reali → trasparenza = fiducia. Da mantenere.

---

## PROPOSTE PRIORITIZZATE

Legenda sforzo: **S** ≈ 1h · **M** ≈ mezza giornata · **L** ≈ 1+ giorni. Impatto: alto/medio.

### ⭐ QUICK-WIN AD ALTO IMPATTO (fare prima)

**QW1 — Widget Tawk.to non deve coprire contenuto funzionale** · *Estetica* · S · **alto** · quick-win
- **Cosa:** riposizionare/offsettare il widget di chat (o dargli un margine sicuro + padding-bottom alle griglie) così non copra mai card/CTA/dati.
- **Perché:** su OGNI pagina il widget "Hi! How can we help?" copre contenuto reale — la **3ª colonna di card** su Previsioni, la **colonna esito WON/LOST** su Storico, le feature del **piano Pro** su Piani (pagina di conversione!), la lista "Who wins?" su World Cup. È il singolo fattore che più abbassa la qualità percepita e, su Piani, tocca la conversione.
- **Dove:** globale (tutte le pagine).

**QW2 — Empty state progettati (non "Nessun dato disponibile")** · *Onboarding* · S–M · **alto** · quick-win
- **Cosa:** ridisegnare gli stati vuoti di **Classifica** ("Nessun dato disponibile.") e **Creator Picks** ("Nessuna schedina pubblicata ancora." perso in un void nero enorme) e la leaderboard vuota. Ognuno deve: spiegare cosa apparirà, mostrare uno **scheletro/ghost row d'esempio**, e portare un **CTA inline** vicino al messaggio (su Creator Picks il "Crea la tua" è isolato in alto a destra).
- **Perché:** per un prodotto nuovo/a basso volume di dati, gli empty state sono un'**alta frequenza di primo impatto**. Oggi sono placeholder energy (§5: "l'empty insegna il next step").
- **Dove:** Classifica, Creator Picks (/community), leaderboard.

**QW3 — Header desk: subtitle per pagina + stat-tile contestuali** · *Chiarezza* · S · **medio-alto** · quick-win
- **Cosa:** il subtitle "Probabilità calibrate da un modello… Il modello ha una opinione, non opinioni da bar." è **identico** su Previsioni, Storico, Classifica, Match Builder. Le 3 stat-tile globali (99 EVENTI / 55 CON EDGE / 66.1% HIT) si ripetono su ogni pagina, anche dove non c'entrano (Classifica). Rendere il subtitle specifico per pagina e mostrare le tile solo dove informano (Previsioni/Storico sì; su Classifica sostituirle con metriche leaderboard o rimuoverle).
- **Perché:** header ripetuto = spazio più prezioso della pagina sprecato + gerarchia diluita; il non-esperto non capisce perché "66.1% HIT" campeggia su una classifica vuota.
- **Dove:** tutte le pagine desk.

**QW4 — Rendere leggibile l'"edge" al tifoso non esperto** · *Chiarezza* · S · **medio-alto** · quick-win
- **Cosa:** "+71.4 pt · edge modello" e "value 44.2%" sono gergo. Aggiungere una **spiegazione in chiaro** (micro-tooltip o riga sotto: "il modello dà X% in più della quota implicita di mercato") e valutare di **cappare/contestualizzare** i valori estremi.
- **Perché:** "+71.4 pt" (su una prob 86%) e "IF Elfsborg 21% @ 34.00 (+599%)" leggono come "troppo bello per essere vero" → erodono il posizionamento "numeri onesti". Il target è il tifoso, non il trader.
- **Dove:** Edge del giorno + card + modale.

**QW5 — Polish landing KPI** · *Estetica* · S · **medio**
- **Cosa:** la KPI mono "Hit-rate" va a capo spezzandosi ("Hit-/rate"); le 3 KPI sono disomogenee (una parola, un `100%`, una parola "Tracciato"). Dare a "Hit-rate" un valore numerico (o riformattare come label unica senza wrap) e uniformare i 3 slot (valore + unità + didascalia).
- **Dove:** landing, sezione "Niente soffiate… numeri onesti".

---

### DIMENSIONE 1 — MOBILE  *(da ispezione codice; riconfermare su device reale)*

**MOB1 — Nav desk mobile: sola striscia a scorrimento orizzontale** · M · **alto**
- **Cosa:** sotto 1200px la top-nav centrale (`.am-topnav`) è `display:none`; sotto 900px la sidebar (`.sports-rail`) diventa `position:static; display:flex; overflow-x:auto` → una **striscia di ~10 chip a scorrimento orizzontale** (Previsioni, Storico, Classifica, Match Builder, Invita, Piani, World Cup, Creator Picks, Weekly Pick, Aggiorna odds). Proposta: **bottom tab bar persistente** per 4–5 destinazioni primarie (Previsioni · Storico · Classifica · Match Builder · Piani), con le voci "In evidenza" in un ingresso dedicato. **Riusare il craft già esistente** della bottom-bar sport fissa della landing (`.lp-hero-sports`, già hardened 320–414px) invece di inventare.
- **Perché:** con lo scroll orizzontale, World Cup / Creator Picks / Weekly Pick / **Piani** (conversione) restano fuori schermo a destra con affordance debole → bassa scopribilità proprio delle pagine di valore. È probabilmente il punto più debole su telefono (traffico tifosi).
- **Dove:** shell desk (`.book-layout` / `.sports-rail`).

**MOB2 — Verifica densità/tocco card e header su 360–414px** · S–M · **medio**
- **Cosa:** le card vanno a 1 colonna (`.market-list`, `.odds-grid` → `1fr`) — bene. Da verificare su device reale: target di tocco ≥44px su chip/filtri, che le stat-tile header non vadano in overflow, e che il modale scheda sia comodo (sticky footer CTA raggiungibile col pollice).
- **Perché:** non verificabile a schermo in questo ambiente; rischio di target piccoli e footer CTA sotto la fold.

---

### DIMENSIONE 2 — CHIAREZZA / GERARCHIA

*(QW3 e QW4 sopra sono i due interventi principali di questa dimensione.)*

**CHI1 — "Quanto sicuro" più immediato** · S–M · **medio**
- **Cosa:** oggi la sicurezza è distribuita su 3 segnali (`53% modello`, 4 dots `bassa/media/alta`, quota). Per il non-esperto renderla **un** segnale dominante e coerente (es. la conf. label + colore come cue primario, il % come dettaglio). Non aggiungere elementi: **consolidare** i tre in una gerarchia unica.
- **Perché:** "chi vince · quanto sicuro · perché" deve leggersi in <5s; oggi "quanto sicuro" richiede di sintetizzare 3 micro-dati.
- **Dove:** card partita + modale.

---

### DIMENSIONE 3 — ESTETICA / RIFINITURA

**EST1 — Tabelle troppo ariose (gap orizzontale morto)** · S–M · **medio**
- **Cosa:** su Storico e sulla lista Match Builder c'è un ampio vuoto orizzontale tra nome match e metadati/esito su schermi larghi. Cappare la `max-width` della tabella (misura di lettura) **oppure** riempire con colonne utili (quota, edge, esito/CLV) e stringere il ritmo di riga.
- **Perché:** il vuoto non è white space attivo, legge come layout non finito; peggiora la scansione.
- **Dove:** Storico (registro pick), Match Builder (lista selezione).

**EST2 — Weekly Pick: metà destra vuota su desktop** · M · **medio**
- **Cosa:** su ~1440 il contenuto editoriale occupa ~40% a sinistra, il resto è void nero. Posizionare la **schedina/un artefatto visivo** a destra, o center-constrainare la colonna. Rimuovere anche la ripetizione ("11% prob. combinata" e "4 selezioni" compaiono due volte, in KPI-row e in "La settimana").
- **Perché:** su wide screen la pagina legge sbilanciata/incompleta.
- **Dove:** `/weekly-pick`.

---

### DIMENSIONE 4 — ONBOARDING / PRIMO ACCESSO

*(QW2 — empty state — è il primo intervento di questa dimensione.)*

**ONB1 — Prima impressione utente NON loggato non verificata** · — · flag
- **Cosa:** l'audit è stato fatto loggati (login vietato all'agente). Va verificato il **funnel anonimo**: landing → gate/preview → signup → primo desk. La landing come superficie pre-signup è forte e a bassa frizione ("Inizia gratis · Senza carta"). Da confermare che il primo desk dopo signup non presenti muri o empty state spogli (vedi QW2).
- **Dove:** flusso anonimo → signup.

**ONB2 — Hero landing mostra uno sport non coperto** · M · **medio**
- **Cosa:** la 1ª slide del carosello hero mostra un giocatore di **football americano**. L'immagine è baked (già flaggato in `ui_memory`: `hero-allsports.jpg` con basket/baseball/cricket + moltiplicatori). Rigenerare con **solo i 3 sport reali** (calcio/tennis/World Cup), zero moltiplicatori.
- **Perché:** contraddice il posizionamento focalizzato al primo impatto assoluto.
- **Dove:** landing hero.

---

## FLAG DI DOMINIO (fuori scope UI → ml-engineer / Andrea)

Non sono bug grafici, ma emergono nell'UI e minano il "numeri onesti":
- Modale GAIS: mercato Gol "attesi **2.3**" ma PICK = **Under 1.5** (apparente incoerenza).
- Match Builder: pick mostrati con probabilità molto basse (es. Djurgården–Halmstads "Pick: Halmstads BK" a **9%**).
- Quote stantie che generano "value" assurdi: IF Elfsborg **21% @ 34.00 (+599%)**; Edge del giorno **+71.4 pt** su 86%.
→ Da verificare pipeline odds/settlement con `ml-engineer-agentic`. La UI dovrebbe comunque **cappare/contestualizzare** i valori estremi (vedi QW4).

---

## TABELLA RIEPILOGO PRIORITÀ

| ID | Dimensione | Intervento | Sforzo | Impatto | Quick-win |
|----|------------|-----------|--------|---------|-----------|
| QW1 | Estetica | Fix overlap widget Tawk | S | alto | ✅ |
| QW2 | Onboarding | Empty state progettati (Classifica/Creator/leaderboard) | S–M | alto | ✅ |
| QW3 | Chiarezza | Subtitle per pagina + stat-tile contestuali | S | medio-alto | ✅ |
| QW4 | Chiarezza | Edge leggibile al non-esperto + cap valori estremi | S | medio-alto | ✅ |
| QW5 | Estetica | Polish KPI landing (Hit-rate wrap) | S | medio | ✅ |
| MOB1 | Mobile | Bottom tab bar desk (riusare craft landing) | M | alto | — |
| MOB2 | Mobile | Verifica tocco/densità 360–414px su device reale | S–M | medio | — |
| CHI1 | Chiarezza | "Quanto sicuro" consolidato in un cue | S–M | medio | — |
| EST1 | Estetica | Tabelle: cap misura o colonne utili | S–M | medio | — |
| EST2 | Estetica | Weekly Pick: riempire metà destra + dedup KPI | M | medio | — |
| ONB1 | Onboarding | Verificare funnel anonimo/signup | — | — | flag |
| ONB2 | Onboarding | Rigenerare hero (solo 3 sport) | M | medio | — |

---

*Audit read-only. Nessun codice modificato. Screenshot chiave catturati in sessione (desk dark, modale scheda, World Cup Hub, Weekly Pick, Creator Picks empty, light mode). Mobile da riconfermare su device reale prima di implementare MOB1/MOB2.*
