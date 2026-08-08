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
  },
};

export default it;
