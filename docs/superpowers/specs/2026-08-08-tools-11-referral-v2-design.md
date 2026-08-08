# Tools 5→11 + Referral V2 (#TOOLS-11-0808 · #REFERRAL-V2-0808)

**Data:** 2026-08-08 · **Stato:** design approvato da Andrea (soglie alzate su sua richiesta, 2026-08-08)
**Origine:** deck Maven *"The Growth Plan — Betredge"* (14 iniziative), item **01 Referral** e **02 Free Betting Tools**
**Gate:** medium/high → **PROPOSAL + APPROVE prima di eseguire** (il referral tocca `profiles` in prod con utenti reali)

## Perché

Il deck di Maven propone 14 canali. Dopo la riconciliazione con lo stato reale della
piattaforma, due item sopravvivono come lavoro nostro eseguibile senza gate esterni:

- **Tools** — la macchina è già costruita e verificata in prod dal 05/08 (`#TOOLS-HUB-0805`).
  Il costo marginale di un tool nuovo è quasi tutto contenuto ed esempio numerico:
  raddoppiare la superficie organica non raddoppia il lavoro.
- **Referral** — è l'unico item del deck che **abbassa** il costo di acquisizione invece
  di aggiungerne, e l'unico i cui premi sono *accesso* e non contante, quindi non apre
  superficie nuova sul rischio #1 ([[project_gambling_qualification]], VIA A).

## Diagnosi: perché il referral attuale non funziona

Non è un problema di comunicazione, è un programma **vuoto** su entrambi i lati.

| Lato | Cosa promette oggi | Valore incrementale reale |
|---|---|---|
| Invitato | «−50% sul primo acquisto» | **Zero** — è la promo di lancio che riceve chiunque; il codice stesso scrive *"(uguale per tutti)"* |
| Chi invita | «guadagni solo se attiviamo la revenue sul tuo codice — scrivici per richiederla» | **Zero automatico** — un toggle manuale per-creator (migration 012) |

Chi clicca il link di un amico non ottiene niente che non avrebbe comunque, e chi lo
manda non ottiene niente affatto. Nessuna scala, nessun progresso visibile, nessun
premio che scatti da sé.

## Decisioni prese (Andrea, 2026-08-08)

| Decisione | Scelta |
|---|---|
| Creator vs utenti | **Un sistema, due facce**: tutti hanno un codice e la scala premi; la rev-share resta il toggle backoffice per-creator della 012 |
| Cosa conta come invito valido | **Solo invitati diventati paganti** (la più severa delle tre opzioni) |
| Forma dei premi | **Gradini crescenti, nessun premio eterno** |
| Soglie | **2 / 5 / 10** amici paganti (alzate da Andrea rispetto all'1/3/5 proposto) |
| Tool nuovi | **Tutti e 6**, Parlay con rotta propria |
| Retroattività | **La scala parte da zero al lancio** — coerente con la 012, dove *"l'accrual NON è retroattivo"* |

## Due fasi indipendenti, con rischio diverso

I due workstream non condividono codice e **si spediscono separatamente**. Il rischio non
è lo stesso, quindi non devono viaggiare sullo stesso PR:

- **Fase A — Tools.** Pagine statiche nuove, nessun DB, nessun denaro. Se sbaglio, la
  cosa peggiore è una pagina brutta o un conto sbagliato in una lingua. Basso rischio.
- **Fase B — Referral V2.** Tocca `profiles` in prod con utenti reali, concede piani a
  pagamento gratis e si aggancia ai rail di grant. **Medium/high: PROPOSAL + APPROVE.**

Fase A prima, perché è quella che produce valore senza aspettare nulla.

---

# Parte 1 — Referral V2

## 1.1 Architettura: si aggiunge sopra, non si sostituisce

Tutto l'esistente resta invariato e non viene migrato:

- `profiles.referral_code` — auto-dichiarato, **immutabile**, UNIQUE su UPPER (migration 013)
- `profiles.referred_by` — attribuzione **first-touch**, scadenza 60gg (`lib/referral-code.ts`)
- `/r/CODE` → localStorage → applicato alla registrazione
- `POST /api/referral/claim` — con anti self-referral già implementato
- `creator_revenue_enabled` / `_at` / `_pct` (migration 012) — invariati

Sopra questo si aggiunge una **scala premi** che legge lo stesso `referred_by`. Un
creator è semplicemente un utente che ha *anche* la rev-share accesa: nessun codice
orfano, nessuna doppia UI, nessuna decisione su «cosa succede a chi è entrambi».

## 1.2 La definizione di invito valido, e la correzione obbligatoria

**Regola:** un invito è valido quando l'invitato **ha pagato almeno una volta**.

`/api/referral/stats` oggi conta `plan IN ('base','premium')`, che è lo **stato
corrente**. È sbagliato per una scala premi: se un amico paga e poi disdice, esce dal
conteggio e la soglia **regredisce dopo che il premio è già stato concesso**. Un premio
che si accende e si spegne è peggio di nessun premio.

Si conta quindi il **pagamento avvenuto**, non l'abbonamento attivo — che è esattamente
la metrica `paying_users` già documentata nella migration 012:

```sql
SELECT COUNT(DISTINCT p.identifier) AS paying_invitees
FROM profiles p
JOIN (
  SELECT identifier, granted_at FROM paygate_orders WHERE granted_at IS NOT NULL
  UNION ALL
  SELECT identifier, granted_at FROM paypal_orders  WHERE granted_at IS NOT NULL
) o ON o.identifier = p.identifier
WHERE UPPER(p.referred_by) = $1
  AND p.identifier <> $2;   -- mai contare sé stessi
```

Il conteggio così è **monotono**: sale e non scende mai.

**Un solo punto di lettura.** Oggi la sorgente è una UNION di due tabelle e una terza
(Shopify) è in arrivo su PR #217. La query vive in **un solo helper**
(`lib/referral-rewards.ts`), non copiata negli endpoint: quando il billing migra si
tocca un posto. Questo non è astrazione speculativa — le tabelle da unire sono già due.

## 1.3 La scala

| Soglia | Premio | Meccanica |
|---|---|---|
| **2** amici paganti | **29** giorni di PRO | `computePaygateGrant` con `days: 29`, `plan: "premium"` |
| **5** amici paganti | altri **60** giorni di PRO, cumulativi coi 29 del gradino precedente | stesso helper, `days: 60` |
| **10** amici paganti | Canale Telegram riservato, finché resti attivo (**revocabile**) | flag su `profiles`, letto dal bot |

Nessun premio eterno: i primi due scadono, il terzo è condizionato e revocabile.

**«Finché resti attivo» ha una definizione operativa**, altrimenti non è revocabile ma
solo vagamente minaccioso: *attivo* = ha un piano a pagamento non scaduto (`base` o
`premium`, **inclusi i giorni regalati** — chi è dentro grazie al premio conta come
attivo). Quando `effectivePlan()` lo declassa a `free`, il flag va a `false` e il bot lo
rimuove dalla stanza. Se torna a pagare, il flag si rialza senza dover rifare i 10
inviti: il gradino raggiunto resta in `referral_rewards` per sempre.

Il gradino alto resta **10 come nel deck** — la slide di Maven rimane vera alla lettera,
ed è il premio col costo marginale più basso (una stanza Telegram non costa nulla in
più), quindi tenerlo alto e aspirazionale è gratis. I due gradini che costano davvero
sono quelli a giorni di PRO, e sono i due alzati di più.

### Il grant DEVE passare da `computePaygateGrant`

`lib/plan-grant.ts` contiene già una funzione **pura e testata** che fa due cose
indispensabili qui: **stack del tempo residuo** (estende dalla scadenza se ancora
attiva, altrimenti da ora) e **anti-downgrade** (un piano attivo di rango superiore non
viene declassato).

Scrivere `plan_expires_at = NOW() + INTERVAL '30 days'` come fa il rail admin
**accorcerebbe** l'abbonamento di un utente con PRO già attivo: il premio diventerebbe
una punizione. Riusandola, i giorni regalati si sommano in cima a quelli pagati.

**Nuovo `plan_source: 'referral'`** per distinguere un piano regalato da uno pagato.
Verificate le interazioni con le guardie esistenti in `plan-grant.ts`:

- `shopifyGrantAllowed()` → protegge solo `plan_source === 'paygate'` attivo, quindi un
  premio referral **non blocca** un acquisto reale successivo. ✔
- `hasActiveShopifySubscription()` → richiede `plan_source === 'shopify'`, quindi un
  premio **non** viene confuso con un abbonamento attivo e non blocca il riacquisto. ✔
- Effetto collaterale accettato: chi ha PRO regalato attivo e compra BASE mantiene PRO
  per anti-downgrade e somma il tempo. È il comportamento già progettato del rail, è
  generoso e non è un bug.

### Idempotenza

Il premio di ogni gradino va concesso **una volta sola**. Tabella dedicata:

```sql
CREATE TABLE referral_rewards (
  id            BIGSERIAL PRIMARY KEY,
  identifier    TEXT NOT NULL,
  tier          SMALLINT NOT NULL,          -- 0 = bonus invitato (§1.4) · 2 | 5 | 10 = gradini
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paying_count  INT NOT NULL,               -- il conteggio al momento del grant (audit)
  UNIQUE (identifier, tier)
);
```

Lo `UNIQUE (identifier, tier)` è il lock vero: due richieste concorrenti non possono
concedere due volte lo stesso gradino. `exec_sql` non riporta `RETURNING` (trappola
nota): si fa INSERT, poi SELECT di verifica, e solo se la riga è mia si concede il piano.
**L'ordine è INSERT-poi-grant**: se il grant fallisce dopo l'insert si perde un premio
(recuperabile a mano dal log), mentre l'ordine inverso ne concederebbe due.

## 1.4 Il lato invitato — ora è il collo di bottiglia

Conseguenza diretta della regola scelta: se il premio scatta solo quando l'amico
**paga**, chi invita ha bisogno che l'amico converta. Oggi all'amico il link non offre
nulla di incrementale, quindi la catena si rompe al primo anello.

**L'invitato riceve 7 giorni di PRO all'iscrizione con un codice valido**, oltre alla
promo di lancio che ha comunque.

- È **accesso, non denaro** → resta dentro la VIA A, nessuna superficie nuova sul rischio #1.
- Mette l'invitato *dentro* il prodotto, che è dove si converte — e la conversione è
  precisamente ciò che sblocca il premio di chi ha invitato: i due lati ora si tirano.
- Stesso helper, `days: 7`, `plan: "premium"`, `plan_source: 'referral'`, registrato in
  `referral_rewards` con `tier = 0` per l'idempotenza (un invitato, un bonus).

## 1.5 Anti-abuso — cosa regge e cosa no

| Vettore | Difesa |
|---|---|
| Auto-invito col proprio codice | Già implementata in `/api/referral/claim` (azzera `referred_by`); la query esclude `identifier <> $2` |
| Account usa-e-getta | Neutralizzato dalla regola: un account gratuito non muove il contatore |
| **Arbitraggio economico** | **Invariante testata**, non un numero fissato — vedi §1.5.1 |
| Rimborso/chargeback dopo il grant | **Debito accettato:** il conteggio è monotono per progetto, quindi un premio già concesso non si revoca. Blast radius = 29 giorni di PRO. Owner: Andrea, da rivedere se si vede in BO |

### 1.5.1 L'invariante anti-arbitraggio

Misurato sui prezzi di `lib/commercial-plan.ts` a oggi (BASE **$14.99**, PRO **$29.99**):
l'attacco al gradino 1 costa 2 × BASE = **$29.98** per un premio da **$29.99**. Margine
un centesimo: non profittevole in pratica. Alla soglia 1 che era stata proposta
inizialmente costava $14.99 per $29.99 — **2× di profitto**, farmabile. Le soglie alzate
da Andrea hanno chiuso il buco.

**Deciso da Andrea (2026-08-08): il primo gradino concede 29 giorni, non 30.** A
$28.99 contro $29.98 di costo l'invariante è rispettata con circa un euro di margine, e
fra 29 e 30 giorni l'utente non percepisce differenza. È la modifica più piccola che
chiude il buco senza alzare l'ingresso della scala.

Ma il margine **non è stabile**, e scriverlo nella spec come fatto compiuto sarebbe un
errore: sul branch `betredge/fixes-prices-badges` c'è già un *«prezzo Pro 49.90»*. Se
quel prezzo arriva in main, lo stesso attacco costa $29.98 per un premio da $48.23 —
**+61% di profitto**, e il programma diventa una macchina per regalare PRO. Nemmeno i 29
giorni ci salvano da un cambio di prezzo: solo il test lo fa.

Quindi la difesa non è la soglia, è un **test che lega premio e costo**:

```
per ogni gradino:  valore_premio(gradino)  ≤  costo_minimo_per_sbloccarlo(gradino)
```

dove `costo_minimo` = soglia × prezzo del piano a pagamento **più economico**, letti
entrambi da `lib/commercial-plan.ts` (non hardcodati nel test). Se domani qualcuno cambia
un prezzo o una soglia, **il test rosso lo dice** invece di lasciare aperto un arbitraggio
che nessuno ricalcola a mano. Al primo centesimo di margine il test fallisce: è severo di
proposito, perché il lato sbagliato dell'errore qui costa prodotto gratis.

## 1.6 UI del pannello *Invita*

Resta dov'è (tab `invita` in `/app`, solo da loggati) e mantiene claim del codice e
link copiabile. Si aggiunge:

- **Progresso verso il gradino successivo** — «3 amici paganti · 2 al prossimo premio»,
  con i tre gradini visibili e quelli raggiunti marcati. Il progresso è il motore: senza
  di esso l'utente non sa di essere a metà strada.
- **Cosa ottiene l'amico** — i 7 giorni, detti sul pannello, perché è l'argomento che
  chi invita userà per convincerlo.
- La nota sulla rev-share resta, ma **sotto** e in tono minore: non è più l'offerta
  principale, è un'opzione per creator.
- Copy in 5 lingue (`pick5`, la chrome del sito parla 5 lingue — non 11 come i tool).

Il pannello legge un solo endpoint esteso: `GET /api/referral/stats` torna
`{ code, signups, paying, tiers: [{tier, reached, granted_at}] }`. `signups` resta per
non rompere la UI esistente; `paid` (stato corrente) viene **sostituito** da `paying`
(pagamenti avvenuti) — nessun altro consumatore in codebase, verificato.

## 1.7 Dove scatta il controllo dei gradini

**Non** in un cron e **non** a ogni apertura del pannello: al momento in cui il fatto
diventa vero, cioè **quando un ordine viene concesso**. I rail di grant
(`activatePaygatePlan`, `activatePaypalPlan`, `activateShopifyPlan`, `activateStripePlan`)
chiamano, dopo il grant riuscito, `checkReferralTiers(invitedIdentifier)` che risale a
`referred_by` e valuta i gradini di chi ha invitato.

Il controllo è **best-effort e non deve mai far fallire un grant pagato**: try/catch con
log, come già fa `sendPlanReceipt`. Un premio mancato si recupera; un pagamento non
concesso è un cliente perso.

---

# Parte 2 — Tools 5→11

## 2.1 Cosa si aggiunge

Cinque tool esistono (`odds-converter`, `margin-calculator`, `ev-calculator`,
`kelly-criterion`, `probability-calculator`). Si aggiungono **sei** slug a
`TOOL_SLUGS` in `lib/tools/registry.ts` — che è già l'unica fonte di verità per
`generateStaticParams` e per gli hreflang, quindi l'infrastruttura di routing non si
tocca:

`arbitrage-calculator` · `roi-calculator` · `yield-calculator` · `stake-calculator` ·
`bankroll-calculator` · `parlay-calculator`

**Da 66 a 132 URL statiche** (11 tool × 11 lingue = 121 pagine, + gli 11 hub).

Parlay ha rotta propria anche se la matematica della catena vive già dentro
`probability-calculator`: il senso dell'hub è **una pagina per keyword**, quindi la
sovrapposizione matematica non è un difetto. Vale anche per Stake/Bankroll rispetto a
Kelly — intent di ricerca diversi (*quanto punto su questa* vs *come gestisco il totale*).

## 2.2 Matematica e esempi lavorati (verificati a mano)

Ogni tool porta un esempio numerico coi conti fatti, come i cinque esistenti.

| Tool | Formula | Esempio verificato |
|---|---|---|
| **Arbitrage** | arb se `Σ(1/quota) < 1`; profitto `= 1/Σ − 1`; stake `= totale × (1/quotaᵢ)/Σ` | 2.10 e 2.10 su due book → Σ = 0.952381 → **+5.00%**; su 1000: 500/500, ritorno 1050, profitto 50 |
| **ROI** | `profitto / capitale impiegato` | bankroll 1000, profitto 400 → **40.00%** |
| **Yield** | `profitto / totale giocato` (turnover) | 200 giocate da 50 = 10.000 di turnover, profitto 400 → **4.00%** |
| **Stake** | `stake = profitto obiettivo / (quota − 1)` | 100 di profitto a 2.50 → **66.67** |
| **Bankroll** | `unità = bankroll × %`; drawdown di una serie; giocate a rovina | 2000 al 2% → **40** per giocata; 10 perse = 400 = **20%** di drawdown; 50 giocate a rovina |
| **Parlay** | quota combinata `= Π quotaᵢ`; probabilità implicita `= 1/combinata`; margine composto `= (1+m)ⁿ − 1` | 4 gambe a 1.80 → 1.80⁴ = **10.4976**; implicita **9.53%**; margine composto **21.55%** con `m = 5%` per gamba |

ROI e Yield sono deliberatamente distinti (capitale vs turnover): la differenza tra i
due è essa stessa contenuto che qualcuno cerca, e ogni explainer cita l'altro con i
numeri del caso identico (stesso profitto 400 → ROI 40% sulla cassa, yield 4% sul
giocato).

**La citazione è per nome, non un `<a>`**: `Prose.tsx` rende solo `**grassetto**`, non i
link markdown, ed è fra i componenti condivisi da non toccare. Il percorso navigabile fra
i tool esiste già — il blocco «Other free tools» di `ToolShell` elenca tutti gli altri su
ogni pagina — quindi il crawl path c'è e il guadagno di un link contestuale in più è
modesto rispetto al toccare un renderer usato da 121 pagine. **Deferito, non dimenticato.**

**Nessuna assunzione nascosta in una costante.** Il margine composto del parlay ha
imposto la regola: il «21,6%» che questa spec riportava non discendeva dalle gambe a
1.80 — veniva da un margine del 5% per gamba che nessuno aveva dichiarato (derivandolo
dalle quote sarebbe stato 46,41%). Quando un output dipende da un parametro che l'utente
non vede, il parametro diventa **un campo**, non una costante nel codice. E l'esempio
scrive il numero che il readout stampa davvero (21,55%), non il suo arrotondamento.

## 2.3 Riuso, non nuova architettura

Per ogni tool: un componente calcolatore in `components/tools/` sul modello degli
esistenti (`ToolShell` + `ToolCalculator` + `Prose` + `Meter`), la copy in
`lib/tools/copy/`, l'icona.

- **`Meter`** — ogni tool mostra **un numero vero dell'utente** (non decorazione):
  arbitrage = profitto garantito contro lo zero; ROI/yield = il risultato contro il
  break-even; stake = la quota della cassa impegnata; bankroll = drawdown contro la
  rovina; parlay = la catena delle probabilità. Resta `aria-hidden`: ogni numero esiste
  già come testo.
- **Icone** — sei raster 3D nella famiglia esistente via gptimg + scontorno flood-fill,
  seguendo il protocollo anti-blocco (`pkill` di `codex exec`, primo piano, prompt corti).
  Mai line-art.
- **Nessun blocco formula** — decisione di Andrea del 05/08 («così non lo leggerà
  nessuno»): al loro posto l'esempio numerico lavorato, spiegazione a 2 paragrafi,
  standfirst più grande, frase chiave col filetto verde.
- Nessuna modifica a `ToolShell`/`ToolCalculator`/`Prose`/SEO: se serve toccarli, è un
  segnale che il tool nuovo sta uscendo dal pattern e va discusso.

## 2.4 Trappole già pagate, da non ripagare

- **`.portal-root` è una grid** → item con `min-width: auto`: un blocco con
  `overflow-x: auto` che contiene testo non spezzabile **allarga il documento** invece
  di scorrere (misurati 456px su viewport 390). Serve `min-width: 0`.
- **`SiteTopbar` legge la lingua da localStorage** (default `it`): le pagine con lingua
  nell'URL devono passare i prop `lang`/`hideLang`.
- **La matematica nella copy va testata come il codice**: ad agosto il testo diceva
  «1.91 → 52.38% → 4.76 punti» mentre il calcolatore mostrava 4.71%. Due test guardano
  l'aritmetica delle **stringhe** in tutte e 11 le lingue: vanno estesi ai sei nuovi.
- **Soglia dell'explainer in CARATTERI, non parole** (>800): polacco e turco dicono lo
  stesso con 40 parole in meno ma pari caratteri.
- **Sitemap**: le 66 URL nuove vanno in `sitemap.xml` — il criterio di successo è
  l'indicizzazione, e una pagina fuori sitemap non esiste.

---

# Verifica (criteri di successo)

Nessuno di questi è «dichiarato»: ognuno è un comando o un check osservabile.

**Tools**
1. `TOOL_SLUGS` ha 11 voci; la build genera **132 HTML statici**; `/tools/xxx`, `/zz/tools` e `/en/tools` restano **404**.
2. Test unitari sui sei calcolatori con **i valori della tabella 2.2 calcolati a mano**.
3. Bordi (vuoto, 0, negativo, testo) → trattino, **mai NaN**.
4. Test sull'aritmetica delle stringhe di copy in **11 lingue** per i sei tool nuovi.
5. Playwright a **1440 e 390px** su tutti e sei; nessun overflow orizzontale del documento.
6. Ogni pagina: canonical + **12 hreflang** + JSON-LD nell'HTML servito.
7. Sitemap: **132 URL sotto `/tools`** (121 pagine tool + 11 hub).

**Referral**
8. Test della query di conteggio: un invitato che paga e **poi disdice resta contato** (il caso che rompe la versione attuale).
9. Test di idempotenza: due chiamate concorrenti a `checkReferralTiers` sullo stesso gradino → **un solo** grant (lo `UNIQUE` regge).
10. Test che il grant **estende e non accorcia**: utente con PRO attivo a 20 giorni + premio 29gg → **49 giorni**, non 29.
11. Test anti self-referral: il proprio codice non incrementa il contatore.
12. Test che un premio referral **non blocchi** un acquisto Shopify successivo (`shopifyGrantAllowed` con `plan_source = 'referral'`).
13. Il pannello mostra il progresso corretto sui dati veri, verificato **da loggato** con cookie Chrome (mai solo da anonimo).
14. Un grant pagato **non fallisce** se `checkReferralTiers` lancia (test col mock che throwa).
15. **Invariante anti-arbitraggio** (§1.5.1): per ogni gradino, `valore_premio ≤ soglia × prezzo del piano più economico`, coi prezzi letti da `lib/commercial-plan.ts`. Rosso se un prezzo o una soglia cambia.

# Fuori scope (dichiarato)

- Gli altri 12 item del deck Maven: Google Ads e Push vanno a Maven; X, Telegram free/base, TikTok/Shorts/Reels, Reddit, Discord restano progetti separati con la loro spec.
- La revoca del premio su rimborso (§1.5, debito accettato con owner).
- La stanza Telegram del gradino 10: qui si scrive il **flag** e la sua semantica; la creazione del canale e il bot che ci pubblica sono lavoro del workstream Telegram.
- Traduzioni con revisione madrelingua: come i cinque esistenti, la traduzione è mia.

# Collegamenti

`#TOOLS-HUB-0805` (spec `2026-08-05-free-betting-tools-design.md`) · migration 012
(creator revenue) · migration 013 (referral code UNIQUE) · `lib/plan-grant.ts`
(`computePaygateGrant`) · PR #217 (billing → Shopify, tocca la sorgente «ha pagato») ·
[[project_gambling_qualification]] (VIA A: i premi sono accesso, non denaro)
