// lib/tools/copy/nl.ts (#TOOLS-HUB-0805)
// Nederlands. Lokale zoektermen: "odds omrekenen", "EV calculator",
// "kelly criterium", "bookmakermarge".

import type { ToolsCopy } from "./types";

const nl: ToolsCopy = {
  hub: {
    metaTitle: "Gratis wedtools — odds, EV, Kelly en marge | BetRedge",
    metaDescription:
      "Vijf gratis rekenmachines: odds omrekenen naar elk formaat, de bookmakermarge verwijderen, verwachte waarde berekenen en je inzet bepalen met Kelly. Zonder account.",
    h1: "Gratis wedtools",
    lede:
      "De vijf berekeningen die je voor een wed maakt: odds omgerekend, marge verwijderd, inzet bepaald. Gratis, zonder account.",
    cardCta: "Open de tool",
    intro: [
      "Elke wed is een vergelijking tussen een prijs en een kans. Deze vijf rekenmachines maken die vergelijking netjes: ze zetten odds om tussen formaten, halen de marge van de bookmaker eruit om de eerlijke lijn te tonen, veranderen een kansschatting in verwachte waarde en bepalen de inzet zodat een verliesreeks je bankroll niet beëindigt.",
      "Alles draait volledig in je browser: er wordt niets verzonden, niets opgeslagen en er is geen account nodig. Gebruik ze los, of gebruik ze om te controleren wat ons model al bij elke wedstrijd publiceert.",
    ],
  },

  common: {
    backLabel: "Home",
    ctaTitle: "Deze berekeningen doen wij bij elke wedstrijd",
    ctaBody:
      "De rekenmachines nemen één prijs per keer. BetRedge scant de markt continu, haalt de marge eruit, vergelijkt met de modelkans en laat zien waar die twee van elkaar afwijken — voetbal en tennis, de hele dag bijgewerkt.",
    ctaButton: "Bekijk het board van vandaag",
    otherTools: "Andere gratis tools",
    langLabel: "Taal",
    free: "Gratis",
    faqTitle: "Vragen",
    invalid: "—",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Odds omrekenen — decimaal, breuk, Amerikaans en impliciete kans | BetRedge",
      metaDescription:
        "Gratis odds converter: typ een prijs in elk formaat — decimaal, breuk, Amerikaans, Hongkong, Malay of Indonesian — en lees hem in alle andere formaten terug.",
      h1: "Odds converter",
      lede:
        "Typ een prijs in één formaat en lees hem in alle andere, samen met de kans die de bookmaker daarmee claimt.",
      labels: {
        inputTitle: "Jouw prijs",
        oddsInput: "Odds",
        formatSelect: "Formaat",
        resultTitle: "Dezelfde prijs, in elk formaat",
        decimal: "Decimaal",
        american: "Amerikaans",
        fractional: "Breuk",
        hongkong: "Hongkong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Impliciete kans",
        hint: "Decimaal accepteert ook een komma: 2,50 werkt als 2.50.",
      },
      formulaTitle: "Hoe de omrekening werkt",
      formula: [
        "decimaal = 1 + (Amerikaans / 100)         als Amerikaans positief is",
        "decimaal = 1 + (100 / |Amerikaans|)       als Amerikaans negatief is",
        "decimaal = 1 + (teller / noemer)          voor breukodds",
        "impliciete kans = 1 / decimaal",
      ],
      explainerTitle: "Een prijs in elk formaat lezen",
      explainer: [
        "Een odd is een kans in andere kleren. De decimale odd — de Europese standaard — geeft de totale uitbetaling per ingezette eenheid: 2.50 keert 2.50 uit voor elke geriskeerde 1, inzet inbegrepen. De breukodd, nog gebruikelijk in de Britse rensport, geeft de winst in plaats van de uitbetaling: 3/2 betekent drie eenheden winst per twee geriskeerde, dus dezelfde 2.50 decimaal. De Amerikaanse odd zegt hoeveel je wint op 100 (+150) of hoeveel je moet riskeren om 100 te winnen (−110). Hongkong, Malay en Indonesian zijn de formaten van de Aziatische markten, en die tellen omdat daar vaak de scherpste prijzen staan.",
        "Het getal dat het lezen waard is, is het laatste: de impliciete kans, simpelweg 1 gedeeld door de decimale odd. Een prijs van 2.50 impliceert 40%. Een prijs van 1.9091 — de bekende −110 — impliceert 52,38%. Dat is de kans die de bookmaker uitspreekt, en het is het enige getal dat je direct met je eigen schatting kunt vergelijken. Twee odds in verschillende formaten zijn niet makkelijker te vergelijken dan twee kansen: eerst omrekenen, dan discussiëren.",
        "Eén beperking die deze converter niet voor je kan wegnemen: de impliciete kans bevat nog de marge van de bookmaker. Tel de impliciete kansen van alle uitkomsten in een markt op en je komt boven 100% — dat overschot is de marge, en die blaast elk van die kansen op. Wil je de eerlijke mening van de markt in plaats van de beprijsde mening, haal de markt dan door de margecalculator en gebruik de eerlijke kansen die eruit komen.",
      ],
      faq: [
        {
          q: "In welk formaat kun je het beste rekenen?",
          a: "Decimaal, tenzij er een reden is om dat niet te doen. Decimale odds vermenigvuldigen geeft direct de prijs van een combinatie, en 1 gedeeld door de odd geeft de impliciete kans — beide zijn onhandig in breuk- of Amerikaanse notatie.",
        },
        {
          q: "Waarom wordt −110 1,909090…?",
          a: "Omdat 100/110 een repeterende breuk is. Afgerond op twee decimalen is het 1.91, wat elke bookmaker toont, maar de converter houdt intern de volle precisie aan zodat een reeks berekeningen niet gaat afwijken.",
        },
        {
          q: "Wat is het verschil tussen Malay- en Indonesian-odds?",
          a: "Ze zijn spiegelbeelden. Malay-odds zijn positief onder 2.00 en negatief daarboven; Indonesian-odds zijn positief boven 2.00 en negatief daaronder. Beide drukken dezelfde prijs uit en rekenen om naar dezelfde decimaal.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Margecalculator — overround, uitbetalingspercentage en eerlijke odds | BetRedge",
      metaDescription:
        "Gratis margecalculator: voer de odds van alle uitkomsten in en krijg de bookmakermarge, het uitbetalingspercentage en de eerlijke odds zonder marge.",
      h1: "Margecalculator",
      lede:
        "Voer alle prijzen van een markt in en zie wat de bookmaker inhoudt — plus de eerlijke lijn die eronder zit.",
      labels: {
        inputTitle: "De markt",
        outcome: "Uitkomst",
        addOutcome: "Uitkomst toevoegen",
        removeOutcome: "Verwijderen",
        resultTitle: "Wat de bookmaker rekent",
        margin: "Bookmakermarge",
        payout: "Uitbetaling",
        fairOddsTitle: "Eerlijke lijn, marge verwijderd",
        fairOdds: "Eerlijke odd",
        fairProbability: "Eerlijke kans",
        impliedProbability: "Impliciete kans",
        hint: "Voeg een uitkomst toe voor driewegmarkten, of meer voor winnaarsmarkten.",
      },
      formulaTitle: "Hoe de marge wordt berekend",
      formula: [
        "overround = Σ (1 / oddᵢ)",
        "marge = overround − 1",
        "uitbetaling = 1 / overround",
        "eerlijke kansᵢ = (1 / oddᵢ) / overround",
        "eerlijke oddᵢ = 1 / eerlijke kansᵢ",
      ],
      explainerTitle: "De marge is de prijs van de wed",
      explainer: [
        "Een eerlijke tweewegmarkt prijst beide kanten op 2.00: de impliciete kansen zijn 50% en 50%, ze tellen op tot precies 100%, en geen van beide kanten heeft voordeel. Echte markten staan op 1.90 en 1.90. Die impliciete kansen zijn elk 52,63%, tellen op tot 105,26%, en de 5,26 procentpunten overschot zijn de marge van de bookmaker — de overround. Welke kant je ook speelt, je betaalt hem.",
        "De marge is het nuttigste getal om te bepalen waar je wedt. Dezelfde wedstrijd met 5% marge en met 2% marge is niet dezelfde wed: de scherpere bookmaker laat je bij identieke meningen ongeveer drie procentpunten verwachte waarde. Marges lopen sterk uiteen per markt: hoofdlijnen bij scherpe bookmakers kunnen onder 2% liggen, terwijl winnaarsmarkten, spelersmarkten en specials routinematig 8% of meer dragen, omdat bookmakers weten dat hun prijzen daar het minst getoetst worden.",
        "De marge verwijderen geeft de eerlijke lijn, de zogenoemde no-vig lijn. Deze calculator doet dat proportioneel: elke impliciete kans wordt gedeeld door hun som, zodat ze weer precies 100% vormen, en de eerlijke odds zijn de omgekeerden. Die lijn komt het dichtst bij de eerlijke schatting van de markt, en is het referentiepunt voor de EV-calculator: een wed heeft alleen positieve verwachte waarde als jouw kans boven de eerlijke kans ligt, niet enkel boven de beprijsde.",
        "Een openlijke beperking: proportioneel verwijderen verdeelt de marge gelijkmatig over de uitkomsten, en echte bookmakers doen dat niet. Zij leggen meer marge op onwaarschijnlijke uitkomsten, want daar zit het recreatieve geld. In een markt met een duidelijke favoriet en een verre outsider onderschat deze methode de echte kans van de favoriet iets. Op hoofdlijnen is de vertekening klein; bij loterijachtige winnaarsmarkten is de eerlijke lijn een schatting, geen meting.",
      ],
      faq: [
        {
          q: "Welke marge is acceptabel?",
          a: "Op hoofdlijnen in voetbal en tennis is onder 3% scherp, 4–5% normaal bij een recreatieve bookmaker, en boven 7% betaal je veel voor het recht een mening te hebben. Vergelijk dezelfde markt bij meerdere bookmakers voordat je kiest.",
        },
        {
          q: "Is uitbetalingspercentage hetzelfde als marge?",
          a: "Twee manieren om hetzelfde getal te lezen. Een marge van 5,26% hoort bij een uitbetaling van 95%: de bookmaker verwacht over de hele markt 95 van elke 100 inzet terug te geven. Uitbetaling is het handigste getal om te vergelijken.",
        },
        {
          q: "Waarom tellen de eerlijke kansen op tot precies 100%?",
          a: "Omdat dat de definitie is van marge verwijderen. De beprijsde kansen tellen op tot meer dan 100%; door elke te delen door dat totaal worden ze herschaald tot ze samen één vormen, wat een samenhangende set kansen moet doen.",
        },
        {
          q: "Werkt dit op driewegmarkten of winnaarsmarkten?",
          a: "Ja — voeg zoveel uitkomsten toe als de markt heeft. De rekenkunde is identiek voor elk aantal uitkomsten, zolang je ze allemaal invoert. Eén weglaten onderschat de marge.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "EV calculator — verwachte waarde van een wed, met of zonder eerlijke lijn | BetRedge",
      metaDescription:
        "Gratis EV calculator: voer prijs, kans en inzet in voor de verwachte waarde in valuta en procenten — of leid de eerlijke kans af uit de lijn van een scherpe bookmaker.",
      h1: "EV calculator",
      lede:
        "Wat een wed gemiddeld waard is: vanuit je eigen kans, of vanuit de lijn van een scherpe bookmaker zonder marge.",
      labels: {
        inputTitle: "De wed",
        modeTitle: "Waar komt de kans vandaan",
        modeManual: "Mijn eigen schatting",
        modeSharp: "Van een scherpe bookmaker",
        yourOdds: "Jouw prijs",
        yourProbability: "Jouw kans (%)",
        sharpOddsA: "Scherpe prijs, jouw kant",
        sharpOddsB: "Scherpe prijs, andere kant",
        derivedProbability: "Eerlijke kans, marge verwijderd",
        stake: "Inzet",
        resultTitle: "Wat de wed waard is",
        ev: "Verwachte waarde",
        fairOdds: "Break-evenprijs",
        edge: "Voordeel",
        positive: "Positieve verwachte waarde bij deze prijs.",
        negative: "Negatieve verwachte waarde bij deze prijs.",
        neutral: "Break-even: de prijs komt precies overeen met de kans.",
        hint: "Percentages als getal invoeren: 55 betekent 55%.",
      },
      formulaTitle: "Hoe de verwachte waarde wordt berekend",
      formula: [
        "EV = p × (odd − 1) × inzet − (1 − p) × inzet",
        "   = (p × odd − 1) × inzet",
        "voordeel = p × odd − 1",
        "break-evenprijs = 1 / p",
      ],
      explainerTitle: "Wat verwachte waarde echt zegt",
      explainer: [
        "Verwachte waarde is het gemiddelde resultaat van een wed als je hem onbeperkt vaak zou kunnen spelen. Er zijn twee invoerwaarden en geen meningen: de prijs die je krijgt en de kans die je de uitkomst geeft. Denk je dat een ploeg 55% van de tijd wint en biedt iemand 2.00, dan is de rekensom direct: 55% van de tijd win je een eenheid, 45% verlies je hem, dus gemiddeld verdien je 0,10 eenheid per ingezette eenheid. Dat is 10% voordeel, en dat is wat +EV betekent.",
        "Het getal dat alles bepaalt is de kans, en daar verliezen de meeste wedders stil. Een fout van 5 punten in de schatting is genoeg om 4% voordeel in 1% verlies te veranderen, en schattingen op het oog zitten er routinematig veel meer dan 5 punten naast. Daarom bestaat de tweede modus van deze calculator: vertrouw niet op je gevoel, maar neem de prijs van beide kanten bij een scherpe bookmaker, haal de marge eruit en gebruik de eerlijke kans die eruit komt. De vraag is dan niet meer of jij slimmer bent dan de markt, maar of de bookmaker waar je speelt langzamer is dan de scherpste.",
        "Lees EV als een percentage, niet als een belofte. Een wed met 4% verwachte waarde levert bij één gelegenheid helemaal niets op: hij wint of verliest. Die 4% verschijnt pas over honderden onafhankelijke weds, en alleen als de kans klopte. Op korte termijn is de variantie veel groter dan het voordeel, en precies daarom telt de inzetgrootte even zwaar als het voordeel zelf — daarvoor is het Kelly-criterium.",
      ],
      faq: [
        {
          q: "Hoe kom ik aan een kans die ik kan vertrouwen?",
          a: "Uit een model op basis van data, of uit de markt zelf. De eerlijke lijn van een scherpe bookmaker — zijn prijzen zonder marge — is met alleen inschatting moeilijk te verslaan, en gratis op te zoeken.",
        },
        {
          q: "Is een wed met positieve EV een goede wed?",
          a: "Het is een noodzakelijke, geen voldoende voorwaarde. Een wed kan positieve verwachte waarde hebben en toch verkeerd zijn als de inzet te groot is voor de bankroll, het voordeel binnen je schattingsfout valt of de markt voor aanvang tegen je in beweegt.",
        },
        {
          q: "Waarom zijn beide kanten van de scherpe markt nodig?",
          a: "Omdat je uit één prijs geen marge kunt verwijderen. Die wordt pas zichtbaar als de impliciete kansen van alle uitkomsten worden opgeteld: de tweede prijs maakt de eerlijke kans berekenbaar.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Kelly criterium calculator — optimale inzet uit voordeel en bankroll | BetRedge",
      metaDescription:
        "Gratis Kelly criterium calculator: voer prijs, kans en bankroll in voor de inzet die de groei op lange termijn maximaliseert — volledige, halve of kwart Kelly.",
      h1: "Kelly criterium calculator",
      lede:
        "De inzet die een bankroll op lange termijn het snelst laat groeien — en waarom bijna iedereen bewust minder zou moeten inzetten.",
      labels: {
        inputTitle: "De wed en de bankroll",
        odds: "Prijs",
        probability: "Jouw kans (%)",
        bankroll: "Bankroll",
        fractionTitle: "Kelly-fractie",
        fractionFull: "Volledig",
        fractionHalf: "Half",
        fractionQuarter: "Kwart",
        resultTitle: "Aanbevolen inzet",
        stake: "Inzet",
        stakePercent: "Deel van de bankroll",
        edge: "Voordeel",
        fullKelly: "Volledige Kelly",
        growth: "Verwachte groei per wed",
        noEdge: "Geen voordeel bij deze prijs — de optimale inzet is nul.",
        hint: "Percentages als getal invoeren: 55 betekent 55%.",
      },
      example: {
        title: "Wat dat betekent met 1.000 bankroll",
        rows: [
          { label: "Bankroll", value: "1.000" },
          { label: "Prijs · jouw kans", value: "2.00 · 55%" },
          { label: "Voordeel", value: "+10%" },
          { label: "Volledige Kelly", value: "10% → 100 per wed" },
          { label: "Halve Kelly", value: "5% → 50 per wed" },
        ],
        note:
          "Vijf verliezen op rij — bij deze prijs één reeks op 54 — laten bij volledige Kelly 590 over, en dan is +69% nodig om terug op 1.000 te komen. Dezelfde reeks bij halve Kelly laat 774 over, waarvoor +29% genoeg is. Zelfde voordeel, zelfde weds, half zo diep gat.",
      },
      explainerTitle: "De inzet zo kiezen dat de slechte reeks hem niet beëindigt",
      explainer: [
        "Het Kelly-criterium antwoordt op wat verwachte waarde overslaat: hoeveel moet je met een gegeven voordeel echt riskeren? Zet te weinig in en een echt voordeel groeit te langzaam om iets te betekenen. Zet te veel in en de rekenkunde keert zich tegen je: een bankroll die halveert heeft +100% nodig om terug te komen, dus te grote inzetten vernietigen de groei zelfs als elke afzonderlijke wed gunstig is. De optimale fractie is het voordeel gedeeld door de netto-odd, en die schaalt met het voordeel, niet met overtuiging: 10% voordeel bij 2.00 vraagt 10% van de bankroll, hetzelfde voordeel bij 5.00 maar 2,5%.",
        "Bijna niemand zou volledige Kelly moeten spelen, want de formule gaat ervan uit dat je kans exact klopt en dat doet hij nooit. Geef hem een overschat voordeel en hij beveelt vrolijk een inzet aan die te groot is voor het voordeel dat je werkelijk hebt: de snelste manier om een bankroll te verliezen terwijl je gemiddeld gelijk hebt. Halve Kelly geeft een kwart van de theoretische groei op en halveert de volatiliteit ongeveer; kwart Kelly is wat veel professionals met echte modellen gebruiken. En biedt de prijs geen voordeel, dan is de juiste inzet nul: een negatieve Kelly-fractie betekent dat de wed aan de andere kant hoort, nooit dat je hier minder moet inzetten.",
      ],
      faq: [
        {
          q: "Volledige, halve of kwart Kelly?",
          a: "Half of kwart voor bijna iedereen. Volledig is alleen optimaal als je kansschatting exact klopt, en schattingsfouten doen bij te hoge inzet veel meer schade dan ze bij te lage inzet goedmaken. Fractionele Kelly ruilt wat groei voor veel overlevingskans.",
        },
        {
          q: "Wat is verwachte groei per wed?",
          a: "De gemiddelde logaritmische groei van de bankroll voor één wed bij die inzet. Hij is bewust klein — 0,005 komt neer op ongeveer een half procentpunt samengestelde groei per wed — en het is de grootheid die Kelly maximaliseert.",
        },
        {
          q: "En als ik meerdere weds tegelijk heb?",
          a: "Kelly voor één wed zet te veel in als weds tegelijk lopen, vooral bij correlatie. Als praktische regel: verdeel het totaal over de gelijktijdige posities en behandel gecorreleerde weds als één.",
        },
        {
          q: "Waarom staat er nul terwijl ik denk voordeel te hebben?",
          a: "Omdat je kans bij de ingevoerde prijs het break-evenpunt niet haalt. Vergelijk de prijs met 1 gedeeld door je kans: is de prijs lager, dan is er geen voordeel om in te zetten.",
        },
      ],
      caveat:
        "Het Kelly-criterium maximaliseert groei op lange termijn, geen gemoedsrust. Zelfs bij de juiste inzet zijn dalingen van 30% of meer gewoon, en de formule gaat uit van een accurate kansschatting: is die optimistisch, dan zet Kelly systematisch te veel in en kan de bankroll verloren gaan. Zet nooit geld in dat je nodig hebt.",
    },

    "probability-calculator": {
      metaTitle: "Kansberekening voor wedden — odds, break-even en combinaties | BetRedge",
      metaDescription:
        "Gratis kansrekenmachine voor wedden: reken kans en odd naar elkaar om, vind de break-evenkans die een prijs eist en combineer de onderdelen van een combinatie.",
      h1: "Kansrekenmachine",
      lede:
        "Zet kansen om in prijzen en terug, zie wat een prijs van je eist en ontdek wat een combinatie echt waard is.",
      labels: {
        inputTitle: "Kans en prijs",
        modeTitle: "Wat heb je?",
        modeProbability: "Een kans",
        modeOdds: "Een prijs",
        probability: "Kans (%)",
        odds: "Decimale odd",
        breakEven: "Break-evenkans",
        fairOdds: "Eerlijke prijs",
        parlayTitle: "Combinatie",
        leg: "Onderdeel",
        addLeg: "Onderdeel toevoegen",
        removeLeg: "Verwijderen",
        parlayProbability: "Gecombineerde kans",
        parlayOdds: "Gecombineerde odd",
        resultTitle: "Resultaten",
        hint: "Een prijs en zijn break-evenkans zijn hetzelfde getal, van twee kanten gelezen.",
      },
      formulaTitle: "Hoe de kansen worden berekend",
      formula: [
        "odd = 1 / kans",
        "kans = 1 / odd",
        "break-evenkans = 1 / odd",
        "kans van de combinatie = p₁ × p₂ × … × pₙ",
        "odd van de combinatie = odd₁ × odd₂ × … × oddₙ",
      ],
      explainerTitle: "Eerst de kans, dan de prijs",
      explainer: [
        "Elke prijs is een uitspraak over een kans, en de omrekening is één deling: een kans van 40% is een prijs van 2.50, en een prijs van 2.50 is een kans van 40%. Die omrekening vóór het wedden maken verandert de vraag van «vind ik deze wed leuk?» naar «denk ik dat deze uitkomst in meer dan 40% van de gevallen gebeurt?» — een vraag waarin je je kunt vergissen, en dus een vraag die het stellen waard is.",
        "Hetzelfde getal, van de prijskant gelezen, is de break-evenkans: de minimale kans die een uitkomst nodig heeft om de wed neutraal te maken. Een prijs van 1.75 eist 57,1%. Een prijs van 1.50 eist 66,7%. Lange prijzen eisen heel weinig — 15.00 vraagt maar 6,7% — en daarom voelen ze goedkoop en daarom leggen bookmakers daar hun marge. De break-evenkans is de eerlijke test van een wed: kun je niet beargumenteren dat de uitkomst erboven ligt, dan is de prijs niet royaal, maar correct.",
        "Bij combinaties wordt kans tegenintuïtief. Onafhankelijke onderdelen worden vermenigvuldigd: drie weds die je elk op 50% inschat komen samen op 12,5%, niet op iets rustgevend dicht bij de helft. Vier onderdelen op 60% geven 12,96%. De gecombineerde odd vermenigvuldigt net zo, en daar zit de valstrik: een combinatie op 15.00 lijkt een koopje tot je merkt dat hij een gebeurtenis van 6,7% eist, en dat de marge van de bookmaker op elk onderdeel is gelegd en vervolgens is samengesteld. Vier onderdelen met elk 5% marge dragen samen bijna 21% marge.",
        "Eén aanname om te onthouden: deze calculator vermenigvuldigt en gaat dus uit van onafhankelijke onderdelen. Twee uitkomsten uit dezelfde wedstrijd — een ploeg die wint en zijn spits die scoort — zijn gecorreleerd, en de kansen vermenigvuldigen onderschat de echte kans dat beide gebeuren. Combinaties binnen één wedstrijd worden juist daarom apart beprijsd door bookmakers: die correlatie is moeilijk te berekenen. Behandel het getal hier als een ondergrens, niet als een antwoord.",
      ],
      faq: [
        {
          q: "Wat is de break-evenkans?",
          a: "De kans die een uitkomst moet hebben om een wed tegen die prijs op lange termijn neutraal te maken. Hij is 1 gedeeld door de decimale odd, en is de lat waar je eigen schatting over moet om de wed zinvol te maken.",
        },
        {
          q: "Waarom is de kans van mijn combinatie zo laag?",
          a: "Omdat kansen worden vermenigvuldigd. Elk toegevoegd onderdeel maakt het geheel onwaarschijnlijker, en een reeks plausibele onderdelen wordt snel een onwaarschijnlijke wed. De odd stijgt mee, maar de opgetelde marge ook.",
        },
        {
          q: "Werkt dit voor combinaties binnen één wedstrijd?",
          a: "Niet precies. Vermenigvuldigen gaat uit van onafhankelijke onderdelen, en uitkomsten binnen één wedstrijd zijn dat meestal niet. Bij gecorreleerde onderdelen is de echte kans anders — vaak hoger dan het product — en daarom beprijzen bookmakers die markten apart.",
        },
        {
          q: "Is de impliciete kans van een prijs de echte kans?",
          a: "Nee. Hij bevat nog de marge van de bookmaker en ligt dus systematisch boven de eerlijke schatting van de markt. Haal die er met de margecalculator uit voordat je hem met je eigen getal vergelijkt.",
        },
      ],
    },
  },
};

export default nl;
