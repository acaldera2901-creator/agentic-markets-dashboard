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

    "parlay-calculator": {
      metaTitle: "Kombinationskalkylator — kombinerat odds, verklig sannolikhet och sammansatt marginal | BetRedge",
      metaDescription:
        "Gratis kombinationskalkylator: fyll i varje delspel och se det kombinerade oddset, sannolikheten kupongen faktiskt kräver och hur bolagets marginal sammansätts.",
      h1: "Kombinationskalkylator",
      lede:
        "Varje delspel du lägger till multiplicerar oddset — och multiplicerar bolagets snitt med det. Här är båda talen, innan spelet läggs.",
      labels: {
        inputTitle: "Delspelen",
        leg: "Delspel",
        addLeg: "Lägg till delspel",
        removeLeg: "Ta bort",
        marginPerLeg: "Bolagets marginal per delspel (%)",
        resultTitle: "Vad kombinationen är värd",
        combinedOdds: "Kombinerat odds",
        impliedProb: "Sannolikhet att den går in",
        compoundMargin: "Sammansatt marginal",
        verdict:
          "Multiplikation förutsätter oberoende delspel. Två val från samma match är inte oberoende: deras verkliga chans är oftast högre än produkten, och därför prissätter bolagen kombinationer inom en match med en egen modell.",
        hint: "Ett decimalodds per delspel, upp till åtta. Marginalen per delspel skrivs som ett tal: 5 betyder 5 %, ungefär vad en snäv tvåvägsmarknad håller.",
      },
      takeaway:
        "Bolagets snitt adderas inte över delspelen, det sammansätts — fyra delspel på 1.80 ser ut som fyra nästan jämna spel och är en enda händelse på 9,53 %.",
      example: {
        title: "Fyra delspel på 1.80, ett spel på 9,53 %",
        rows: [
          { label: "Delspel", value: "4 × 1.80" },
          { label: "Kombinerat odds", value: "10.50" },
          { label: "Sannolikhet att den går in", value: "9,53 %" },
          { label: "Marginal per delspel", value: "5 %" },
          { label: "Sammansatt marginal", value: "21,55 %" },
        ],
        note:
          "För sig är varje delspel det spel ingen stannar upp vid: 55,56 % implicit, 1.80 vid vinst. Kedjade kräver de fyra en händelse på 9,53 % — och de 5 % bolaget håller på varje delspel blir 1,05⁴ − 1 = 21,55 % på kombinationen. Inget lades till spelet utom fler sätt att förlora det: oddset steg för att chansen sjönk.",
      },
      explainerTitle: "Varför oddset växer snabbare än chansen",
      explainer: [
        "**En kombination är ett spel med flera sätt att förlora, inte flera spel.** Det kombinerade oddset är produkten av delspelen — 1.80 taget fyra gånger är 10.4976 — och sannolikheten är produkten av sannolikheterna, och där slutar aritmetiken vara vänlig: fyra val som du var för sig skulle kalla nästan jämna blir tillsammans 9,53 %. Marginalen beter sig likadant, och det är den delen nästan ingen räknar med. Den adderas inte delspel för delspel, den **sammansätts**: ett bolag som håller 5 % på varje av fyra delspel håller 1,05⁴ − 1 = 21,55 % på kombinationen, och vid åtta delspel har samma 5 % per delspel blivit 47,75 %. Utbetalningen ser generös ut därför att chansen kollapsade, inte därför att någon betalar mer för samma risk.",
        "**Kombinationer är den mest marknadsförda produkten inom spel och den minst gynnsamma för kunden**, och det är samma sak sedd från två sidor: desto större den sammansatta marginalen är, desto mer kan ett bolag lägga på oddsboostar, försäkringar och reklam för just den kupongen. Ett tunt övertag på ett delspel överlever inte att multipliceras med tre delspel marginal till — samma val som enkelspel betalar marginalen en gång var, fyrkombinationen betalar den fyra gånger om. Sedan finns det multiplikationen förutsätter: **att delspelen är oberoende**. Två val från samma match är korrelerade, så där är multiplikation fel räknesätt: en hemmavinst och ett mål av lagets forward brukar komma tillsammans, alltså är paret mer sannolikt än produkten säger, medan delspel som knappt kan samexistera är värda betydligt mindre. Därför bygger bolagen kombinationer inom en match med en egen modell i stället för att låta dig sätta ihop dem av enkelspelen — och därför är den här kalkylatorn ärlig för delspel från olika matcher.",
      ],
      faq: [
        {
          q: "Fungerar det för kombinationer inom samma match?",
          a: "Inte exakt. Här multipliceras det, och multiplikation förutsätter oberoende delspel. Utfall inom en match rör sig tillsammans, så parets verkliga sannolikhet är annorlunda — ofta högre än produkten — och just därför prissätter bolagen de marknaderna med en egen modell i stället för utifrån enkelspelen.",
        },
        {
          q: "Varför är den kombinerade sannolikheten så låg?",
          a: "Därför att sannolikheter multipliceras i stället för att snittas. Fyra delspel på 55,56 % blir 9,53 %: varje delspel du lägger till gör hela spelet mindre sannolikt, så en kedja av rimliga val blir snabbt ett osannolikt spel. Oddset stiger i motsvarande grad, och med oddset stiger den ackumulerade marginalen.",
        },
        {
          q: "Vad är den sammansatta marginalen exakt?",
          a: "Bolagets snitt efter att varje delspel har multiplicerat det. Fyll i vad ett delspel kostar dig — omkring 5 % på en snäv tvåvägsmarknad — och kalkylatorn sammansätter det: ett plus marginalen, upphöjt till antalet delspel, minus ett. Fyra delspel på 5 % kostar 21,55 %, åtta delspel 47,75 %.",
        },
        {
          q: "Är fyra enkelspel bättre än en fyrkombination?",
          a: "För den som spelar på ett övertag, ja: samma fyra val som enkelspel betalar marginalen en gång var i stället för att multiplicera den, och ett felaktigt delspel kostar ett spel i stället för hela kupongen. En kombination köper varians — en liten chans till en stor utbetalning — och priset för variansen är den sammansatta marginalen.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "ROI-kalkylator för betting — avkastning på kassan | BetRedge",
      metaDescription:
        "Gratis ROI-kalkylator för betting: fyll i kapital och vinst för att se avkastningen på kassan, slutkapitalet och varför samma vinst blir 4 % i yield.",
      h1: "ROI-kalkylator",
      lede:
        "Vad kassan gav under en period — och varför samma vinst på 400 är 40 % ROI här och 4 % yield på den andra sidan.",
      labels: {
        inputTitle: "Kapital och resultat",
        capital: "Kapital",
        profit: "Vinst",
        resultTitle: "Avkastning på det kapitalet",
        roi: "ROI",
        endingCapital: "Kapital efteråt",
        hint: "Vinsten fylls i netto och får vara negativ: -250 är en förlustperiod. Kapitalet är kassan du satte på spel, inte den totala omsättningen.",
        verdict:
          "ROI beror helt på nämnaren, så deklarera den: 400 på en kassa om 1 000 är 40 %, samma 400 mot 10 000 i omsättning är 4 % i yield. Ingen av siffrorna säger särskilt mycket utan perioden och antalet spel bakom den.",
      },
      takeaway:
        "ROI säger vad kassan gav. Den säger inte om strategin är bra, för samma 40 % kan komma från 200 spel eller från en enda tursam lördag.",
      example: {
        title: "400 i vinst på en kassa om 1 000",
        rows: [
          { label: "Kapital", value: "1 000" },
          { label: "Vinst under perioden", value: "+400" },
          { label: "ROI", value: "+40,00 %" },
          { label: "Kapital efteråt", value: "1 400" },
          { label: "Samma 400 mot 10 000 i omsättning", value: "yield +4,00 %" },
        ],
        note:
          "Båda procentsatserna beskriver ett och samma resultat. Att nå +40,00 % på kassan krävde 200 spel om 50 — 10 000 i omsättning, tio gånger kapitalet — och 4,00 % av den omsättningen är samma 400. Vänd kassan två gånger i stället för tio och yielden bakom 40 % ROI måste vara 20 %, vilket nästan ingen håller uppe.",
      },
      explainerTitle: "Vinst mätt mot pengarna som stod på spel",
      explainer: [
        "**ROI är vinsten delad med pengarna du satte på spel**, och hela svårigheten sitter i andra halvan av den meningen. En kassa om 1 000 som avslutar en säsong 400 upp har gett 40,00 %, och den siffran går att jämföra hederligt med allt annat du kunde ha gjort med samma 1 000. Vad den inte kan beskriva är spelandet. En avkastning på 40 % säger ingenting om hur många spel det krävde, över hur lång tid, eller hur nära noll saldot kom på vägen — och det är de tre sakerna som avgör om det händer igen. Så **deklarera nämnaren innan du citerar siffran**: startkassa, medelsaldo och totala insättningar ger tre olika procentsatser ur en identisk uppsättning spel, och den mest smickrande är alltid den minsta.",
        "**Samma 400 i vinst är 40 % ROI och 4 % yield på samma gång**, och att veta vilken av dem du håller i handen är nästan hela värdet av de två sidorna. ROI mäter mot kapitalet, yield mot omsättningen — summan av varje lagd insats. Vårt exempel kom dit med 200 spel om 50, så 10 000 gick genom kassan: tio gånger kapitalet, och 4,00 % av det är precis de 400. **Den multiplikatorn är hela bryggan mellan de två talen**, och det är därför ROI ensam smickrar den som spelar mycket. Den som vänder en kassa om 1 000 tio gånger med 4 % yield och den som vänder den två gånger med 20 % yield rapporterar båda 40 %, och bara ett av dem går att upprepa. Kvaliteten per spel mäter du i yield-kalkylatorn; behåll ROI för det den verkligen är bra på: att jämföra vad pengarna gav mot alternativen.",
      ],
      faq: [
        {
          q: "Vad är skillnaden mellan ROI och yield?",
          a: "ROI delar vinsten med kapitalet, yield delar den med omsättningen — summan av alla insatser. Samma 400 i vinst är 40,00 % av en kassa om 1 000 och 4,00 % av 10 000 i omsättning. ROI säger vad pengarna gav, yield säger hur bra spelen var, och förhållandet mellan dem är hur många gånger du vände kassan.",
        },
        {
          q: "Vilket kapital ska stå i nämnaren?",
          a: "Det du kan deklarera och sedan hålla fast — vanligtvis startkassan. Toppsaldo, medelsaldo och totala insättningar ger olika procentsatser ur samma spel, så siffran betyder något bara vid sidan av sin definition. Att fylla på kontot mitt i perioden utan att deklarera nämnaren igen är det vanligaste sättet att blåsa upp en ROI.",
        },
        {
          q: "Är 40 % ROI bra?",
          a: "Det beror på perioden och antalet spel. Över en säsong och 200 spel är det ett starkt men rimligt resultat. Samma 40 % över tjugo spel ligger väl inom det intervall slumpen skapar på egen hand, och 40 % på en vecka betyder oftast att insatserna var stora i förhållande till kassan, inte att kanten var stor.",
        },
        {
          q: "Kan ROI vara negativ?",
          a: "Ja, och kalkylatorn visar det i stället för att dölja det: en förlust på 250 av en kassa om 1 000 är -25,00 %. Återhämtningen är inte symmetrisk — efter -25 % behövs +33,33 % på det som är kvar för att komma tillbaka till noll — och därför förtjänar nedgången lika mycket uppmärksamhet som avkastningen.",
        },
      ],
    },
    "yield-calculator": {
      metaTitle: "Yield-kalkylator för betting — vinst per satsad krona | BetRedge",
      metaDescription:
        "Gratis yield-kalkylator: fyll i antal spel, medelinsats och vinst för att få omsättning och yield — och hur många spel som krävs innan siffran betyder något.",
      h1: "Yield-kalkylator",
      lede:
        "Vinst mätt mot allt du har satsat, inte mot din kassa — den enda siffran som jämför två spelare med olika mycket pengar.",
      labels: {
        inputTitle: "Spel, insats och resultat",
        bets: "Antal spel",
        avgStake: "Medelinsats",
        profit: "Vinst",
        resultTitle: "Yield på omsättningen",
        turnover: "Omsättning",
        yieldPercent: "Yield",
        hint: "Omsättningen räknar vi ut: spel × medelinsats. Räkna insatsen för varje spel, inte pengarna som stod på spel samtidigt. Vinsten fylls i netto och får vara negativ.",
        verdictNoise:
          "Under tusen spel är siffran mest brus. Med platta insatser på 2.00 är en standardavvikelse av yielden 7,07 punkter över 200 spel och fortfarande 3,16 över 1 000: läs den som ett intervall, inte som ett resultat.",
        verdictVolume:
          "Efter tusen spel börjar siffran bära information, men en standardavvikelse är på 2.00 fortfarande omkring 3,16 punkter — en +4 % och en +7 % över samma volym är inte två olika nivåer av skicklighet.",
      },
      takeaway:
        "Yield är siffran som jämför spelare: 4 % på 10 000 i omsättning är värt mer än 40 % ROI insamlat över tjugo spel.",
      example: {
        title: "200 spel om 50, 400 i vinst",
        rows: [
          { label: "Antal spel", value: "200" },
          { label: "Medelinsats", value: "50" },
          { label: "Omsättning", value: "10 000" },
          { label: "Vinst", value: "+400" },
          { label: "Yield", value: "+4,00 %" },
          { label: "Samma 400 på en kassa om 1 000", value: "ROI +40,00 %" },
        ],
        note:
          "Ett resultat, två lika hederliga procentsatser: 4,00 % av de 10 000 som gick genom spelbolaget, 40,00 % av de 1 000 som någonsin stod på spel. Avståndet mellan dem är ingenting annat än de tio gånger kassan vändes. Och urvalet väger tyngre än båda siffrorna: vid 200 spel är en standardavvikelse av yielden 7,07 punkter, så dessa +4,00 % ligger inom det intervall en serie krona eller klave skapar av sig själv.",
      },
      explainerTitle: "Siffran som jämför två spelare",
      explainer: [
        "**Yield är vinsten delad med omsättningen** — summan av varje lagd insats, inte saldot på kontot. Det är siffran spelare citerar för varandra just därför att den inte beror på hur mycket pengar de har: 4 % är 4 % vare sig insatserna är 5 eller 500. **Talet alla fyller i fel är nämnaren**, och felet går alltid i samma riktning. Omsättningen räknar varje spels insats i det ögonblick det läggs, så 200 spel om 50 blir 10 000 även om bara 50 stod på spel samtidigt, och kassan om 1 000 som spelen återanvände är inte talet man delar med. Därför frågar den här sidan efter antalet och medelinsatsen och räknar fram omsättningen framför dig. Mät samma vinst mot kapitalet i stället och du får ROI: ROI-kalkylatorn håller den andra halvan av jämförelsen, där 400 i vinst är 40,00 % av en kassa om 1 000 och 4,00 % av 10 000 i omsättning.",
        "**En yield över ungefär 5 %, hållen över allvarlig volym, är ovanlig.** Där den finns bor den i mjuka marknader med låga gränser, och den krymper när insatserna växer, eftersom oddsen som tillät den inte överlever att träffas hårt. Varje långsiktig siffra långt över det behandlar man som ett kort urval, en mjuk nisch eller en annan definition av omsättning. Och **under några hundra spel är talet brus, inte ett resultat**: med platta insatser på 2.00 är en standardavvikelse av yielden ett delat med roten ur antalet spel — 7,07 punkter över 200 spel, 3,16 över 1 000, 2,00 över 2 500. En yield på +4 % når två standardavvikelser från noll först vid omkring 2 500 spel. Vid längre odds svänger det bredare: på 3.00 bär samma 200 spel en standardavvikelse om 10 punkter. Och det är den hederliga läsningen av tjugo vunna spel — ingen mätt kant, bara ett för kort urval.",
      ],
      faq: [
        {
          q: "Hur räknar jag ut min omsättning?",
          a: "Genom att summera insatsen för varje lagt spel, vunnet eller förlorat. 200 spel om 50 är 10 000 i omsättning, även om kassan bakom bara var 1 000. Använd inte nettobeloppet och inte saldot: omsättning är pengarna som gick genom spelbolaget, räknade en gång per spel.",
        },
        {
          q: "Är 5 % yield bra?",
          a: "Hållen över tusentals spel, ja — det ligger nära taket för vad som överlever riktiga gränser. Betydligt högre siffror kommer oftast från mjuka marknader, ett kort urval eller kampanjvärde, och de faller när insatserna stiger, eftersom oddsen som skapade dem tas bort eller begränsas.",
        },
        {
          q: "Hur många spel innan min yield betyder något?",
          a: "Fler än de flesta antar. Med platta insatser på 2.00 är en standardavvikelse av yielden 7,07 punkter över 200 spel, 3,16 över 1 000 och 2,00 över 2 500, så en +4 % når två standardavvikelser från noll först vid ungefär 2 500 spel. Under några hundra spel är siffran ett intervall.",
        },
        {
          q: "Vad händer om mina insatser varierar mycket?",
          a: "Då är spel × medelinsats bara en approximation, och den smickrar dig när vinsterna landade på de stora insatserna. Summera de faktiska insatserna och dela vinsten med den summan. Spelar du i units, räkna units: yield per satsad unit är samma siffra och lättare att hålla hederlig.",
        },
      ],
    },
    "stake-calculator": {
      metaTitle: "Insatskalkylator — insatsen för en målvinst | BetRedge",
      metaDescription:
        "Gratis insatskalkylator: fyll i oddset och vinsten du vill ha och se insatsen som krävs, den totala utbetalningen och hur stor del av kassan spelet binder.",
      h1: "Insatskalkylator",
      lede:
        "Insatsen som en målvinst kräver vid ett givet pris — och andelen av kassan den binder utan att säga det.",
      labels: {
        inputTitle: "Pris och mål",
        odds: "Odds",
        targetProfit: "Målvinst",
        bankroll: "Kassa",
        resultTitle: "Vad målet kostar",
        stakeNeeded: "Insats som krävs",
        totalReturn: "Total utbetalning",
        bankrollShare: "Andel av kassan",
        hint: "Kassan är det som gör insatsen till ett procenttal: utan den är insatsen ett tal utan något vid sidan. Oddset skrivs decimalt — 2.50, inte +150.",
        verdictModest:
          "Den här insatsen binder under 5 % av den angivna kassan, och en svit på tio förluster skulle inte avsluta den. Läs den vid sidan av priset, inte ensam: samma mål vid ett kortare pris kräver ett mycket större spel.",
        verdictHeavy:
          "Den här insatsen binder mer än 5 % av den angivna kassan på ett enda utfall. I den storleken tar en svit på tio förluster — helt vanlig kring odds 2.00 — mer än hälften av den, så kontrollera talet i kassakalkylatorn innan du spelar.",
      },
      takeaway:
        "Att utgå från vinsten du vill ha är snabbaste vägen till att satsa för mycket: den användbara frågan är inte hur mycket jag vill vinna, utan hur mycket jag kan förlora.",
      example: {
        title: "Att vilja ha 100 i vinst vid 2.50",
        rows: [
          { label: "Odds", value: "2.50" },
          { label: "Målvinst", value: "100" },
          { label: "Insats som krävs", value: "66,67" },
          { label: "Total utbetalning", value: "166,67" },
          { label: "Andel av en kassa på 1 000", value: "6,67 %" },
        ],
        note:
          "Samma 100 kostar 25,00 vid 5.00 och 400,00 vid 1.25 — målet flyttade sig inte, priset gjorde det. Och 66,67 på en kassa om 1 000 är exakt hel Kelly för någon som sätter utfallet till 44 %, medan 2.50 går jämnt upp vid 40 %. Önskan bär alltså redan på en sannolikhetsbedömning värd en fördel på +10 %, bara oredovisad.",
      },
      explainerTitle: "Att räkna baklänges från ett tal du själv valde",
      explainer: [
        "Räkningen är den lätta halvan. Ett spel ger tillbaka insatsen plus insats × (pris − 1), så **insatsen ett mål kräver är målet delat med priset minus ett** — 100 vid 2.50 kräver 66,67, och kupongen kommer tillbaka som 166,67. Det som gör sidan värd att läsa är den andra effekten: **desto kortare pris, desto större spel kräver samma önskan**. De där 100 kostar 25,00 vid 5.00, 66,67 vid 2.50, 100,00 vid 2.00 och 400,00 vid 1.25. Mellan de fyra raderna ändrades ingenting i din åsikt, och pengarna i risk rörde sig med en faktor sexton. Därför frågar kalkylatorn efter en kassa den strikt inte behöver: 66,67 är varken stort eller litet förrän du vet att det är 6,67 % av allt du lagt undan.",
        "**Att resonera från vinsten du vill ha är den kortaste vägen till en insats som är för stor**, och det havererar på ett bestämt sätt. Förlora det första spelet och målet växer tyst för att täcka det: att vilja ha 100 igen efter att ha tappat 66,67 betyder att begära 166,67, vilket vid 2.00 kräver en insats på 166,67, och faller även den blir nästa begäran 476,19 vid 1.70. Tre spel senare har 709,52 av en kassa om 1 000 exponerats för att vinna de ursprungliga 100, och priset kortades varje gång eftersom korta priser känns tryggare. **Spelet blir större precis när skälet till det blir svagare.** Den ärliga versionen av kalkylen går åt andra hållet, från vad du kan förlora till vad du kan satsa, och det är kalkylatorn för Kelly-kriteriet: där kommer storleken från en uppmätt fördel, inte från ett tal du valde. Vårt tal är inte heller en tillfällighet — 66,67 på 1 000 är exakt vad hel Kelly rekommenderar vid 2.50 till någon som tror på 44 %, mot de 40 % priset innebär. Om du inte skulle försvara de 44 % handlade insatsen aldrig om spelet.",
      ],
      faq: [
        {
          q: "Hur räknar man ut insatsen för en målvinst?",
          a: "Dela vinsten du vill ha med priset minus ett. Vid 2.50 är nettoavkastningen per satsad enhet 1,50, så 100 i vinst kräver 100 / 1,50 = 66,67 i insats och betalar 166,67 totalt. Vid 2.00 är nettoavkastningen 1,00, och därför är insatsen och målet samma tal där.",
        },
        {
          q: "Varför frågar kalkylatorn efter min kassa?",
          a: "Eftersom insatsen i sig inte säger något. 66,67 är ett avrundningsfel för en spelare och en tredjedel av kontot för en annan, och det som avgör vilket är andelen av kassan — här 6,67 %. Lämna fältet tomt och insatsen fungerar ändå; andelen blir ett streck, vilket är hederligt, för det antagandet är ditt och inte vårt att hitta på.",
        },
        {
          q: "Ska jag använda den här eller Kelly-kriteriet?",
          a: "Använd den här för att prissätta en önskan och Kelly för att dimensionera ett spel. Den här sidan startar i ett tal du valde och räknar ut vad det kostar; kalkylatorn för Kelly-kriteriet startar i en uppmätt fördel och räknar ut vad kassan kan bära. När de säger olika saker är det den som aldrig frågade efter din sannolikhetsbedömning som ska bort.",
        },
        {
          q: "Kan det någon gång vara rätt att jaga en förlust med större insats?",
          a: "Inte med den här räkningen. Varje återhämtningsbegäran är större än den förra och läggs oftast på ett kortare pris eftersom korta priser känns tryggare, så insatsen växer medan fördelen krymper. Kassaregler finns för att göra nästa insats oberoende av senaste resultatet: lås enheten som en andel av kassan och serien kan inte skena.",
        },
      ],
    },
    "bankroll-calculator": {
      metaTitle: "Kassakalkylator — enhet, drawdown och förluster till ruin | BetRedge",
      metaDescription:
        "Gratis kassakalkylator: ange kassa och enhet och se insatsen per spel, vad en förlustsvit kostar, drawdownen den lämnar och hur många förluster kassan täcker.",
      h1: "Kassakalkylator",
      lede:
        "Vad en enhet i procent faktiskt binder: insatsen per spel, kostnaden för en förlustsvit och hur många förluster i rad kassan klarar.",
      labels: {
        inputTitle: "Kassa och regel",
        bankroll: "Kassa",
        unitPercent: "Enhet (%)",
        losingStreak: "Förlustsvit",
        resultTitle: "Vad regeln kostar",
        unit: "Insats per spel",
        streakLoss: "Svitens kostnad",
        drawdown: "Drawdown",
        betsToRuin: "Förluster till ruin",
        hint: "Procent skrivs som tal: 2 betyder 2 % av kassan per spel. Förlustsviten räknar spel, så bara heltal — det är sviten du vill klara, inte en förutsägelse.",
        verdictSafe:
          "Vid 5 % per enhet eller lägre lämnar den svit du angav kassan fortfarande arbetsduglig. En svit på tio når 38,54 % av spelarna inom 1 000 spel vid jämna odds, så en plan som bara håller om du aldrig möter en är ingen plan.",
        verdictAggressive:
          "Över 5 % per enhet avslutar den vanliga förlustsviten kontot: tio förluster tar halva kassan eller mer, och från hälften krävs +100,00 % för att komma tillbaka. Eftersom en svit på tio dyker upp inom 1 000 spel för 38,54 % av spelarna är detta ett spel på att inte möta den.",
      },
      takeaway:
        "Enhetsprocenten är ingen preferens. Den är ditt beslut om hur lång den värsta förlustsviten får vara innan du är ute ur spelet.",
      example: {
        title: "En kassa på 2 000 vid 2 % per spel",
        rows: [
          { label: "Kassa", value: "2 000" },
          { label: "Enhet", value: "2 %" },
          { label: "Insats per spel", value: "40,00" },
          { label: "Tio förluster i rad", value: "400,00" },
          { label: "Drawdown", value: "20,00 %" },
          { label: "Förluster till ruin", value: "50" },
        ],
        note:
          "Det hålet på 20,00 % kräver +25,00 % på det som är kvar för att nå 2 000 igen. Flytta enheten till 5 % och samma tio förluster kostar 1 000 — en drawdown på 50,00 % som behöver +100,00 % för att återhämtas, med en kassa som täcker 20 förluster i rad i stället för 50. Tre punkter på regeln, och sviten du klarar är mindre än hälften så lång.",
      },
      explainerTitle: "Regeln som avgör hur lång svacka du klarar",
      explainer: [
        "**En enhet är en procent av kassan, inte ett belopp**, och skillnaden syns bara när det går illa. Satsa fasta 40 för alltid och en kassa som fallit till 1 000 spelar 4 % i stället för 2 %: regeln dras åt precis när den borde lossna. Räkna om enheten mot aktuellt saldo och varje förlust gör nästa insats mindre, och det är det som hindrar en förlustsvit från att fullborda jobbet. Asymmetrin under är hela skälet att bry sig — **att tappa 20 % kräver +25,00 % tillbaka, att tappa 50 % kräver +100,00 % och att tappa 80 % kräver +400,00 %.** Inget i andra halvan av de paren är symmetriskt med den första, och ingen fördel är stor nog att göra +400,00 % till en plan snarare än ett hopp. En kassa på 2 000 vid 2 % satsar 40 per spel, tar tio raka förluster för 400,00 och kommer ut på −20,00 % — med tio av de 50 förluster i rad som insatsen klarar förbrukade.",
        "**En svit på tio förluster vid odds kring 2.00 är helt vanlig, inte otur**, och detta är talet som visar det. Vid jämna odds har en enskild följd av tio en sannolikhet på 0,098 % — en på 1 024 — vilket läses som aldrig, tills du räknar hur många följder en säsong innehåller. Över 1 000 spel är chansen att möta minst en förlustsvit på tio eller längre **38,54 %**; vid 2.10, där en spelare utan fördel vinner 47,62 % av gångerna, är den **52,31 %** — bättre än en slantsingling. Över 500 spel är samma två tal 21,45 % och 30,73 %, och den längsta svit man ska vänta sig i 1 000 spel vid jämna odds är ungefär tio, eftersom den växer med tvålogaritmen av antalet spel. Sviten är inte fördelningens svans, den är dess mitt, så **en enhet över 5 % är ett spel på att inte möta det vanliga fallet**: vid 5 % tar de tio förlusterna halva kassan, vid 10 % tar de hela. När fördelen är uppmätt i stället för antagen dimensionerar kalkylatorn för Kelly-kriteriet enheten utifrån fördelen själv — läs dess tal som ett tak och den här sidan som golvet under.",
      ],
      faq: [
        {
          q: "Vilken enhetsstorlek ska jag använda?",
          a: "En till två procent av kassan per spel är det vanliga intervallet för platt insats, och över fem procent blir den vanliga förlustsviten en händelse som stänger kontot. Det hederliga sättet att välja går baklänges: bestäm den förlustsvit du vill klara, läs drawdownen kalkylatorn ger och fråga dig om du skulle spela likadant efteråt.",
        },
        {
          q: "Varför visas förluster till ruin som ett heltal?",
          a: "För att det räknar spel, och en bråkdel av ett spel är inget spel. En kassa på 1 000 vid 3 % ger en enhet på 30, alltså 33 förluster och en tredjedel — svaret blir därför 33, avrundat nedåt, eftersom kassan inte längre täcker nästa i sin helhet. Att avrunda uppåt skulle utlova ett spel som pengarna inte finns till.",
        },
        {
          q: "Är tio förluster i rad verkligen normalt?",
          a: "Ja, och räkningen är inte ens nära. En enskild följd av tio förluster vid jämna odds är en händelse på 0,098 %, men över 1 000 spel finns så många följder att chansen att möta minst en är 38,54 %, och 52,31 % vid 2.10 där en spelare utan fördel vinner 47,62 % av gångerna. Planera för den i stället för att bli överraskad.",
        },
        {
          q: "Ska jag använda den här eller Kelly-kriteriet?",
          a: "Den här när du inte har en uppmätt fördel, vilket är för det mesta: en enhet i procent kräver ingen sannolikhetsbedömning och dess värsta fall är känt i förväg. Kalkylatorn för Kelly-kriteriet är rätt verktyg så snart du kan försvara en sannolikhet, och den rekommenderar oftast mer än platta 2 %. Att läsa dess svar som ett tak och den platta regeln som ett golv håller båda hederliga.",
        },
      ],
    },
  },
};

export default sv;
