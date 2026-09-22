# Handoff — Shopify: gli abbonamenti BetRedge non hanno un biller

**Data:** 2026-09-11
**Destinatario:** Tommy (accesso Shopify Admin)
**Chi fa la parte Vercel:** Andrea (Tommy non tocca Vercel)
**Rif. interno:** `#SHOPIFY-NO-BILLER-0911`

---

## 1. Il problema, in tre frasi

Lo store Shopify **`gvfgra-sp.myshopify.com`** (admin: `info@betredge.com`) vende due
abbonamenti BetRedge, mensile e annuale. Il checkout funziona: crea regolarmente un
*subscription contract* e la carta del cliente viene salvata.

**Ma Shopify non addebita da solo.** Un abbonamento si rinnova solo se **un'app**
chiama `subscriptionBillingAttemptCreate` sul contratto a ogni ciclo. I nostri due
selling plan (`692497973585` = Monthly, `692498071889` = Annual) sono stati creati a
luglio con un'app custom (`BetRedge Billing Ops`) che **non fa fatturazione**: ha solo i
permessi sui prodotti. Quindi nessuno ha mai eseguito il secondo addebito.

**Conseguenza reale:** l'unico cliente che ha pagato con carta (ordine **#1002**,
25/07/2026, $14.99) non è mai stato riaddebitato il 24/08 ed è decaduto in silenzio.
Non è un caso isolato: sarebbe successo a chiunque.

> **Perché serve Tommy:** tutto quello che segue si fa **dentro Shopify Admin**, a cui
> noi non abbiamo accesso. Nessuno di questi passi tocca il sito, il database o i
> pagamenti già incassati.

---

## 2. Prima di toccare qualsiasi cosa — la regola che non va violata

### ⛔️ NON disinstallare l'app custom `BetRedge Billing Ops`

(app id `402113429505`, visibile in *Impostazioni → App e canali di vendita*)

Due motivi:

1. **Tiene il token Admin API** che il nostro sito usa per specchiare in Shopify gli
   ordini pagati in crypto. Disinstallarla rompe quella funzione, che oggi funziona.
2. **Disinstallare un'app che possiede dei subscription contract ne provoca la
   cancellazione dopo 48 ore.** Va lasciata dov'è anche dopo aver creato i piani nuovi.

Sembra l'app "sbagliata" da rimuovere — non lo è. Va semplicemente **affiancata**, non
sostituita.

### ⛔️ NON forzare addebiti sul cliente esistente

Nessun "riprova il pagamento" sul contratto di `joachimasolbakken@gmail.com`: sono
passate settimane, un addebito a sorpresa oggi sarebbe un problema, non una soluzione.
Vedi il punto 3.1: quel contratto si **chiude**, non si riattiva.

---

## 3. I cinque passi

### 3.1 — Fotografare (e poi chiudere) il contratto del cliente esistente

**Dove:** Shopify Admin → *Clienti* → cerca `solbakken`
(URL diretto: `https://admin.shopify.com/store/gvfgra-sp/customers?query=solbakken`)

Cliente: **`joachimasolbakken@gmail.com`** — ordine #1002 del 25/07/2026, $14.99,
prodotto *BetRedge Base* (mensile).

Rispondere a queste quattro domande e riportarle ad Andrea:

| Domanda | Perché serve |
|---|---|
| Esiste un **subscription contract** sulla scheda cliente? | Se non c'è, non c'è nulla da chiudere e il rischio è zero |
| Qual è il suo **stato**? (`active` / `cancelled` / `failed` / `paused`) | `active` = la carta è ancora vaultata e riaddebitabile |
| C'è un **prossimo addebito previsto** e con che data? | È l'unico modo di sapere se può ancora partire un addebito a sorpresa |
| Ci sono **tentativi di addebito falliti** nello storico? | Distingue "nessuno ha mai provato" da "ha provato e non è passato" |

**Poi, se il contratto risulta `active`: cancellarlo.** Non metterlo in pausa —
cancellarlo. Un contratto attivo senza nessuno che lo fattura è una mina: nel momento in
cui colleghiamo un biller, quello potrebbe addebitare un ciclo con settimane di ritardo
a una persona che nel frattempo non è più cliente.

**Fatto quando:** le 4 risposte sono scritte ad Andrea e il contratto risulta
`cancelled` (o non è mai esistito).

---

### 3.2 — Ricreare i piani dentro l'app nativa **Shopify Subscriptions**

**Dove:** Shopify Admin → *App* → **Subscriptions** (l'app gratuita di Shopify, già
installata sullo store) → *Crea piano di abbonamento*.

Servono **due piani**, da applicare ai prodotti indicati:

| Piano | Ricorrenza | Prodotti a cui applicarlo | Prezzo (già sul prodotto) |
|---|---|---|---|
| **Monthly** | ogni **1 mese** | `BetRedge Base`, `BetRedge Premium` | $14.99 / $29.99 |
| **Annual** | ogni **1 anno** | `BetRedge Base Annual`, `BetRedge Premium Annual` | $164.99 / $329.99 |

Due regole sul come:

- **Nessuno sconto sul piano.** Il campo "sconto abbonamento" va lasciato a **0%**: il
  prezzo giusto è già quello del prodotto, e uno sconto lì si sommerebbe alle promo che
  gestisce il nostro sito. Un cliente pagherebbe meno del dovuto senza che ce ne
  accorgiamo.
- **Il piano deve essere creato dall'app Subscriptions**, non da `BetRedge Billing Ops`.
  È esattamente il punto di tutto questo lavoro: chi possiede il piano è chi eseguirà
  l'addebito. Se il piano nuovo nasce di nuovo sotto l'app custom, non abbiamo risolto
  niente.

**Non toccare** questi prodotti, che devono restare **senza** piano di abbonamento
(sono acquisti una-tantum e devono restarlo):
`BetRedge Weekly Pick`, `BetRedge Base — 30 Days (one-time)`,
`BetRedge Premium — 30 Days (one-time)`.

Se sulla scheda di uno di questi prodotti compaiono **altri piani oltre a questi due**
(per esempio un piano promozionale di lancio), **non cancellarli: segnalarli ad Andrea**
con nome e ID. Sono piani vecchi che soffrono dello stesso difetto, ma la decisione su
cosa farne dipende da variabili che stanno su Vercel.

**Fatto quando:** aprendo la scheda di `BetRedge Base` si vede il piano *Monthly*
elencato, e nella colonna dell'app compare **Subscriptions** (non "BetRedge Billing
Ops"). Idem per l'annuale sui due prodotti Annual.

---

### 3.3 — Verificare che non ci sia **anche Appstle Subscription**

**Dove:** Shopify Admin → *Impostazioni* → *App e canali di vendita*.

A luglio risultavano installate **due** app di abbonamento in parallelo: quella nativa
`Subscriptions` e **`Appstle Subscription`**. Due app che gestiscono abbonamenti sullo
stesso store significano piani duplicati, e nel caso peggiore due addebiti sullo stesso
cliente.

- Se **Appstle non c'è più**: scrivilo e passa oltre.
- Se **c'è**: guarda prima se possiede dei selling plan o dei contratti attivi
  (App → Appstle → i suoi piani). Se è vuota, **disinstallala**. Se ha contratti dentro,
  **fermati e scrivilo ad Andrea** prima di disinstallare: vale la stessa regola delle 48
  ore del punto 2.

**Fatto quando:** o Appstle non è installata, oppure è stato confermato che è vuota ed è
stata rimossa.

---

### 3.4 — Registrare i 4 webhook mancanti

**Dove:** Shopify Admin → *Impostazioni* → *Notifiche* → *Webhook* → *Crea webhook*.

Oggi sullo store sono registrati **solo** `orders/paid` e `refunds/create`: per questo un
rinnovo che non parte non produce nessun segnale e il difetto è rimasto invisibile per
settimane. Il nostro sito ha **già** il codice che riceve questi quattro eventi — manca
solo che Shopify glieli mandi.

Per ognuno dei quattro:

| Campo | Valore |
|---|---|
| Evento | `subscription_contracts/create` |
| Evento | `subscription_contracts/update` |
| Evento | `subscription_billing_attempts/success` |
| Evento | `subscription_billing_attempts/failure` |
| Formato | **JSON** |
| URL | `https://www.betredge.com/api/shopify/webhook` |
| Versione API | **2026-07** |

Tre trappole, tutte già incontrate su questo store:

1. **La versione API va cambiata a mano.** Il form propone di default **`unstable`**, che
   non va bene: cambia forma senza preavviso. Selezionare **2026-07**.
2. **L'URL è con `www`.** `https://betredge.com/...` risponde con un redirect, e dopo 48
   ore di consegne fallite Shopify cancella il webhook da solo.
3. **Le tendine dell'admin non rispondono alla rotella del mouse** e digitarci dentro fa
   scattare le scorciatoie globali di Shopify (si aprono pagine a caso). Aprire la
   tendina col click e scorrere con le **frecce della tastiera**, poi Invio.

**Fatto quando:** nella lista dei webhook compaiono 6 righe (le 2 esistenti + le 4
nuove), tutte verso `https://www.betredge.com/api/shopify/webhook` e tutte in versione
`2026-07`. Screenshot della lista ad Andrea.

---

### 3.5 — Passare i 3 ID ad Andrea (e fermarsi lì)

Creati i piani nuovi al punto 3.2, servono i loro **ID numerici**. Si leggono dall'URL
della pagina del piano dentro l'app Subscriptions, oppure dalla scheda del prodotto.

Da mandare ad Andrea:

- ID del **selling plan mensile** → andrà in `SHOPIFY_SELLING_PLAN_BASE`
- ID del **selling plan mensile del premium** → `SHOPIFY_SELLING_PLAN_PREMIUM`
  (se un unico piano mensile copre entrambi i prodotti, è lo stesso numero due volte:
  era così prima, con `692497973585`)
- ID del **selling plan annuale** → `SHOPIFY_SELLING_PLAN_ANNUAL`

**Qui la lane di Tommy finisce.** Mettere quei valori nelle variabili d'ambiente su
Vercel e riaccendere la vendita dell'abbonamento è **di Andrea**, che ha l'accesso, e va
fatto solo dopo che i punti 3.1–3.4 sono chiusi.

---

## 4. Cosa rimandare indietro

Un unico messaggio ad Andrea con:

1. Le 4 risposte sul contratto del cliente + se è stato cancellato (punto 3.1)
2. Conferma che i due piani esistono **sotto l'app Subscriptions**, con screenshot della
   scheda prodotto (punto 3.2)
3. Stato di Appstle: assente / rimossa / presente-con-contratti (punto 3.3)
4. Screenshot della lista webhook (punto 3.4)
5. I 3 ID dei selling plan (punto 3.5)

Se un passo non torna — un'app che non c'è, un menù diverso da come è descritto qui, un
contratto in uno stato imprevisto — **fermarsi e scriverlo**, invece di aggirarlo. Il
difetto che ha causato tutto questo è nato esattamente così: una cosa data per fatta che
nessuno aveva verificato.

---

## 5. Nota per Andrea (non è lavoro di Tommy)

Finché i punti sopra non sono chiusi, **il sito continua a vendere un abbonamento che
non si rinnoverà**. L'interruttore per fermare quella vendita è solo ambientale: tolte
`SHOPIFY_SELLING_PLAN_BASE` / `_PREMIUM` / `_ANNUAL` da Vercel, `buildShopifyCheckoutUrl`
(`lib/shopify.ts`) torna `null`, `/api/shopify/checkout` risponde 503 e il checkout cade
sul rail PayGate one-off — la cui copy dichiara già che non si rinnova. È reversibile
rimettendo i valori, ed è coperto dai test (`lib/shopify.test.ts:135,140`).
⚠️ **Vanno tolte anche le tre `*_LAUNCH`** (`SHOPIFY_SELLING_PLAN_BASE_LAUNCH`,
`_PREMIUM_LAUNCH`, `_ANNUAL_LAUNCH`) se sono valorizzate: `sellingPlanFor(..., discounted)`
legge il piano di lancio **prima** di quello pieno (`lib/shopify.ts:142-147`), quindi con
la promo attiva il rail resterebbe aperto anche dopo aver tolto le altre tre.
Non verificato se oggi siano settate: `vercel env pull` restituisce i valori vuoti, si
legge solo dalla dashboard.

Resta inoltre **falsa la copy al punto vendita**, non corretta in questo giro (5
occorrenze in `app/app/page.tsx`: la disclosure nel modal «renews automatically every
month», due badge «Carta o crypto · rinnovo automatico», la FAQ «How do I pay?»). È una
decisione di prodotto e va presa insieme a quella sull'interruttore qui sopra: o si
ripara il rail, o la copy va allineata.
