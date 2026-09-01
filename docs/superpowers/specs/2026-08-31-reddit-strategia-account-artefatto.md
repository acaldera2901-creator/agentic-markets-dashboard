# Reddit — strategia «account-artefatto»

**Data:** 2026-08-31 · **Owner:** marketing · **Sostituisce:** `2026-08-13-reddit-playbook.md`
**Decisione di Andrea (31/08):** un solo account, `u/Betredge`. Nessun account umano.

---

## 1. Diagnosi — il canale non è sotto-sfruttato, non è mai partito

| misura | valore |
|---|---|
| `u/Betredge` creato | 10/08/2026 |
| Commenti pubblicati | **4**, tutti fra il 10 e il 14/08 |
| Attività negli ultimi 17 giorni | **zero** |
| Post principale (scritto il 13/08, pronto) | **mai pubblicato** |
| Soglia di morte del playbook precedente | 27/08 — **passata per inerzia, non per misura** |
| Blocchi umani mai sbloccati | OK di Tommy in `ch_deploy_gate` · display name (30 secondi a mano) |

⚠️ **Da verificare per primo (owner: Andrea, account loggato):** il feed pubblico
`reddit.com/user/Betredge/comments.rss` risponde **200 con la bio corretta e zero
commenti**. Non è confermato che i 4 commenti siano stati rimossi — Reddit ha risposto
429 su tutti i control, quindi lo strumento potrebbe mentire (cfr.
`reference_lazy_images_false_positive`). Ma finché non si guarda, non si sa se stiamo
progettando sopra un account già bruciato.

**Il difetto strutturale del piano vecchio non era la tattica, era il ciclo:** un post
levigato per 18 giorni e mai spedito, e una soglia di morte che si poteva mancare
semplicemente non facendo nulla. La strategia nuova mette la cadenza *prima* della
qualità del singolo pezzo, e rende il non-fare una condizione di fallimento esplicita.

---

## 2. Il vincolo che fissa la forma

Un solo account, col nome del brand. Conseguenza diretta e non negoziabile:

> **Il brand non entra mai nei sub grandi come partecipante.**

`r/sportsbook` (615k) e `r/sportsbetting` (579k) sospendono gli account solo-promo a
discrezione dei mod, e un nome-brand che commenta nei daily thread è indistinguibile
da un tout. **Quei 1,2M di persone non sono nel piano.** Va scritto qui perché il
growth plan di aprile prometteva il contrario ed era falso.

Il bacino reale è quello dei sub dove un brand che *regala* è benvenuto:

| sub | iscritti | cosa ci si può fare |
|---|---|---|
| **r/algobetting** | 25k | sub primario: metodologia, dati, registro esiti. No ads, no vanto su campioni piccoli |
| **r/sportsanalytics** | 24k | solo commenti, o post senza mercato/quote (regola: niente submission su gambling) |
| **r/datasets** | 700k | dataset gratuiti — il brand sul dataset è normale, non promo |
| **r/SideProject** / **r/InternetIsBeautiful** | 500k / 17M | i calcolatori, come prodotto gratuito. Traffico basso in qualità, ma legittimo |
| r/SoccerBetting | 144k | solo dentro il *Daily Picks Thread* (commenti) |

**Ordine di grandezza atteso: decine di click al mese, non migliaia.** Vale la pena
solo per un motivo: oggi il sito intero fa **4,5 sessioni uniche al giorno** e la bocca
dell'imbuto è zero. Venti click veri al mese da gente che costruisce modelli valgono
più di 2.680 impression di banner che hanno prodotto 2 clic.

---

## 3. Il principio: si regalano COSE, non OPINIONI

In `r/algobetting` c'è una caccia attiva ai contenuti scritti da AI (misurato il 13/08:
il commento top di un thread liquidava un post come *«personal blog of llm bs»*).
Con un solo account, e quell'account che porta il nome del brand, l'accusa «è un bot»
è una macchia permanente e cercabile **esattamente nella community che ci serve**.

Da qui la regola che governa tutta la produzione:

> **Un calcolatore, un dataset, una tabella di esiti saldati non possono essere «AI slop».
> Un paragrafo levigato sì.**

Quindi `u/Betredge` pubblica artefatti e li commenta in modo corto e numerico. Non
pubblica saggi, non fa opinionismo, non argomenta in prosa.

---

## 4. I quattro artefatti, in ordine di forza

Sono tutti già costruiti e tutti fermi. Nessuno richiede codice nuovo.

### A. Il registro sigillato → post mensile di esiti (il più forte)
Il canale Telegram dichiara **3 pick al giorno prima del calcio d'inizio e le salda
tutte**. È la valuta che Reddit rispetta e che quasi nessuno ha: un record dichiarato
in anticipo, non selezionato a posteriori.
- **Forma:** tabella *dentro* Reddit (mai un link), riga per riga, incluse le perse.
- **Dove:** `r/algobetting`; nel Daily Thread di `r/SoccerBetting` in versione corta.
- **Vincolo:** il primo post si fa **solo dopo 14 giorni consecutivi di sigillo saldato
  al 100%** (il gate già scritto in `project_telegram_free_channel`). Non prima.

### B. Il dataset delle closing line (il più credibile)
**24.864 snapshot** di closing line raccolti. Pubblicarne un estratto pulito, gratis,
con licenza aperta, in `r/datasets` + `r/algobetting`.
- Costo: una query e un CSV. Rendimento: è il tipo di regalo che compra il diritto di
  parlare in quel sub per sei mesi.
- Zero rischio legale: sono prezzi di mercato, non consigli.

### C. I 132 calcolatori
Costruiti, live, in 11 lingue, **7 visite in 30 giorni**. Sono gratuiti, senza
registrazione e senza pubblicità: è esattamente il profilo che `r/SideProject` e
`r/InternetIsBeautiful` accettano da un account-brand.
- Nei sub betting **mai come post**: solo in risposta a chi chiede «come calcolo l'EV /
  il margine / lo stake?». Rispondere con il numero fatto a mano **e** il link, in
  quell'ordine.

### D. Le curve di calibrazione
Il post già scritto il 13/08 (23.091 previsioni walk-forward, con l'ammissione che sul
calcio il mercato è meglio calibrato di noi). Resta valido, ma **va accorciato e
irregolarizzato** prima di uscire — nella forma attuale è il tipo di prosa che quel sub
caccia. Esce come terzo post, non come primo.

---

## 5. Cadenza — è questa la parte che è mancata

### Le medie giornaliere

| | media/giorno | al mese | dove |
|---|---|---|---|
| **Commenti** | **3** | ~90 | `r/algobetting`, `r/sportsanalytics`, Daily Thread di `r/SoccerBetting` |
| **Post** | **0,14** (1 a settimana) | 4–5 | ruotati su 6 sub, così ognuno ci vede ~1 volta al mese |

**Rampa, perché l'account è freddo** (~2 di karma, tre settimane di vita):

| periodo | commenti/giorno | post/settimana |
|---|---|---|
| settimane 1–2 | 2 | 1 |
| dalla settimana 3 | 3–4 | 1 (2 finché dura il magazzino) |

### Perché un post al giorno non esiste

Tre vincoli indipendenti, ognuno sufficiente da solo:

1. **Il sub non regge il volume.** `r/algobetting` ha 25k iscritti e una manciata di post
   al giorno in totale. Un account-brand che ne pubblica uno al giorno **è** il sub: viene
   letto come spam dai mod prima che dagli utenti. La tolleranza reale per un nome
   commerciale in un sub piccolo è **1–2 post al mese**.
2. **Il magazzino non regge il volume.** Un post al giorno fa 30 al mese; gli artefatti
   veri sono 4. Dal quinto giorno pubblicheremmo riempitivo — cioè esattamente il
   materiale che quel sub accusa di essere scritto da un'AI (§3).
3. **L'account non regge il volume, oggi.** Molti sub grandi hanno soglie minime di karma
   ed età per pubblicare, e Reddit limita di suo gli account nuovi. Il rubinetto è chiuso
   finché il profilo non si scalda.

### Dove il volume esiste davvero

Nei **commenti**: nessun tetto di sub, nessuna coda mod, e un buon commento dentro un
thread attivo viene visto da più persone di un post in un sub da 25k. È lì che il nome
utente viene cliccato, ed è quello il numero da guardare ogni giorno.

**Onestà sul motore dei post:** 2 a settimana si reggono per circa un mese — tanto dura il
magazzino dei 4 artefatti. A regime il motore *ricorrente* vale **1 a settimana**: report
settimanale sul movimento delle closing line, registro esiti mensile, drop di dataset
spezzati per sport. Prometterne di più significa promettere riempitivo.

**La cadenza batte la qualità del singolo pezzo.** Un commento mediocre pubblicato vale
più di un post perfetto in bozza — è la lezione dei 18 giorni.

---

## 6. Regole di forma (anti-slop) — vincolanti

- **Commenti: massimo 4 frasi, e almeno un numero specifico.** Se serve più lungo, è un post.
- **Niente em-dash. Niente «non è X, è Y». Niente struttura simmetrica.** Sono i tre tell
  che quel sub cita esplicitamente per riconoscere un LLM.
- Prosa irregolare: frasi di lunghezza diversa, qualche minuscola, nessuna lista
  perfettamente parallela.
- **Inglese** su tutti i sub (r/algobetting e r/sportsanalytics sono anglofoni).
- Ogni commento deve reggere da solo senza il brand: se togliendo il nome utente il
  commento perde valore, non va pubblicato.

## 7. Cosa non si fa, mai

- **Mai un link nel post.** Il link vive nel profilo, e nei commenti solo se richiesto.
- **Mai nominare BetRedge per primi.**
- **Mai parlare di calcio come edge.** 184 pick regolate, 48,9%, edge mediano −3,02%:
  vinciamo dalla parte sbagliata del prezzo. Se qualcuno chiede, si dice così.
- **Mai ripetere «CLV verified».** È scritto sulla landing ed è **falso**: 0 pick su 1.474
  ha un CLV (`project_clv_claim_gap`). Su Reddit un claim del genere viene verificato e
  demolito, e a quel punto il canale è finito.
- Mai vendere, mai citare il prezzo, mai il PRO. La qualificazione gambling è aperta:
  su Reddit siamo un layer di intelligence che regala strumenti, coerente con la VIA A.
- **Niente Reddit Ads.** Le policy sui contenuti gambling-adiacenti li rendono un rifiuto
  probabile e una segnalazione certa mentre il gate legale è aperto.

---

## 8. Misura e criterio di morte

**Cosa si misura** (nessuno di questi richiede lavoro nuovo):
1. **Click sul link del profilo** (`utm_medium=profile`) — l'unico numero tracciato.
2. **Query di marca in Search Console** — se il post funziona, la gente cerca «betredge».
3. **Segnali interni a Reddit:** upvote, commenti, quante volte chiedono «dove si trova?».
4. **Rimozioni** — una rimozione è un dato, non un incidente: dice che il sub non è il nostro.

**Criterio di morte — 30/09/2026, owner Andrea:**
> Se al 30/09 il totale fa **meno di 25 click dal profilo**, **zero query di marca nuove**
> e **nessuna richiesta del link nei commenti**, Reddit non è il canale e si chiude.

**Clausola anti-inerzia** (la cosa che è mancata il 27/08):
> Cadenza minima = **2 commenti al giorno**. Una settimana in cui salta **due giorni
> consecutivi** conta come
> settimana fallita. **Tre settimane fallite = chiusura anticipata**, senza aspettare il
> 30/09. Il canale muore per misura o per inerzia dichiarata, mai per silenzio.

---

## 9. Prerequisiti — nulla parte finché questi tre non sono chiusi

| # | cosa | owner |
|---|---|---|
| 1 | Verificare se i 4 commenti sono ancora vivi (feed a 0 entries, non confermato) | Andrea (loggato) |
| 2 | **PROPOSAL ferma su Tommy** in `ch_deploy_gate` (`msg_msngssbm_897dacb759`): il brand compare in contesto betting mentre la qualificazione gambling è aperta. Vale anche per i post senza link, perché il nome utente **è** il brand | Tommy |
| 3 | **Display name** `BetRedge — football & tennis model probabilities` da mettere a mano: `reddit.com/settings/profile`. Fallito 3 volte in automazione, oggi il campo è una stringa vuota | Andrea |

Il link del profilo è già a posto e taggato (`?utm_source=reddit&utm_medium=profile&utm_campaign=algobetting`).

---

## 10. Roadmap — 4 settimane

**Settimana 1 (01–07/09) — riapertura**
Sbloccare i 3 prerequisiti · riprendere 1 commento/giorno · **artefatto: il dataset
closing line** in `r/datasets` + `r/algobetting`. È il primo perché è il meno
attaccabile: sono dati, non affermazioni.

**Settimana 2 (08–14/09) — il prodotto gratuito**
Commenti quotidiani · **artefatto: i calcolatori** in `r/SideProject` +
`r/InternetIsBeautiful` · prima risposta con link dentro un thread betting, solo su
richiesta.

**Settimana 3 (15–21/09) — il metodo**
Commenti quotidiani · **artefatto: il post di calibrazione**, riscritto corto e
irregolare, in `r/algobetting`.

**Settimana 4 (22–30/09) — la prova**
Commenti quotidiani · **artefatto: il registro esiti mensile**, *se e solo se* il
sigillo Telegram ha 14 giorni consecutivi saldati al 100% · **30/09: verdetto sul
criterio di morte.**

---

## 11. Onestà sul tetto

Con un solo account-brand il canale **non può** essere un motore di acquisizione di
volume. Quello che può fare, e che nessun altro canale nostro fa oggi, è **costruire la
prova pubblica che dietro BetRedge c'è un sistema vero**, in un posto dove quella prova
viene letta da persone competenti e indicizzata da Google. È un canale di credibilità
con un rivolo di traffico, non un imbuto. Se serve volume, la leva è un'altra e va
discussa a parte.

---

**Collegato a:** `project_reddit_growth` · `project_telegram_free_channel` (il sigillo è
l'artefatto A) · `project_tools_hub` (l'artefatto C) · `project_clv_claim_gap` (il claim
da non ripetere) · `project_football_edge_gap` (perché il calcio resta fuori) ·
`project_gambling_qualification` (il gate) · `feedback_workflow_andrea`.
