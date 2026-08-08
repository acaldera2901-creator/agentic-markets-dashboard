// lib/tools/copy/sv.ts (#TOOLS-HUB-0805)
// Svenska. Lokala sökord: "oddsomvandlare", "EV-kalkylator", "Kelly-kriteriet",
// "spelbolagets marginal".

import type { ToolsCopy } from "./types";

const sv: ToolsCopy = {
  hub: {
    metaTitle: "Gratis spelverktyg — odds, EV, Kelly och marginal | BetRedge",
    metaDescription:
      "Fem gratis kalkylatorer: omvandla odds mellan alla format, ta bort spelbolagets marginal, räkna ut väntat värde och sätt insatsen med Kelly. Utan registrering.",
    h1: "Gratis spelverktyg",
    lede:
      "De fem räkneövningarna som görs före ett spel: odds omvandlade, marginal borttagen, insats satt. Gratis, utan konto.",
    cardCta: "Öppna verktyget",
    intro: [
      "Varje spel är en jämförelse mellan ett pris och en sannolikhet. De här fem kalkylatorerna gör jämförelsen ordentligt: de översätter odds mellan format, tar bort spelbolagets marginal och visar den rättvisa linjen, förvandlar en sannolikhetsuppskattning till väntat värde och sätter insatsen så att en förlustsvit inte avslutar kassan.",
      "Allt körs helt i din webbläsare: inget skickas, inget sparas och det finns inget konto att skapa. Använd dem för sig — eller använd dem för att kontrollera vad vår modell redan publicerar för varje match.",
    ],
  },

  common: {
    backLabel: "Start",
    ctaTitle: "De här siffrorna räknar vi på varje match",
    ctaBody:
      "Kalkylatorerna tar ett pris i taget. BetRedge skannar marknaden löpande, tar bort marginalen, jämför med modellens sannolikhet och visar var de två inte stämmer överens — fotboll och tennis, uppdaterat hela dagen.",
    ctaButton: "Se dagens board",
    otherTools: "Andra gratisverktyg",
    langLabel: "Språk",
    free: "Gratis",
    faqTitle: "Frågor",
    invalid: "—",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Oddsomvandlare — decimal, bråk, amerikanska och implicit sannolikhet | BetRedge",
      metaDescription:
        "Gratis oddsomvandlare: skriv ett pris i valfritt format — decimal, bråk, amerikanskt, Hongkong, Malay eller Indonesian — och läs det i alla de andra.",
      h1: "Oddsomvandlare",
      lede:
        "Skriv ett pris i ett format och läs det i alla andra, tillsammans med den sannolikhet spelbolaget påstår.",
      labels: {
        inputTitle: "Ditt pris",
        oddsInput: "Odds",
        formatSelect: "Format",
        resultTitle: "Samma pris, i varje format",
        decimal: "Decimal",
        american: "Amerikanskt",
        fractional: "Bråk",
        hongkong: "Hongkong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Implicit sannolikhet",
        hint: "Decimal godtar även komma: 2,50 fungerar som 2.50.",
      },
      takeaway:
        "Varje odds är en sannolikhet i förklädnad. Omvandla först, diskutera sedan: 2.50 betyder att spelbolaget säger 40 % till dig.",
      example: {
        title: "Ett pris, alla format",
        rows: [
          { label: "Du skriver", value: "2.50" },
          { label: "Amerikanskt", value: "+150" },
          { label: "Bråk", value: "3/2" },
          { label: "Hongkong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Implicit sannolikhet", value: "40,00 %" },
        ],
        note:
          "Ändra ett och resten följer. Se upp med avrundningen: den välkända −110 är 1.9091 i decimalform och innebär 52,38 %, medan ett visat 1.91 innebär 52,36 % — en skillnad som ser ut som ingenting och spelar roll, eftersom fördelar avgörs i tiondelar av en procent.",
      },
      explainerTitle: "Att läsa ett pris i vilket format som helst",
      explainer: [
        "**Odds är en sannolikhet i andra kläder.** Decimalodds — europeisk standard — ger den totala återbetalningen per satsad enhet: 2.50 ger tillbaka 2.50 för varje riskerad 1, insatsen inräknad. Bråkodds anger vinsten: 3/2 är tre enheter vinst per två riskerade, samma 2.50. Amerikanska odds säger hur mycket du vinner på 100 (+150) eller hur mycket du måste riskera för att vinna 100 (−110). Hongkong, Malay och Indonesian är de asiatiska formaten, och de spelar roll eftersom de skarpaste priserna ofta finns där.",
        "Talet som är värt att läsa är det sista. **Den implicita sannolikheten är 1 delat med decimaloddset**, och det är den enda siffran du kan jämföra direkt med din egen uppskattning: två odds i olika notationer är inte lättare att jämföra än två sannolikheter. En gräns det här verktyget inte kan ta bort: **den implicita sannolikheten innehåller fortfarande spelbolagets marginal**, så summera alla utfall i en marknad och du passerar 100 %. Vill du marknadens ärliga bedömning istället för dess prissatta, kör den genom marginalkalkylatorn.",
      ],
      faq: [
        {
          q: "Vilket format är bäst att räkna i?",
          a: "Decimal, om det inte finns skäl till annat. Att multiplicera decimalodds ger direkt priset på ett kombinationsspel, och 1 delat med oddset ger den implicita sannolikheten — båda är otympliga i bråk- eller amerikansk notation.",
        },
        {
          q: "Varför blir −110 1,909090…?",
          a: "Eftersom 100/110 är ett periodiskt decimaltal. Avrundat till två decimaler blir det 1.91, vilket alla spelbolag visar, men omvandlaren behåller full precision internt så att en kedja av beräkningar inte glider.",
        },
        {
          q: "Vad skiljer Malay- och Indonesian-odds?",
          a: "De är spegelbilder. Malay-odds är positiva under 2.00 och negativa över; Indonesian-odds är positiva över 2.00 och negativa under. Båda uttrycker samma pris och omvandlas till samma decimal.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Marginalkalkylator — overround, återbetalning och rättvisa odds | BetRedge",
      metaDescription:
        "Gratis marginalkalkylator: mata in oddsen för alla utfall i en marknad och få spelbolagets marginal, återbetalningsprocenten och de rättvisa oddsen utan marginal.",
      h1: "Marginalkalkylator",
      lede:
        "Mata in alla priser i en marknad och se vad spelbolaget behåller — plus den rättvisa linjen som ligger under.",
      labels: {
        inputTitle: "Marknaden",
        outcome: "Utfall",
        addOutcome: "Lägg till utfall",
        removeOutcome: "Ta bort",
        resultTitle: "Vad spelbolaget tar",
        margin: "Spelbolagets marginal",
        payout: "Återbetalning",
        fairOddsTitle: "Rättvis linje, marginal borttagen",
        fairOdds: "Rättvist odds",
        fairProbability: "Rättvis sannolikhet",
        impliedProbability: "Implicit sannolikhet",
        hint: "Lägg till ett utfall för trevägsmarknader, eller fler för vinnarmarknader.",
      },
      takeaway:
        "Marginalen är vad du betalar för rätten att ha en åsikt. Två spelbolag, samma match — och skillnaden är pengar.",
      example: {
        title: "Samma match hos två spelbolag",
        rows: [
          { label: "Nöjesinriktat bolag", value: "1.90 / 1.90 · marginal 5,26 %" },
          { label: "Skarpt bolag", value: "1.98 / 1.98 · marginal 1,01 %" },
          { label: "Rättvis linje, båda", value: "2.00 / 2.00 · 50 % var" },
          { label: "Ditt EV på en sann 50 %", value: "−5 % mot −1 % per spel" },
        ],
        note:
          "Samma åsikt, samma match. Att satsa 100 tvåhundra gånger kostar 1 000 hos det första bolaget och 200 hos det andra: de åtta örena i prisskillnad blir 800 över en säsong. Det är den billigaste fördelen i spel, och den kräver ingen modell alls.",
      },
      explainerTitle: "Marginalen är priset på spelet",
      explainer: [
        "**En rättvis tvåvägsmarknad prissätter båda sidor till 2.00.** De implicita sannolikheterna är 50 % och 50 %, de summerar till exakt 100 %, och ingen sida har någon fördel. Verkliga marknader prissätts till 1.90 och 1.90: de implicita blir 52,63 % var, summerar till 105,26 %, och **de överskjutande 5,26 procentenheterna är spelbolagets marginal** — overrounden. Vilken sida du än spelar betalar du den. Marginalerna varierar kraftigt: huvudlinjer hos skarpa bolag går under 2 %, medan vinnarmarknader och spelarmarknader rutinmässigt bär 8 % eller mer, eftersom bolagen vet att deras priser prövas minst där.",
        "Att ta bort marginalen ger den rättvisa linjen, no-vig-linjen. Den här kalkylatorn gör det proportionellt — varje implicit sannolikhet delad med deras summa, så att de åter blir exakt 100 % — och **den rättvisa linjen är referenspunkten för varje +EV-beslut**: ett spel har positivt väntat värde bara om din sannolikhet slår den rättvisa, inte bara den prissatta. En uttalad gräns: verkliga bolag lägger mer marginal på osannolika utfall, så i en marknad med tydlig favorit underskattar metoden favoriten något. På balanserade linjer är snedvridningen liten; på lotteriliknande vinnarmarknader är den rättvisa linjen en uppskattning.",
      ],
      faq: [
        {
          q: "Vilken marginal är acceptabel?",
          a: "På huvudlinjer i fotboll och tennis är under 3 % skarpt, 4–5 % normalt hos ett nöjesinriktat bolag, och över 7 % betalar du mycket för rätten att ha en åsikt. Jämför samma marknad hos flera bolag innan du bestämmer dig.",
        },
        {
          q: "Är återbetalning samma sak som marginal?",
          a: "Två sätt att läsa samma tal. En marginal på 5,26 % motsvarar 95 % återbetalning: bolaget räknar med att ge tillbaka 95 av varje 100 satsade över hela marknaden. Återbetalning är det behändigaste talet att jämföra med.",
        },
        {
          q: "Varför summerar de rättvisa sannolikheterna till exakt 100 %?",
          a: "Eftersom det är definitionen av att ta bort marginalen. De prissatta summerar till mer än 100 %; genom att dela varje med den summan skalas de om till att bli ett, vilket en sammanhängande uppsättning sannolikheter måste göra.",
        },
        {
          q: "Fungerar det på trevägs- eller vinnarmarknader?",
          a: "Ja — lägg till så många utfall som marknaden har. Matematiken är identisk för valfritt antal utfall, så länge du matar in alla. Att utesluta ett underskattar marginalen.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "EV-kalkylator — väntat värde för ett spel, med eller utan rättvis linje | BetRedge",
      metaDescription:
        "Gratis EV-kalkylator: mata in odds, sannolikhet och insats för väntat värde i valuta och procent — eller härled den rättvisa sannolikheten från ett skarpt bolags linje.",
      h1: "EV-kalkylator",
      lede:
        "Vad ett spel är värt i genomsnitt: utifrån din egen sannolikhet, eller ett skarpt bolags linje med marginalen borttagen.",
      labels: {
        inputTitle: "Spelet",
        modeTitle: "Var kommer sannolikheten från",
        modeManual: "Min egen uppskattning",
        modeSharp: "Från ett skarpt bolag",
        yourOdds: "Ditt pris",
        yourProbability: "Din sannolikhet (%)",
        sharpOddsA: "Skarpt pris, din sida",
        sharpOddsB: "Skarpt pris, andra sidan",
        derivedProbability: "Rättvis sannolikhet, marginal borttagen",
        stake: "Insats",
        resultTitle: "Vad spelet är värt",
        ev: "Väntat värde",
        fairOdds: "Break-even-pris",
        edge: "Fördel",
        positive: "Positivt väntat värde vid det här priset.",
        negative: "Negativt väntat värde vid det här priset.",
        neutral: "Break-even: priset motsvarar sannolikheten exakt.",
        hint: "Procent skrivs som tal: 55 betyder 55 %.",
      },
      takeaway:
        "Du behöver inte gissa bättre än marknaden — bara hitta ett bolag som är långsammare än det skarpaste.",
      example: {
        title: "Att låna sannolikheten från ett skarpt bolag",
        rows: [
          { label: "Skarpt bolag, båda sidor", value: "1.95 / 1.95" },
          { label: "Rättvis sannolikhet, marginal borttagen", value: "50,00 %" },
          { label: "Break-even-pris", value: "2.00" },
          { label: "Ditt bolag erbjuder", value: "2.10" },
          { label: "EV på 100 satsade", value: "+5,00 (+5 %)" },
        ],
        note:
          "Ingen åsikt behövdes: den skarpa linjen gav sannolikheten, och ditt bolag prissatte samma utfall till 2.10 där 2.00 var rättvist. Flytta de skarpa priserna till 1.90/1.90 och den rättvisa sannolikheten är fortfarande 50 % — det är hela poängen med att ta bort marginalen: svaret rör sig inte med vigen.",
      },
      explainerTitle: "Vad väntat värde faktiskt säger",
      explainer: [
        "**Väntat värde är det genomsnittliga utfallet av ett spel du skulle kunna upprepa i all evighet.** Två ingångar, inga åsikter: priset du erbjuds och sannolikheten du ger utfallet. Tror du att ett lag vinner 55 % av gångerna och någon erbjuder 2.00 är räkningen omedelbar — 55 % av gångerna vinner du en enhet, 45 % förlorar du den, alltså 0,10 enheter per satsad enhet. Det är 10 % fördel, och mer betyder inte +EV.",
        "**Sannolikheten är där nästan alla förlorar tyst.** Ett fel på 5 punkter gör 4 % fördel till 1 % förlust, och uppskattningar på ögonmått missar med betydligt mer. Därav kalkylatorns andra läge: istället för att lita på magkänslan, ta båda sidor hos ett skarpt bolag, ta bort marginalen och använd den rättvisa sannolikheten som blir kvar. Läs resultatet som en takt, inte ett löfte — 4 % fördel ger ingenting på ett enskilt spel, den framträder först över hundratals, och bara om sannolikheten stämde. Därför betyder insatsens storlek lika mycket som fördelen.",
      ],
      faq: [
        {
          q: "Hur får jag en sannolikhet jag kan lita på?",
          a: "Från en datadriven modell, eller från marknaden själv. Den rättvisa linjen hos ett skarpt bolag — dess priser utan marginal — är svår att slå med enbart bedömning, och den går att slå upp gratis.",
        },
        {
          q: "Är ett spel med positivt EV ett bra spel?",
          a: "Ett nödvändigt men inte tillräckligt villkor. Ett spel kan ha positivt väntat värde och ändå vara fel om insatsen är för stor för kassan, om fördelen ligger inom ditt uppskattningsfel eller om marknaden rör sig emot dig före start.",
        },
        {
          q: "Varför behövs båda sidorna av den skarpa marknaden?",
          a: "Eftersom man inte kan ta bort en marginal från ett enda pris. Den syns först när de implicita sannolikheterna för alla utfall summeras: det är det andra priset som gör den rättvisa sannolikheten beräkningsbar.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Kelly-kalkylator — optimal insats utifrån fördel och kassa | BetRedge",
      metaDescription:
        "Gratis Kelly-kalkylator: mata in odds, sannolikhet och kassa för den insats som maximerar tillväxten på lång sikt — hel, halv eller kvarts Kelly.",
      h1: "Kelly-kalkylator",
      lede:
        "Insatsen som får en kassa att växa snabbast på lång sikt — och varför nästan alla borde satsa mindre än den säger.",
      labels: {
        inputTitle: "Spelet och kassan",
        odds: "Pris",
        probability: "Din sannolikhet (%)",
        bankroll: "Kassa",
        fractionTitle: "Kelly-andel",
        fractionFull: "Hel",
        fractionHalf: "Halv",
        fractionQuarter: "Kvarts",
        resultTitle: "Rekommenderad insats",
        stake: "Insats",
        stakePercent: "Andel av kassan",
        edge: "Fördel",
        fullKelly: "Hel Kelly",
        growth: "Väntad tillväxt per spel",
        noEdge: "Ingen fördel vid det här priset — optimal insats är noll.",
        hint: "Procent skrivs som tal: 55 betyder 55 %.",
      },
      takeaway:
        "Kelly anpassar insatsen till fördelen, inte till din övertygelse — och nästan alla borde medvetet satsa mindre än den säger.",
      example: {
        title: "Vad det betyder med 1 000 i kassan",
        rows: [
          { label: "Kassa", value: "1 000" },
          { label: "Odds · din sannolikhet", value: "2.00 · 55%" },
          { label: "Fördel", value: "+10%" },
          { label: "Hel Kelly", value: "10% → 100 per spel" },
          { label: "Halv Kelly", value: "5% → 50 per spel" },
        ],
        note:
          "Fem förluster i rad — en serie av 54 vid det här oddset — lämnar 590 vid hel Kelly, och då krävs +69% för att komma tillbaka till 1 000. Samma svit vid halv Kelly lämnar 774, där +29% räcker. Samma fördel, samma spel, hälften så djup grop.",
      },
      explainerTitle: "Att sätta insatsen så att förlustsviten inte avslutar den",
      explainer: [
        "Kelly-kriteriet besvarar det väntat värde hoppar över: hur mycket ska man faktiskt riskera givet en fördel? Satsa för lite och en verklig fördel växer för långsamt för att betyda något. Satsa för mycket och matematiken vänder sig mot dig: en kassa som halveras behöver +100 % för att komma tillbaka, så för stora insatser förstör tillväxten även när varje enskilt spel är gynnsamt. Den optimala andelen är fördelen delad med nettooddset, och **den skalar med fördelen, inte med övertygelsen**: 10 % fördel vid 2.00 kräver 10 % av kassan, samma fördel vid 5.00 bara 2,5 %.",
        "**Nästan ingen bör spela hel Kelly**, för formeln antar att din sannolikhet är exakt och det är den aldrig. Ge den en överskattad fördel och den rekommenderar villigt en insats som är för stor för den fördel du faktiskt har: det snabbaste sättet att förlora en kassa medan man har rätt i genomsnitt. Halv Kelly ger upp en fjärdedel av den teoretiska tillväxten och halverar ungefär volatiliteten; kvarts Kelly är vad många professionella med verkliga modeller använder. Och när priset inte ger någon fördel är rätt insats noll: en negativ Kelly-andel betyder att spelet hör till andra sidan, aldrig att man ska satsa mindre på den här.",
      ],
      faq: [
        {
          q: "Hel, halv eller kvarts Kelly?",
          a: "Halv eller kvarts för nästan alla. Hel är bara optimal om sannolikhetsuppskattningen är exakt, och uppskattningsfel skadar vid för stor insats mycket mer än de hjälper vid för liten. Fraktionell Kelly byter lite tillväxt mot mycket överlevnad.",
        },
        {
          q: "Vad är väntad tillväxt per spel?",
          a: "Kassans genomsnittliga logaritmiska tillväxt för ett spel vid den insatsen. Den är liten av konstruktion — 0,005 motsvarar ungefär en halv procentenhet sammansatt tillväxt per spel — och det är storheten Kelly maximerar.",
        },
        {
          q: "Vad gäller om jag har flera spel samtidigt?",
          a: "Kelly för enskilda spel satsar för mycket när spel löper parallellt, särskilt om de är korrelerade. Praktisk regel: fördela totalen över de samtidiga positionerna och behandla korrelerade spel som ett.",
        },
        {
          q: "Varför visar den noll när jag tror att jag har en fördel?",
          a: "Eftersom din sannolikhet vid det angivna priset inte når över break-even-punkten. Jämför priset med 1 delat med din sannolikhet: är priset lägre finns ingen fördel att satsa på.",
        },
      ],
      caveat:
        "Kelly-kriteriet maximerar tillväxt på lång sikt, inte bekvämlighet. Även vid rätt insats är nedgångar på 30 % eller mer vanliga, och formeln antar att din sannolikhetsuppskattning är korrekt: är den optimistisk satsar Kelly systematiskt för mycket och kassan kan förloras. Satsa aldrig pengar du behöver.",
    },

    "probability-calculator": {
      metaTitle: "Sannolikhetskalkylator — odds, break-even och kombinationsspel | BetRedge",
      metaDescription:
        "Gratis sannolikhetskalkylator för spel: omvandla sannolikhet och odds, hitta den break-even-sannolikhet ett pris kräver och kombinera delspel till ett kombinationsspel.",
      h1: "Sannolikhetskalkylator",
      lede:
        "Gör sannolikheter till priser och tillbaka, se vad ett pris kräver av dig och ta reda på vad ett kombinationsspel egentligen är värt.",
      labels: {
        inputTitle: "Sannolikhet och pris",
        modeTitle: "Vad har du?",
        modeProbability: "En sannolikhet",
        modeOdds: "Ett pris",
        probability: "Sannolikhet (%)",
        odds: "Decimalodds",
        breakEven: "Break-even-sannolikhet",
        fairOdds: "Rättvist pris",
        parlayTitle: "Kombinationsspel",
        leg: "Delspel",
        addLeg: "Lägg till delspel",
        removeLeg: "Ta bort",
        parlayProbability: "Kombinerad sannolikhet",
        parlayOdds: "Kombinerat odds",
        resultTitle: "Resultat",
        hint: "Ett pris och dess break-even-sannolikhet är samma tal läst från två sidor.",
      },
      takeaway:
        "Delspel multipliceras, och spelbolagets snitt med dem. En fyrspelare på 1.80 kräver en händelse på 9,5 %.",
      example: {
        title: "Vad en fyrspelare egentligen kostar",
        rows: [
          { label: "Fyra delspel på", value: "1.80 vardera · 55,56 %" },
          { label: "Kombinerat odds", value: "10.50" },
          { label: "Kombinerad sannolikhet", value: "9,53 %" },
          { label: "Marginal per delspel", value: "5 %" },
          { label: "Marginal på kombinationen", value: "21,6 %" },
        ],
        note:
          "Oddset ser generöst ut tills man ser vad det kräver: en händelse på 9,5 %. Och bolagets snitt har sammansatts fyra gånger — 1,05⁴ − 1 = 21,6 % — så samma fyra val kostar dig fyra gånger marginalen för ett enskilt spel. Korrelerade delspel från samma match är något annat: multiplikation underskattar dem, och just därför prissätter bolagen kombinationer inom en match separat.",
      },
      explainerTitle: "Sannolikheten först, priset sedan",
      explainer: [
        "**Varje pris är ett påstående om en sannolikhet**, och omvandlingen är en division: 40 % är ett pris på 2.50, och 2.50 är en sannolikhet på 40 %. Att göra omvandlingen före spelet ändrar frågan från «gillar jag det här spelet?» till «händer det här i mer än 40 % av fallen?» — en fråga man faktiskt kan ha fel om. Läst från prissidan är samma tal **break-even-sannolikheten**: den minsta chans ett utfall behöver för att spelet ska vara neutralt. 1.75 kräver 57,1 %; 1.50 kräver 66,7 %; 15.00 begär bara 6,7 %, och därför känns långa odds billiga och därför lägger bolagen sin marginal där.",
        "**I kombinationsspel blir sannolikhet kontraintuitiv.** Oberoende delspel multipliceras: tre spel du bedömer till 50 % vardera blir tillsammans 12,5 %, inte något betryggande nära hälften. Fyra delspel på 60 % ger 12,96 %. Det kombinerade oddset multipliceras likadant, och där ligger fällan — talet blir stort medan chansen blir liten, och marginalen sammansätts med den. Håll fast vid antagandet: här multipliceras det, alltså antas oberoende. Två utfall från samma match är korrelerade, och där är den verkliga sannolikheten en annan, oftast högre än produkten.",
      ],
      faq: [
        {
          q: "Vad är break-even-sannolikhet?",
          a: "Den chans ett utfall måste ha för att ett spel till det priset ska vara neutralt på lång sikt. Den är 1 delat med decimaloddset, och är ribban din egen uppskattning måste passera för att spelet ska vara rimligt.",
        },
        {
          q: "Varför är sannolikheten för min kombination så låg?",
          a: "Eftersom sannolikheter multipliceras. Varje tillagt delspel gör helheten mindre sannolik, och en kedja av rimliga delspel blir snabbt ett osannolikt spel. Oddset stiger i motsvarande grad — men så gör även den ackumulerade marginalen.",
        },
        {
          q: "Fungerar det för kombinationer inom samma match?",
          a: "Inte exakt. Multiplikation antar oberoende delspel, och utfall inom en match är oftast inte oberoende. Vid korrelerade delspel är den verkliga sannolikheten en annan — ofta högre än produkten — och därför prissätter bolagen dessa marknader separat.",
        },
        {
          q: "Är ett pris implicita sannolikhet den verkliga sannolikheten?",
          a: "Nej. Den innehåller fortfarande bolagets marginal och ligger därför systematiskt över marknadens ärliga uppskattning. Ta bort den med marginalkalkylatorn innan du jämför med ditt eget tal.",
        },
      ],
    },

    "arbitrage-calculator": {
      metaTitle: "Arbitragekalkylator — dela en insats mellan spelbolag | BetRedge",
      metaDescription:
        "Gratis arbitragekalkylator: ange bästa oddset på varje utfall hos olika spelbolag och se summan av de implicita sannolikheterna, hur insatsen delas och vinsten — eller att den inte finns.",
      h1: "Arbitragekalkylator",
      lede:
        "Ange bästa tillgängliga odds på varje utfall och se om två spelbolag tillsammans lämnar en marginal — och hur insatsen då ska delas.",
      labels: {
        inputTitle: "Bästa odds på varje utfall",
        outcome: "Utfall",
        addOutcome: "Lägg till utfall",
        removeOutcome: "Ta bort",
        total: "Total insats",
        resultTitle: "Så delas den",
        profit: "Vinst",
        impliedSum: "Summa av implicita sannolikheter",
        stakeOn: "Insats på utfall",
        guaranteedReturn: "Återbäring vid varje utfall",
        verdictArb:
          "Oddsen summerar till under 100 %: delad så här betalar varje utfall tillbaka samma belopp.",
        verdictNoArb:
          "Oddsen summerar till över 100 %, så här finns inget arbitrage — varje delning förlorar den marginalen, vilket utfall som än kommer.",
        hint: "Ett odds per utfall, vart och ett från bolaget som betalar mest på den sidan. Decimal godtar komma: 2,10 fungerar som 2.10.",
      },
      takeaway:
        "Arbitrage är ingen prognos. Det kräver aldrig att du har rätt om vinnaren — det kräver att två spelbolag är oense med mer än sina egna marginaler.",
      example: {
        title: "Två bolag, 1 000 att dela",
        rows: [
          { label: "Odds, ett bolag per sida", value: "2.10 · 2.10" },
          { label: "Summa av implicita sannolikheter", value: "95,24 %" },
          { label: "Insats per sida, av 1 000", value: "500 · 500" },
          { label: "Återbäring vid varje utfall", value: "1 050" },
          { label: "Vinst", value: "+50 (+5,00 %)" },
        ],
        note:
          "Samma marknad prissatt 1.90/1.90 inom ett enda bolag summerar till 105,26 % och ger tillbaka −5,00 % hur du än delar. Inget i matchen har ändrats mellan de två linjerna: hela skillnaden ligger i vilket bolag som betalar mest på vilken sida, och i om du hade laddade konton hos båda medan oddsen fortfarande stod uppe.",
      },
      explainerTitle: "När två spelbolag är tillräckligt oense",
      explainer: [
        "**Summera ett delat med varje odds och du håller hela marknaden i ett enda tal.** Inom ett bolag passerar det talet alltid 100 % — marginalen är det som håller det där. Men bästa oddset på ena sidan och bästa på den andra ligger ofta hos olika bolag, och kombinerade kan summan falla under 100 %. Det är hela villkoret: **de implicita sannolikheterna måste summera till under 1**. Dela den totala insatsen i proportion till dessa sannolikheter och varje utfall betalar tillbaka samma belopp, så det du får tillbaka slutar bero på resultatet. Två odds på 2.10 summerar till 95,24 %, och 500 på varje sida av en insats på 1 000 ger 1 050 tillbaka hur matchen än slutar.",
        "**I praktiken stänger detta betydligt mer sällan än räkneexemplet antyder, och skälen väger tyngre än formeln.** Odds rör sig: luckan du hittade är oftast det långsammare bolaget som hämtar in, och den kan försvinna på sekunderna mellan första och andra benet — då sitter du med ett vanligt, oskyddat spel till ett odds du valde för att gardera och inte för dess värde. Insatsgränser biter hårdast precis där luckan är bredast, så 5 % på pappret är ofta 5 % på fyrtio enheter och inte på tusen. Och **spelbolag begränsar konton som gör detta systematiskt** — först lägre gränser, sedan nekade spel och stängningar. Lägg till kapitalet som står parkerat hos flera bolag och valutaspreaden mellan dem, och arbitrage läses mindre som en maskin och mer som ett långsamt, operativt tungt sätt att skrapa av en tunn marginal.",
      ],
      faq: [
        {
          q: "Behöver jag konto hos varje spelbolag?",
          a: "Ja. Ett arbitrage finns bara mellan de specifika bolag som erbjuder just de oddsen, så du behöver laddade konton hos varje av dem innan oddsen rör sig. Det kapitalet, spritt över flera bolag och stillastående större delen av tiden, är kostnaden nästan ingen kalkylator visar.",
        },
        {
          q: "Vad händer om det andra oddset rör sig innan jag lägger det?",
          a: "Då sitter du med första benet ensamt: ett vanligt spel, till ett odds du valde för att gardera och inte för dess värde. Lägg den sida som mest sannolikt rör sig först, och behandla att bli stående oskyddad som en del av risken, inte som en olycka.",
        },
        {
          q: "Varför begränsar spelbolag arbitragespelare?",
          a: "Eftersom deras marginal lever på balanserat flöde från fritidskunder, och ett konto som alltid bara tar bästa oddset på en sida är för dem en ren kostnad. Begränsningarna kommer tyst som lägre insatsgränser, långt innan ett konto stängs helt.",
        },
        {
          q: "Är arbitragespel lagligt?",
          a: "Själva aktiviteten är laglig: du lägger vanliga spel till publicerade odds. Vad som kan förbjuda det är bolagets egna villkor, som i regel förbehåller dem rätten att begränsa, neka eller ogiltigförklara spel de bedömer som arbitrage. Lagligt och tillåtet är inte samma sak.",
        },
      ],
    },
  },
};

export default sv;
