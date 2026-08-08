// lib/tools/copy/it.ts (#TOOLS-HUB-0805)
// Italiano. Le keyword locali sono "convertitore quote", "calcolatore valore
// atteso", "criterio di Kelly", "margine bookmaker": i title sono scritti su
// quelle, non tradotti alla lettera dall'inglese.

import type { ToolsCopy } from "./types";

const it: ToolsCopy = {
  hub: {
    metaTitle: "Strumenti gratis per scommesse — quote, EV, Kelly e margine | BetRedge",
    metaDescription:
      "Cinque calcolatori gratuiti: converti le quote in ogni formato, togli il margine del bookmaker, calcola il valore atteso, dimensiona la puntata con Kelly. Senza registrazione.",
    h1: "Strumenti gratuiti per scommesse",
    lede:
      "I cinque conti che vanno fatti prima di puntare: quote convertite, margine rimosso, puntata dimensionata. Gratis, senza account.",
    cardCta: "Apri lo strumento",
    intro: [
      "Ogni scommessa è il confronto fra un prezzo e una probabilità. Questi cinque calcolatori fanno quel confronto per bene: traducono le quote fra i formati, togliono il margine del bookmaker per far vedere la linea equa, trasformano una stima di probabilità in valore atteso e dimensionano la puntata perché una serie negativa non chiuda il bankroll.",
      "Girano interamente nel tuo browser: niente viene inviato, niente viene salvato, non c'è nessun account da creare. Usali da soli, oppure usali per verificare quello che il nostro modello già pubblica su ogni partita.",
    ],
  },

  common: {
    backLabel: "Home",
    ctaTitle: "Questi conti li facciamo su ogni partita",
    ctaBody:
      "I calcolatori lavorano su una quota alla volta. BetRedge scansiona il mercato in continuo, toglie il margine, confronta con la probabilità del modello e mostra dove i due non vanno d'accordo — calcio e tennis, aggiornati tutto il giorno.",
    ctaButton: "Vedi la board di oggi",
    otherTools: "Altri strumenti gratuiti",
    langLabel: "Lingua",
    free: "Gratis",
    faqTitle: "Domande",
    invalid: "—",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Convertitore quote — decimali, frazionarie, americane e probabilità | BetRedge",
      metaDescription:
        "Convertitore di quote gratuito: scrivi una quota in qualsiasi formato — decimale, frazionaria, americana, Hong Kong, Malay, Indonesian — e leggila in tutti gli altri.",
      h1: "Convertitore di quote",
      lede:
        "Scrivi una quota in un formato e leggila in tutti gli altri, con la probabilità che il bookmaker sta dichiarando.",
      labels: {
        inputTitle: "La tua quota",
        oddsInput: "Quota",
        formatSelect: "Formato",
        resultTitle: "La stessa quota, in ogni formato",
        decimal: "Decimale",
        american: "Americana",
        fractional: "Frazionaria",
        hongkong: "Hong Kong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Probabilità implicita",
        hint: "Il decimale accetta anche la virgola: 2,50 vale come 2.50.",
      },
      takeaway:
        "Ogni quota è una probabilità travestita. Prima converti, poi discuti: 2.50 significa che il book ti sta dicendo 40%.",
      example: {
        title: "Una quota, tutti i formati",
        rows: [
          { label: "Tu scrivi", value: "2.50" },
          { label: "Americana", value: "+150" },
          { label: "Frazionaria", value: "3/2" },
          { label: "Hong Kong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Probabilità implicita", value: "40.00%" },
        ],
        note:
          "Cambiane una e le altre seguono. Attenzione all'arrotondamento: la familiare −110 in decimale è 1.9091 e implica il 52,38%, mentre una 1.91 mostrata a schermo implica il 52,36% — uno scarto che sembra niente e conta, perché il vantaggio si gioca nei decimi di punto.",
      },
      explainerTitle: "Leggere una quota in qualsiasi formato",
      explainer: [
        "**Una quota è una probabilità vestita in modo diverso.** La decimale — lo standard europeo — dà il ritorno totale per unità puntata: 2.50 restituisce 2.50 per ogni 1 rischiato, puntata compresa. La frazionaria indica invece il profitto: 3/2 sono tre unità di profitto ogni due rischiate, cioè la stessa 2.50. L'americana dice quanto vinci puntando 100 (+150) o quanto devi rischiare per vincerne 100 (−110). Hong Kong, Malay e Indonesian sono i formati dei mercati asiatici, e contano perché è spesso lì che stanno le quote più affilate.",
        "Il numero che vale la pena leggere è l'ultimo. **La probabilità implicita è 1 diviso la quota decimale**, ed è l'unica cifra che puoi confrontare direttamente con la tua stima: due quote in notazioni diverse non sono più facili da confrontare di due probabilità. Un limite che questo strumento non può togliere per te: **la probabilità implicita contiene ancora il margine del bookmaker**, quindi somma tutti gli esiti di un mercato e supererai il 100%. Per avere l'opinione onesta del mercato invece di quella con il ricarico, passala dal calcolatore di margine.",
      ],
      faq: [
        {
          q: "In quale formato conviene lavorare?",
          a: "In decimale, salvo motivi contrari. Moltiplicando quote decimali ottieni subito la quota di una multipla, e dividendo 1 per la quota ottieni la probabilità implicita: due operazioni scomode in notazione frazionaria o americana.",
        },
        {
          q: "Perché −110 diventa 1,909090…?",
          a: "Perché 100/110 è un decimale periodico. Arrotondato a due cifre è 1.91, che è quello che mostrano i book, ma il convertitore tiene la precisione piena all'interno così una catena di calcoli non accumula errore.",
        },
        {
          q: "Che differenza c'è fra quote Malay e Indonesian?",
          a: "Sono speculari. Le Malay sono positive sotto la 2.00 e negative sopra; le Indonesian sono positive sopra la 2.00 e negative sotto. Esprimono lo stesso prezzo e convertono nella stessa decimale.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Calcolatore margine bookmaker — overround, payout e quote eque | BetRedge",
      metaDescription:
        "Calcolatore di margine gratuito: inserisci le quote di tutti gli esiti e ottieni il margine del bookmaker, la percentuale di payout e le quote eque senza ricarico.",
      h1: "Calcolatore del margine",
      lede:
        "Inserisci tutte le quote di un mercato e vedi quanto trattiene il bookmaker — più la linea equa che ci sta sotto.",
      labels: {
        inputTitle: "Il mercato",
        outcome: "Esito",
        addOutcome: "Aggiungi esito",
        removeOutcome: "Rimuovi",
        resultTitle: "Quanto sta chiedendo il book",
        margin: "Margine del bookmaker",
        payout: "Payout",
        fairOddsTitle: "Linea equa, margine rimosso",
        fairOdds: "Quota equa",
        fairProbability: "Probabilità equa",
        impliedProbability: "Probabilità implicita",
        hint: "Aggiungi un esito per i mercati a tre vie, o più per gli antepost.",
      },
      takeaway:
        "Il margine è quello che paghi per il diritto di avere un'opinione. Due book, la stessa partita, e la differenza sono soldi.",
      example: {
        title: "La stessa partita su due book",
        rows: [
          { label: "Book generalista", value: "1.90 / 1.90 · margine 5,26%" },
          { label: "Book sharp", value: "1.98 / 1.98 · margine 1,01%" },
          { label: "Linea equa, entrambi", value: "2.00 / 2.00 · 50% ciascuno" },
          { label: "Il tuo EV su un vero 50%", value: "−5% contro −1% per scommessa" },
        ],
        note:
          "Opinione identica, partita identica. Puntare 100 duecento volte costa 1.000 sul primo book e 200 sul secondo: gli otto centesimi di differenza di quota diventano 800 in una stagione. È il vantaggio più economico che esista nelle scommesse, e non richiede nessun modello.",
      },
      explainerTitle: "Il margine è il prezzo della scommessa",
      explainer: [
        "**Un mercato a due vie equo prezza entrambi i lati a 2.00.** Le probabilità implicite sono 50% e 50%, sommano esattamente a 100%, e nessuno dei due lati ha un vantaggio. I mercati reali sono prezzati 1.90 e 1.90: quelle implicite valgono 52,63% ciascuna, sommano a 105,26%, e **i 5,26 punti in eccesso sono il margine del bookmaker** — l'overround. Qualunque lato giochi, lo stai pagando. I margini cambiano molto per mercato: le linee principali dei book sharp stanno sotto il 2%, mentre antepost e mercati sui giocatori arrivano abitualmente all'8% e oltre, perché è lì che i book sanno di essere meno controllati.",
        "Togliere il margine dà la linea equa, la no-vig. Questo calcolatore lo fa in proporzione — ogni probabilità implicita divisa per la loro somma, così tornano a sommare esattamente 100% — e **quella linea equa è il riferimento di ogni decisione +EV**: una scommessa ha valore atteso positivo solo se la tua probabilità batte quella equa, non semplicemente quella prezzata. Un limite dichiarato: i book reali caricano più margine sugli esiti improbabili, quindi in un mercato con un favorito netto questo metodo lo sottostima un po'. Sulle linee equilibrate la distorsione è piccola; sugli antepost da lotteria, tratta la linea equa come una stima.",
      ],
      faq: [
        {
          q: "Quale margine è accettabile?",
          a: "Sulle linee principali di calcio e tennis, sotto il 3% è sharp, fra 4% e 5% è normale in un book generalista, sopra il 7% stai pagando molto per il diritto di avere un'opinione. Confronta lo stesso mercato su più book prima di decidere.",
        },
        {
          q: "Payout e margine sono la stessa cosa?",
          a: "Sono due letture dello stesso numero. Un margine del 5,26% corrisponde a un payout del 95%: il book si aspetta di restituire 95 su ogni 100 giocati sull'intero mercato. Il payout è il numero più comodo per confrontare i book.",
        },
        {
          q: "Perché le probabilità eque sommano esattamente a 100%?",
          a: "Perché è la definizione di rimuovere il margine. Quelle prezzate sommano a più di 100%; dividendo ognuna per quel totale si riscalano fino a sommare a uno, che è ciò che un insieme coerente di probabilità deve fare.",
        },
        {
          q: "Funziona sui mercati a tre vie o antepost?",
          a: "Sì, basta aggiungere tutti gli esiti che il mercato ha. La matematica è identica per qualsiasi numero di esiti, a condizione di inserirli tutti: lasciarne fuori uno sottostima il margine.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "Calcolatore valore atteso (EV) — con o senza linea equa | BetRedge",
      metaDescription:
        "Calcolatore di valore atteso gratuito: inserisci quota, probabilità e puntata per avere l'EV in valuta e in percentuale, oppure deducila dalla linea di un book sharp.",
      h1: "Calcolatore di valore atteso",
      lede:
        "Quanto vale in media una scommessa: dalla tua probabilità, o da quella di un book sharp con il margine tolto.",
      labels: {
        inputTitle: "La scommessa",
        modeTitle: "Da dove viene la probabilità",
        modeManual: "Stima mia",
        modeSharp: "Da un book sharp",
        yourOdds: "La tua quota",
        yourProbability: "La tua probabilità (%)",
        sharpOddsA: "Quota sharp, il tuo lato",
        sharpOddsB: "Quota sharp, l'altro lato",
        derivedProbability: "Probabilità equa, margine rimosso",
        stake: "Puntata",
        resultTitle: "Quanto vale la scommessa",
        ev: "Valore atteso",
        fairOdds: "Quota di pareggio",
        edge: "Vantaggio",
        positive: "Valore atteso positivo a questa quota.",
        negative: "Valore atteso negativo a questa quota.",
        neutral: "Pareggio: la quota corrisponde esattamente alla probabilità.",
        hint: "Le percentuali vanno scritte come numeri: 55 significa 55%.",
      },
      takeaway:
        "Non devi indovinare meglio del mercato: devi solo trovare un book più lento del più sharp.",
      example: {
        title: "Prendere in prestito la probabilità da un book sharp",
        rows: [
          { label: "Book sharp, entrambi i lati", value: "1.95 / 1.95" },
          { label: "Probabilità equa, margine tolto", value: "50,00%" },
          { label: "Quota di pareggio", value: "2.00" },
          { label: "Il tuo book offre", value: "2.10" },
          { label: "EV su 100 puntati", value: "+5,00 (+5%)" },
        ],
        note:
          "Nessuna opinione richiesta: la linea sharp ha fornito la probabilità, e il tuo book ha prezzato lo stesso esito a 2.10 dove l'equa era 2.00. Sposta le quote sharp a 1.90/1.90 e la probabilità equa resta il 50% — è proprio questo il senso di togliere il margine: la risposta non si muove col ricarico.",
      },
      explainerTitle: "Cosa dice davvero il valore atteso",
      explainer: [
        "**Il valore atteso è il risultato medio di una scommessa che potresti ripetere all'infinito.** Due ingressi, nessuna opinione: la quota offerta e la probabilità che dai all'esito. Pensi che una squadra vinca il 55% delle volte e qualcuno ti offre 2.00, e il conto è immediato — il 55% delle volte guadagni un'unità, il 45% la perdi, quindi guadagni 0,10 unità per unità puntata. È un vantaggio del 10%, e questo è tutto ciò che significa +EV.",
        "**La probabilità è il punto in cui quasi tutti perdono in silenzio.** Un errore di 5 punti trasforma un vantaggio del 4% in una perdita dell'1%, e le stime fatte a occhio sbagliano di molto più di 5 punti. Da qui la seconda modalità di questo calcolatore: invece di fidarti dell'istinto, prendi entrambi i lati presso un book sharp, togli il margine e usa la probabilità equa che ne esce. Leggi il risultato come un tasso, non come una promessa — un vantaggio del 4% non rende nulla sulla singola scommessa, compare solo su centinaia di esse, e solo se la probabilità era giusta. Per questo la dimensione della puntata conta quanto il vantaggio.",
      ],
      faq: [
        {
          q: "Come ottengo una probabilità affidabile?",
          a: "Da un modello costruito sui dati, oppure dal mercato stesso. La linea equa di un book sharp — le sue quote senza margine — è un riferimento difficile da superare con il solo giudizio, e si può consultare gratis.",
        },
        {
          q: "Una scommessa a EV positivo è una buona scommessa?",
          a: "È una condizione necessaria, non sufficiente. Può avere valore atteso positivo ed essere comunque un errore se la puntata è troppo grande per il bankroll, se il vantaggio rientra nel tuo errore di stima o se il mercato si muove contro prima dell'inizio.",
        },
        {
          q: "Perché servono entrambi i lati del mercato sharp?",
          a: "Perché il margine non si può togliere da una quota sola. Diventa visibile solo sommando le probabilità implicite di tutti gli esiti: è la seconda quota a rendere calcolabile la probabilità equa.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Calcolatore criterio di Kelly — puntata ottimale su edge e bankroll | BetRedge",
      metaDescription:
        "Calcolatore del criterio di Kelly gratuito: inserisci quota, probabilità e bankroll per la puntata che massimizza la crescita nel lungo periodo — Kelly pieno, mezzo o quarto.",
      h1: "Calcolatore del criterio di Kelly",
      lede:
        "La puntata che fa crescere più in fretta un bankroll nel lungo periodo — e perché quasi tutti dovrebbero puntare meno di quanto dice.",
      labels: {
        inputTitle: "Scommessa e bankroll",
        odds: "Quota",
        probability: "La tua probabilità (%)",
        bankroll: "Bankroll",
        fractionTitle: "Frazione di Kelly",
        fractionFull: "Pieno",
        fractionHalf: "Mezzo",
        fractionQuarter: "Quarto",
        resultTitle: "Puntata consigliata",
        stake: "Puntata",
        stakePercent: "Quota del bankroll",
        edge: "Vantaggio",
        fullKelly: "Kelly pieno",
        growth: "Crescita attesa per scommessa",
        noEdge: "Nessun vantaggio a questa quota: la puntata ottimale è zero.",
        hint: "Le percentuali vanno scritte come numeri: 55 significa 55%.",
      },
      takeaway:
        "Kelly dimensiona la puntata sul vantaggio, non sulla tua convinzione — e quasi tutti dovrebbero puntare deliberatamente meno di quanto dice.",
      example: {
        title: "Cosa significa con 1.000 di bankroll",
        rows: [
          { label: "Bankroll", value: "1.000" },
          { label: "Quota · tua probabilità", value: "2.00 · 55%" },
          { label: "Vantaggio", value: "+10%" },
          { label: "Kelly pieno", value: "10% → 100 per scommessa" },
          { label: "Mezzo Kelly", value: "5% → 50 per scommessa" },
        ],
        note:
          "Cinque sconfitte di fila — una sequenza su 54 a questa quota — lasciano 590 con Kelly pieno, e servirà un +69% per tornare a 1.000. La stessa serie a mezzo Kelly lascia 774, e serve un +29%. Stesso vantaggio, stesse scommesse, metà della buca.",
      },
      explainerTitle: "Dimensionare la puntata perché la serie negativa non la chiuda",
      explainer: [
        "Il criterio di Kelly risponde a ciò che il valore atteso ignora: dato un vantaggio, quanto rischiare davvero? Punta troppo poco e un vantaggio reale si capitalizza troppo lentamente per contare. Punta troppo e la matematica si gira contro: un bankroll che si dimezza ha bisogno di un +100% per tornare al punto di partenza, quindi le puntate troppo grandi distruggono la crescita anche quando ogni singola scommessa è favorevole. La frazione ottimale è il vantaggio diviso la quota netta, e **scala col vantaggio, non con la convinzione**: un vantaggio del 10% a quota 2.00 chiede il 10% del bankroll, lo stesso vantaggio a 5.00 ne chiede solo il 2,5%.",
        "**Quasi nessuno dovrebbe giocare Kelly pieno**, perché la formula assume che la tua probabilità sia esatta e non lo è mai. Dalle un vantaggio sovrastimato e ti consiglierà con entusiasmo una puntata troppo grande per il vantaggio che hai davvero: il modo più rapido di perdere un bankroll pur avendo ragione in media. Il mezzo Kelly rinuncia a un quarto della crescita teorica e dimezza circa la volatilità; il quarto di Kelly è quello che usano molti professionisti con modelli veri. E quando la quota non offre vantaggio, la puntata corretta è zero: una frazione di Kelly negativa significa che la scommessa va presa sull'altro lato, non che su questa devi puntare meno.",
      ],
      faq: [
        {
          q: "Meglio Kelly pieno, mezzo o quarto?",
          a: "Mezzo o quarto per quasi tutti. Il pieno è ottimale solo se la stima di probabilità è esatta, e l'errore di stima fa molto più danno in eccesso di puntata di quanto aiuti in difetto. Il Kelly frazionario scambia un po' di crescita per molta sopravvivenza.",
        },
        {
          q: "Cos'è la crescita attesa per scommessa?",
          a: "La crescita logaritmica media del bankroll per una scommessa a quella puntata. È piccola per costruzione — un valore di 0,005 vale circa mezzo punto percentuale di crescita composta per scommessa — ed è la quantità che Kelly massimizza.",
        },
        {
          q: "E se ho più scommesse aperte insieme?",
          a: "Il Kelly su singola scommessa punta troppo quando le scommesse corrono in parallelo, soprattutto se sono correlate. Come regola pratica, dividi il totale fra le posizioni simultanee e tratta le scommesse correlate come una sola.",
        },
        {
          q: "Perché mostra zero se penso di avere un vantaggio?",
          a: "Perché alla quota inserita la tua probabilità non supera il punto di pareggio. Confronta la quota con 1 diviso la tua probabilità: se la quota è più bassa, non c'è vantaggio da puntare.",
        },
      ],
      caveat:
        "Il criterio di Kelly massimizza la crescita nel lungo periodo, non la tranquillità. Anche alla puntata corretta, cali del 30% o più sono ordinari, e la formula assume che la tua stima di probabilità sia accurata: se è ottimistica, Kelly punterà sistematicamente troppo e il bankroll può essere perso. Non giocare soldi che ti servono.",
    },

    "probability-calculator": {
      metaTitle: "Calcolatore di probabilità — quote, pareggio e multipla | BetRedge",
      metaDescription:
        "Calcolatore di probabilità gratuito per scommesse: converti probabilità e quota, trova la probabilità di pareggio che una quota richiede e combina le gambe di una multipla.",
      h1: "Calcolatore di probabilità",
      lede:
        "Trasforma le probabilità in quote e viceversa, vedi cosa ti chiede una quota e scopri quanto vale davvero una multipla.",
      labels: {
        inputTitle: "Probabilità e quota",
        modeTitle: "Cosa hai?",
        modeProbability: "Una probabilità",
        modeOdds: "Una quota",
        probability: "Probabilità (%)",
        odds: "Quota decimale",
        breakEven: "Probabilità di pareggio",
        fairOdds: "Quota equa",
        parlayTitle: "Multipla",
        leg: "Gamba",
        addLeg: "Aggiungi gamba",
        removeLeg: "Rimuovi",
        parlayProbability: "Probabilità combinata",
        parlayOdds: "Quota combinata",
        resultTitle: "Risultati",
        hint: "Una quota e la sua probabilità di pareggio sono lo stesso numero letto dai due lati.",
      },
      takeaway:
        "Le gambe si moltiplicano, e con loro il ricarico del book. Una quadrupla a 1.80 chiede un evento al 9,5%.",
      example: {
        title: "Quanto costa davvero una quadrupla",
        rows: [
          { label: "Quattro gambe a", value: "1.80 ciascuna · 55,56%" },
          { label: "Quota combinata", value: "10.50" },
          { label: "Probabilità combinata", value: "9,53%" },
          { label: "Margine per gamba", value: "5%" },
          { label: "Margine sulla multipla", value: "21,6%" },
        ],
        note:
          "La quota sembra generosa finché non guardi cosa pretende: un evento al 9,5%. E il ricarico del book si è composto quattro volte — 1,05⁴ − 1 = 21,6% — quindi le stesse quattro selezioni ti costano quattro volte il margine di una singola. Le gambe correlate della stessa partita sono un'altra bestia: moltiplicare le sottostima, ed è esattamente per questo che i book prezzano a parte le multiple sullo stesso match.",
      },
      explainerTitle: "Prima la probabilità, poi la quota",
      explainer: [
        "**Ogni quota è un'affermazione sulla probabilità**, e la conversione è una divisione: il 40% è una quota di 2.50, e 2.50 è una probabilità del 40%. Fare quella conversione prima di puntare cambia la domanda da «mi piace questa scommessa?» a «questo esito succede più del 40% delle volte?» — una domanda su cui si può sbagliare davvero. Letto dal lato della quota, lo stesso numero è la **probabilità di pareggio**: la possibilità minima che serve perché la scommessa sia neutra. 1.75 pretende il 57,1%; 1.50 pretende il 66,7%; 15.00 chiede solo il 6,7%, ed è per questo che le quote lunghe sembrano convenienti e per questo che i book ci caricano il margine.",
        "**Le multiple sono il punto in cui la probabilità diventa controintuitiva.** Le gambe indipendenti si moltiplicano: tre scommesse che valuti al 50% combinano al 12,5%, non a qualcosa di rassicurante vicino a metà. Quattro gambe al 60% fanno 12,96%. La quota combinata si moltiplica allo stesso modo, e qui sta la trappola — il numero diventa grande mentre la possibilità diventa piccola, e il margine si compone con lei. Tieni presente l'assunzione di fondo: qui si moltiplica, quindi si assume che le gambe siano indipendenti. Due esiti della stessa partita sono correlati, e lì la probabilità reale è diversa, di solito più alta del prodotto.",
      ],
      faq: [
        {
          q: "Cos'è la probabilità di pareggio?",
          a: "La possibilità che un esito deve avere perché una scommessa a quella quota sia neutra nel lungo periodo. Vale 1 diviso la quota decimale, ed è l'asticella che la tua stima deve superare perché la scommessa abbia senso.",
        },
        {
          q: "Perché la probabilità della mia multipla è così bassa?",
          a: "Perché le probabilità si moltiplicano. Ogni gamba aggiunta rende l'insieme meno probabile, e una catena di gambe plausibili diventa in fretta una scommessa improbabile. La quota sale di conseguenza, ma sale anche il margine accumulato.",
        },
        {
          q: "Funziona per le multiple sulla stessa partita?",
          a: "Non esattamente. La moltiplicazione assume gambe indipendenti, e gli esiti dentro una stessa partita di solito non lo sono. Per gambe correlate la probabilità reale è diversa — spesso più alta del prodotto — ed è per questo che i book prezzano quei mercati a parte.",
        },
        {
          q: "La probabilità implicita di una quota è la probabilità vera?",
          a: "No. Contiene ancora il margine del bookmaker, quindi è sistematicamente più alta della stima onesta del mercato. Usa il calcolatore di margine per toglierlo prima di confrontarla con il tuo numero.",
        },
      ],
    },

    "arbitrage-calculator": {
      metaTitle: "Calcolatore di arbitraggio — dividere la puntata fra book | BetRedge",
      metaDescription:
        "Calcolatore di arbitraggio gratuito: inserisci la quota migliore su ogni esito da book diversi e leggi la somma delle implicite, come dividere la puntata e il profitto — o che non c'è.",
      h1: "Calcolatore di arbitraggio",
      lede:
        "Inserisci la quota migliore disponibile su ogni esito e scopri se due book insieme lasciano un margine — e come dividere la puntata se lo lasciano.",
      labels: {
        inputTitle: "Quota migliore su ogni esito",
        outcome: "Esito",
        addOutcome: "Aggiungi esito",
        removeOutcome: "Togli",
        total: "Puntata totale",
        resultTitle: "Come dividerla",
        profit: "Profitto",
        impliedSum: "Somma delle probabilità implicite",
        stakeOn: "Puntata sull'esito",
        guaranteedReturn: "Ritorno in ogni esito",
        verdictArb:
          "Le quote sommano a meno del 100%: divisa così, ogni esito restituisce la stessa cifra.",
        verdictNoArb:
          "Le quote sommano a più del 100%, quindi qui non c'è arbitraggio — qualunque divisione perde quel margine, qualunque esito si verifichi.",
        hint: "Una quota per esito, ciascuna dal book che paga di più su quel lato. Il decimale accetta la virgola: 2,10 vale come 2.10.",
      },
      takeaway:
        "L'arbitraggio non è una previsione. Non ti chiede mai di avere ragione su chi vince: chiede a due book di essere in disaccordo più dei loro margini.",
      example: {
        title: "Due book, 1.000 da dividere",
        rows: [
          { label: "Quote, un book per lato", value: "2.10 · 2.10" },
          { label: "Somma delle probabilità implicite", value: "95,24%" },
          { label: "Puntata su ciascuno, su 1.000", value: "500 · 500" },
          { label: "Ritorno in ogni esito", value: "1.050" },
          { label: "Profitto", value: "+50 (+5,00%)" },
        ],
        note:
          "Lo stesso mercato prezzato 1.90/1.90 dentro un solo book somma a 105,26% e restituisce −5,00% comunque lo dividi. Fra le due linee della partita non è cambiato nulla: la differenza è tutta in quale book paga di più su quale lato, e nell'avere conti alimentati su entrambi mentre le quote erano ancora esposte.",
      },
      explainerTitle: "Quando due book sono in disaccordo abbastanza",
      explainer: [
        "**Somma uno diviso ogni quota e tieni tutto il mercato in un solo numero.** Dentro un book quel numero supera sempre il 100%: è il margine che lo tiene lì. Ma la quota migliore su un lato e quella migliore sull'altro stanno spesso su book diversi, e combinandole la somma può scendere sotto il 100%. È tutta la condizione: **le probabilità implicite devono sommare a meno di 1**. Dividi la puntata totale in proporzione a quelle implicite e ogni esito restituisce la stessa cifra, quindi quello che riprendi smette di dipendere dal risultato. Due quote di 2.10 sommano a 95,24%, e 500 su ciascun lato di una puntata da 1.000 restituiscono 1.050 come che vada la partita.",
        "**In pratica si chiude molto meno spesso di quanto suggerisca l'aritmetica, e i motivi contano più della formula.** Le quote si muovono: la differenza che hai visto è di solito il book più lento che si allinea, e può sparire nei secondi fra la prima gamba e la seconda, lasciandoti una scommessa normale e scoperta a una quota scelta per coprirti e non per il valore. I limiti di puntata mordono esattamente dove la differenza è più ampia, quindi un margine del 5% sulla carta è spesso un margine del 5% su quaranta unità e non su mille. E **i book limitano i conti di chi lo fa di sistema**: prima limiti più bassi, poi scommesse rifiutate e chiusure. Aggiungi il capitale parcheggiato su più book e il cambio fra le valute, e l'arbitraggio somiglia meno a una macchina e più a un modo lento e operativamente pesante di raschiare un margine sottile.",
      ],
      faq: [
        {
          q: "Serve un conto su ogni bookmaker?",
          a: "Sì. L'arbitraggio esiste solo fra i book specifici che espongono quelle quote specifiche, quindi servono conti alimentati su ognuno prima che le quote si muovano. Quel capitale, sparso su più book e fermo per la maggior parte del tempo, è il costo che quasi nessun calcolatore mostra.",
        },
        {
          q: "Cosa succede se la seconda quota si muove prima che io la giochi?",
          a: "Ti resta la prima gamba da sola: una scommessa normale, a una quota scelta per coprirti e non per il valore. Gioca prima la gamba che ha più probabilità di muoversi, e considera il restare scoperto parte del rischio, non un incidente.",
        },
        {
          q: "Perché i book limitano chi fa arbitraggio?",
          a: "Perché il loro margine vive sul flusso equilibrato dei clienti ricreativi, e un conto che prende sempre e solo la quota migliore su un lato è per loro puro costo. Le limitazioni arrivano in silenzio come limiti di puntata più bassi, molto prima della chiusura del conto.",
        },
        {
          q: "L'arbitraggio è legale?",
          a: "L'attività in sé è legale: stai piazzando scommesse normali a quote pubblicate. Quello che può vietarlo sono i termini del book, che di regola si riservano il diritto di limitare, rifiutare o annullare le scommesse che giudicano arbitraggio. Legale e permesso non sono la stessa cosa.",
        },
      ],
    },

    "parlay-calculator": {
      metaTitle: "Calcolatore multiple — quota combinata, probabilità reale e margine composto | BetRedge",
      metaDescription:
        "Calcolatore di multiple gratuito: inserisci ogni gamba e ottieni la quota combinata, la probabilità che serve davvero e come il margine del book si compone gamba per gamba.",
      h1: "Calcolatore multiple",
      lede:
        "Ogni gamba che aggiungi moltiplica la quota — e insieme moltiplica la parte che si tiene il book. Qui ci sono entrambi i numeri, prima di giocare.",
      labels: {
        inputTitle: "Le gambe",
        leg: "Gamba",
        addLeg: "Aggiungi gamba",
        removeLeg: "Togli",
        marginPerLeg: "Margine del book per gamba (%)",
        resultTitle: "Quanto vale la multipla",
        combinedOdds: "Quota combinata",
        impliedProb: "Probabilità che esca",
        compoundMargin: "Margine composto",
        verdict:
          "Moltiplicare assume gambe indipendenti. Due selezioni della stessa partita non lo sono: la loro probabilità reale è di solito più alta del prodotto, ed è per questo che i book prezzano le multiple sullo stesso match con un modello loro.",
        hint: "Una quota decimale per gamba, fino a otto. Il margine per gamba si scrive come numero: 5 significa 5%, più o meno quello di un mercato a due esiti stretto.",
      },
      takeaway:
        "La parte che si tiene il book non si somma sulle gambe, si compone — quattro gambe a 1.80 sembrano quattro scommesse quasi in equilibrio e sono un unico evento al 9,53%.",
      example: {
        title: "Quattro gambe a 1.80, una scommessa al 9,53%",
        rows: [
          { label: "Gambe", value: "4 × 1.80" },
          { label: "Quota combinata", value: "10.50" },
          { label: "Probabilità che esca", value: "9,53%" },
          { label: "Margine per gamba", value: "5%" },
          { label: "Margine composto", value: "21,55%" },
        ],
        note:
          "Presa da sola, ogni gamba è la scommessa su cui nessuno si ferma a pensare: 55,56% implicito, 1.80 per vincere. In catena, tutte e quattro chiedono un evento al 9,53% — e il 5% che il book si tiene su ogni gamba diventa 1,05⁴ − 1 = 21,55% sulla multipla. Alla scommessa non è stato aggiunto niente tranne altri modi di perderla: la quota è salita perché la probabilità è scesa.",
      },
      explainerTitle: "Perché la quota cresce più in fretta della probabilità",
      explainer: [
        "**Una multipla è una scommessa sola con più modi di perdere, non più scommesse.** La quota combinata è il prodotto delle gambe — 1.80 preso quattro volte fa 10.4976 — e la probabilità è il prodotto delle probabilità, ed è lì che l'aritmetica smette di essere amichevole: quattro selezioni che chiameresti quasi in equilibrio fanno 9,53%. Il margine si comporta allo stesso modo, e questa è la parte che quasi nessuno mette nel conto. Non si somma gamba per gamba, si **compone**: un book che si tiene il 5% su ognuna di quattro gambe si tiene 1,05⁴ − 1 = 21,55% sulla multipla, e a otto gambe quello stesso 5% per gamba è diventato 47,75%. La vincita sembra generosa perché la probabilità è crollata, non perché qualcuno ti stia pagando di più per lo stesso rischio.",
        "**Le multiple sono il prodotto più spinto della scommessa e il meno favorevole a chi gioca**, e sono lo stesso fatto visto da due lati: più grande è il margine composto, più un book può permettersi di maggiorare, assicurare e pubblicizzare quella giocata. Un vantaggio sottile su una gamba non sopravvive alla moltiplicazione per altre tre gambe di margine — le stesse selezioni giocate singole pagano il margine una volta ciascuna, la quadrupla lo paga quattro volte. Poi c'è l'assunzione dietro la moltiplicazione: **che le gambe siano indipendenti**. Due selezioni della stessa partita sono correlate, quindi moltiplicare è il conto sbagliato: la vittoria in casa e il gol del suo attaccante tendono ad arrivare insieme, quindi la coppia è più probabile di quanto dica il prodotto, mentre gambe che a stento convivono valgono molto meno. È per questo che i book costruiscono le multiple sullo stesso match con un modello loro invece di lasciartele comporre dalle singole — e per questo questo calcolatore è onesto su gambe di partite diverse.",
      ],
      faq: [
        {
          q: "Vale anche per le multiple sulla stessa partita?",
          a: "Non esattamente. Qui si moltiplica, e moltiplicare assume gambe indipendenti. Gli esiti dentro una stessa partita si muovono insieme, quindi la probabilità vera della coppia è diversa — spesso più alta del prodotto — ed è per questo che i book prezzano quei mercati con un modello loro e non partendo dalle singole.",
        },
        {
          q: "Perché la probabilità combinata è così bassa?",
          a: "Perché le probabilità si moltiplicano, non si mediano. Quattro gambe al 55,56% fanno 9,53%: ogni gamba in più rende l'intera giocata meno probabile, quindi una catena di selezioni plausibili diventa in fretta una scommessa improbabile. La quota sale per compensare, e con la quota sale il margine accumulato.",
        },
        {
          q: "Cos'è esattamente il margine composto?",
          a: "La parte che si tiene il book dopo che ogni gamba l'ha moltiplicata. Inserisci quanto ti costa una gamba — intorno al 5% su un mercato a due esiti stretto — e il calcolatore la compone: uno più il margine, elevato al numero delle gambe, meno uno. Quattro gambe al 5% costano 21,55%, otto gambe 47,75%.",
        },
        {
          q: "Meglio quattro singole o una quadrupla?",
          a: "Per chi gioca su un vantaggio, quattro singole: le stesse selezioni pagano il margine una volta ciascuna invece di moltiplicarlo, e una gamba sbagliata costa una scommessa e non tutto il biglietto. La multipla compra varianza — una piccola probabilità di un ritorno grande — e il prezzo di quella varianza è il margine composto.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "Calcolatore ROI scommesse — ritorno sul capitale | BetRedge",
      metaDescription:
        "Calcolatore ROI gratuito per le scommesse: inserisci capitale e profitto e leggi il ritorno sulla cassa, il capitale finale e perché lo stesso profitto è uno yield del 4%.",
      h1: "Calcolatore ROI",
      lede:
        "Quanto ha reso la cassa in un periodo — e perché lo stesso profitto di 400 qui è un ROI del 40% e sull'altra pagina uno yield del 4%.",
      labels: {
        inputTitle: "Capitale e risultato",
        capital: "Capitale",
        profit: "Profitto",
        resultTitle: "Ritorno su quel capitale",
        roi: "ROI",
        endingCapital: "Capitale finale",
        hint: "Il profitto va inserito netto e può essere negativo: -250 è un periodo in perdita. Il capitale è la cassa che hai messo a rischio, non il totale giocato.",
        verdict:
          "Il ROI dipende interamente dal denominatore, quindi dichiaralo: 400 su una cassa da 1.000 è il 40%, lo stesso 400 su 10.000 giocati è uno yield del 4%. Nessuno dei due numeri dice molto senza il periodo e il numero di scommesse che ci stanno dietro.",
      },
      takeaway:
        "Il ROI dice quanto ha reso la cassa. Non dice se la strategia è buona, perché lo stesso 40% può venire da 200 scommesse o da un sabato fortunato.",
      example: {
        title: "400 di profitto su una cassa da 1.000",
        rows: [
          { label: "Capitale", value: "1.000" },
          { label: "Profitto del periodo", value: "+400" },
          { label: "ROI", value: "+40,00%" },
          { label: "Capitale finale", value: "1.400" },
          { label: "Lo stesso 400 su 10.000 giocati", value: "yield +4,00%" },
        ],
        note:
          "Le due percentuali descrivono un solo risultato identico. Arrivare a +40,00% sulla cassa ha richiesto 200 scommesse da 50 — 10.000 di giocato, dieci volte il capitale — e il 4,00% di quel giocato è lo stesso 400. Rigira la cassa due volte invece di dieci e lo yield dietro un ROI del 40% dovrebbe essere il 20%, che quasi nessuno sostiene.",
      },
      explainerTitle: "Il profitto misurato sui soldi a rischio",
      explainer: [
        "**Il ROI è il profitto diviso i soldi che hai messo a rischio**, e tutta la difficoltà sta nella seconda metà della frase. Una cassa da 1.000 che chiude la stagione con 400 in più ha reso il 40,00%, e quella cifra si può confrontare onestamente con qualunque altra cosa avresti fatto con quei 1.000. Ciò che non può descrivere sono le scommesse. Un ritorno del 40% non dice quante giocate sono servite, in quanto tempo, né quanto la cassa si è avvicinata allo zero per strada — e sono le tre cose che decidono se ricapiterà. Quindi **dichiara il denominatore prima di citare il numero**: cassa iniziale, saldo medio e totale versato danno tre percentuali diverse dallo stesso identico insieme di scommesse, e quella che fa più bella figura è sempre la più piccola.",
        "**Lo stesso 400 di profitto è un ROI del 40% e uno yield del 4% insieme**, e sapere quale dei due hai in mano è quasi tutto il valore delle due pagine. Il ROI misura sul capitale, lo yield sul giocato — la somma di ogni singolo stake piazzato. Nel nostro esempio ci sono volute 200 scommesse da 50, quindi 10.000 sono passati per la cassa: dieci volte il capitale, e il 4,00% di quella cifra è proprio quel 400. **Quel moltiplicatore è tutto il ponte fra i due numeri**, ed è il motivo per cui il ROI da solo fa un favore a chi gioca molto. Chi rigira una cassa da 1.000 dieci volte con uno yield del 4% e chi la rigira due volte con uno yield del 20% dichiarano entrambi il 40%, e solo uno dei due è ripetibile. La qualità per scommessa si misura sul calcolatore yield; il ROI tienilo per ciò in cui è davvero utile: confrontare quanto ha reso quel denaro rispetto alle alternative.",
      ],
      faq: [
        {
          q: "Che differenza c'è fra ROI e yield?",
          a: "Il ROI divide il profitto per il capitale, lo yield lo divide per il giocato — la somma di tutti gli stake. Lo stesso 400 di profitto è il 40,00% di una cassa da 1.000 e il 4,00% di 10.000 giocati. Il ROI dice quanto ha reso il denaro, lo yield quanto erano buone le scommesse, e il rapporto fra i due è quante volte hai rigirato la cassa.",
        },
        {
          q: "Quale capitale devo usare come denominatore?",
          a: "Quello che sai dichiarare e poi tenere fisso: di solito la cassa iniziale. Saldo massimo, saldo medio e totale versato producono percentuali diverse dalle stesse scommesse, quindi il numero significa qualcosa solo accanto alla sua definizione. Ricaricare il conto a metà periodo senza ridichiarare il denominatore è il modo più comune di gonfiare un ROI.",
        },
        {
          q: "Un ROI del 40% è buono?",
          a: "Dipende dal periodo e dal numero di scommesse. Su una stagione e 200 giocate è un risultato forte ma plausibile. Lo stesso 40% su venti scommesse sta comodamente dentro l'intervallo che produce il caso da solo, e un 40% in una settimana di solito significa che gli stake erano grossi rispetto alla cassa, non che il vantaggio era grosso.",
        },
        {
          q: "Il ROI può essere negativo?",
          a: "Sì, e il calcolatore lo mostra invece di nasconderlo: una perdita di 250 su una cassa da 1.000 è -25,00%. Il recupero non è simmetrico — dopo un -25% serve un +33,33% su quello che resta per tornare in pari — ed è il motivo per cui il drawdown merita la stessa attenzione del ritorno.",
        },
      ],
    },
    "yield-calculator": {
      metaTitle: "Calcolatore yield scommesse — profitto sul giocato | BetRedge",
      metaDescription:
        "Calcolatore yield gratuito: inserisci numero di scommesse, stake medio e profitto per ottenere giocato e yield — e quante giocate servono perché il numero significhi qualcosa.",
      h1: "Calcolatore yield",
      lede:
        "Il profitto misurato su tutto ciò che hai giocato, non sulla tua cassa — l'unica cifra che confronta due scommettitori con soldi diversi.",
      labels: {
        inputTitle: "Scommesse, stake e risultato",
        bets: "Numero di scommesse",
        avgStake: "Stake medio",
        profit: "Profitto",
        resultTitle: "Yield sul giocato",
        turnover: "Giocato totale",
        yieldPercent: "Yield",
        hint: "Il giocato lo calcoliamo noi: scommesse × stake medio. Conta lo stake di ogni giocata, non i soldi esposti in un momento. Il profitto va netto e può essere negativo.",
        verdictNoise:
          "Sotto il migliaio di scommesse questa cifra è in gran parte rumore. A stake piatto su quota 2.00 una deviazione standard dello yield vale 7,07 punti su 200 giocate e ancora 3,16 su 1.000: leggila come un intervallo, non come un risultato.",
        verdictVolume:
          "Oltre il migliaio di scommesse la cifra inizia a portare informazione, ma una deviazione standard vale ancora circa 3,16 punti su quota 2.00 — un +4% e un +7% sullo stesso volume non sono due livelli di bravura diversi.",
      },
      takeaway:
        "Lo yield è la metrica che confronta gli scommettitori: un 4% su 10.000 giocati vale più di un ROI del 40% raccolto in venti scommesse.",
      example: {
        title: "200 scommesse da 50, 400 di profitto",
        rows: [
          { label: "Numero di scommesse", value: "200" },
          { label: "Stake medio", value: "50" },
          { label: "Giocato totale", value: "10.000" },
          { label: "Profitto", value: "+400" },
          { label: "Yield", value: "+4,00%" },
          { label: "Lo stesso 400 su una cassa da 1.000", value: "ROI +40,00%" },
        ],
        note:
          "Un solo risultato, due percentuali entrambe oneste: il 4,00% dei 10.000 passati dal book, il 40,00% dei 1.000 mai messi a rischio. La distanza fra le due è soltanto le dieci volte in cui la cassa è stata rigirata. E il campione conta più di entrambe: su 200 giocate una deviazione standard dello yield vale 7,07 punti, quindi questo +4,00% sta dentro l'intervallo che produce da sola una serie di lanci di monetina.",
      },
      explainerTitle: "Il numero che confronta due scommettitori",
      explainer: [
        "**Lo yield è il profitto diviso il giocato** — il totale di ogni singolo stake piazzato, non il saldo sul conto. È la cifra che gli scommettitori si citano a vicenda proprio perché non dipende da quanti soldi hanno: il 4% è il 4% sia con stake da 5 sia con stake da 500. **L'input che tutti sbagliano è il denominatore**, e lo sbagliano sempre nella stessa direzione. Il giocato conta lo stake di ogni scommessa nel momento in cui la piazzi, quindi 200 giocate da 50 fanno 10.000 anche se in un dato istante erano esposti solo 50, e i 1.000 di cassa attraverso cui quelle giocate sono state riciclate non sono il numero per cui dividere. Per questo la pagina chiede il numero di scommesse e lo stake medio e calcola il giocato davanti a te. Misura lo stesso profitto sul capitale e ottieni il ROI: il calcolatore ROI tiene l'altra metà del confronto, dove 400 di profitto sono il 40,00% di una cassa da 1.000 e il 4,00% di 10.000 giocati.",
        "**Uno yield sopra il 5% circa, sostenuto su volumi seri, è raro.** Dove esiste vive di solito in mercati morbidi con limiti bassi, e si assottiglia al crescere degli stake, perché le quote che lo permettevano non sopravvivono a chi le colpisce forte. Qualunque cifra di lungo periodo molto sopra quella soglia va trattata come un campione corto, una nicchia morbida o una definizione diversa di giocato. E **sotto qualche centinaio di scommesse il numero è rumore, non un risultato**: a stake piatto su quota 2.00 una deviazione standard dello yield è uno diviso la radice del numero di giocate — 7,07 punti su 200 scommesse, 3,16 su 1.000, 2,00 su 2.500. Un +4% di yield arriva a due deviazioni standard da zero solo intorno alle 2.500 giocate. Sulle quote più alte le oscillazioni sono più larghe: a 2.00 sono 7,07 punti su 200 scommesse, a 3.00 diventano 10 punti sulle stesse 200. Ed è la lettura onesta di venti scommesse vinte — non un vantaggio misurato, solo un campione troppo corto per distinguere.",
      ],
      faq: [
        {
          q: "Come calcolo il giocato totale?",
          a: "Sommando lo stake di ogni scommessa piazzata, vinta o persa. 200 giocate da 50 fanno 10.000 di giocato, anche se la cassa dietro era solo 1.000. Non usare il netto e non usare il saldo: il giocato è il denaro passato dal bookmaker, contato una volta per scommessa.",
        },
        {
          q: "Uno yield del 5% è buono?",
          a: "Sostenuto su migliaia di scommesse sì, ed è intorno al massimo di ciò che sopravvive a limiti veri. Gli yield molto più alti nascono di solito da mercati morbidi, da un campione corto o da valore promozionale, e tendono a scendere quando gli stake crescono, perché le quote che li producevano vengono prese o limitate.",
        },
        {
          q: "Quante scommesse servono perché il mio yield significhi qualcosa?",
          a: "Più di quante si pensi. A stake piatto su quota 2.00 una deviazione standard dello yield vale 7,07 punti su 200 giocate, 3,16 su 1.000 e 2,00 su 2.500, quindi un +4% arriva a due deviazioni standard da zero solo verso le 2.500 scommesse. Sotto qualche centinaio, trattalo come un intervallo.",
        },
        {
          q: "E se i miei stake variano molto?",
          a: "Allora scommesse × stake medio è solo un'approssimazione, e ti fa un favore quando le vittorie sono cadute sugli stake grossi. Somma gli stake reali e dividi il profitto per quel totale. Se giochi a unità, conta le unità: lo yield per unità giocata è la stessa cifra ed è più facile tenerla onesta.",
        },
      ],
    },
    "stake-calculator": {
      metaTitle: "Calcolatore stake — la puntata per un profitto obiettivo | BetRedge",
      metaDescription:
        "Calcolatore di stake gratuito: inserisci quota e profitto che vuoi e leggi la puntata necessaria, il ritorno totale e quanta parte del bankroll impegna quella scommessa.",
      h1: "Calcolatore stake",
      lede:
        "La puntata che un profitto obiettivo richiede a una data quota — e la fetta di bankroll che impegna senza dirtelo.",
      labels: {
        inputTitle: "Quota e obiettivo",
        odds: "Quota",
        targetProfit: "Profitto obiettivo",
        bankroll: "Bankroll",
        resultTitle: "Quanto costa quell'obiettivo",
        stakeNeeded: "Puntata necessaria",
        totalReturn: "Ritorno totale",
        bankrollShare: "Quota del bankroll",
        hint: "Il bankroll è ciò che trasforma la puntata in una percentuale: senza, la puntata è un numero senza niente accanto. La quota va in decimale — 2.50, non +150.",
        verdictModest:
          "Questa puntata impegna meno del 5% del bankroll dichiarato, e una serie di dieci sconfitte non la chiuderebbe. Leggila accanto alla quota, non da sola: lo stesso obiettivo a una quota più corta chiede una puntata molto più grande.",
        verdictHeavy:
          "Questa puntata impegna più del 5% del bankroll dichiarato su un solo esito. A quella misura una serie di dieci sconfitte — ordinaria a quote intorno a 2.00 — se ne porta via più della metà, quindi controlla il numero sul calcolatore bankroll prima di piazzarla.",
      },
      takeaway:
        "Partire dal profitto che vuoi è il modo più rapido di puntare troppo: la domanda utile non è quanto voglio vincere, è quanto posso permettermi di perdere.",
      example: {
        title: "Volere 100 di profitto a quota 2.50",
        rows: [
          { label: "Quota", value: "2.50" },
          { label: "Profitto obiettivo", value: "100" },
          { label: "Puntata necessaria", value: "66,67" },
          { label: "Ritorno totale", value: "166,67" },
          { label: "Quota di un bankroll da 1.000", value: "6,67%" },
        ],
        note:
          "Lo stesso 100 costa 25,00 a quota 5.00 e 400,00 a quota 1.25 — l'obiettivo non si è mosso, si è mossa la quota. E 66,67 su un bankroll da 1.000 è esattamente il Kelly pieno di chi crede che l'esito capiti il 44% delle volte, quando 2.50 va in pari al 40%. Il desiderio contiene già una stima di probabilità con un vantaggio del +10%, solo non dichiarata.",
      },
      explainerTitle: "Ragionare al contrario da un numero che hai scelto tu",
      explainer: [
        "L'aritmetica è la metà facile. Una scommessa restituisce la puntata più puntata × (quota − 1), quindi **la puntata che un obiettivo richiede è l'obiettivo diviso la quota meno uno** — 100 a 2.50 chiede 66,67, e la giocata torna a 166,67. Ciò che rende utile questa pagina è il secondo effetto: **più corta è la quota, più grande è la puntata che lo stesso desiderio pretende**. Quel 100 costa 25,00 a 5.00, 66,67 a 2.50, 100,00 a 2.00 e 400,00 a 1.25. Fra quelle quattro righe la tua opinione non è cambiata di una virgola, e i soldi a rischio si sono mossi di sedici volte. È il motivo per cui il calcolatore chiede un bankroll di cui non avrebbe bisogno: 66,67 non è grande né piccolo finché non sai che è il 6,67% di tutto quello che hai messo da parte.",
        "**Ragionare dal profitto che vuoi è la strada più rapida verso una puntata troppo grande**, e sbaglia in un modo preciso. Perdi la prima e l'obiettivo cresce in silenzio per coprirla: volere ancora 100 dopo aver lasciato 66,67 significa chiederne 166,67, che a quota 2.00 richiede una puntata di 166,67, e se va male anche quella la richiesta successiva è 476,19 a 1.70. Tre scommesse dopo, 709,52 di un bankroll da 1.000 sono stati esposti per vincere i 100 iniziali, e la quota si è accorciata ogni volta perché le quote corte sembrano più sicure. **La puntata diventa più grande esattamente mentre il motivo per farla diventa più debole.** La versione onesta di questo calcolo va nel verso opposto, da quanto puoi perdere a quanto puoi puntare, ed è il calcolatore del criterio di Kelly: là la misura nasce da un vantaggio misurato, non da una cifra che hai scelto. E il nostro numero non è un caso — 66,67 su 1.000 è esattamente ciò che il Kelly pieno consiglia a 2.50 a chi crede al 44%, contro il 40% che la quota implica. Se quel 44% non lo difenderesti, la puntata non riguardava la scommessa.",
      ],
      faq: [
        {
          q: "Come si calcola la puntata per un profitto obiettivo?",
          a: "Dividi il profitto che vuoi per la quota meno uno. A 2.50 il ritorno netto per unità puntata è 1,50, quindi 100 di profitto chiedono 100 / 1,50 = 66,67 di puntata e pagano 166,67 in totale. A 2.00 il ritorno netto è 1,00, ed è il motivo per cui lì la puntata e l'obiettivo sono lo stesso numero.",
        },
        {
          q: "Perché il calcolatore chiede il bankroll?",
          a: "Perché la puntata da sola non dice niente. 66,67 è un errore di arrotondamento per uno e un terzo del conto per un altro, e la cifra che decide quale dei due è la quota del bankroll — qui il 6,67%. Lascia il campo vuoto e la puntata funziona comunque; la percentuale diventa un trattino, che è onesto, perché quell'assunzione è tua e non nostra da inventare.",
        },
        {
          q: "Meglio questo o il criterio di Kelly?",
          a: "Usa questo per dare un prezzo a un desiderio e Kelly per dimensionare una scommessa. Questa pagina parte da un numero che hai scelto e calcola quanto costa; il calcolatore del criterio di Kelly parte da un vantaggio che hai misurato e calcola quanto il bankroll può portare. Quando i due non concordano, quello da scartare è quello che non ha consultato la tua stima di probabilità.",
        },
        {
          q: "Inseguire una perdita con una puntata più grande ha mai senso?",
          a: "Non con questa aritmetica. Ogni richiesta di recupero è più grande della precedente, e di solito viene piazzata a una quota più corta perché le quote corte sembrano più sicure, quindi la puntata cresce mentre il vantaggio si riduce. Le regole di bankroll esistono per rendere la prossima puntata indipendente dall'ultimo risultato: fissa l'unità come percentuale del bankroll e la sequenza non può scappare.",
        },
      ],
    },
    "bankroll-calculator": {
      metaTitle: "Calcolatore bankroll — unità, drawdown e sconfitte alla rovina | BetRedge",
      metaDescription:
        "Calcolatore di bankroll gratuito: imposta cassa e unità e leggi la puntata per scommessa, quanto costa una serie negativa, il drawdown che lascia e quante sconfitte copre.",
      h1: "Calcolatore bankroll",
      lede:
        "Quanto impegna davvero un'unità in percentuale: la puntata per scommessa, il costo di una serie negativa e quante sconfitte consecutive la cassa sopravvive.",
      labels: {
        inputTitle: "Cassa e regola",
        bankroll: "Bankroll",
        unitPercent: "Unità (%)",
        losingStreak: "Serie negativa",
        resultTitle: "Quanto costa la regola",
        unit: "Puntata per scommessa",
        streakLoss: "Costo della serie",
        drawdown: "Drawdown",
        betsToRuin: "Sconfitte alla rovina",
        hint: "Le percentuali vanno scritte come numeri: 2 significa il 2% del bankroll per scommessa. La serie negativa è un conteggio di giocate, quindi solo numeri interi — è la serie che vuoi sopravvivere, non una previsione.",
        verdictSafe:
          "Al 5% per unità o sotto, la serie che hai dichiarato lascia il bankroll ancora funzionante. Una serie di dieci arriva al 38,54% di chi gioca entro 1.000 giocate a quote pari, quindi un piano che regge solo se non la incontri non è un piano.",
        verdictAggressive:
          "Sopra il 5% per unità la serie negativa ordinaria chiude il conto: dieci sconfitte si portano via metà del bankroll o più, e da metà servirebbe un +100,00% per tornare indietro. Poiché una serie di dieci arriva entro 1.000 giocate al 38,54% di chi gioca, questa è una scommessa sul non incontrarla.",
      },
      takeaway:
        "La percentuale per unità non è una preferenza. È la tua decisione su quanto lunga può essere la serie negativa peggiore prima che tu esca dal gioco.",
      example: {
        title: "Un bankroll da 2.000 al 2% per scommessa",
        rows: [
          { label: "Bankroll", value: "2.000" },
          { label: "Unità", value: "2%" },
          { label: "Puntata per scommessa", value: "40,00" },
          { label: "Dieci sconfitte di fila", value: "400,00" },
          { label: "Drawdown", value: "20,00%" },
          { label: "Sconfitte alla rovina", value: "50" },
        ],
        note:
          "Quel buco del 20,00% chiede un +25,00% su ciò che resta per tornare a 2.000. Porta l'unità al 5% e le stesse dieci sconfitte costano 1.000 — un drawdown del 50,00% che chiede un +100,00% per rientrare, con la cassa che copre 20 sconfitte consecutive invece di 50. Tre punti di regola, e la serie che sopravvivi si dimezza.",
      },
      explainerTitle: "La regola che decide quanto lunga una serie negativa sopravvivi",
      explainer: [
        "**Un'unità è una percentuale del bankroll, non un importo**, e la differenza si vede solo quando le cose vanno male. Punta 40 fissi per sempre e un bankroll scivolato a 1.000 sta scommettendo il 4% invece del 2%: la regola si stringe esattamente quando dovrebbe allargarsi. Ricalcola l'unità sul saldo corrente e ogni sconfitta rende più piccola la puntata successiva, ed è questo che impedisce a una serie negativa di finire il lavoro. L'asimmetria sotto è tutto il motivo per cui importa — **perdere il 20% chiede un +25,00% per rientrare, perdere il 50% chiede un +100,00%, perdere l'80% chiede un +400,00%.** Nella seconda metà di quelle coppie non c'è niente di simmetrico con la prima, e nessun vantaggio è grande abbastanza per fare di un recupero del 400,00% un piano invece di una speranza. Un bankroll da 2.000 al 2% punta 40 per scommessa, assorbe dieci sconfitte consecutive per 400,00 e ne esce con un −20,00% — avendo usato dieci delle 50 sconfitte consecutive che quella puntata può sopravvivere.",
        "**Una serie di dieci sconfitte a quote intorno a 2.00 è ordinaria, non sfortuna**, ed è questo il numero che lo dimostra. A quote pari una singola sequenza di dieci ha una probabilità dello 0,098% — una su 1.024 — che si legge come mai, finché non conti quante sequenze contiene una stagione. Su 1.000 giocate la probabilità di incontrare almeno una serie di dieci o più è **38,54%**; a quota 2.10, dove chi non ha vantaggio vince il 47,62% delle volte, è **52,31%** — meglio di un lancio di moneta. Su 500 giocate le stesse due cifre sono 21,45% e 30,73%, e la serie più lunga da aspettarsi in 1.000 giocate a quote pari è circa dieci, perché cresce col logaritmo in base due del numero di scommesse. La serie non è la coda della distribuzione, è il suo centro, quindi **un'unità sopra il 5% è una scommessa sul non incontrare il caso ordinario**: al 5% quelle dieci sconfitte prendono metà del bankroll, al 10% lo prendono tutto. Quando il vantaggio è misurato e non assunto, il calcolatore del criterio di Kelly dimensiona l'unità sul vantaggio stesso — leggi quel numero come un tetto, e questa pagina come il pavimento sotto di lui.",
      ],
      faq: [
        {
          q: "Quale unità dovrei usare?",
          a: "Fra l'uno e il due per cento del bankroll per scommessa è l'intervallo abituale dello stake piatto, e sopra il cinque per cento la serie negativa ordinaria diventa un evento che chiude il conto. Il modo onesto di scegliere è al contrario: decidi la serie negativa che vuoi sopravvivere, leggi il drawdown che questo calcolatore ti dà e chiediti se dopo continueresti a giocare così.",
        },
        {
          q: "Perché le sconfitte alla rovina sono un numero intero?",
          a: "Perché contano giocate, e una frazione di giocata non è una giocata. Un bankroll da 1.000 al 3% dà un'unità di 30, cioè 33 sconfitte e un terzo — quindi la risposta è 33, arrotondata per difetto, perché la cassa non copre più la successiva per intero. Arrotondare per eccesso promette una scommessa per cui i soldi non ci sono.",
        },
        {
          q: "Dieci sconfitte di fila sono davvero normali?",
          a: "Sì, e l'aritmetica non è nemmeno vicina. Una singola sequenza di dieci sconfitte a quote pari è un evento dello 0,098%, ma su 1.000 giocate le sequenze sono tante e la probabilità di incontrarne almeno una è 38,54%, che sale al 52,31% a quota 2.10, dove chi non ha vantaggio vince il 47,62% delle volte. Pianificala, invece di stupirti.",
        },
        {
          q: "Meglio questo o il criterio di Kelly?",
          a: "Usa questo quando non hai un vantaggio misurato, cioè quasi sempre: un'unità in percentuale non chiede stime di probabilità e il suo caso peggiore si conosce in anticipo. Il calcolatore del criterio di Kelly è lo strumento giusto quando una probabilità la puoi difendere, e di solito consiglierà più di un 2% piatto. Trattare la sua risposta come un tetto e la regola piatta come il pavimento tiene onesti entrambi.",
        },
      ],
    },
  },
};

export default it;
