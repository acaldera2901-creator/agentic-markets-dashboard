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
  },
};

export default nl;
