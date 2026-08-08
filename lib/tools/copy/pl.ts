// lib/tools/copy/pl.ts (#TOOLS-HUB-0805)
// Polski. Lokalne frazy: "kalkulator kursów", "kalkulator wartości oczekiwanej",
// "kryterium Kelly'ego", "marża bukmachera".

import type { ToolsCopy } from "./types";

const pl: ToolsCopy = {
  hub: {
    metaTitle: "Darmowe narzędzia bukmacherskie — kursy, EV, Kelly i marża | BetRedge",
    metaDescription:
      "11 darmowych kalkulatorów: przeliczanie kursów na każdy format, usuwanie marży bukmachera, wartość oczekiwana, dobór stawki według Kelly'ego, sprawdzenie arbitrażu i pomiar ROI. Bez rejestracji.",
    h1: "Darmowe narzędzia bukmacherskie",
    lede:
      "Jedenaście obliczeń, które wykonuje się przed zakładem: kursy przeliczone, marża usunięta, stawka dobrana, ROI zmierzony. Bezpłatnie, bez konta.",
    cardCta: "Otwórz narzędzie",
    intro: [
      "Każdy zakład to porównanie ceny z prawdopodobieństwem. Te jedenaście kalkulatorów wykonuje je porządnie: przeliczają kursy między formatami, usuwają marżę bukmachera i odsłaniają uczciwą linię, zamieniają oszacowanie prawdopodobieństwa w wartość oczekiwaną, składają nogi kuponu w jeden kurs, pokazują, kiedy dwóch bukmacherów rozchodzi się dość, by domknąć arbitraż, dobierają stawkę tak, aby seria przegranych nie zamknęła bankrolla, i mierzą potem, ile te zakłady naprawdę przyniosły.",
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

    "arbitrage-calculator": {
      metaTitle: "Kalkulator arbitrażu — podział stawki między bukmacherów | BetRedge",
      metaDescription:
        "Darmowy kalkulator arbitrażu: wpisz najlepszy kurs na każdy wynik u różnych bukmacherów i zobacz sumę prawdopodobieństw, podział stawki oraz zysk — albo to, że go nie ma.",
      h1: "Kalkulator arbitrażu",
      lede:
        "Wpisz najlepszy dostępny kurs na każdy wynik i sprawdź, czy dwóch bukmacherów razem zostawia marżę — i jak wtedy podzielić stawkę.",
      labels: {
        inputTitle: "Najlepszy kurs na każdy wynik",
        outcome: "Wynik",
        addOutcome: "Dodaj wynik",
        removeOutcome: "Usuń",
        total: "Stawka łączna",
        resultTitle: "Jak ją podzielić",
        profit: "Zysk",
        impliedSum: "Suma prawdopodobieństw implikowanych",
        stakeOn: "Stawka na wynik",
        guaranteedReturn: "Zwrot przy każdym wyniku",
        verdictArb:
          "Kursy sumują się do mniej niż 100%: podzielona tak stawka zwraca tyle samo przy każdym wyniku.",
        verdictNoArb:
          "Kursy sumują się do więcej niż 100%, więc arbitrażu tu nie ma — każdy podział traci tę marżę, niezależnie od wyniku.",
        hint: "Jeden kurs na wynik, każdy od bukmachera, który płaci najwięcej po tej stronie. Format dziesiętny przyjmuje przecinek: 2,10 działa jak 2.10.",
      },
      takeaway:
        "Arbitraż nie jest prognozą. Nigdy nie wymaga trafienia zwycięzcy — wymaga, żeby dwóch bukmacherów różniło się bardziej niż ich własne marże.",
      example: {
        title: "Dwóch bukmacherów, 1000 do podziału",
        rows: [
          { label: "Kursy, po jednym bukmacherze", value: "2.10 · 2.10" },
          { label: "Suma prawdopodobieństw implikowanych", value: "95,24%" },
          { label: "Stawka na każdą stronę, z 1000", value: "500 · 500" },
          { label: "Zwrot przy każdym wyniku", value: "1050" },
          { label: "Zysk", value: "+50 (+5,00%)" },
        ],
        note:
          "Ten sam rynek wyceniony 1.90/1.90 u jednego bukmachera sumuje się do 105,26% i oddaje −5,00%, jakkolwiek go podzielić. Między tymi dwiema liniami w meczu nie zmieniło się nic: cała różnica leży w tym, który bukmacher płaci więcej po której stronie, i czy miałeś zasilone konta u obu, gdy kursy jeszcze stały.",
      },
      explainerTitle: "Kiedy dwóch bukmacherów różni się wystarczająco",
      explainer: [
        "**Zsumuj jeden podzielony przez każdy kurs i masz cały rynek w jednej liczbie.** U jednego bukmachera ta liczba zawsze przekracza 100% — trzyma ją tam marża. Ale najlepszy kurs na jedną stronę i najlepszy na drugą często stoją u różnych bukmacherów, a po połączeniu suma może spaść poniżej 100%. To cały warunek: **prawdopodobieństwa implikowane muszą sumować się do mniej niż 1**. Podziel stawkę łączną proporcjonalnie do tych prawdopodobieństw i każdy wynik zwraca tyle samo, więc to, co odbierasz, przestaje zależeć od rezultatu. Dwa kursy 2.10 sumują się do 95,24%, a 500 na każdą stronę stawki 1000 zwraca 1050 niezależnie od przebiegu meczu.",
        "**W praktyce zamyka się to znacznie rzadziej, niż sugeruje arytmetyka, a powody ważą więcej niż wzór.** Kursy się ruszają: znaleziona luka to zwykle wolniejszy bukmacher, który dopiero nadgania, i może zniknąć w sekundach między pierwszym a drugim zakładem — zostaje wtedy zwykły, niezabezpieczony zakład po kursie wybranym do zabezpieczenia, a nie ze względu na wartość. Limity stawek najmocniej gryzą dokładnie tam, gdzie luka jest najszersza, więc 5% na papierze to często 5% od czterdziestu jednostek, a nie od tysiąca. A **bukmacherzy ograniczają konta tych, którzy robią to systematycznie**: najpierw niższe limity, potem odmowy przyjęcia zakładu i zamknięcia. Dodaj kapitał zamrożony u kilku bukmacherów i spread walutowy między nimi, a arbitraż wygląda mniej jak maszyna, a bardziej jak żmudny i operacyjnie ciężki sposób zeskrobania cienkiej marży.",
      ],
      faq: [
        {
          q: "Czy potrzebuję konta u każdego bukmachera?",
          a: "Tak. Arbitraż istnieje tylko między konkretnymi bukmacherami wystawiającymi te konkretne kursy, więc potrzebne są zasilone konta u każdego z nich, zanim kursy się poruszą. Ten kapitał, rozproszony u kilku firm i przez większość czasu bezczynny, jest kosztem, którego prawie żaden kalkulator nie pokazuje.",
        },
        {
          q: "Co, jeśli drugi kurs zmieni się, zanim go zagram?",
          a: "Zostaje ci pierwsza noga sama: zwykły zakład po kursie wybranym do zabezpieczenia, a nie ze względu na wartość. Zagraj najpierw stronę, która najprawdopodobniej się ruszy, i traktuj pozostanie bez zabezpieczenia jako część ryzyka, nie jako wypadek.",
        },
        {
          q: "Dlaczego bukmacherzy ograniczają graczy arbitrażowych?",
          a: "Bo ich marża żyje ze zrównoważonego strumienia klientów rekreacyjnych, a konto, które zawsze bierze tylko najlepszy kurs po jednej stronie, jest dla nich czystym kosztem. Ograniczenia przychodzą cicho, jako niższe limity stawek, na długo przed zamknięciem konta.",
        },
        {
          q: "Czy arbitraż bukmacherski jest legalny?",
          a: "Sama czynność jest legalna: obstawiasz zwykłe zakłady po opublikowanych kursach. Zakazać go mogą regulaminy bukmachera, które zwykle zastrzegają prawo do ograniczania, odrzucania lub anulowania zakładów uznanych za arbitraż. Legalne i dozwolone to nie to samo.",
        },
      ],
    },

    "parlay-calculator": {
      metaTitle: "Kalkulator kuponów AKO — kurs łączny, realne prawdopodobieństwo i marża złożona | BetRedge",
      metaDescription:
        "Darmowy kalkulator kuponów wielokrotnych: wpisz każde zdarzenie i zobacz kurs łączny, prawdopodobieństwo, którego kupon naprawdę wymaga, oraz składanie się marży.",
      h1: "Kalkulator kuponów AKO",
      lede:
        "Każde dodane zdarzenie mnoży kurs — i mnoży razem z nim część, którą zatrzymuje bukmacher. Oto oba te liczby, jeszcze przed postawieniem kuponu.",
      labels: {
        inputTitle: "Zdarzenia",
        leg: "Zdarzenie",
        addLeg: "Dodaj zdarzenie",
        removeLeg: "Usuń",
        marginPerLeg: "Marża bukmachera na zdarzenie (%)",
        resultTitle: "Ile wart jest kupon",
        combinedOdds: "Kurs łączny",
        impliedProb: "Prawdopodobieństwo wejścia",
        compoundMargin: "Marża złożona",
        verdict:
          "Mnożenie zakłada, że zdarzenia są niezależne. Dwa typy z tego samego meczu nie są: ich realne prawdopodobieństwo jest zwykle wyższe niż iloczyn, i właśnie dlatego bukmacherzy wyceniają kupony z jednego meczu własnym modelem.",
        hint: "Jeden kurs dziesiętny na zdarzenie, maksymalnie osiem. Marżę na zdarzenie wpisuje się jako liczbę: 5 oznacza 5%, tyle mniej więcej trzyma wąski rynek dwudrożny.",
      },
      takeaway:
        "Część, którą zatrzymuje bukmacher, nie dodaje się między zdarzeniami — składa się. Cztery zdarzenia po 1.80 wyglądają jak cztery niemal wyrównane zakłady, a są jednym zdarzeniem o prawdopodobieństwie 9,53%.",
      example: {
        title: "Cztery zdarzenia po 1.80, jeden zakład o 9,53%",
        rows: [
          { label: "Zdarzenia", value: "4 × 1.80" },
          { label: "Kurs łączny", value: "10.50" },
          { label: "Prawdopodobieństwo wejścia", value: "9,53%" },
          { label: "Marża na zdarzenie", value: "5%" },
          { label: "Marża złożona", value: "21,55%" },
        ],
        note:
          "Osobno każde zdarzenie jest zakładem, nad którym nikt się nie zastanawia: 55,56% implikowane, 1.80 do wygrania. W łańcuchu cztery z nich wymagają zdarzenia o 9,53% — a 5%, które bukmacher trzyma na każdym z nich, staje się 1,05⁴ − 1 = 21,55% na całym kuponie. Do zakładu nie dodano nic poza kolejnymi sposobami jego przegrania: kurs wzrósł, bo spadło prawdopodobieństwo.",
      },
      explainerTitle: "Dlaczego kurs rośnie szybciej niż szansa",
      explainer: [
        "**Kupon wielokrotny to jeden zakład z kilkoma sposobami przegrania, a nie kilka zakładów.** Kurs łączny jest iloczynem zdarzeń — 1.80 wzięte cztery razy daje 10.4976 — a prawdopodobieństwo jest iloczynem prawdopodobieństw, i tu arytmetyka przestaje być życzliwa: cztery typy, z których każdy nazwałbyś niemal wyrównanym, dają razem 9,53%. Marża działa identycznie, i to jest część, której prawie nikt nie liczy. Nie dodaje się zdarzenie po zdarzeniu, ona się **składa**: bukmacher trzymający 5% na każdym z czterech zdarzeń trzyma 1,05⁴ − 1 = 21,55% na kuponie, a przy ośmiu zdarzeniach te same 5% na zdarzenie to już 47,75%. Wypłata wygląda hojnie, bo szansa się załamała, a nie bo ktoś płaci więcej za to samo ryzyko.",
        "**Kupony wielokrotne są najmocniej promowanym produktem w bukmacherce i najmniej korzystnym dla klienta**, a to jest ten sam fakt widziany z dwóch stron: im większa marża złożona, tym więcej bukmacher może wydać na podbicia kursu, ubezpieczenia i reklamę tego kuponu. Cienka przewaga na jednym zdarzeniu nie przeżyje pomnożenia przez trzy kolejne zdarzenia marży — te same typy jako pojedyncze płacą marżę raz każdy, czwórka płaci ją czterokrotnie. Zostaje jeszcze to, co mnożenie zakłada: **że zdarzenia są niezależne**. Dwa typy z tego samego meczu są skorelowane, więc mnożenie jest tam złym rachunkiem: zwycięstwo gospodarzy i gol ich napastnika przychodzą zwykle razem, więc para jest bardziej prawdopodobna niż mówi iloczyn, a zdarzenia, które z trudem współistnieją, są warte znacznie mniej. Dlatego bukmacherzy budują kupony z jednego meczu własnym modelem, zamiast pozwalać składać je z pojedynczych kursów — i dlatego ten kalkulator jest uczciwy przy zdarzeniach z różnych meczów.",
      ],
      faq: [
        {
          q: "Czy to działa dla kuponów z jednego meczu?",
          a: "Nie do końca. Tutaj mnożymy, a mnożenie zakłada niezależne zdarzenia. Wyniki w obrębie jednego meczu poruszają się razem, więc realne prawdopodobieństwo pary jest inne — często wyższe niż iloczyn — i właśnie dlatego bukmacherzy wyceniają te rynki własnym modelem, a nie z pojedynczych kursów.",
        },
        {
          q: "Dlaczego łączne prawdopodobieństwo jest tak niskie?",
          a: "Bo prawdopodobieństwa się mnożą, a nie uśredniają. Cztery zdarzenia po 55,56% dają 9,53%: każde dodane zdarzenie czyni cały kupon mniej prawdopodobnym, więc łańcuch sensownych typów szybko staje się nieprawdopodobnym zakładem. Kurs rośnie w odpowiedzi, a razem z kursem rośnie nazbierana marża.",
        },
        {
          q: "Czym dokładnie jest marża złożona?",
          a: "Częścią bukmachera po tym, jak każde zdarzenie ją pomnożyło. Wpisz, ile kosztuje jedno zdarzenie — około 5% na wąskim rynku dwudrożnym — a kalkulator ją złoży: jeden plus marża, podniesione do liczby zdarzeń, minus jeden. Cztery zdarzenia po 5% kosztują 21,55%, osiem zdarzeń 47,75%.",
        },
        {
          q: "Cztery pojedyncze czy jedna czwórka?",
          a: "Dla kogoś, kto gra z przewagą, cztery pojedyncze: te same typy płacą marżę raz każdy, zamiast ją mnożyć, a jedno pudło kosztuje jeden zakład, nie cały kupon. Kupon wielokrotny kupuje wariancję — małą szansę na dużą wypłatę — a ceną tej wariancji jest marża złożona.",
        },
      ],
    },
    "roi-calculator": {
      metaTitle: "Kalkulator ROI dla zakładów — zwrot z bankrolla | BetRedge",
      metaDescription:
        "Darmowy kalkulator ROI dla zakładów: podaj kapitał i zysk, aby zobaczyć zwrot z bankrolla, kapitał końcowy i dlaczego ten sam zysk to yield na poziomie 4%.",
      h1: "Kalkulator ROI",
      lede:
        "Ile bankroll zarobił w danym okresie — i dlaczego ten sam zysk 400 to tutaj ROI 40%, a na drugiej stronie yield 4%.",
      labels: {
        inputTitle: "Kapitał i wynik",
        capital: "Kapitał",
        profit: "Zysk",
        resultTitle: "Zwrot z tego kapitału",
        roi: "ROI",
        endingCapital: "Kapitał po okresie",
        hint: "Zysk wpisujesz netto i może być ujemny: -250 to okres na minusie. Kapitał to bankroll wystawiony na ryzyko, a nie suma postawionych stawek.",
        verdict:
          "ROI zależy w całości od mianownika, więc go zadeklaruj: 400 na bankrollu 1000 to 40%, te same 400 przy obrocie 10 000 to yield 4%. Żadna z tych liczb nie mówi wiele bez okresu i liczby zakładów, które za nią stoją.",
      },
      takeaway:
        "ROI mówi, ile zarobił bankroll. Nie mówi, czy strategia jest dobra, bo te same 40% mogą pochodzić z 200 zakładów albo z jednej szczęśliwej soboty.",
      example: {
        title: "400 zysku na bankrollu 1000",
        rows: [
          { label: "Kapitał", value: "1000" },
          { label: "Zysk w okresie", value: "+400" },
          { label: "ROI", value: "+40,00%" },
          { label: "Kapitał po okresie", value: "1400" },
          { label: "Te same 400 przy obrocie 10 000", value: "yield +4,00%" },
        ],
        note:
          "Oba procenty opisują jeden i ten sam wynik. Dojście do +40,00% na bankrollu wymagało 200 zakładów po 50 — 10 000 obrotu, dziesięć razy kapitał — a 4,00% tego obrotu to te same 400. Obróć bankroll dwa razy zamiast dziesięciu i yield stojący za ROI 40% musiałby wynosić 20%, czego prawie nikt nie utrzymuje.",
      },
      explainerTitle: "Zysk mierzony pieniędzmi wystawionymi na ryzyko",
      explainer: [
        "**ROI to zysk podzielony przez pieniądze wystawione na ryzyko**, a cała trudność siedzi w drugiej połowie tego zdania. Bankroll 1000, który kończy sezon 400 wyżej, dał 40,00%, i tę liczbę można uczciwie porównać z czymkolwiek innym, co zrobiłbyś z tym 1000. Czego nie potrafi opisać, to same zakłady. Zwrot 40% nie mówi, ile zakładów było potrzebnych, w jakim czasie, ani jak blisko zera saldo znalazło się po drodze — a to trzy rzeczy, które decydują, czy powtórzy się jeszcze raz. Dlatego **zadeklaruj mianownik, zanim podasz liczbę**: bankroll początkowy, średnie saldo i suma wpłat dają trzy różne procenty z jednego identycznego zestawu zakładów, a najkorzystniejszy zawsze jest ten najmniejszy.",
        "**Te same 400 zysku to jednocześnie ROI 40% i yield 4%**, a wiedza, którą z tych liczb trzymasz w ręce, to prawie cała wartość obu stron. ROI mierzy względem kapitału, yield względem obrotu — sumy wszystkich postawionych stawek. W naszym przykładzie potrzeba było 200 zakładów po 50, więc przez bankroll przeszło 10 000: dziesięć razy kapitał, a 4,00% tej kwoty to dokładnie te 400. **Ten mnożnik jest całym pomostem między dwiema liczbami** i dlatego samo ROI schlebia temu, kto gra dużo. Ktoś, kto obraca bankroll 1000 dziesięć razy z yieldem 4%, i ktoś, kto obraca go dwa razy z yieldem 20%, raportują te same 40%, a powtarzalne jest tylko jedno z nich. Jakość pojedynczego zakładu policzysz w kalkulatorze yield; ROI zachowaj do tego, w czym jest naprawdę dobry: porównania, ile te pieniądze dały wobec alternatyw.",
      ],
      faq: [
        {
          q: "Czym różni się ROI od yieldu?",
          a: "ROI dzieli zysk przez kapitał, yield dzieli go przez obrót — sumę wszystkich stawek. Te same 400 zysku to 40,00% bankrolla 1000 i 4,00% obrotu 10 000. ROI mówi, ile dały pieniądze, yield mówi, jak dobre były zakłady, a stosunek między nimi to liczba obrotów bankrolla.",
        },
        {
          q: "Jaki kapitał wpisać w mianownik?",
          a: "Taki, który potrafisz zadeklarować i potem utrzymać bez zmian — zwykle bankroll początkowy. Szczyt salda, średnie saldo i suma wpłat dają z tych samych zakładów różne procenty, więc liczba znaczy coś tylko obok swojej definicji. Dopłata w środku okresu bez ponownego zadeklarowania mianownika to najczęstszy sposób zawyżenia ROI.",
        },
        {
          q: "Czy ROI 40% to dobry wynik?",
          a: "To zależy od okresu i liczby zakładów. Na przestrzeni sezonu i 200 zakładów jest to wynik mocny, ale wiarygodny. Te same 40% na dwudziestu zakładach mieszczą się spokojnie w zakresie, który przypadek produkuje sam, a 40% w tygodniu zwykle znaczy, że stawki były duże względem bankrolla, a nie że przewaga była duża.",
        },
        {
          q: "Czy ROI może być ujemne?",
          a: "Tak, i kalkulator to pokazuje, zamiast ukrywać: strata 250 na bankrollu 1000 to -25,00%. Odbicie nie jest symetryczne — po -25% potrzebujesz +33,33% z tego, co zostało, aby wrócić do punktu wyjścia — i dlatego obsunięcie zasługuje na tyle samo uwagi co zwrot.",
        },
      ],
    },
    "yield-calculator": {
      metaTitle: "Kalkulator yield dla zakładów — zysk od obrotu | BetRedge",
      metaDescription:
        "Darmowy kalkulator yield: podaj liczbę zakładów, średnią stawkę i zysk, aby zobaczyć obrót i yield — oraz ile zakładów potrzeba, by liczba coś znaczyła.",
      h1: "Kalkulator yield",
      lede:
        "Zysk mierzony wszystkim, co postawiłeś, a nie twoim bankrollem — jedyna liczba, która porównuje dwóch graczy o różnych pieniądzach.",
      labels: {
        inputTitle: "Zakłady, stawka i wynik",
        bets: "Liczba zakładów",
        avgStake: "Średnia stawka",
        profit: "Zysk",
        resultTitle: "Yield od obrotu",
        turnover: "Obrót",
        yieldPercent: "Yield",
        hint: "Obrót liczymy za ciebie: zakłady × średnia stawka. Licz stawkę każdego zakładu, a nie pieniądze wystawione w jednej chwili. Zysk wpisujesz netto i może być ujemny.",
        verdictNoise:
          "Poniżej tysiąca zakładów ta liczba to głównie szum. Przy płaskiej stawce na kursie 2.00 jedno odchylenie standardowe yieldu to 7,07 punktu na 200 zakładach i nadal 3,16 na 1000: czytaj ją jako przedział, nie jako wynik.",
        verdictVolume:
          "Powyżej tysiąca zakładów liczba zaczyna nieść informację, ale jedno odchylenie standardowe to na kursie 2.00 wciąż około 3,16 punktu — +4% i +7% na tym samym wolumenie to nie dwa różne poziomy umiejętności.",
      },
      takeaway:
        "Yield to miara, która porównuje graczy: 4% przy obrocie 10 000 jest warte więcej niż ROI 40% zebrane na dwudziestu zakładach.",
      example: {
        title: "200 zakładów po 50, 400 zysku",
        rows: [
          { label: "Liczba zakładów", value: "200" },
          { label: "Średnia stawka", value: "50" },
          { label: "Obrót", value: "10 000" },
          { label: "Zysk", value: "+400" },
          { label: "Yield", value: "+4,00%" },
          { label: "Te same 400 na bankrollu 1000", value: "ROI +40,00%" },
        ],
        note:
          "Jeden wynik, dwa równie uczciwe procenty: 4,00% z 10 000, które przeszły przez bukmachera, i 40,00% z 1000, które kiedykolwiek były na ryzyku. Różnica między nimi to wyłącznie dziesięć obrotów bankrolla. A próba waży więcej niż obie liczby: na 200 zakładach jedno odchylenie standardowe yieldu to 7,07 punktu, więc te +4,00% mieszczą się w zakresie, który sama seria rzutów monetą produkuje.",
      },
      explainerTitle: "Liczba, która porównuje dwóch graczy",
      explainer: [
        "**Yield to zysk podzielony przez obrót** — sumę wszystkich postawionych stawek, a nie saldo konta. To liczba, którą gracze podają sobie wzajemnie właśnie dlatego, że nie zależy od tego, ile mają pieniędzy: 4% to 4% przy stawkach 5 i przy stawkach 500. **Dana, którą wszyscy wpisują źle, to mianownik**, a błąd zawsze idzie w tę samą stronę. Obrót liczy stawkę każdego zakładu w chwili jego postawienia, więc 200 zakładów po 50 to 10 000, nawet jeśli w danym momencie wystawione było tylko 50, a bankroll 1000, przez który te zakłady krążyły, nie jest liczbą, przez którą się dzieli. Dlatego ta strona pyta o liczbę zakładów i średnią stawkę i wylicza obrót na twoich oczach. Zmierz ten sam zysk względem kapitału i dostaniesz ROI: kalkulator ROI trzyma drugą połowę porównania, gdzie 400 zysku to 40,00% bankrolla 1000 i 4,00% obrotu 10 000.",
        "**Yield powyżej około 5%, utrzymany na poważnym wolumenie, jest rzadki.** Tam, gdzie istnieje, mieszka na miękkich rynkach z niskimi limitami i topnieje, gdy stawki rosną, bo kursy, które go umożliwiały, nie przeżywają mocnego uderzenia. Każdą długoterminową liczbę znacznie powyżej traktuj jako krótką próbę, miękką niszę albo inną definicję obrotu. A **poniżej kilkuset zakładów liczba jest szumem, nie wynikiem**: przy płaskiej stawce na kursie 2.00 jedno odchylenie standardowe yieldu to jeden podzielony przez pierwiastek z liczby zakładów — 7,07 punktu na 200 zakładach, 3,16 na 1000, 2,00 na 2500. Yield +4% osiąga dwa odchylenia standardowe od zera dopiero przy około 2500 zakładach. Na wyższych kursach wahania są większe: na 3.00 te same 200 zakładów niosą odchylenie 10 punktów. I to jest uczciwe odczytanie dwudziestu wygranych zakładów: nie zmierzona przewaga, tylko zbyt krótka próba.",
      ],
      faq: [
        {
          q: "Jak obliczyć swój obrót?",
          a: "Dodając stawkę każdego postawionego zakładu, wygranego czy przegranego. 200 zakładów po 50 to 10 000 obrotu, nawet jeśli bankroll za nimi wynosił tylko 1000. Nie używaj kwoty netto ani salda: obrót to pieniądze, które przeszły przez bukmachera, liczone raz na zakład.",
        },
        {
          q: "Czy yield 5% jest dobry?",
          a: "Utrzymany na tysiącach zakładów tak — to okolice górnej granicy tego, co przeżywa prawdziwe limity. Znacznie wyższe wartości zwykle pochodzą z miękkich rynków, krótkiej próby albo wartości promocyjnej i spadają, gdy stawki rosną, bo kursy, które je dawały, są zabierane albo limitowane.",
        },
        {
          q: "Ile zakładów, żeby mój yield coś znaczył?",
          a: "Więcej, niż większość zakłada. Przy płaskiej stawce na kursie 2.00 jedno odchylenie standardowe yieldu to 7,07 punktu na 200 zakładach, 3,16 na 1000 i 2,00 na 2500, więc +4% osiąga dwa odchylenia od zera dopiero przy około 2500 zakładach. Poniżej kilkuset traktuj liczbę jako przedział.",
        },
        {
          q: "Co, jeśli moje stawki bardzo się różnią?",
          a: "Wtedy zakłady × średnia stawka to tylko przybliżenie, które ci schlebia, gdy trafienia padły na duże stawki. Zsumuj rzeczywiste stawki i podziel zysk przez tę sumę. Jeśli grasz w jednostkach, licz jednostki: yield na postawioną jednostkę to ta sama liczba i łatwiej ją utrzymać uczciwą.",
        },
      ],
    },
    "stake-calculator": {
      metaTitle: "Kalkulator stawki — stawka na docelowy zysk | BetRedge",
      metaDescription:
        "Darmowy kalkulator stawki: podaj kurs i zysk, jaki chcesz, a zobaczysz potrzebną stawkę, całkowity zwrot i jaką część bankrolla angażuje ten jeden zakład.",
      h1: "Kalkulator stawki",
      lede:
        "Stawka, jakiej docelowy zysk wymaga przy danym kursie — i część bankrolla, którą po cichu angażuje.",
      labels: {
        inputTitle: "Kurs i cel",
        odds: "Kurs",
        targetProfit: "Docelowy zysk",
        bankroll: "Bankroll",
        resultTitle: "Ile kosztuje ten cel",
        stakeNeeded: "Potrzebna stawka",
        totalReturn: "Całkowity zwrot",
        bankrollShare: "Część bankrolla",
        hint: "Bankroll zamienia stawkę w procent: bez niego stawka jest liczbą bez odniesienia. Kurs wpisuj dziesiętnie — 2.50, nie +150.",
        verdictModest:
          "Ta stawka angażuje mniej niż 5% podanego bankrolla, a seria dziesięciu przegranych go nie zakończy. Czytaj ją razem z kursem, nie osobno: ten sam cel przy krótszym kursie wymaga znacznie większego zakładu.",
        verdictHeavy:
          "Ta stawka angażuje ponad 5% podanego bankrolla na jeden wynik. Przy tej wielkości seria dziesięciu przegranych — zwyczajna przy kursach około 2.00 — zabiera z niego ponad połowę, więc sprawdź tę liczbę w kalkulatorze bankrolla, zanim zagrasz.",
      },
      takeaway:
        "Wychodzenie od zysku, jakiego chcesz, to najszybsza droga do zbyt dużej stawki: użyteczne pytanie nie brzmi ile chcę wygrać, ale ile mogę stracić.",
      example: {
        title: "Chcieć 100 zysku przy kursie 2.50",
        rows: [
          { label: "Kurs", value: "2.50" },
          { label: "Docelowy zysk", value: "100" },
          { label: "Potrzebna stawka", value: "66,67" },
          { label: "Całkowity zwrot", value: "166,67" },
          { label: "Część bankrolla 1000", value: "6,67%" },
        ],
        note:
          "Te same 100 kosztują 25,00 przy 5.00 i 400,00 przy 1.25 — cel się nie zmienił, zmienił się kurs. A 66,67 przy bankrollu 1000 to dokładnie pełny Kelly dla kogoś, kto wycenia ten wynik na 44%, gdy 2.50 wychodzi na zero przy 40%. Życzenie zawiera więc już oszacowanie prawdopodobieństwa warte przewagę +10%, tylko niewypowiedziane.",
      },
      explainerTitle: "Liczenie od tyłu, od liczby, którą sam wybrałeś",
      explainer: [
        "Arytmetyka to łatwiejsza połowa. Zakład zwraca stawkę plus stawka × (kurs − 1), więc **stawka, jakiej wymaga cel, to cel podzielony przez kurs minus jeden** — 100 przy 2.50 wymaga 66,67, a kupon wraca jako 166,67. Wartość tej strony leży w drugim efekcie: **im krótszy kurs, tym większy zakład wymusza to samo życzenie**. Te 100 kosztują 25,00 przy 5.00, 66,67 przy 2.50, 100,00 przy 2.00 i 400,00 przy 1.25. Między tymi czterema wierszami twoja opinia nie drgnęła, a pieniądze w ryzyku zmieniły się szesnastokrotnie. Dlatego kalkulator pyta o bankroll, którego formalnie nie potrzebuje: 66,67 nie jest ani duże, ani małe, dopóki nie wiesz, że to 6,67% wszystkiego, co odłożyłeś.",
        "**Wychodzenie od zysku, jakiego chcesz, to najkrótsza droga do zbyt dużej stawki**, i zawodzi w konkretny sposób. Przegraj pierwszy zakład i cel po cichu rośnie, żeby go pokryć: chcieć znów 100 po stracie 66,67 znaczy żądać 166,67, co przy 2.00 wymaga stawki 166,67, a jeśli i ta padnie, następne żądanie to 476,19 przy 1.70. Trzy zakłady później 709,52 z bankrolla 1000 jest wystawione na ryzyko, żeby wygrać pierwotne 100, a kurs za każdym razem był krótszy, bo krótkie kursy wydają się bezpieczniejsze. **Zakład rośnie dokładnie wtedy, gdy powód do jego zagrania słabnie.** Uczciwa wersja tego rachunku biegnie odwrotnie, od tego, ile możesz stracić, do tego, ile możesz postawić, i jest to kalkulator kryterium Kelly'ego: tam wielkość bierze się ze zmierzonej przewagi, a nie z liczby, którą wybrałeś. Nasza liczba też nie jest przypadkiem — 66,67 z 1000 to dokładnie tyle, ile pełny Kelly zaleca przy 2.50 komuś, kto wierzy w 44%, wobec 40% wynikających z kursu. Jeśli nie obroniłbyś tych 44%, stawka nigdy nie dotyczyła zakładu.",
      ],
      faq: [
        {
          q: "Jak obliczyć stawkę na docelowy zysk?",
          a: "Podziel oczekiwany zysk przez kurs minus jeden. Przy 2.50 zwrot netto na jednostkę stawki wynosi 1,50, więc 100 zysku wymaga 100 / 1,50 = 66,67 stawki i płaci 166,67 razem. Przy 2.00 zwrot netto to 1,00 — dlatego tam stawka i cel są tą samą liczbą.",
        },
        {
          q: "Dlaczego kalkulator pyta o bankroll?",
          a: "Bo sama stawka nic nie mówi. 66,67 dla jednego gracza to błąd zaokrąglenia, a dla drugiego trzecia część konta, i rozstrzyga o tym część bankrolla — tutaj 6,67%. Zostaw pole puste i stawka nadal działa; procent zamienia się w kreskę, co jest uczciwe, bo to założenie należy do ciebie, a nie do nas.",
        },
        {
          q: "Ten kalkulator czy kryterium Kelly'ego?",
          a: "Ten do wycenienia życzenia, Kelly do wymiarowania zakładu. Ta strona startuje od liczby, którą wybrałeś, i liczy jej koszt; kalkulator kryterium Kelly'ego startuje od zmierzonej przewagi i liczy, ile bankroll zniesie. Gdy oba się rozchodzą, odrzuć ten, który nigdy nie zapytał o twoje oszacowanie prawdopodobieństwa.",
        },
        {
          q: "Czy gonienie straty większą stawką kiedykolwiek ma sens?",
          a: "Nie przy tej arytmetyce. Każde żądanie odrobienia jest większe od poprzedniego i zwykle stawiane przy krótszym kursie, bo krótkie kursy wydają się bezpieczniejsze, więc stawka rośnie, gdy przewaga maleje. Zasady bankrolla istnieją po to, by następna stawka nie zależała od ostatniego wyniku: ustal jednostkę jako procent bankrolla i ciąg nie ucieknie.",
        },
      ],
    },
    "bankroll-calculator": {
      metaTitle: "Kalkulator bankrolla — jednostka, obsunięcie i przegrane do ruiny | BetRedge",
      metaDescription:
        "Darmowy kalkulator bankrolla: ustaw bankroll i jednostkę, a zobaczysz stawkę na zakład, koszt złej serii, obsunięcie, jakie po niej zostaje, i ile przegranych pokrywasz.",
      h1: "Kalkulator bankrolla",
      lede:
        "Ile naprawdę angażuje jednostka wyrażona w procentach: stawka na zakład, koszt złej serii i ile przegranych z rzędu bankroll przetrzyma.",
      labels: {
        inputTitle: "Bankroll i zasada",
        bankroll: "Bankroll",
        unitPercent: "Jednostka (%)",
        losingStreak: "Zła seria",
        resultTitle: "Ile kosztuje ta zasada",
        unit: "Stawka na zakład",
        streakLoss: "Koszt serii",
        drawdown: "Obsunięcie",
        betsToRuin: "Przegrane do ruiny",
        hint: "Procenty wpisuj jako liczby: 2 oznacza 2% bankrolla na zakład. Zła seria to licznik zakładów, więc tylko liczby całkowite — to seria, którą chcesz przetrzymać, nie prognoza.",
        verdictSafe:
          "Przy 5% na jednostkę lub mniej podana seria zostawia bankroll wciąż zdolny do pracy. Seria dziesięciu dotyka 38,54% graczy w ciągu 1000 zakładów przy kursach parzystych, więc plan, który trzyma się tylko wtedy, gdy jej nie spotkasz, nie jest planem.",
        verdictAggressive:
          "Powyżej 5% na jednostkę zwyczajna zła seria kończy konto: dziesięć przegranych zabiera połowę bankrolla lub więcej, a z połowy potrzeba +100,00%, by wrócić. Skoro seria dziesięciu pojawia się w 1000 zakładach u 38,54% graczy, to zakład o to, że jej nie spotkasz.",
      },
      takeaway:
        "Procent na jednostkę nie jest preferencją. To twoja decyzja o tym, jak długa może być najgorsza zła seria, zanim wypadniesz z gry.",
      example: {
        title: "Bankroll 2000 przy 2% na zakład",
        rows: [
          { label: "Bankroll", value: "2000" },
          { label: "Jednostka", value: "2%" },
          { label: "Stawka na zakład", value: "40,00" },
          { label: "Dziesięć przegranych z rzędu", value: "400,00" },
          { label: "Obsunięcie", value: "20,00%" },
          { label: "Przegrane do ruiny", value: "50" },
        ],
        note:
          "Ta dziura 20,00% wymaga +25,00% na tym, co zostało, by wrócić do 2000. Podnieś jednostkę do 5% i te same dziesięć przegranych kosztuje 1000 — obsunięcie 50,00%, które do odrobienia wymaga +100,00%, a bankroll pokrywa 20 przegranych z rzędu zamiast 50. Trzy punkty zasady, a przetrzymywana seria skraca się o ponad połowę.",
      },
      explainerTitle: "Zasada, która decyduje, jak długą złą serię przetrzymasz",
      explainer: [
        "**Jednostka to procent bankrolla, nie kwota**, a różnica ujawnia się dopiero, gdy jest źle. Stawiaj na zawsze stałe 40, a bankroll spadły do 1000 obstawia 4% zamiast 2%: zasada zacieśnia się dokładnie wtedy, gdy powinna poluzować. Przelicz jednostkę na bieżącym saldzie i każda przegrana zmniejsza kolejną stawkę, i to właśnie nie pozwala złej serii dokończyć dzieła. Asymetria pod spodem to cały powód, by się tym przejmować — **strata 20% wymaga +25,00% na odrobienie, strata 50% wymaga +100,00%, a strata 80% wymaga +400,00%.** W drugiej połowie tych par nie ma nic symetrycznego wobec pierwszej i żadna przewaga nie jest dość duża, żeby +400,00% było planem, a nie nadzieją. Bankroll 2000 przy 2% stawia 40 na zakład, wchłania dziesięć przegranych z rzędu za 400,00 i wychodzi z tego na −20,00% — zużywszy dziesięć z 50 kolejnych przegranych, które ta stawka wytrzyma.",
        "**Seria dziesięciu przegranych przy kursach około 2.00 jest zwyczajna, a nie pechowa**, i to liczba, która to pokazuje. Przy kursach parzystych pojedyncza sekwencja dziesięciu ma prawdopodobieństwo 0,098% — jedna na 1024 — co czyta się jak nigdy, dopóki nie policzysz, ile sekwencji zawiera sezon. Na 1000 zakładach prawdopodobieństwo spotkania co najmniej jednej serii dziesięciu lub dłuższej to **38,54%**; przy 2.10, gdzie gracz bez przewagi wygrywa 47,62% razy, wynosi **52,31%** — lepiej niż rzut monetą. Na 500 zakładach te same dwie liczby to 21,45% i 30,73%, a najdłuższa seria, jakiej należy oczekiwać w 1000 zakładach przy kursach parzystych, to około dziesięć, bo rośnie z logarytmem o podstawie dwa z liczby zakładów. Seria nie jest ogonem rozkładu, jest jego środkiem, więc **jednostka powyżej 5% to zakład o to, że nie trafisz na przypadek zwyczajny**: przy 5% te dziesięć przegranych zabiera połowę bankrolla, przy 10% zabiera całość. Kiedy przewaga jest zmierzona, a nie założona, kalkulator kryterium Kelly'ego wymierza jednostkę z samej przewagi — czytaj tę liczbę jako sufit, a tę stronę jako podłogę pod nim.",
      ],
      faq: [
        {
          q: "Jakiej wielkości jednostki używać?",
          a: "Jeden do dwóch procent bankrolla na zakład to zwykły zakres płaskiego stawiania, a powyżej pięciu procent zwyczajna zła seria staje się zdarzeniem kończącym konto. Uczciwie wybiera się od tyłu: zdecyduj, jaką złą serię chcesz przetrzymać, przeczytaj obsunięcie, które daje ten kalkulator, i zapytaj siebie, czy po nim grałbyś dalej tak samo.",
        },
        {
          q: "Dlaczego przegrane do ruiny to liczba całkowita?",
          a: "Bo liczą zakłady, a część zakładu zakładem nie jest. Bankroll 1000 przy 3% daje jednostkę 30, czyli 33 przegrane i jedną trzecią — więc odpowiedź to 33, w dół, bo bankroll nie pokrywa już kolejnej w całości. Zaokrąglenie w górę obiecywałoby zakład, na który pieniędzy nie ma.",
        },
        {
          q: "Czy dziesięć przegranych z rzędu jest naprawdę normalne?",
          a: "Tak, i arytmetyka nie jest tu nawet bliska. Jedna sekwencja dziesięciu przegranych przy kursach parzystych to zdarzenie 0,098%, ale na 1000 zakładach sekwencji jest tyle, że prawdopodobieństwo spotkania co najmniej jednej wynosi 38,54%, a przy 2.10, gdzie gracz bez przewagi wygrywa 47,62% razy, rośnie do 52,31%. Zaplanuj to, zamiast się dziwić.",
        },
        {
          q: "Ten kalkulator czy kryterium Kelly'ego?",
          a: "Ten, gdy nie masz zmierzonej przewagi, czyli niemal zawsze: jednostka w procentach nie wymaga oszacowania prawdopodobieństwa, a jej najgorszy przypadek znasz z góry. Kalkulator kryterium Kelly'ego jest właściwym narzędziem, gdy potrafisz obronić prawdopodobieństwo, i zwykle zaleci więcej niż płaskie 2%. Traktowanie jego odpowiedzi jako sufitu, a płaskiej zasady jako podłogi trzyma oba w ryzach.",
        },
      ],
    },
  },
};

export default pl;
