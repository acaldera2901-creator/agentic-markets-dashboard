// lib/tools/copy/pl.ts (#TOOLS-HUB-0805)
// Polski. Lokalne frazy: "kalkulator kursów", "kalkulator wartości oczekiwanej",
// "kryterium Kelly'ego", "marża bukmachera".

import type { ToolsCopy } from "./types";

const pl: ToolsCopy = {
  hub: {
    metaTitle: "Darmowe narzędzia bukmacherskie — kursy, EV, Kelly i marża | BetRedge",
    metaDescription:
      "Pięć darmowych kalkulatorów: przeliczanie kursów na każdy format, usuwanie marży bukmachera, wartość oczekiwana i dobór stawki według Kelly'ego. Bez rejestracji.",
    h1: "Darmowe narzędzia bukmacherskie",
    lede:
      "Pięć obliczeń, które wykonuje się przed zakładem: kursy przeliczone, marża usunięta, stawka dobrana. Bezpłatnie, bez konta.",
    cardCta: "Otwórz narzędzie",
    intro: [
      "Każdy zakład to porównanie ceny z prawdopodobieństwem. Te pięć kalkulatorów wykonuje je porządnie: przeliczają kursy między formatami, usuwają marżę bukmachera i odsłaniają uczciwą linię, zamieniają oszacowanie prawdopodobieństwa w wartość oczekiwaną i dobierają stawkę tak, aby seria przegranych nie zamknęła bankrolla.",
      "Wszystko działa wyłącznie w twojej przeglądarce: nic nie jest wysyłane, nic nie jest zapisywane i nie trzeba zakładać konta. Korzystaj z nich osobno albo używaj ich, by sprawdzić to, co nasz model publikuje przy każdym meczu.",
    ],
  },

  common: {
    backLabel: "Strona główna",
    ctaTitle: "Te liczby liczymy przy każdym meczu",
    ctaBody:
      "Kalkulatory pracują na jednej cenie naraz. BetRedge skanuje rynek bez przerwy, usuwa marżę, porównuje z prawdopodobieństwem modelu i pokazuje, gdzie te dwie rzeczy się rozchodzą — piłka nożna i tenis, aktualizowane cały dzień.",
    ctaButton: "Zobacz dzisiejszą tablicę",
    otherTools: "Inne darmowe narzędzia",
    langLabel: "Język",
    free: "Darmowe",
    faqTitle: "Pytania",
    invalid: "—",
  },

  tools: {
    "odds-converter": {
      metaTitle: "Kalkulator kursów — dziesiętne, ułamkowe, amerykańskie i prawdopodobieństwo | BetRedge",
      metaDescription:
        "Darmowy konwerter kursów: wpisz cenę w dowolnym formacie — dziesiętnym, ułamkowym, amerykańskim, Hongkong, Malay lub Indonesian — i odczytaj ją we wszystkich innych.",
      h1: "Konwerter kursów",
      lede:
        "Wpisz cenę w jednym formacie i odczytaj ją we wszystkich pozostałych, razem z prawdopodobieństwem, które podaje bukmacher.",
      labels: {
        inputTitle: "Twoja cena",
        oddsInput: "Kurs",
        formatSelect: "Format",
        resultTitle: "Ta sama cena w każdym formacie",
        decimal: "Dziesiętny",
        american: "Amerykański",
        fractional: "Ułamkowy",
        hongkong: "Hongkong",
        malay: "Malay",
        indonesian: "Indonesian",
        impliedProbability: "Prawdopodobieństwo implikowane",
        hint: "Format dziesiętny przyjmuje też przecinek: 2,50 działa jak 2.50.",
      },
      takeaway:
        "Każdy kurs to przebrane prawdopodobieństwo. Najpierw przelicz, potem dyskutuj: 2.50 znaczy, że bukmacher mówi ci 40%.",
      example: {
        title: "Jeden kurs, wszystkie formaty",
        rows: [
          { label: "Wpisujesz", value: "2.50" },
          { label: "Amerykański", value: "+150" },
          { label: "Ułamkowy", value: "3/2" },
          { label: "Hongkong · Malay · Indonesian", value: "1.50 · −0.67 · +1.50" },
          { label: "Prawdopodobieństwo implikowane", value: "40,00%" },
        ],
        note:
          "Zmień jeden i pozostałe podążą. Uwaga na zaokrąglenie: znane −110 to dziesiętnie 1.9091 i implikuje 52,38%, natomiast wyświetlone 1.91 implikuje 52,36% — różnica, która wygląda na nic i ma znaczenie, bo przewaga rozgrywa się w dziesiątych części punktu.",
      },
      explainerTitle: "Odczytać cenę w dowolnym formacie",
      explainer: [
        "**Kurs to prawdopodobieństwo w innym ubraniu.** Dziesiętny — standard europejski — podaje całkowity zwrot na jednostkę stawki: 2.50 zwraca 2.50 za każde ryzykowane 1, razem ze stawką. Ułamkowy podaje zysk: 3/2 to trzy jednostki zysku na dwie ryzykowane, ten sam 2.50. Amerykański mówi, ile wygrywasz przy stawce 100 (+150) albo ile musisz zaryzykować, by wygrać 100 (−110). Hongkong, Malay i Indonesian to formaty azjatyckie i mają znaczenie, bo tam często stoją najostrzejsze ceny.",
        "Liczba warta czytania jest ostatnia. **Prawdopodobieństwo implikowane to 1 podzielone przez kurs dziesiętny** i jest jedyną wartością, którą możesz porównać bezpośrednio z własnym oszacowaniem: dwóch kursów w różnych zapisach nie porównuje się łatwiej niż dwóch prawdopodobieństw. Ograniczenie, którego to narzędzie nie zdejmie: **prawdopodobieństwo implikowane wciąż zawiera marżę bukmachera**, więc zsumuj wszystkie wyniki rynku i przekroczysz 100%. Po uczciwą opinię rynku, a nie opinię z narzutem, przepuść go przez kalkulator marży.",
      ],
      faq: [
        {
          q: "W jakim formacie najlepiej liczyć?",
          a: "W dziesiętnym, o ile nie ma powodu, by robić inaczej. Mnożenie kursów dziesiętnych od razu daje cenę kuponu wielokrotnego, a 1 podzielone przez kurs daje prawdopodobieństwo implikowane — obie operacje są niewygodne w notacji ułamkowej i amerykańskiej.",
        },
        {
          q: "Dlaczego −110 wychodzi jako 1,909090…?",
          a: "Bo 100/110 to liczba okresowa. Po zaokrągleniu do dwóch miejsc daje 1.91, czyli to, co pokazują bukmacherzy, ale konwerter trzyma wewnątrz pełną dokładność, żeby ciąg obliczeń nie odjechał od wyniku.",
        },
        {
          q: "Czym różnią się kursy Malay i Indonesian?",
          a: "Są swoim odbiciem. Malay są dodatnie poniżej 2.00 i ujemne powyżej; Indonesian są dodatnie powyżej 2.00 i ujemne poniżej. Wyrażają tę samą cenę i przeliczają się na ten sam kurs dziesiętny.",
        },
      ],
    },

    "margin-calculator": {
      metaTitle: "Kalkulator marży bukmachera — overround, wypłata i kursy uczciwe | BetRedge",
      metaDescription:
        "Darmowy kalkulator marży: wpisz kursy wszystkich wyników i poznaj marżę bukmachera, procent wypłaty oraz kursy uczciwe po usunięciu narzutu.",
      h1: "Kalkulator marży",
      lede:
        "Wpisz wszystkie ceny rynku i zobacz, ile zatrzymuje bukmacher — oraz jaka uczciwa linia leży pod spodem.",
      labels: {
        inputTitle: "Rynek",
        outcome: "Wynik",
        addOutcome: "Dodaj wynik",
        removeOutcome: "Usuń",
        resultTitle: "Ile liczy sobie bukmacher",
        margin: "Marża bukmachera",
        payout: "Wypłata",
        fairOddsTitle: "Uczciwa linia, marża usunięta",
        fairOdds: "Kurs uczciwy",
        fairProbability: "Prawdopodobieństwo uczciwe",
        impliedProbability: "Prawdopodobieństwo implikowane",
        hint: "Dodaj wynik dla rynków trzydrogowych albo więcej dla rynków na zwycięzcę.",
      },
      takeaway:
        "Marża to cena prawa do posiadania opinii. Dwóch bukmacherów, ten sam mecz — a różnica to pieniądze.",
      example: {
        title: "Ten sam mecz u dwóch bukmacherów",
        rows: [
          { label: "Bukmacher rekreacyjny", value: "1.90 / 1.90 · marża 5,26%" },
          { label: "Bukmacher ostry", value: "1.98 / 1.98 · marża 1,01%" },
          { label: "Linia uczciwa, obaj", value: "2.00 / 2.00 · po 50%" },
          { label: "Twój EV przy realnych 50%", value: "−5% wobec −1% na zakład" },
        ],
        note:
          "Ta sama opinia, ten sam mecz. Postawienie 100 dwieście razy kosztuje 1000 u pierwszego bukmachera i 200 u drugiego: osiem groszy różnicy kursu to 800 w skali sezonu. To najtańsza przewaga w zakładach i nie wymaga żadnego modelu.",
      },
      explainerTitle: "Marża to cena zakładu",
      explainer: [
        "**Uczciwy rynek dwudrogowy wycenia obie strony na 2.00.** Prawdopodobieństwa implikowane to 50% i 50%, sumują się dokładnie do 100%, żadna strona nie ma przewagi. Rzeczywiste rynki wyceniane są na 1.90 i 1.90: te implikowane wynoszą po 52,63%, sumują się do 105,26%, a **nadwyżkowe 5,26 punktu to marża bukmachera** — overround. Którąkolwiek stronę zagrasz, płacisz ją. Marże mocno się różnią: główne linie u ostrych bukmacherów schodzą pod 2%, natomiast rynki na zwycięzcę i rynki zawodników rutynowo mają 8% i więcej, bo tam bukmacherzy wiedzą, że ich ceny są najmniej sprawdzane.",
        "Usunięcie marży daje linię uczciwą, no-vig. Ten kalkulator robi to proporcjonalnie — każde implikowane dzielone przez ich sumę, więc znów dają dokładnie 100% — a **ta linia uczciwa jest punktem odniesienia każdej decyzji +EV**: zakład ma dodatnią wartość oczekiwaną tylko wtedy, gdy twoje prawdopodobieństwo bije uczciwe, a nie po prostu wycenione. Zadeklarowane ograniczenie: prawdziwi bukmacherzy dokładają marży wynikom nieprawdopodobnym, więc na rynku z wyraźnym faworytem ta metoda go trochę zaniża. Na zrównoważonych liniach zaburzenie jest małe; na loteryjnych rynkach na zwycięzcę traktuj linię uczciwą jako oszacowanie.",
      ],
      faq: [
        {
          q: "Jaka marża jest akceptowalna?",
          a: "Na głównych liniach w piłce i tenisie poniżej 3% to ostro, 4–5% to normalnie u bukmachera rekreacyjnego, powyżej 7% płacisz dużo za prawo do posiadania opinii. Porównaj ten sam rynek u kilku bukmacherów przed decyzją.",
        },
        {
          q: "Czy procent wypłaty to to samo co marża?",
          a: "To dwa odczyty tej samej liczby. Marża 5,26% odpowiada wypłacie 95%: bukmacher spodziewa się zwrócić 95 z każdych 100 postawionych na całym rynku. Wypłata jest wygodniejsza do porównań.",
        },
        {
          q: "Dlaczego prawdopodobieństwa uczciwe sumują się dokładnie do 100%?",
          a: "Bo taka jest definicja usunięcia marży. Wycenione sumują się do więcej niż 100%; dzielenie każdego przez tę sumę przeskalowuje je tak, by dawały jedność, co musi robić spójny zestaw prawdopodobieństw.",
        },
        {
          q: "Czy działa na rynkach trzydrogowych i na zwycięzcę?",
          a: "Tak — dodaj tyle wyników, ile ma rynek. Matematyka jest identyczna dla dowolnej liczby wyników, pod warunkiem że wpiszesz wszystkie. Pominięcie jednego zaniża marżę.",
        },
      ],
    },

    "ev-calculator": {
      metaTitle: "Kalkulator wartości oczekiwanej (EV) — z uczciwą linią lub bez | BetRedge",
      metaDescription:
        "Darmowy kalkulator wartości oczekiwanej: wpisz kurs, prawdopodobieństwo i stawkę, by poznać EV w walucie i procentach — albo wylicz prawdopodobieństwo z linii ostrego bukmachera.",
      h1: "Kalkulator wartości oczekiwanej",
      lede:
        "Ile średnio wart jest zakład: z twojego prawdopodobieństwa albo z linii ostrego bukmachera po usunięciu marży.",
      labels: {
        inputTitle: "Zakład",
        modeTitle: "Skąd bierze się prawdopodobieństwo",
        modeManual: "Moje oszacowanie",
        modeSharp: "Od ostrego bukmachera",
        yourOdds: "Twoja cena",
        yourProbability: "Twoje prawdopodobieństwo (%)",
        sharpOddsA: "Ostra cena, twoja strona",
        sharpOddsB: "Ostra cena, druga strona",
        derivedProbability: "Prawdopodobieństwo uczciwe, marża usunięta",
        stake: "Stawka",
        resultTitle: "Ile wart jest zakład",
        ev: "Wartość oczekiwana",
        fairOdds: "Cena progu opłacalności",
        edge: "Przewaga",
        positive: "Dodatnia wartość oczekiwana przy tej cenie.",
        negative: "Ujemna wartość oczekiwana przy tej cenie.",
        neutral: "Próg opłacalności: cena dokładnie odpowiada prawdopodobieństwu.",
        hint: "Procenty wpisuj jako liczby: 55 oznacza 55%.",
      },
      takeaway:
        "Nie musisz zgadywać lepiej niż rynek: musisz tylko znaleźć bukmachera wolniejszego niż najostrzejszy.",
      example: {
        title: "Pożyczyć prawdopodobieństwo od ostrego bukmachera",
        rows: [
          { label: "Ostry bukmacher, obie strony", value: "1.95 / 1.95" },
          { label: "Prawdopodobieństwo uczciwe, bez marży", value: "50,00%" },
          { label: "Cena progu opłacalności", value: "2.00" },
          { label: "Twój bukmacher oferuje", value: "2.10" },
          { label: "EV przy stawce 100", value: "+5,00 (+5%)" },
        ],
        note:
          "Żadna opinia nie była potrzebna: ostra linia dała prawdopodobieństwo, a twój bukmacher wycenił ten sam wynik na 2.10 tam, gdzie uczciwe było 2.00. Przesuń ostre kursy na 1.90/1.90, a prawdopodobieństwo uczciwe wciąż wynosi 50% — o to właśnie chodzi w usuwaniu marży: odpowiedź nie przesuwa się razem z narzutem.",
      },
      explainerTitle: "Co naprawdę mówi wartość oczekiwana",
      explainer: [
        "**Wartość oczekiwana to średni wynik zakładu, który mógłbyś powtarzać bez końca.** Dwa wejścia, żadnych opinii: oferowana cena i prawdopodobieństwo, które przypisujesz wynikowi. Uważasz, że drużyna wygrywa w 55% przypadków, a ktoś oferuje 2.00 — rachunek jest natychmiastowy: w 55% zyskujesz jednostkę, w 45% ją tracisz, czyli 0,10 jednostki na jednostkę stawki. To przewaga 10% i tylko to znaczy +EV.",
        "**Prawdopodobieństwo to miejsce, w którym prawie wszyscy przegrywają po cichu.** Błąd o 5 punktów zamienia przewagę 4% w stratę 1%, a oszacowania na oko mylą się znacznie bardziej. Stąd drugi tryb tego kalkulatora: zamiast ufać intuicji, weź obie strony u ostrego bukmachera, usuń marżę i użyj wynikającego prawdopodobieństwa uczciwego. Czytaj wynik jak stopę, nie obietnicę — przewaga 4% nie daje nic na pojedynczym zakładzie, pojawia się dopiero na setkach i tylko wtedy, gdy prawdopodobieństwo było trafne. Dlatego wielkość stawki liczy się tak samo jak przewaga.",
      ],
      faq: [
        {
          q: "Skąd wziąć prawdopodobieństwo, któremu można zaufać?",
          a: "Z modelu zbudowanego na danych albo z samego rynku. Uczciwa linia ostrego bukmachera — jego ceny bez marży — jest trudna do pobicia samym wyczuciem, a można ją sprawdzić bezpłatnie.",
        },
        {
          q: "Czy zakład z dodatnim EV to dobry zakład?",
          a: "To warunek konieczny, nie wystarczający. Zakład może mieć dodatnią wartość oczekiwaną i wciąż być błędem, jeśli stawka jest zbyt duża wobec bankrolla, przewaga mieści się w błędzie oszacowania albo rynek zmieni się przeciwnie przed rozpoczęciem.",
        },
        {
          q: "Dlaczego kalkulator prosi o obie strony ostrego rynku?",
          a: "Bo z jednej ceny nie da się usunąć marży. Widać ją tylko po zsumowaniu prawdopodobieństw implikowanych wszystkich wyników: druga cena sprawia, że prawdopodobieństwo uczciwe da się obliczyć.",
        },
      ],
    },

    "kelly-criterion": {
      metaTitle: "Kalkulator kryterium Kelly'ego — optymalna stawka z przewagi i bankrolla | BetRedge",
      metaDescription:
        "Darmowy kalkulator kryterium Kelly'ego: wpisz kurs, prawdopodobieństwo i bankroll, by poznać stawkę maksymalizującą wzrost w długim okresie — pełny, połowa lub ćwierć Kelly.",
      h1: "Kalkulator kryterium Kelly'ego",
      lede:
        "Stawka, która najszybciej powiększa bankroll w długim okresie — i dlaczego prawie każdy powinien obstawiać mniej, niż ona wskazuje.",
      labels: {
        inputTitle: "Zakład i bankroll",
        odds: "Cena",
        probability: "Twoje prawdopodobieństwo (%)",
        bankroll: "Bankroll",
        fractionTitle: "Frakcja Kelly'ego",
        fractionFull: "Pełny",
        fractionHalf: "Połowa",
        fractionQuarter: "Ćwierć",
        resultTitle: "Zalecana stawka",
        stake: "Stawka",
        stakePercent: "Część bankrolla",
        edge: "Przewaga",
        fullKelly: "Pełny Kelly",
        growth: "Oczekiwany wzrost na zakład",
        noEdge: "Brak przewagi przy tej cenie — optymalna stawka to zero.",
        hint: "Procenty wpisuj jako liczby: 55 oznacza 55%.",
      },
      takeaway:
        "Kelly dobiera stawkę do przewagi, nie do twojej pewności — i prawie każdy powinien świadomie obstawiać mniej, niż on mówi.",
      example: {
        title: "Co to znaczy przy bankrollu 1000",
        rows: [
          { label: "Bankroll", value: "1000" },
          { label: "Kurs · twoje prawdopodobieństwo", value: "2.00 · 55%" },
          { label: "Przewaga", value: "+10%" },
          { label: "Pełny Kelly", value: "10% → 100 na zakład" },
          { label: "Połowa Kelly", value: "5% → 50 na zakład" },
        ],
        note:
          "Pięć przegranych z rzędu — przy tym kursie jedna seria na 54 — zostawia 590 przy pełnym Kellym, a powrót do 1000 wymaga +69%. Ta sama seria przy połowie Kelly'ego zostawia 774, gdzie wystarcza +29%. Ta sama przewaga, te same zakłady, o połowę mniejszy dołek.",
      },
      explainerTitle: "Dobrać stawkę tak, by zła seria jej nie zakończyła",
      explainer: [
        "Kryterium Kelly'ego odpowiada na to, co wartość oczekiwana pomija: mając przewagę, ile faktycznie ryzykować? Obstawiaj za mało i prawdziwa przewaga kapitalizuje się zbyt wolno, by mieć znaczenie. Obstawiaj za dużo i matematyka obraca się przeciw tobie: bankroll zmniejszony o połowę potrzebuje +100%, żeby wrócić do punktu wyjścia, więc zbyt duże stawki niszczą wzrost nawet wtedy, gdy każdy zakład jest korzystny. Optymalna frakcja to przewaga podzielona przez kurs netto i **skaluje się z przewagą, nie z pewnością**: przewaga 10% przy 2.00 wymaga 10% bankrolla, ta sama przewaga przy 5.00 tylko 2,5%.",
        "**Prawie nikt nie powinien grać pełnym Kellym**, bo formuła zakłada, że twoje prawdopodobieństwo jest dokładne, a nigdy nie jest. Podaj jej zawyżoną przewagę i ochoczo zaleci stawkę zbyt dużą wobec przewagi, którą naprawdę masz: najszybszy sposób utraty bankrolla przy jednoczesnym byciu przeciętnie w porządku. Połowa Kelly'ego rezygnuje z jednej czwartej teoretycznego wzrostu i mniej więcej o połowę obniża zmienność; ćwierć Kelly'ego stosuje wielu profesjonalistów z prawdziwymi modelami. A gdy cena nie daje przewagi, właściwa stawka to zero: ujemna frakcja Kelly'ego oznacza, że zakład jest po drugiej stronie, a nie że masz obstawić mniej po tej.",
      ],
      faq: [
        {
          q: "Pełny, połowa czy ćwierć Kelly'ego?",
          a: "Połowa albo ćwierć dla prawie każdego. Pełny jest optymalny tylko wtedy, gdy oszacowanie prawdopodobieństwa jest dokładne, a błąd oszacowania szkodzi przy zbyt dużej stawce znacznie bardziej, niż pomaga przy zbyt małej. Kelly frakcyjny wymienia trochę wzrostu na dużo przetrwania.",
        },
        {
          q: "Czym jest oczekiwany wzrost na zakład?",
          a: "Średnim logarytmicznym wzrostem bankrolla dla jednego zakładu przy tej stawce. Jest mały z założenia — wartość 0,005 to około pół punktu procentowego wzrostu składanego na zakład — i to jest wielkość, którą Kelly maksymalizuje.",
        },
        {
          q: "A jeśli mam kilka zakładów jednocześnie?",
          a: "Kelly dla pojedynczego zakładu obstawia za dużo, gdy zakłady biegną równolegle, zwłaszcza przy korelacji. Praktyczna zasada: podziel całość między jednoczesne pozycje, a zakłady skorelowane traktuj jak jeden.",
        },
        {
          q: "Dlaczego pokazuje zero, choć wydaje mi się, że mam przewagę?",
          a: "Bo przy wpisanej cenie twoje prawdopodobieństwo nie przekracza progu opłacalności. Porównaj cenę z 1 podzielonym przez twoje prawdopodobieństwo: jeśli cena jest niższa, nie ma przewagi do obstawienia.",
        },
      ],
      caveat:
        "Kryterium Kelly'ego maksymalizuje wzrost w długim okresie, a nie komfort. Nawet przy właściwej stawce spadki o 30% i więcej są zwyczajne, a formuła zakłada dokładne oszacowanie prawdopodobieństwa: jeśli jest optymistyczne, Kelly będzie systematycznie obstawiał za dużo i bankroll można stracić. Nigdy nie obstawiaj pieniędzy, które są ci potrzebne.",
    },

    "probability-calculator": {
      metaTitle: "Kalkulator prawdopodobieństwa — kursy, próg opłacalności i kupony | BetRedge",
      metaDescription:
        "Darmowy kalkulator prawdopodobieństwa dla zakładów: przelicz prawdopodobieństwo i kurs, znajdź próg opłacalności ceny i połącz zdarzenia w kupon wielokrotny.",
      h1: "Kalkulator prawdopodobieństwa",
      lede:
        "Zamień prawdopodobieństwa na ceny i odwrotnie, sprawdź czego wymaga od ciebie cena i ile naprawdę wart jest kupon.",
      labels: {
        inputTitle: "Prawdopodobieństwo i cena",
        modeTitle: "Co masz?",
        modeProbability: "Prawdopodobieństwo",
        modeOdds: "Cenę",
        probability: "Prawdopodobieństwo (%)",
        odds: "Kurs dziesiętny",
        breakEven: "Prawdopodobieństwo progu opłacalności",
        fairOdds: "Cena uczciwa",
        parlayTitle: "Kupon wielokrotny",
        leg: "Zdarzenie",
        addLeg: "Dodaj zdarzenie",
        removeLeg: "Usuń",
        parlayProbability: "Prawdopodobieństwo łączne",
        parlayOdds: "Kurs łączny",
        resultTitle: "Wyniki",
        hint: "Cena i jej próg opłacalności to ta sama liczba czytana z dwóch stron.",
      },
      takeaway:
        "Zdarzenia się mnożą, a razem z nimi narzut bukmachera. Czwórka po 1.80 wymaga zdarzenia o prawdopodobieństwie 9,5%.",
      example: {
        title: "Ile naprawdę kosztuje czwórka",
        rows: [
          { label: "Cztery zdarzenia po", value: "1.80 każde · 55,56%" },
          { label: "Kurs łączny", value: "10.50" },
          { label: "Prawdopodobieństwo łączne", value: "9,53%" },
          { label: "Marża na zdarzenie", value: "5%" },
          { label: "Marża na kuponie", value: "21,6%" },
        ],
        note:
          "Kurs wygląda hojnie, dopóki nie zobaczysz, czego wymaga: zdarzenia o 9,5%. A narzut bukmachera złożył się cztery razy — 1,05⁴ − 1 = 21,6% — więc te same cztery wybory kosztują cię czterokrotność marży pojedynczego zakładu. Zdarzenia skorelowane z jednego meczu to inna sprawa: mnożenie je zaniża, i właśnie dlatego bukmacherzy wyceniają kupony z jednego meczu osobno.",
      },
      explainerTitle: "Najpierw prawdopodobieństwo, potem cena",
      explainer: [
        "**Każda cena jest twierdzeniem o prawdopodobieństwie**, a przeliczenie to jedno dzielenie: 40% to cena 2.50, a 2.50 to prawdopodobieństwo 40%. Wykonanie tego przeliczenia przed zakładem zmienia pytanie z «czy podoba mi się ten zakład?» na «czy to zdarza się częściej niż w 40% przypadków?» — pytanie, w którym można się mylić. Czytana od strony ceny ta sama liczba to **prawdopodobieństwo progu opłacalności**: minimalna szansa, jaką musi mieć wynik, by zakład był neutralny. 1.75 wymaga 57,1%; 1.50 wymaga 66,7%; 15.00 prosi tylko o 6,7%, dlatego długie kursy wydają się tanie i dlatego bukmacherzy dokładają tam marży.",
        "**Kupony wielokrotne to miejsce, gdzie prawdopodobieństwo staje się nieintuicyjne.** Niezależne zdarzenia mnożą się: trzy zakłady oceniane na 50% dają razem 12,5%, a nie coś kojąco bliskiego połowie. Cztery zdarzenia po 60% dają 12,96%. Kurs łączny mnoży się tak samo i tu jest pułapka — liczba rośnie, gdy szansa maleje, a marża rośnie razem z nią. Pamiętaj o założeniu: tu się mnoży, więc przyjmuje się niezależność. Dwa wyniki z tego samego meczu są skorelowane, a tam prawdziwe prawdopodobieństwo jest inne, zwykle wyższe od iloczynu.",
      ],
      faq: [
        {
          q: "Czym jest prawdopodobieństwo progu opłacalności?",
          a: "Szansą, jaką musi mieć wynik, by zakład po tej cenie był w długim okresie neutralny. Wynosi 1 podzielone przez kurs dziesiętny i jest poprzeczką, którą twoje oszacowanie musi przeskoczyć, żeby zakład miał sens.",
        },
        {
          q: "Dlaczego prawdopodobieństwo mojego kuponu jest tak niskie?",
          a: "Bo prawdopodobieństwa się mnożą. Każde dodane zdarzenie czyni całość mniej prawdopodobną, a łańcuch wiarygodnych zdarzeń szybko staje się nieprawdopodobnym zakładem. Kurs rośnie odpowiednio, ale rośnie też skumulowana marża.",
        },
        {
          q: "Czy to działa dla kuponów z jednego meczu?",
          a: "Nie dokładnie. Mnożenie zakłada niezależność zdarzeń, a wyniki w jednym meczu zwykle niezależne nie są. Przy zdarzeniach skorelowanych prawdziwe prawdopodobieństwo jest inne — często wyższe od iloczynu — i dlatego bukmacherzy wyceniają te rynki osobno.",
        },
        {
          q: "Czy prawdopodobieństwo implikowane ceny to prawdziwe prawdopodobieństwo?",
          a: "Nie. Zawiera jeszcze marżę bukmachera, więc jest systematycznie wyższe niż uczciwe oszacowanie rynku. Usuń ją kalkulatorem marży, zanim porównasz ją z własną liczbą.",
        },
      ],
    },
  },
};

export default pl;
