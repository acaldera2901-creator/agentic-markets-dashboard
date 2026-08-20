// lib/tools/copy/nl.ts (#TOOLS-HUB-0805)
// Nederlands. Lokale zoektermen: "odds omrekenen", "EV calculator",
// "kelly criterium", "bookmakermarge".

import type { ToolsCopy } from "./types";

const nl: ToolsCopy = {
  hub: {
    metaTitle: "Gratis wedtools — odds, EV, Kelly en marge | BetRedge",
    metaDescription:
      "11 gratis rekenmachines: odds omrekenen naar elk formaat, de bookmakermarge verwijderen, verwachte waarde berekenen, je inzet bepalen met Kelly, arbitrage checken en je ROI meten. Zonder account.",
    h1: "Gratis wedtools",
    lede:
      "De elf berekeningen die je voor een wed maakt: odds omgerekend, marge verwijderd, inzet bepaald, ROI gemeten. Gratis, zonder account.",
    cardCta: "Open de tool",
    intro: [
      "Elke wed is een vergelijking tussen een prijs en een kans. Deze elf rekenmachines maken die vergelijking netjes: ze zetten odds om tussen formaten, halen de marge van de bookmaker eruit om de eerlijke lijn te tonen, veranderen een kansschatting in verwachte waarde, rekenen de benen van een combi naar één prijs, laten zien wanneer twee bookmakers genoeg uit elkaar liggen voor arbitrage, bepalen de inzet zodat een verliesreeks je bankroll niet beëindigt en meten daarna wat die weds echt hebben opgebracht.",
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
      takeaway:
        "Elke odd is een vermomde kans. Reken eerst om, discussieer daarna: 2.50 betekent dat de bookmaker je 40% vertelt.",
      example: {
        title: "Eén prijs, elk formaat",
        rows: [
          { label: "Jij typt", value: "2.50" },
          { label: "Amerikaans", value: "+150" },
          { label: "Breuk", value: "3/2" },
          { label: "Hongkong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Impliciete kans", value: "40,00%" },
        ],
        note:
          "Verander er één en de rest volgt. Let op de afronding: de bekende −110 is decimaal 1.9091 en impliceert 52,38%, terwijl een weergegeven 1.91 52,36% impliceert — een verschil dat niets lijkt en meetelt, want voordeel zit in tienden van procenten.",
      },
      explainerTitle: "Een prijs in elk formaat lezen",
      explainer: [
        "**Een odd is een kans in andere kleren.** De decimale odd — de Europese standaard — geeft de totale uitbetaling per ingezette eenheid: 2.50 keert 2.50 uit voor elke geriskeerde 1, inzet inbegrepen. De breukodd geeft de winst: 3/2 is drie eenheden winst per twee geriskeerde, dezelfde 2.50. De Amerikaanse odd zegt hoeveel je wint op 100 (+150) of hoeveel je moet riskeren om 100 te winnen (−110). Hongkong, Malay en Indonesian zijn de Aziatische formaten, en die tellen omdat daar vaak de scherpste prijzen staan.",
        "Het getal dat het lezen waard is, is het laatste. **De impliciete kans is 1 gedeeld door de decimale odd**, en het is het enige cijfer dat je direct met je eigen schatting kunt vergelijken: twee odds in verschillende notaties vergelijken niet makkelijker dan twee kansen. Eén beperking die deze tool niet kan wegnemen: **de impliciete kans bevat nog de marge van de bookmaker**, dus tel alle uitkomsten van een markt op en je komt boven 100%. Wil je de eerlijke mening van de markt in plaats van de beprijsde, haal de markt dan door de margecalculator.",
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
      takeaway:
        "De marge is wat je betaalt voor het recht een mening te hebben. Twee bookmakers, dezelfde wedstrijd, en het verschil is geld.",
      example: {
        title: "Dezelfde wedstrijd bij twee bookmakers",
        rows: [
          { label: "Recreatieve bookmaker", value: "1.90 / 1.90 · marge 5,26%" },
          { label: "Scherpe bookmaker", value: "1.98 / 1.98 · marge 1,01%" },
          { label: "Eerlijke lijn, beide", value: "2.00 / 2.00 · elk 50%" },
          { label: "Jouw EV op een echte 50%", value: "−5% tegen −1% per wed" },
        ],
        note:
          "Zelfde mening, zelfde wedstrijd. 100 inzetten tweehonderd keer kost 1.000 bij de eerste bookmaker en 200 bij de tweede: de acht cent prijsverschil is 800 over een seizoen. Het is het goedkoopste voordeel in wedden, en het vraagt geen enkel model.",
      },
      explainerTitle: "De marge is de prijs van de wed",
      explainer: [
        "**Een eerlijke tweewegmarkt prijst beide kanten op 2.00.** De impliciete kansen zijn 50% en 50%, ze tellen op tot precies 100%, en geen kant heeft voordeel. Echte markten staan op 1.90 en 1.90: die impliciete kansen zijn elk 52,63%, tellen op tot 105,26%, en **de overtollige 5,26 procentpunten zijn de marge van de bookmaker** — de overround. Welke kant je ook speelt, je betaalt hem. Marges verschillen sterk: hoofdlijnen bij scherpe bookmakers duiken onder 2%, terwijl winnaarsmarkten en spelersmarkten routinematig 8% of meer dragen, want daar weten bookmakers hun prijzen het minst getoetst.",
        "De marge verwijderen geeft de eerlijke lijn, de no-vig lijn. Deze calculator doet dat proportioneel — elke impliciete kans gedeeld door hun som, zodat ze weer precies 100% vormen — en **die eerlijke lijn is het referentiepunt van elke +EV-beslissing**: een wed heeft alleen positieve verwachte waarde als jouw kans de eerlijke verslaat, niet enkel de beprijsde. Een openlijke beperking: echte bookmakers leggen meer marge op onwaarschijnlijke uitkomsten, dus bij een duidelijke favoriet onderschat deze methode hem iets. Op evenwichtige lijnen is de vertekening klein; bij loterijachtige winnaarsmarkten is de eerlijke lijn een schatting.",
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
      takeaway:
        "Je hoeft de markt niet te overtreffen — alleen een bookmaker te vinden die langzamer is dan de scherpste.",
      example: {
        title: "De kans lenen van een scherpe bookmaker",
        rows: [
          { label: "Scherpe bookmaker, beide kanten", value: "1.95 / 1.95" },
          { label: "Eerlijke kans, marge weg", value: "50,00%" },
          { label: "Break-evenprijs", value: "2.00" },
          { label: "Jouw bookmaker biedt", value: "2.10" },
          { label: "EV op 100 inzet", value: "+5,00 (+5%)" },
        ],
        note:
          "Er was geen mening nodig: de scherpe lijn leverde de kans, en jouw bookmaker prijsde dezelfde uitkomst op 2.10 waar 2.00 eerlijk was. Zet de scherpe prijzen op 1.90/1.90 en de eerlijke kans blijft 50% — dat is precies het punt van marge verwijderen: het antwoord beweegt niet mee met de vig.",
      },
      explainerTitle: "Wat verwachte waarde echt zegt",
      explainer: [
        "**Verwachte waarde is het gemiddelde resultaat van een wed die je eindeloos zou kunnen herhalen.** Twee invoerwaarden, geen meningen: de geboden prijs en de kans die je de uitkomst geeft. Denk je dat een ploeg 55% van de tijd wint en biedt iemand 2.00, dan is de rekensom direct — 55% van de tijd win je een eenheid, 45% verlies je hem, dus 0,10 eenheid per ingezette eenheid. Dat is 10% voordeel, en meer betekent +EV niet.",
        "**De kans is waar bijna iedereen stil verliest.** Een fout van 5 punten maakt van 4% voordeel 1% verlies, en schattingen op het oog zitten er veel verder naast. Vandaar de tweede modus van deze calculator: vertrouw niet op je gevoel, maar neem beide kanten bij een scherpe bookmaker, haal de marge eruit en gebruik de eerlijke kans die eruit komt. Lees het resultaat als een percentage, niet als een belofte — 4% voordeel levert bij één wed niets op, het verschijnt pas over honderden, en alleen als de kans klopte. Daarom telt de inzetgrootte even zwaar als het voordeel.",
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
      takeaway:
        "Kelly bepaalt de inzet op het voordeel, niet op je overtuiging — en bijna iedereen zou bewust minder moeten inzetten dan hij zegt.",
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
        "Het Kelly-criterium antwoordt op wat verwachte waarde overslaat: hoeveel moet je met een gegeven voordeel echt riskeren? Zet te weinig in en een echt voordeel groeit te langzaam om iets te betekenen. Zet te veel in en de rekenkunde keert zich tegen je: een bankroll die halveert heeft +100% nodig om terug te komen, dus te grote inzetten vernietigen de groei zelfs als elke afzonderlijke wed gunstig is. De optimale fractie is het voordeel gedeeld door de netto-odd, en **die schaalt met het voordeel, niet met overtuiging**: 10% voordeel bij 2.00 vraagt 10% van de bankroll, hetzelfde voordeel bij 5.00 maar 2,5%.",
        "**Bijna niemand zou volledige Kelly moeten spelen**, want de formule gaat ervan uit dat je kans exact klopt en dat doet hij nooit. Geef hem een overschat voordeel en hij beveelt vrolijk een inzet aan die te groot is voor het voordeel dat je werkelijk hebt: de snelste manier om een bankroll te verliezen terwijl je gemiddeld gelijk hebt. Halve Kelly geeft een kwart van de theoretische groei op en halveert de volatiliteit ongeveer; kwart Kelly is wat veel professionals met echte modellen gebruiken. En biedt de prijs geen voordeel, dan is de juiste inzet nul: een negatieve Kelly-fractie betekent dat de wed aan de andere kant hoort, nooit dat je hier minder moet inzetten.",
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
      takeaway:
        "Onderdelen worden vermenigvuldigd, en de marge van de bookmaker met ze mee. Een viervoudige op 1.80 vraagt een gebeurtenis van 9,5%.",
      example: {
        title: "Wat een viervoudige combinatie echt kost",
        rows: [
          { label: "Vier onderdelen op", value: "elk 1.80 · 55,56%" },
          { label: "Gecombineerde odd", value: "10.50" },
          { label: "Gecombineerde kans", value: "9,53%" },
          { label: "Marge per onderdeel", value: "5%" },
          { label: "Marge op de combinatie", value: "21,6%" },
        ],
        note:
          "De odd lijkt royaal tot je ziet wat hij eist: een gebeurtenis van 9,5%. En de marge van de bookmaker is vier keer samengesteld — 1,05⁴ − 1 = 21,6% — dus dezelfde vier selecties kosten je vier keer de marge van één wed. Gecorreleerde onderdelen uit één wedstrijd zijn een ander verhaal: vermenigvuldigen onderschat ze, en juist daarom prijzen bookmakers combinaties binnen één wedstrijd apart.",
      },
      explainerTitle: "Eerst de kans, dan de prijs",
      explainer: [
        "**Elke prijs is een uitspraak over een kans**, en de omrekening is één deling: 40% is een prijs van 2.50, en 2.50 is een kans van 40%. Die omrekening vóór het wedden verandert de vraag van «vind ik deze wed leuk?» naar «gebeurt dit in meer dan 40% van de gevallen?» — een vraag waarin je je kunt vergissen. Van de prijskant gelezen is hetzelfde getal de **break-evenkans**: de minimale kans die een uitkomst nodig heeft om de wed neutraal te maken. 1.75 eist 57,1%; 1.50 eist 66,7%; 15.00 vraagt maar 6,7%, en daarom voelen lange prijzen goedkoop en leggen bookmakers daar hun marge.",
        "**Bij combinaties wordt kans tegenintuïtief.** Onafhankelijke onderdelen worden vermenigvuldigd: drie weds die je elk op 50% inschat komen samen op 12,5%, niet op iets rustgevend dicht bij de helft. Vier onderdelen op 60% geven 12,96%. De gecombineerde odd vermenigvuldigt net zo, en daar zit de valstrik — het getal wordt groot terwijl de kans klein wordt, en de marge groeit mee. Hou de aanname vast: hier wordt vermenigvuldigd, dus onafhankelijkheid aangenomen. Twee uitkomsten uit dezelfde wedstrijd zijn gecorreleerd, en daar is de echte kans anders, meestal hoger dan het product.",
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

    "arbitrage-calculator": {
      metaTitle: "Arbitrage-calculator — een inzet over bookmakers verdelen | BetRedge",
      metaDescription:
        "Gratis arbitrage-calculator: geef per uitkomst de beste quotering bij verschillende bookmakers en zie de som van de impliciete kansen, de verdeling van de inzet en de winst — of dat die ontbreekt.",
      h1: "Arbitrage-calculator",
      lede:
        "Voer de beste beschikbare quotering per uitkomst in en zie of twee bookmakers samen marge overlaten — en hoe je de inzet dan verdeelt.",
      labels: {
        inputTitle: "Beste quotering per uitkomst",
        outcome: "Uitkomst",
        addOutcome: "Uitkomst toevoegen",
        removeOutcome: "Verwijderen",
        total: "Totale inzet",
        resultTitle: "Hoe je verdeelt",
        profit: "Winst",
        impliedSum: "Som van de impliciete kansen",
        stakeOn: "Inzet op uitkomst",
        guaranteedReturn: "Opbrengst bij elke uitkomst",
        verdictArb:
          "De quoteringen tellen op tot minder dan 100%: zo verdeeld betaalt elke uitkomst hetzelfde terug.",
        verdictNoArb:
          "De quoteringen tellen op tot meer dan 100%, dus hier is geen arbitrage — elke verdeling verliest die marge, welke uitkomst er ook valt.",
        hint: "Eén quotering per uitkomst, elk bij de bookmaker die op die kant het meest betaalt. Decimaal accepteert een komma: 2,10 werkt als 2.10.",
      },
      takeaway:
        "Arbitrage is geen voorspelling. Het vraagt nooit of je gelijk hebt over de winnaar — het vraagt of twee bookmakers verder uiteenlopen dan hun eigen marges.",
      example: {
        title: "Twee bookmakers, 1.000 te verdelen",
        rows: [
          { label: "Quoteringen, één bookmaker per kant", value: "2.10 · 2.10" },
          { label: "Som van de impliciete kansen", value: "95,24%" },
          { label: "Inzet per kant, van 1.000", value: "500 · 500" },
          { label: "Opbrengst bij elke uitkomst", value: "1.050" },
          { label: "Winst", value: "+50 (+5,00%)" },
        ],
        note:
          "Dezelfde markt op 1.90/1.90 binnen één bookmaker telt op tot 105,26% en geeft −5,00% terug, hoe je ook verdeelt. Aan de wedstrijd is tussen de twee lijnen niets veranderd: het hele verschil zit in welke bookmaker op welke kant meer betaalt, en of je bij beide een gevulde rekening had toen de quoteringen er nog stonden.",
      },
      explainerTitle: "Wanneer twee bookmakers genoeg uiteenlopen",
      explainer: [
        "**Tel één gedeeld door elke quotering op en je hebt de hele markt in één getal.** Binnen één bookmaker komt dat getal altijd boven 100% uit — de marge houdt het daar. Maar de beste quotering op de ene kant en de beste op de andere staan vaak bij verschillende bookmakers, en gecombineerd kan de som onder 100% zakken. Dat is de hele voorwaarde: **de impliciete kansen moeten samen onder 1 blijven**. Verdeel de totale inzet naar verhouding van die impliciete kansen en elke uitkomst betaalt hetzelfde terug, waardoor wat je terugkrijgt niet langer van de uitslag afhangt. Twee quoteringen van 2.10 tellen op tot 95,24%, en 500 op elke kant van een inzet van 1.000 levert 1.050 op, hoe de wedstrijd ook eindigt.",
        "**In de praktijk sluit dit veel minder vaak dan de rekensom suggereert, en de redenen wegen zwaarder dan de formule.** Quoteringen bewegen: het gat dat je zag is meestal de langzamere bookmaker die bijtrekt, en het kan verdwijnen in de seconden tussen de eerste en de tweede poot — dan houd je een gewone, ongedekte wedde over tegen een quotering die je koos om te dekken en niet om haar waarde. Inzetlimieten knijpen precies daar het hardst waar het gat het breedst is: 5% op papier is vaak 5% op veertig eenheden en niet op duizend. En **bookmakers beperken rekeningen die dit systematisch doen** — eerst lagere limieten, later geweigerde weddenschappen en sluitingen. Tel het kapitaal dat bij meerdere bookmakers vastligt en het koersverschil tussen valuta's erbij op, en arbitrage leest minder als een machine en meer als een langzame, operationeel zware manier om een dunne marge af te schrapen.",
      ],
      faq: [
        {
          q: "Heb ik bij elke bookmaker een rekening nodig?",
          a: "Ja. Een arbitrage bestaat alleen tussen de specifieke bookmakers die die specifieke quoteringen aanbieden, dus je hebt bij elk van hen een gevulde rekening nodig voordat de quoteringen bewegen. Dat kapitaal, verspreid over meerdere aanbieders en het grootste deel van de tijd stil, is de kostenpost die vrijwel geen calculator laat zien.",
        },
        {
          q: "Wat als de tweede quotering beweegt voordat ik hem speel?",
          a: "Dan houd je de eerste poot alleen over: een gewone wedde, tegen een quotering die je koos om te dekken en niet om haar waarde. Zet de kant die het meest waarschijnlijk beweegt als eerste, en behandel ongedekt achterblijven als onderdeel van het risico, niet als een ongeluk.",
        },
        {
          q: "Waarom beperken bookmakers arbitrage-spelers?",
          a: "Omdat hun marge leeft van evenwichtige inzet van recreatieve klanten, en een rekening die altijd alleen de beste quotering op één kant pakt is voor hen pure kostenpost. Beperkingen komen stil binnen als lagere inzetlimieten, lang voordat een rekening wordt gesloten.",
        },
        {
          q: "Is arbitrage-wedden legaal?",
          a: "De activiteit zelf is legaal: je plaatst gewone weddenschappen tegen gepubliceerde quoteringen. Wat het kan verbieden zijn de voorwaarden van de bookmaker, die zich doorgaans het recht voorbehouden weddenschappen te beperken, te weigeren of te vernietigen die zij als arbitrage aanmerken. Legaal en toegestaan zijn niet hetzelfde.",
        },
      ],
    },

    "parlay-calculator": {
      metaTitle: "Combinatiewedden-calculator — gecombineerde odd, echte kans en samengestelde marge | BetRedge",
      metaDescription:
        "Gratis combi-calculator: vul elk onderdeel in en zie de gecombineerde odd, de kans die de combinatie werkelijk vraagt en hoe de marge van de bookmaker zich opbouwt.",
      h1: "Combinatiewedden-calculator",
      lede:
        "Elk onderdeel dat je toevoegt vermenigvuldigt de odd — en vermenigvuldigt het deel dat de bookmaker houdt mee. Hier staan beide getallen, voor je inzet.",
      labels: {
        inputTitle: "De onderdelen",
        leg: "Onderdeel",
        addLeg: "Onderdeel toevoegen",
        removeLeg: "Verwijderen",
        marginPerLeg: "Marge van de bookmaker per onderdeel (%)",
        resultTitle: "Wat de combinatie waard is",
        combinedOdds: "Gecombineerde odd",
        impliedProb: "Kans dat hij binnenkomt",
        compoundMargin: "Samengestelde marge",
        verdict:
          "Vermenigvuldigen veronderstelt onafhankelijke onderdelen. Twee selecties uit dezelfde wedstrijd zijn dat niet: hun echte kans is meestal hoger dan het product, en daarom prijzen bookmakers combinaties binnen één wedstrijd met een eigen model.",
        hint: "Eén decimale odd per onderdeel, tot acht. De marge per onderdeel vul je als getal in: 5 betekent 5%, ongeveer wat een scherpe tweewegmarkt houdt.",
      },
      takeaway:
        "Het deel dat de bookmaker houdt telt niet op over de onderdelen, het stapelt zich — vier onderdelen op 1.80 lijken vier bijna gelijke weddenschappen en zijn één gebeurtenis van 9,53%.",
      example: {
        title: "Vier onderdelen op 1.80, één wed van 9,53%",
        rows: [
          { label: "Onderdelen", value: "4 × 1.80" },
          { label: "Gecombineerde odd", value: "10.50" },
          { label: "Kans dat hij binnenkomt", value: "9,53%" },
          { label: "Marge per onderdeel", value: "5%" },
          { label: "Samengestelde marge", value: "21,55%" },
        ],
        note:
          "Los bekeken is elk onderdeel de wed waar niemand bij stilstaat: 55,56% impliciet, 1.80 bij winst. Aan elkaar geregen vragen de vier een gebeurtenis van 9,53% — en de 5% die de bookmaker per onderdeel houdt wordt 1,05⁴ − 1 = 21,55% op de combinatie. Er is niets aan de wed toegevoegd behalve meer manieren om hem te verliezen: de odd ging omhoog omdat de kans omlaag ging.",
      },
      explainerTitle: "Waarom de odd sneller groeit dan de kans",
      explainer: [
        "**Een combinatie is één wed met meerdere manieren om te verliezen, niet meerdere weddenschappen.** De gecombineerde odd is het product van de onderdelen — 1.80 vier keer genomen is 10.4976 — en de kans is het product van de kansen, en daar houdt de rekenkunde op vriendelijk te zijn: vier selecties die je elk bijna gelijk zou noemen komen samen op 9,53%. De marge doet precies hetzelfde, en dat is het deel dat bijna niemand meerekent. Hij telt niet op per onderdeel, hij **stapelt zich**: een bookmaker die op elk van vier onderdelen 5% houdt, houdt 1,05⁴ − 1 = 21,55% op de combinatie, en bij acht onderdelen is diezelfde 5% per onderdeel 47,75% geworden. De uitbetaling lijkt royaal omdat de kans instortte, niet omdat iemand meer betaalt voor hetzelfde risico.",
        "**Combinaties zijn het meest gepromote product in wedden en het minst gunstige voor de klant**, en dat is hetzelfde feit van twee kanten: hoe groter de samengestelde marge, hoe meer een bookmaker zich kan permitteren om die bon te boosten, te verzekeren en te adverteren. Een dun voordeel op één onderdeel overleeft de vermenigvuldiging met drie extra onderdelen marge niet — dezelfde selecties als enkelvoudige weddenschappen betalen de marge elk één keer, de viervoudige betaalt hem vier keer. Dan is er nog wat het vermenigvuldigen veronderstelt: **dat de onderdelen onafhankelijk zijn**. Twee selecties uit dezelfde wedstrijd zijn gecorreleerd, dus vermenigvuldigen is daar de verkeerde som: een thuiszege en een doelpunt van diezelfde spits komen vaak samen, waardoor het paar waarschijnlijker is dan het product zegt, terwijl onderdelen die elkaar bijna uitsluiten veel minder waard zijn. Daarom bouwen bookmakers combinaties binnen één wedstrijd met een eigen model in plaats van je ze uit de enkelvoudige odds te laten samenstellen — en daarom is deze calculator eerlijk bij onderdelen uit verschillende wedstrijden.",
      ],
      faq: [
        {
          q: "Werkt dit ook voor combinaties binnen één wedstrijd?",
          a: "Niet precies. Hier wordt vermenigvuldigd, en vermenigvuldigen veronderstelt onafhankelijke onderdelen. Uitkomsten binnen één wedstrijd bewegen samen, dus de echte kans van het paar is anders — vaak hoger dan het product — en juist daarom prijzen bookmakers die markten met een eigen model en niet vanuit de enkelvoudige odds.",
        },
        {
          q: "Waarom is de gecombineerde kans zo laag?",
          a: "Omdat kansen vermenigvuldigen in plaats van gemiddeld worden. Vier onderdelen op 55,56% komen op 9,53%: elk onderdeel dat je toevoegt maakt de hele wed onwaarschijnlijker, dus een reeks plausibele selecties wordt snel een onwaarschijnlijke wed. De odd stijgt mee, en met de odd stijgt de opgebouwde marge.",
        },
        {
          q: "Wat is de samengestelde marge precies?",
          a: "Het deel van de bookmaker nadat elk onderdeel het vermenigvuldigd heeft. Vul in wat één onderdeel je kost — rond 5% op een scherpe tweewegmarkt — en de calculator stapelt het: één plus de marge, tot de macht van het aantal onderdelen, min één. Vier onderdelen op 5% kosten 21,55%, acht onderdelen 47,75%.",
        },
        {
          q: "Zijn vier enkelvoudige weddenschappen beter dan een viervoudige?",
          a: "Voor wie op een voordeel wedt wel: dezelfde vier selecties los betalen de marge elk één keer in plaats van hem te vermenigvuldigen, en één fout onderdeel kost één wed in plaats van de hele bon. Een combinatie koopt variantie — een kleine kans op een grote uitbetaling — en de prijs daarvan is de samengestelde marge.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "ROI-calculator voor wedden — rendement op je bankroll | BetRedge",
      metaDescription:
        "Gratis ROI-calculator voor wedden: vul kapitaal en winst in en zie het rendement op je bankroll, het eindkapitaal en waarom dezelfde winst een yield van 4% is.",
      h1: "ROI-calculator",
      lede:
        "Wat de bankroll over een periode opbracht — en waarom dezelfde 400 winst hier 40% ROI is en op de andere pagina 4% yield.",
      labels: {
        inputTitle: "Kapitaal en resultaat",
        capital: "Kapitaal",
        profit: "Winst",
        resultTitle: "Rendement op dat kapitaal",
        roi: "ROI",
        endingCapital: "Kapitaal daarna",
        hint: "De winst gaat er netto in en mag negatief zijn: -250 is een verliesperiode. Kapitaal is de bankroll die je in risico zette, niet het totaal dat je inzette.",
        verdict:
          "De ROI hangt volledig van de noemer af, dus benoem hem: 400 op een bankroll van 1.000 is 40%, dezelfde 400 op 10.000 ingezet is 4% yield. Geen van beide cijfers zegt veel zonder de periode en het aantal weddenschappen erachter.",
      },
      takeaway:
        "De ROI zegt wat de bankroll opbracht. Hij zegt niet of de strategie goed is, want dezelfde 40% kan uit 200 weddenschappen komen of uit één gelukkige zaterdag.",
      example: {
        title: "400 winst op een bankroll van 1.000",
        rows: [
          { label: "Kapitaal", value: "1.000" },
          { label: "Winst over de periode", value: "+400" },
          { label: "ROI", value: "+40,00%" },
          { label: "Kapitaal daarna", value: "1.400" },
          { label: "Dezelfde 400 op 10.000 ingezet", value: "yield +4,00%" },
        ],
        note:
          "Beide percentages beschrijven één identiek resultaat. Die +40,00% op de bankroll kostte 200 weddenschappen van 50 — 10.000 omzet, tien keer het kapitaal — en 4,00% van die omzet is diezelfde 400. Draai de bankroll twee keer om in plaats van tien keer en de yield achter 40% ROI zou 20% moeten zijn, wat bijna niemand volhoudt.",
      },
      explainerTitle: "Winst gemeten tegen het geld in risico",
      explainer: [
        "**ROI is winst gedeeld door het geld dat je in risico zette**, en alle moeilijkheid zit in de tweede helft van die zin. Een bankroll van 1.000 die een seizoen 400 hoger afsluit heeft 40,00% opgebracht, en dat cijfer valt eerlijk te vergelijken met alles wat je anders met diezelfde 1.000 had gedaan. Wat het niet kan beschrijven zijn de weddenschappen. Een rendement van 40% zegt niets over hoeveel weddenschappen ervoor nodig waren, over hoeveel tijd, of hoe dicht het saldo onderweg bij nul kwam — en dat zijn precies de drie dingen die bepalen of het opnieuw gebeurt. Dus **benoem de noemer voordat je het cijfer noemt**: startbankroll, gemiddeld saldo en totaal gestort geven drie verschillende percentages uit één identieke reeks weddenschappen, en het vleiendste is altijd het kleinste.",
        "**Dezelfde 400 winst is tegelijk 40% ROI en 4% yield**, en weten welke van de twee je in handen hebt is bijna de hele waarde van beide pagina's. ROI meet tegen kapitaal, yield tegen omzet — de som van elke geplaatste inzet. Ons voorbeeld kwam daar met 200 weddenschappen van 50, dus er ging 10.000 door de bankroll: tien keer het kapitaal, en 4,00% daarvan is precies die 400. **Die vermenigvuldiger is de hele brug tussen de twee cijfers**, en daarom vleit ROI op zichzelf wie veel speelt. Wie een bankroll van 1.000 tien keer omdraait met 4% yield en wie hem twee keer omdraait met 20% yield rapporteren beiden 40%, en maar één daarvan is herhaalbaar. De kwaliteit per weddenschap meet je met de yield-calculator; houd ROI voor waar hij echt goed in is: vergelijken wat dat geld opbracht tegenover de alternatieven.",
      ],
      faq: [
        {
          q: "Wat is het verschil tussen ROI en yield?",
          a: "ROI deelt de winst door het kapitaal, yield deelt hem door de omzet — de som van alle inzetten. Dezelfde 400 winst is 40,00% van een bankroll van 1.000 en 4,00% van 10.000 ingezet. ROI zegt wat het geld opbracht, yield hoe goed de weddenschappen waren, en de verhouding tussen beide is hoe vaak je de bankroll hebt omgedraaid.",
        },
        {
          q: "Welk kapitaal hoort in de noemer?",
          a: "Het kapitaal dat je kunt benoemen en daarna vasthouden — meestal de startbankroll. Hoogste saldo, gemiddeld saldo en totaal gestort leveren uit dezelfde weddenschappen verschillende percentages op, dus het cijfer betekent alleen iets naast zijn definitie. Halverwege de periode bijstorten zonder de noemer opnieuw te benoemen is de gewoonste manier om een ROI op te blazen.",
        },
        {
          q: "Is 40% ROI goed?",
          a: "Dat hangt van de periode en het aantal weddenschappen af. Over een seizoen met 200 weddenschappen is het een sterk maar plausibel resultaat. Dezelfde 40% over twintig weddenschappen valt ruim binnen wat het toeval zelf produceert, en 40% in een week betekent meestal dat de inzetten groot waren ten opzichte van de bankroll, niet dat de edge groot was.",
        },
        {
          q: "Kan de ROI negatief zijn?",
          a: "Ja, en de calculator laat het zien in plaats van het te verbergen: 250 verlies op een bankroll van 1.000 is -25,00%. Herstel is niet symmetrisch — na -25% heb je +33,33% nodig op wat er over is om weer op nul te komen — en daarom verdient de drawdown net zoveel aandacht als het rendement.",
        },
      ],
    },
    "yield-calculator": {
      metaTitle: "Yield-calculator voor wedden — winst per ingezette euro | BetRedge",
      metaDescription:
        "Gratis yield-calculator: vul aantal weddenschappen, gemiddelde inzet en winst in voor omzet en yield — en hoeveel weddenschappen nodig zijn voordat het cijfer iets zegt.",
      h1: "Yield-calculator",
      lede:
        "Winst gemeten tegen alles wat je hebt ingezet, niet tegen je bankroll — het enige cijfer dat twee spelers met verschillend geld vergelijkt.",
      labels: {
        inputTitle: "Weddenschappen, inzet en resultaat",
        bets: "Aantal weddenschappen",
        avgStake: "Gemiddelde inzet",
        profit: "Winst",
        resultTitle: "Yield op de omzet",
        turnover: "Omzet",
        yieldPercent: "Yield",
        hint: "De omzet rekenen wij uit: weddenschappen × gemiddelde inzet. Tel de inzet van elke weddenschap, niet het geld dat op één moment in risico stond. De winst gaat er netto in en mag negatief zijn.",
        verdictNoise:
          "Onder duizend weddenschappen is dit cijfer vooral ruis. Bij vlakke inzetten op 2.00 is één standaardafwijking van de yield 7,07 punten over 200 weddenschappen en nog 3,16 over 1.000: lees het als een bandbreedte, niet als een resultaat.",
        verdictVolume:
          "Voorbij duizend weddenschappen begint het cijfer informatie te dragen, maar één standaardafwijking is op 2.00 nog altijd ongeveer 3,16 punten — een +4% en een +7% over hetzelfde volume zijn geen twee niveaus van kunnen.",
      },
      takeaway:
        "Yield is het cijfer dat spelers vergelijkt: 4% op 10.000 omzet is meer waard dan 40% ROI verzameld over twintig weddenschappen.",
      example: {
        title: "200 weddenschappen van 50, 400 winst",
        rows: [
          { label: "Aantal weddenschappen", value: "200" },
          { label: "Gemiddelde inzet", value: "50" },
          { label: "Omzet", value: "10.000" },
          { label: "Winst", value: "+400" },
          { label: "Yield", value: "+4,00%" },
          { label: "Dezelfde 400 op een bankroll van 1.000", value: "ROI +40,00%" },
        ],
        note:
          "Één resultaat, twee even eerlijke percentages: 4,00% van de 10.000 die door de bookmaker gingen, 40,00% van de 1.000 die ooit in risico stond. Het verschil tussen beide is niets anders dan de tien keer dat de bankroll werd omgedraaid. En de steekproef weegt zwaarder dan beide cijfers: bij 200 weddenschappen is één standaardafwijking van de yield 7,07 punten, dus deze +4,00% valt binnen wat een reeks muntworpen zelf voortbrengt.",
      },
      explainerTitle: "Het cijfer dat twee spelers vergelijkt",
      explainer: [
        "**Yield is winst gedeeld door omzet** — het totaal van elke geplaatste inzet, niet het saldo op de rekening. Het is het cijfer dat spelers elkaar noemen juist omdat het niet afhangt van hoeveel geld ze hebben: 4% is 4%, of de inzetten 5 of 500 zijn. **Het getal dat iedereen verkeerd invult is de noemer**, en de fout gaat altijd dezelfde kant op. Omzet telt de inzet van elke weddenschap op het moment dat je hem plaatst, dus 200 weddenschappen van 50 is 10.000, ook als er nooit meer dan 50 tegelijk in risico stond, en de bankroll van 1.000 waar die weddenschappen door heen gingen is niet het getal om door te delen. Daarom vraagt deze pagina om het aantal en de gemiddelde inzet en rekent de omzet voor je uit. Meet dezelfde winst tegen het kapitaal en je hebt de ROI: de ROI-calculator houdt de andere helft van de vergelijking, waar 400 winst 40,00% van een bankroll van 1.000 is en 4,00% van 10.000 ingezet.",
        "**Een yield boven ongeveer 5%, volgehouden over serieus volume, is zeldzaam.** Waar hij bestaat, leeft hij in zachte markten met lage limieten, en hij krimpt zodra de inzetten groeien, omdat de odds die hem mogelijk maakten niet overleven als je er hard op speelt. Elk langetermijncijfer daar ruim boven behandel je als een korte steekproef, een zachte niche of een andere definitie van omzet. En **onder een paar honderd weddenschappen is het getal ruis, geen resultaat**: bij vlakke inzetten op 2.00 is één standaardafwijking van de yield één gedeeld door de wortel van het aantal weddenschappen — 7,07 punten over 200, 3,16 over 1.000, 2,00 over 2.500. Een +4% yield bereikt pas rond 2.500 weddenschappen twee standaardafwijkingen boven nul. Bij hogere odds zwaait het verder uit: op 3.00 dragen dezelfde 200 weddenschappen een standaardafwijking van 10 punten. En dat is de eerlijke lezing van twintig gewonnen weddenschappen: geen gemeten edge, alleen een te korte steekproef.",
      ],
      faq: [
        {
          q: "Hoe bereken ik mijn omzet?",
          a: "Door de inzet van elke geplaatste weddenschap op te tellen, gewonnen of verloren. 200 weddenschappen van 50 is 10.000 omzet, ook als de bankroll erachter maar 1.000 was. Gebruik niet het netto bedrag en niet het saldo: omzet is het geld dat door de bookmaker ging, één keer per weddenschap geteld.",
        },
        {
          q: "Is 5% yield goed?",
          a: "Volgehouden over duizenden weddenschappen wel — het zit rond de bovengrens van wat echte limieten overleeft. Veel hogere yields komen meestal uit zachte markten, een korte steekproef of promotiewaarde, en ze dalen als de inzetten stijgen, omdat de odds die ze opleverden worden weggenomen of gelimiteerd.",
        },
        {
          q: "Hoeveel weddenschappen voordat mijn yield iets betekent?",
          a: "Meer dan de meesten aannemen. Bij vlakke inzetten op 2.00 is één standaardafwijking van de yield 7,07 punten over 200 weddenschappen, 3,16 over 1.000 en 2,00 over 2.500, dus een +4% haalt pas rond 2.500 weddenschappen twee standaardafwijkingen boven nul. Onder een paar honderd is het een bandbreedte.",
        },
        {
          q: "En als mijn inzetten sterk verschillen?",
          a: "Dan is weddenschappen × gemiddelde inzet slechts een benadering, en hij vleit je als de winnaars op de grote inzetten vielen. Tel de werkelijke inzetten op en deel de winst door dat totaal. Speel je in units, tel dan units: de yield per ingezette unit is hetzelfde cijfer en blijft makkelijker eerlijk.",
        },
      ],
    },
    "stake-calculator": {
      metaTitle: "Inzet-calculator — de inzet voor een doelwinst | BetRedge",
      metaDescription:
        "Gratis inzet-calculator: vul de odd en de winst die je wil in en zie de benodigde inzet, de totale uitbetaling en welk deel van je bankroll die ene wed vastlegt.",
      h1: "Inzet-calculator",
      lede:
        "De inzet die een doelwinst bij een bepaalde prijs vraagt — en het deel van je bankroll dat hij stil vastlegt.",
      labels: {
        inputTitle: "Prijs en doel",
        odds: "Prijs",
        targetProfit: "Doelwinst",
        bankroll: "Bankroll",
        resultTitle: "Wat dat doel kost",
        stakeNeeded: "Benodigde inzet",
        totalReturn: "Totale uitbetaling",
        bankrollShare: "Deel van de bankroll",
        hint: "De bankroll maakt van de inzet pas een percentage: zonder hem is de inzet een getal zonder iets ernaast. De prijs gaat in decimaal — 2.50, niet +150.",
        verdictModest:
          "Deze inzet legt minder dan 5% van de opgegeven bankroll vast, en een reeks van tien verliezen zou hem niet beëindigen. Lees hem naast de prijs, niet alleen: hetzelfde doel bij een kortere prijs vraagt een veel grotere wed.",
        verdictHeavy:
          "Deze inzet legt meer dan 5% van de opgegeven bankroll vast op één uitkomst. Op die maat neemt een reeks van tien verliezen — gewoon bij prijzen rond 2.00 — er meer dan de helft van, dus toets het getal in de bankroll-calculator voordat je inzet.",
      },
      takeaway:
        "Beginnen bij de winst die je wil is de snelste manier om te veel in te zetten: de nuttige vraag is niet hoeveel ik wil winnen, maar hoeveel ik me kan veroorloven te verliezen.",
      example: {
        title: "100 winst willen bij 2.50",
        rows: [
          { label: "Prijs", value: "2.50" },
          { label: "Doelwinst", value: "100" },
          { label: "Benodigde inzet", value: "66,67" },
          { label: "Totale uitbetaling", value: "166,67" },
          { label: "Deel van een bankroll van 1.000", value: "6,67%" },
        ],
        note:
          "Dezelfde 100 kost 25,00 bij 5.00 en 400,00 bij 1.25 — het doel bewoog niet, de prijs wel. En 66,67 op een bankroll van 1.000 is precies de volledige Kelly voor iemand die de uitkomst op 44% zet, terwijl 2.50 quitte speelt bij 40%. De wens bevat dus al een kansschatting met een voordeel van +10%, alleen niet uitgesproken.",
      },
      explainerTitle: "Terugrekenen vanaf een getal dat je zelf koos",
      explainer: [
        "De rekensom is de makkelijke helft. Een wed geeft de inzet terug plus inzet × (prijs − 1), dus **de inzet die een doel vraagt is het doel gedeeld door de prijs min één** — 100 bij 2.50 vraagt 66,67, en het bonnetje komt terug als 166,67. Wat deze pagina waard maakt is het tweede effect: **hoe korter de prijs, hoe groter de wed die dezelfde wens vereist**. Die 100 kost 25,00 bij 5.00, 66,67 bij 2.50, 100,00 bij 2.00 en 400,00 bij 1.25. Tussen die vier regels veranderde je mening niets, en het geld in risico bewoog met een factor zestien. Daarom vraagt de calculator om een bankroll die hij strikt niet nodig heeft: 66,67 is niet groot of klein tot je weet dat het 6,67% is van alles wat je hebt weggezet.",
        "**Denken vanuit de winst die je wil is de kortste route naar een te grote inzet**, en het gaat op een specifieke manier mis. Verlies de eerste en het doel groeit stil mee om hem te dekken: opnieuw 100 willen nadat je 66,67 hebt laten liggen betekent 166,67 vragen, wat bij 2.00 een inzet van 166,67 kost, en valt die ook dan is de volgende vraag 476,19 bij 1.70. Drie wedden later staat 709,52 van een bankroll van 1.000 op het spel om de oorspronkelijke 100 te winnen, en de prijs werd elke keer korter omdat korte prijzen veiliger voelen. **De wed wordt groter precies wanneer de reden ervoor zwakker wordt.** De eerlijke versie van deze rekensom loopt de andere kant op, van wat je kan verliezen naar wat je kan inzetten, en dat is de Kelly-criterium calculator: daar komt de maat uit een gemeten voordeel, niet uit een getal dat je koos. Ons getal is ook geen toeval — 66,67 op 1.000 is exact wat de volledige Kelly bij 2.50 aanraadt aan iemand die 44% gelooft, tegen de 40% die de prijs impliceert. Zou je die 44% niet verdedigen, dan ging de inzet nooit over de wed.",
      ],
      faq: [
        {
          q: "Hoe bereken je de inzet voor een doelwinst?",
          a: "Deel de gewenste winst door de prijs min één. Bij 2.50 is de netto opbrengst per ingezette eenheid 1,50, dus 100 winst vraagt 100 / 1,50 = 66,67 inzet en betaalt 166,67 in totaal. Bij 2.00 is de netto opbrengst 1,00, en daarom zijn inzet en doel daar hetzelfde getal.",
        },
        {
          q: "Waarom vraagt de calculator mijn bankroll?",
          a: "Omdat de inzet alleen niets zegt. 66,67 is voor de een een afrondingsfout en voor de ander een derde van de rekening, en wat dat beslist is het deel van de bankroll — hier 6,67%. Laat het veld leeg en de inzet werkt nog steeds; het percentage wordt een streepje, en dat is eerlijk, want die aanname is de jouwe en niet de onze.",
        },
        {
          q: "Deze of het Kelly-criterium?",
          a: "Deze om een wens een prijs te geven, Kelly om een wed te dimensioneren. Deze pagina begint bij een getal dat je koos en rekent uit wat het kost; de Kelly-criterium calculator begint bij een gemeten voordeel en rekent uit wat de bankroll kan dragen. Spreken ze elkaar tegen, laat dan degene vallen die je kansschatting nooit heeft gevraagd.",
        },
        {
          q: "Is een verlies najagen met een grotere inzet ooit juist?",
          a: "Niet met deze rekensom. Elke herstelvraag is groter dan de vorige, en ze wordt meestal bij een kortere prijs geplaatst omdat korte prijzen veiliger voelen, dus de inzet groeit terwijl het voordeel krimpt. Bankroll-regels bestaan om de volgende inzet los te koppelen van het laatste resultaat: zet de eenheid vast als percentage van de bankroll en de reeks kan niet ontsporen.",
        },
      ],
    },
    "bankroll-calculator": {
      metaTitle: "Bankroll-calculator — eenheid, drawdown en verliezen tot ruïne | BetRedge",
      metaDescription:
        "Gratis bankroll-calculator: stel bankroll en eenheid in en zie de inzet per wed, wat een verliesreeks kost, de drawdown die hij achterlaat en hoeveel verliezen je dekt.",
      h1: "Bankroll-calculator",
      lede:
        "Wat een procentuele eenheid echt vastlegt: de inzet per wed, de kosten van een verliesreeks en hoeveel verliezen op rij de bankroll overleeft.",
      labels: {
        inputTitle: "Bankroll en regel",
        bankroll: "Bankroll",
        unitPercent: "Eenheid (%)",
        losingStreak: "Verliesreeks",
        resultTitle: "Wat de regel kost",
        unit: "Inzet per wed",
        streakLoss: "Kosten van de reeks",
        drawdown: "Drawdown",
        betsToRuin: "Verliezen tot ruïne",
        hint: "Percentages als getal invoeren: 2 betekent 2% van de bankroll per wed. De verliesreeks telt wedden, dus alleen hele getallen — het is de reeks die je wil overleven, geen voorspelling.",
        verdictSafe:
          "Op 5% per eenheid of lager laat de opgegeven reeks de bankroll nog werkend achter. Een reeks van tien bereikt 38,54% van de spelers binnen 1.000 wedden bij gelijke odds, dus een plan dat alleen houdt als je hem nooit tegenkomt is geen plan.",
        verdictAggressive:
          "Boven 5% per eenheid beëindigt de gewone verliesreeks de rekening: tien verliezen nemen de helft van de bankroll of meer, en vanaf de helft is +100,00% nodig om terug te komen. Omdat een reeks van tien binnen 1.000 wedden 38,54% van de spelers treft, is dit een wed op hem niet tegenkomen.",
      },
      takeaway:
        "Het eenheidspercentage is geen voorkeur. Het is jouw besluit over hoe lang de slechtste verliesreeks mag zijn voordat je uit het spel ligt.",
      example: {
        title: "Een bankroll van 2.000 bij 2% per wed",
        rows: [
          { label: "Bankroll", value: "2.000" },
          { label: "Eenheid", value: "2%" },
          { label: "Inzet per wed", value: "40,00" },
          { label: "Tien verliezen op rij", value: "400,00" },
          { label: "Drawdown", value: "20,00%" },
          { label: "Verliezen tot ruïne", value: "50" },
        ],
        note:
          "Dat gat van 20,00% vraagt +25,00% op wat er over is om terug te komen op 2.000. Zet de eenheid op 5% en dezelfde tien verliezen kosten 1.000 — een drawdown van 50,00% die +100,00% nodig heeft om te herstellen, terwijl de bankroll 20 verliezen op rij dekt in plaats van 50. Drie punten regel, en de reeks die je overleeft wordt minder dan de helft.",
      },
      explainerTitle: "De regel die bepaalt hoeveel tegenslag je overleeft",
      explainer: [
        "**Een eenheid is een percentage van de bankroll, geen bedrag**, en het verschil komt pas boven als het slecht gaat. Zet voor altijd 40 vast in en een bankroll die naar 1.000 is gezakt wedt 4% in plaats van 2%: de regel knijpt precies wanneer hij zou moeten lossen. Herbereken de eenheid op het huidige saldo en elk verlies maakt de volgende inzet kleiner, en dat is wat een verliesreeks belet het karwei af te maken. De asymmetrie eronder is de hele reden om je zorgen te maken — **20% verliezen vraagt +25,00% om terug te komen, 50% vraagt +100,00% en 80% vraagt +400,00%.** Niets in de tweede helft van die paren is symmetrisch met de eerste, en geen voordeel is groot genoeg om van +400,00% een plan te maken in plaats van een hoop. Een bankroll van 2.000 bij 2% zet 40 per wed in, absorbeert tien verliezen op rij voor 400,00 en komt eruit op −20,00% — met tien van de 50 opeenvolgende verliezen verbruikt die deze inzet aankan.",
        "**Een reeks van tien verliezen bij odds rond 2.00 is gewoon, geen pech**, en dit is het getal dat het aantoont. Bij gelijke odds heeft één reeks van tien een kans van 0,098% — één op 1.024 — wat leest als nooit, tot je telt hoeveel reeksen een seizoen bevat. Over 1.000 wedden is de kans om minstens één verliesreeks van tien of langer tegen te komen **38,54%**; bij 2.10, waar een speler zonder voordeel 47,62% van de tijd wint, is het **52,31%** — beter dan kop of munt. Over 500 wedden zijn diezelfde twee cijfers 21,45% en 30,73%, en de langste reeks om te verwachten in 1.000 wedden bij gelijke odds is ongeveer tien, want hij groeit met de logaritme met grondtal twee van het aantal wedden. De reeks is niet de staart van de verdeling, hij is het midden, dus **een eenheid boven 5% is een wed op het niet tegenkomen van het gewone geval**: bij 5% nemen die tien verliezen de helft van de bankroll, bij 10% nemen ze alles. Wanneer het voordeel gemeten is in plaats van aangenomen, bepaalt de Kelly-criterium calculator de eenheid uit het voordeel zelf — lees dat getal als een plafond en deze pagina als de vloer eronder.",
      ],
      faq: [
        {
          q: "Welke eenheidsgrootte moet ik gebruiken?",
          a: "Eén tot twee procent van de bankroll per wed is het gebruikelijke bereik voor vlak inzetten, en boven vijf procent wordt de gewone verliesreeks een gebeurtenis die de rekening sluit. De eerlijke manier van kiezen loopt achterstevoren: bepaal de verliesreeks die je wil overleven, lees de drawdown die deze calculator geeft, en vraag je af of je daarna nog net zo zou wedden.",
        },
        {
          q: "Waarom is verliezen tot ruïne een heel getal?",
          a: "Omdat het wedden telt, en een fractie van een wed is er geen. Een bankroll van 1.000 bij 3% geeft een eenheid van 30, dus 33 verliezen en een derde — het antwoord is dus 33, naar beneden afgerond, want de bankroll dekt de volgende niet meer volledig. Naar boven afronden zou een wed beloven waarvoor het geld niet bestaat.",
        },
        {
          q: "Is een reeks van tien verliezen echt normaal?",
          a: "Ja, en de rekensom is niet eens close. Eén reeks van tien verliezen bij gelijke odds is een gebeurtenis van 0,098%, maar over 1.000 wedden zijn er genoeg reeksen dat de kans op minstens één 38,54% is, oplopend tot 52,31% bij 2.10 waar een speler zonder voordeel 47,62% van de tijd wint. Plan ervoor in plaats van je te laten verrassen.",
        },
        {
          q: "Deze of het Kelly-criterium?",
          a: "Deze wanneer je geen gemeten voordeel hebt, wat meestal zo is: een procentuele eenheid vraagt geen kansschatting en het slechtste geval is vooraf bekend. De Kelly-criterium calculator is het juiste gereedschap zodra je een kans kan verdedigen, en die raadt doorgaans meer aan dan een vlakke 2%. Zijn antwoord als plafond en de vlakke regel als vloer behandelen houdt ze beide eerlijk.",
        },
      ],
    },
  },
};

export default nl;
