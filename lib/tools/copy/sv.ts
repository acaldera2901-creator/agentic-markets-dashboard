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
      formulaTitle: "Så fungerar omvandlingen",
      formula: [
        "decimal = 1 + (amerikanskt / 100)          om amerikanskt är positivt",
        "decimal = 1 + (100 / |amerikanskt|)        om amerikanskt är negativt",
        "decimal = 1 + (täljare / nämnare)          för bråkodds",
        "implicit sannolikhet = 1 / decimal",
      ],
      explainerTitle: "Att läsa ett pris i vilket format som helst",
      explainer: [
        "Odds är en sannolikhet i andra kläder. Decimalodds — europeisk standard — anger den totala återbetalningen per satsad enhet: 2.50 ger tillbaka 2.50 för varje riskerad 1, insatsen inräknad. Bråkodds, fortfarande standard inom brittisk galopp, anger vinsten istället för återbetalningen: 3/2 betyder tre enheter vinst per två riskerade, alltså samma 2.50 decimal. Amerikanska odds anger hur mycket du vinner på 100 (+150) eller hur mycket du måste riskera för att vinna 100 (−110). Hongkong, Malay och Indonesian är de asiatiska marknadernas format, och de spelar roll eftersom de skarpaste priserna ofta finns där.",
        "Talet som är värt att läsa är det sista: den implicita sannolikheten, alltså 1 delat med decimaloddset. Ett pris på 2.50 innebär 40 %. Ett pris på 1.9091 — den välkända −110 — innebär 52,38 %. Det är den chans spelbolaget uttalar, och det är det enda talet du kan jämföra direkt med din egen uppskattning. Två odds i olika format är inte lättare att jämföra än två sannolikheter: omvandla först, diskutera sedan.",
        "En begränsning den här omvandlaren inte kan ta bort: den implicita sannolikheten innehåller fortfarande spelbolagets marginal. Summera de implicita sannolikheterna för alla utfall i en marknad och du kommer över 100 % — överskottet är marginalen, och den blåser upp varenda en av de sannolikheterna. Vill du marknadens ärliga bedömning istället för dess prissatta, kör marknaden genom marginalkalkylatorn och använd de rättvisa sannolikheter den ger.",
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
      formulaTitle: "Så beräknas marginalen",
      formula: [
        "overround = Σ (1 / oddsᵢ)",
        "marginal = overround − 1",
        "återbetalning = 1 / overround",
        "rättvis sannolikhetᵢ = (1 / oddsᵢ) / overround",
        "rättvist oddsᵢ = 1 / rättvis sannolikhetᵢ",
      ],
      explainerTitle: "Marginalen är priset på spelet",
      explainer: [
        "En rättvis tvåvägsmarknad prissätter båda sidor till 2.00: de implicita sannolikheterna är 50 % och 50 %, de summerar till exakt 100 %, och ingen sida har någon fördel. Verkliga marknader prissätts till 1.90 och 1.90. De implicita sannolikheterna blir 52,63 % var, summerar till 105,26 %, och de överskjutande 5,26 procentenheterna är spelbolagets marginal — overrounden. Vilken sida du än spelar betalar du den.",
        "Marginalen är det mest användbara talet när du väljer var du spelar. Samma match med 5 % marginal och med 2 % marginal är inte samma spel: det snävare bolaget lämnar dig runt tre procentenheter väntat värde vid identiska åsikter. Marginalerna varierar kraftigt mellan marknader: huvudlinjer hos skarpa bolag kan ligga under 2 %, medan vinnarmarknader, spelarmarknader och specialspel rutinmässigt bär 8 % eller mer — där vet bolagen att deras priser prövas minst.",
        "Att ta bort marginalen ger den rättvisa linjen, den så kallade no-vig-linjen. Den här kalkylatorn gör det proportionellt: varje implicit sannolikhet divideras med deras summa, så att de åter summerar till exakt 100 %, och de rättvisa oddsen är inverserna. Den linjen är det närmaste marknadens ärliga uppskattning du kommer, och den är referenspunkten för EV-kalkylatorn: ett spel har positivt väntat värde bara om din sannolikhet överstiger den rättvisa, inte enbart den prissatta.",
        "En uttalad begränsning: proportionell borttagning fördelar marginalen jämnt över utfallen, och verkliga bolag gör inte så. De lägger mer marginal på osannolika utfall, eftersom det är där nöjesspelandet samlas. I en marknad med tydlig favorit och avlägsen outsider underskattar metoden favoritens verkliga chans något. På huvudlinjer är snedvridningen liten; på lotteriliknande vinnarmarknader är den rättvisa linjen en uppskattning, inte en mätning.",
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
      formulaTitle: "Så beräknas väntat värde",
      formula: [
        "EV = p × (odds − 1) × insats − (1 − p) × insats",
        "   = (p × odds − 1) × insats",
        "fördel = p × odds − 1",
        "break-even-pris = 1 / p",
      ],
      explainerTitle: "Vad väntat värde faktiskt säger",
      explainer: [
        "Väntat värde är det genomsnittliga utfallet av ett spel om du kunde upprepa det obegränsat många gånger. Det har två ingångar och inga åsikter: priset du erbjuds och sannolikheten du ger utfallet. Om du tror att ett lag vinner 55 % av gångerna och någon erbjuder 2.00 är räkningen omedelbar: 55 % av gångerna vinner du en enhet, 45 % förlorar du den, alltså tjänar du i genomsnitt 0,10 enheter per satsad enhet. Det är 10 % fördel, och det är vad +EV betyder.",
        "Talet som avgör allt är sannolikheten, och där förlorar de flesta spelare tyst. Ett fel på 5 punkter i uppskattningen räcker för att göra 4 % fördel till 1 % förlust, och uppskattningar gjorda på ögonmått avviker rutinmässigt med betydligt mer än 5 punkter. Därför finns kalkylatorns andra läge: istället för att lita på magkänslan, ta priset på båda sidor hos ett skarpt bolag, ta bort marginalen och använd den rättvisa sannolikhet som blir kvar. Frågan är inte längre om du är smartare än marknaden, utan om bolaget du spelar hos är långsammare än det skarpaste.",
        "Läs EV som en takt, inte som ett löfte. Ett spel med 4 % väntat värde ger ingenting vid ett enskilt tillfälle: det vinner eller förlorar. De 4 % framträder först över hundratals oberoende spel, och bara om sannolikheten stämde. På kort sikt är variansen betydligt större än fördelen, och just därför betyder insatsens storlek lika mycket som fördelen — det är Kelly-kriteriets uppgift.",
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
        "Kelly-kriteriet besvarar det väntat värde hoppar över: hur mycket ska man faktiskt riskera givet en fördel? Satsa för lite och en verklig fördel växer för långsamt för att betyda något. Satsa för mycket och matematiken vänder sig mot dig: en kassa som halveras behöver +100 % för att komma tillbaka, så för stora insatser förstör tillväxten även när varje enskilt spel är gynnsamt. Den optimala andelen är fördelen delad med nettooddset, och den skalar med fördelen, inte med övertygelsen: 10 % fördel vid 2.00 kräver 10 % av kassan, samma fördel vid 5.00 bara 2,5 %.",
        "Nästan ingen bör spela hel Kelly, för formeln antar att din sannolikhet är exakt och det är den aldrig. Ge den en överskattad fördel och den rekommenderar villigt en insats som är för stor för den fördel du faktiskt har: det snabbaste sättet att förlora en kassa medan man har rätt i genomsnitt. Halv Kelly ger upp en fjärdedel av den teoretiska tillväxten och halverar ungefär volatiliteten; kvarts Kelly är vad många professionella med verkliga modeller använder. Och när priset inte ger någon fördel är rätt insats noll: en negativ Kelly-andel betyder att spelet hör till andra sidan, aldrig att man ska satsa mindre på den här.",
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
      formulaTitle: "Så beräknas sannolikheterna",
      formula: [
        "odds = 1 / sannolikhet",
        "sannolikhet = 1 / odds",
        "break-even-sannolikhet = 1 / odds",
        "kombinationens sannolikhet = p₁ × p₂ × … × pₙ",
        "kombinationens odds = odds₁ × odds₂ × … × oddsₙ",
      ],
      explainerTitle: "Sannolikheten först, priset sedan",
      explainer: [
        "Varje pris är ett påstående om en sannolikhet, och omvandlingen mellan dem är en division: en sannolikhet på 40 % är ett pris på 2.50, och ett pris på 2.50 är en sannolikhet på 40 %. Att göra omvandlingen före spelet ändrar frågan från «gillar jag det här spelet?» till «tror jag att utfallet inträffar i mer än 40 % av fallen?» — en fråga man faktiskt kan ha fel om, och därför en fråga värd att ställa.",
        "Samma tal, läst från prissidan, är break-even-sannolikheten: den minsta chans ett utfall behöver för att spelet ska vara neutralt. Ett pris på 1.75 kräver 57,1 %. Ett pris på 1.50 kräver 66,7 %. Långa priser kräver mycket lite — 15.00 begär bara 6,7 % — därför känns de billiga och därför lägger bolagen sin marginal där. Break-even-sannolikheten är spelets ärliga test: kan du inte argumentera för att utfallet överstiger den är priset inte generöst, det är korrekt.",
        "I kombinationsspel blir sannolikhet kontraintuitiv. Oberoende delspel multipliceras: tre spel du bedömer till 50 % vardera blir tillsammans 12,5 %, inte något betryggande nära hälften. Fyra delspel på 60 % ger 12,96 %. Det kombinerade oddset multipliceras likadant, och där ligger fällan: en kombination på 15.00 ser ut som ett fynd tills man märker att den kräver en händelse på 6,7 %, och att bolagets marginal har lagts på varje delspel och sedan sammansatts. Fyra delspel med 5 % marginal vardera bär nästan 21 % total marginal.",
        "Ett antagande att hålla i minnet: kalkylatorn multiplicerar och antar därmed oberoende delspel. Två utfall från samma match — att ett lag vinner och att dess forward gör mål — är korrelerade, och att multiplicera deras sannolikheter underskattar den verkliga chansen att båda inträffar. Kombinationer inom en match prissätts separat av bolagen just eftersom korrelationen är svår att beräkna: behandla talet här som en undre gräns, inte som ett svar.",
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
  },
};

export default sv;
