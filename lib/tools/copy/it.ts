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
      formulaTitle: "Come funziona la conversione",
      formula: [
        "decimale = 1 + (americana / 100)          se l'americana è positiva",
        "decimale = 1 + (100 / |americana|)        se l'americana è negativa",
        "decimale = 1 + (numeratore / denominatore) per le frazionarie",
        "probabilità implicita = 1 / decimale",
      ],
      explainerTitle: "Leggere una quota in qualsiasi formato",
      explainer: [
        "Una quota è una probabilità vestita in modo diverso. La decimale — lo standard europeo — dice quanto torna in tutto per ogni unità puntata: 2.50 restituisce 2.50 per ogni 1 rischiato, puntata compresa. La frazionaria, ancora usata nelle corse britanniche, indica il profitto e non il ritorno: 3/2 significa tre unità di profitto ogni due rischiate, cioè la stessa 2.50 decimale. L'americana dice quanto vinci puntando 100 (+150) o quanto devi rischiare per vincerne 100 (−110). Hong Kong, Malay e Indonesian sono i formati dei mercati asiatici, e contano perché è spesso lì che stanno le quote più affilate.",
        "Il numero che vale la pena leggere è l'ultimo: la probabilità implicita, cioè 1 diviso la quota decimale. Una quota di 2.50 implica il 40%. Una di 1.9091 — la familiare −110 — implica il 52,38%. È la probabilità che il bookmaker dichiara, ed è l'unico numero che puoi confrontare direttamente con la tua stima. Due quote in formati diversi non sono più facili da confrontare di due probabilità: prima converti, poi discuti.",
        "Un limite che questo convertitore non può togliere: la probabilità implicita contiene ancora il margine del bookmaker. Somma le probabilità implicite di tutti gli esiti di un mercato e otterrai più del 100% — quell'eccesso è il margine, e gonfia ognuna di quelle probabilità. Se vuoi l'opinione onesta del mercato invece di quella con il ricarico, passa il mercato dal calcolatore di margine e usa le probabilità eque che restituisce.",
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
      formulaTitle: "Come si calcola il margine",
      formula: [
        "overround = Σ (1 / quotaᵢ)",
        "margine = overround − 1",
        "payout = 1 / overround",
        "probabilità equaᵢ = (1 / quotaᵢ) / overround",
        "quota equaᵢ = 1 / probabilità equaᵢ",
      ],
      explainerTitle: "Il margine è il prezzo della scommessa",
      explainer: [
        "Un mercato a due vie equo prezza entrambi i lati a 2.00: le probabilità implicite sono 50% e 50%, sommano esattamente a 100% e nessuno dei due lati ha un vantaggio. I mercati reali sono prezzati 1.90 e 1.90. Quelle probabilità implicite valgono 52,63% ciascuna, sommano a 105,26%, e i 5,26 punti percentuali in eccesso sono il margine del bookmaker — l'overround. Qualunque lato giochi, lo stai pagando.",
        "Il margine è il numero più utile per decidere dove puntare. La stessa partita a margine 5% e a margine 2% non è la stessa scommessa: il book più stretto ti sta lasciando circa tre punti percentuali di valore atteso a parità di opinioni. I margini variano molto per mercato: le linee principali dei book sharp possono stare sotto il 2%, mentre antepost, mercati sui giocatori e scommesse speciali arrivano abitualmente all'8% e oltre, perché è lì che i book sanno di essere meno controllati.",
        "Togliere il margine dà la linea equa, la cosiddetta no-vig. Questo calcolatore lo fa in modo proporzionale: ogni probabilità implicita viene divisa per la loro somma, così tornano a sommare esattamente 100%, e le quote eque sono i reciproci. Quella linea è la cosa più vicina alla stima onesta del mercato, ed è il riferimento per il calcolatore di EV: una scommessa ha valore atteso positivo solo se la tua probabilità supera quella equa, non semplicemente quella prezzata.",
        "Un limite dichiarato: la rimozione proporzionale distribuisce il margine in modo uniforme su tutti gli esiti, e i book reali non lo fanno. Caricano più margine sugli esiti improbabili, perché è lì che si concentra il gioco occasionale. In un mercato con un favorito netto e un outsider lontano, questo metodo sottostima un po' la probabilità vera del favorito. Sulle linee principali la distorsione è piccola; sugli antepost da lotteria, tratta la linea equa come una stima, non come una misura.",
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
      formulaTitle: "Come si calcola il valore atteso",
      formula: [
        "EV = p × (quota − 1) × puntata − (1 − p) × puntata",
        "   = (p × quota − 1) × puntata",
        "vantaggio = p × quota − 1",
        "quota di pareggio = 1 / p",
      ],
      explainerTitle: "Cosa dice davvero il valore atteso",
      explainer: [
        "Il valore atteso è il risultato medio di una scommessa se potessi ripeterla un numero illimitato di volte. Ha due ingressi e nessuna opinione: la quota che ti viene offerta e la probabilità che attribuisci all'esito. Se pensi che una squadra vinca il 55% delle volte e qualcuno ti offre 2.00, il conto è immediato: il 55% delle volte guadagni un'unità, il 45% la perdi, quindi in media guadagni 0,10 unità per unità puntata. È un vantaggio del 10%, ed è quello che significa +EV.",
        "Il numero che decide tutto è la probabilità, ed è lì che la maggior parte dei giocatori perde in silenzio. Un errore di 5 punti nella stima è sufficiente a trasformare un vantaggio del 4% in una perdita dell'1%, e le stime fatte a occhio sbagliano abitualmente di molto più di 5 punti. Per questo esiste la seconda modalità di questo calcolatore: invece di fidarti dell'istinto, prendi la quota di entrambi i lati presso un book sharp, togli il margine e usa la probabilità equa che ne esce. Non ti stai più chiedendo se sei più bravo del mercato, ma se il book su cui giochi è più lento del book più sharp.",
        "Leggi l'EV come un tasso, non come una promessa. Una scommessa con il 4% di valore atteso non rende nulla nella singola occasione: vince o perde. Quel 4% compare solo su centinaia di scommesse indipendenti, e solo se la probabilità era giusta. Nel breve periodo la varianza è molto più grande del vantaggio, ed è esattamente per questo che la dimensione della puntata conta quanto il vantaggio stesso: è il compito del criterio di Kelly.",
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
      formulaTitle: "Come si calcola la puntata di Kelly",
      formula: [
        "b = quota − 1",
        "f* = (p × b − (1 − p)) / b = (p × quota − 1) / b",
        "puntata = bankroll × f* × frazione",
        "crescita attesa = p × ln(1 + f × b) + (1 − p) × ln(1 − f)",
      ],
      explainerTitle: "Dimensionare la puntata perché la serie negativa non la chiuda",
      explainer: [
        "Il criterio di Kelly risponde a una domanda che il valore atteso ignora: dato un vantaggio, quanto rischiare davvero? Punta troppo poco e un vantaggio reale si capitalizza troppo lentamente per contare. Punta troppo e la matematica si gira contro: un bankroll che si dimezza ha bisogno di un +100% per tornare al punto di partenza, quindi le puntate grandi distruggono la crescita anche quando ogni singola scommessa è favorevole. Kelly trova la frazione che massimizza il tasso di crescita nel lungo periodo, e risulta essere il vantaggio diviso la quota netta.",
        "Il risultato scala col vantaggio, non con la convinzione. Un vantaggio del 10% a quota 2.00 chiede il 10% del bankroll; lo stesso 10% a quota 5.00 chiede solo il 2,5%, perché la quota più lunga significa serie negative più lunghe e un percorso più accidentato. È per questo che la formula è utile anche a chi non la segue mai alla lettera: dice che quota e vantaggio insieme decidono la puntata, e che una sensazione forte non è un ingresso.",
        "Quasi nessuno dovrebbe giocare Kelly pieno. La formula assume che la tua probabilità sia esatta, e non lo è mai. Dalle un vantaggio sovrastimato e ti consiglierà con entusiasmo una puntata troppo grande per il vantaggio che hai davvero: il modo più rapido di perdere un bankroll pur avendo ragione in media. Il mezzo Kelly rinuncia a un quarto della crescita teorica e dimezza circa la volatilità; il quarto di Kelly è quello che molti professionisti con modelli veri usano davvero. Se le tue probabilità vengono dal giudizio e non dai dati, il quarto di Kelly non è prudenza: è realismo.",
        "Quando la quota non offre vantaggio, la puntata corretta è zero, e questo calcolatore lo dice invece di restituire un numero negativo travestito da consiglio. Una frazione di Kelly negativa significa che la scommessa andrebbe presa sull'altro lato, se la trovi a quella quota: non significa mai puntare meno su questa.",
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
      formulaTitle: "Come si calcolano le probabilità",
      formula: [
        "quota = 1 / probabilità",
        "probabilità = 1 / quota",
        "probabilità di pareggio = 1 / quota",
        "probabilità della multipla = p₁ × p₂ × … × pₙ",
        "quota della multipla = quota₁ × quota₂ × … × quotaₙ",
      ],
      explainerTitle: "Prima la probabilità, poi la quota",
      explainer: [
        "Ogni quota è un'affermazione sulla probabilità, e la conversione fra le due è una divisione: una probabilità del 40% è una quota di 2.50, e una quota di 2.50 è una probabilità del 40%. Fare quella conversione prima di puntare cambia la domanda da «mi piace questa scommessa?» a «penso che questo esito succeda più del 40% delle volte?», che è una domanda su cui si può sbagliare davvero, e quindi una domanda che vale la pena porsi.",
        "Lo stesso numero, letto dal lato della quota, è la probabilità di pareggio: la possibilità minima che un esito deve avere perché la scommessa sia neutra. Una quota di 1.75 pretende il 57,1%. Una di 1.50 pretende il 66,7%. Le quote lunghe pretendono pochissimo — 15.00 chiede solo il 6,7% — ed è per questo che sembrano convenienti e per questo che i book ci caricano il margine. La probabilità di pareggio è il test onesto di una scommessa: se non riesci ad argomentare che l'esito la supera, la quota non è generosa, è corretta.",
        "Le multiple sono il punto in cui la probabilità diventa controintuitiva. Le gambe indipendenti si moltiplicano: tre scommesse che valuti al 50% ciascuna combinano al 12,5%, non a qualcosa di rassicurante vicino a metà. Quattro gambe al 60% fanno 12,96%. La quota combinata si moltiplica allo stesso modo, e qui sta la trappola: un'accumulata a 15.00 sembra un affare finché non noti che pretende un evento al 6,7%, e che il margine del bookmaker è stato applicato a ogni singola gamba e poi composto. Una multipla di quattro gambe al 5% di margine ciascuna porta quasi il 21% di margine totale.",
        "Un'assunzione da tenere presente: questo calcolatore moltiplica, quindi assume che le gambe siano indipendenti. Due esiti della stessa partita — la vittoria di una squadra e il gol del suo attaccante — sono correlati, e moltiplicare le loro probabilità sottostima la probabilità vera che escano entrambi. Le multiple sulla stessa partita sono prezzate a parte dai book proprio perché quella correlazione è difficile da calcolare: tratta il numero che vedi qui come un minimo, non come una risposta.",
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
  },
};

export default it;
