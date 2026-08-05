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
      formulaTitle: "Jak działa przeliczanie",
      formula: [
        "dziesiętny = 1 + (amerykański / 100)         gdy amerykański jest dodatni",
        "dziesiętny = 1 + (100 / |amerykański|)       gdy amerykański jest ujemny",
        "dziesiętny = 1 + (licznik / mianownik)       dla kursów ułamkowych",
        "prawdopodobieństwo implikowane = 1 / dziesiętny",
      ],
      explainerTitle: "Odczytać cenę w dowolnym formacie",
      explainer: [
        "Kurs to prawdopodobieństwo w innym ubraniu. Kurs dziesiętny — standard europejski — podaje całkowity zwrot na jednostkę stawki: 2.50 zwraca 2.50 za każde ryzykowane 1, razem ze stawką. Kurs ułamkowy, nadal używany na brytyjskich torach, podaje zysk, a nie zwrot: 3/2 znaczy trzy jednostki zysku na dwie ryzykowane, czyli ten sam 2.50 dziesiętny. Kurs amerykański mówi, ile wygrywasz przy stawce 100 (+150) albo ile musisz zaryzykować, by wygrać 100 (−110). Hongkong, Malay i Indonesian to formaty rynków azjatyckich i mają znaczenie, bo tam często stoją najostrzejsze ceny.",
        "Liczba, którą warto czytać, jest ostatnia: prawdopodobieństwo implikowane, czyli 1 podzielone przez kurs dziesiętny. Cena 2.50 implikuje 40%. Cena 1.91 — znane −110 — implikuje 52,38%. To prawdopodobieństwo ogłoszone przez bukmachera i jedyna liczba, którą możesz porównać bezpośrednio z własnym oszacowaniem. Dwóch kursów w różnych formatach nie porównuje się łatwiej niż dwóch prawdopodobieństw: najpierw przelicz, potem dyskutuj.",
        "Ograniczenie, którego ten konwerter nie usunie: prawdopodobieństwo implikowane wciąż zawiera marżę bukmachera. Zsumuj prawdopodobieństwa implikowane wszystkich wyników rynku i przekroczysz 100% — ta nadwyżka to marża i zawyża każde z tych prawdopodobieństw. Jeśli chcesz uczciwej opinii rynku, a nie opinii z narzutem, przepuść rynek przez kalkulator marży i użyj zwróconych prawdopodobieństw uczciwych.",
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
      formulaTitle: "Jak liczy się marżę",
      formula: [
        "overround = Σ (1 / kursᵢ)",
        "marża = overround − 1",
        "wypłata = 1 / overround",
        "prawdopodobieństwo uczciweᵢ = (1 / kursᵢ) / overround",
        "kurs uczciwyᵢ = 1 / prawdopodobieństwo uczciweᵢ",
      ],
      explainerTitle: "Marża to cena zakładu",
      explainer: [
        "Uczciwy rynek dwudrogowy wycenia obie strony na 2.00: prawdopodobieństwa implikowane to 50% i 50%, sumują się dokładnie do 100% i żadna strona nie ma przewagi. Rzeczywiste rynki są wyceniane na 1.91 i 1.91. Te prawdopodobieństwa implikowane wynoszą po 52,38%, sumują się do 104,76%, a nadwyżkowe 4,76 punktu procentowego to marża bukmachera — overround. Którąkolwiek stronę zagrasz, płacisz ją.",
        "Marża jest najbardziej użyteczną liczbą przy decyzji, gdzie obstawiać. Ten sam mecz przy marży 5% i przy marży 2% to nie ten sam zakład: ciaśniejszy bukmacher zostawia ci około trzech punktów procentowych wartości oczekiwanej przy identycznych opiniach. Marże bardzo się różnią zależnie od rynku: główne linie u ostrych bukmacherów schodzą poniżej 2%, natomiast rynki na zwycięzcę, rynki zawodników i zakłady specjalne rutynowo mają 8% i więcej, bo tam bukmacherzy wiedzą, że ich ceny są najmniej sprawdzane.",
        "Usunięcie marży daje uczciwą linię, tak zwaną no-vig. Ten kalkulator robi to proporcjonalnie: każde prawdopodobieństwo implikowane dzielone jest przez ich sumę, więc znów sumują się dokładnie do 100%, a kursy uczciwe są ich odwrotnościami. Ta linia jest najbliższa uczciwemu oszacowaniu rynku i jest punktem odniesienia dla kalkulatora EV: zakład ma dodatnią wartość oczekiwaną tylko wtedy, gdy twoje prawdopodobieństwo przewyższa uczciwe, a nie jedynie wycenione.",
        "Zadeklarowane ograniczenie: usuwanie proporcjonalne rozkłada marżę równomiernie na wszystkie wyniki, a prawdziwi bukmacherzy tego nie robią. Dokładają marży wynikom nieprawdopodobnym, bo tam skupiają się pieniądze graczy okazjonalnych. Na rynku z wyraźnym faworytem i dalekim outsiderem ta metoda trochę zaniża prawdziwą szansę faworyta. Na głównych liniach zaburzenie jest małe; na loteryjnych rynkach na zwycięzcę traktuj uczciwą linię jako oszacowanie, nie pomiar.",
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
      formulaTitle: "Jak liczy się wartość oczekiwaną",
      formula: [
        "EV = p × (kurs − 1) × stawka − (1 − p) × stawka",
        "   = (p × kurs − 1) × stawka",
        "przewaga = p × kurs − 1",
        "cena progu opłacalności = 1 / p",
      ],
      explainerTitle: "Co naprawdę mówi wartość oczekiwana",
      explainer: [
        "Wartość oczekiwana to średni wynik zakładu, gdyby można go było powtórzyć nieskończoną liczbę razy. Ma dwa wejścia i żadnych opinii: oferowaną cenę i prawdopodobieństwo, które przypisujesz wynikowi. Jeśli uważasz, że drużyna wygrywa w 55% przypadków, a ktoś oferuje 2.00, rachunek jest natychmiastowy: w 55% przypadków zyskujesz jednostkę, w 45% ją tracisz, więc średnio zarabiasz 0,10 jednostki na jednostkę stawki. To przewaga 10% i właśnie to znaczy +EV.",
        "Liczbą, która decyduje o wszystkim, jest prawdopodobieństwo — i tam większość graczy przegrywa po cichu. Błąd o 5 punktów w oszacowaniu wystarcza, by przewaga 4% zamieniła się w stratę 1%, a oszacowania robione na oko mylą się rutynowo o znacznie więcej niż 5 punktów. Dlatego istnieje drugi tryb tego kalkulatora: zamiast ufać przeczuciu, weź cenę obu stron u ostrego bukmachera, usuń marżę i użyj wynikającego prawdopodobieństwa uczciwego. Nie pytasz już, czy jesteś mądrzejszy od rynku, ale czy bukmacher, u którego grasz, jest wolniejszy od najostrzejszego.",
        "Czytaj EV jak stopę, nie jak obietnicę. Zakład z 4% wartości oczekiwanej nie daje nic w jednym przypadku: wygrywa albo przegrywa. Te 4% pojawiają się dopiero na setkach niezależnych zakładów i tylko wtedy, gdy prawdopodobieństwo było trafne. W krótkim okresie wariancja jest znacznie większa niż przewaga i właśnie dlatego wielkość stawki liczy się tak samo jak sama przewaga — do tego służy kryterium Kelly'ego.",
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
      formulaTitle: "Jak liczy się stawkę Kelly'ego",
      formula: [
        "b = kurs − 1",
        "f* = (p × b − (1 − p)) / b = (p × kurs − 1) / b",
        "stawka = bankroll × f* × frakcja",
        "oczekiwany wzrost = p × ln(1 + f × b) + (1 − p) × ln(1 − f)",
      ],
      explainerTitle: "Dobrać stawkę tak, by zła seria jej nie zakończyła",
      explainer: [
        "Kryterium Kelly'ego odpowiada na pytanie, które wartość oczekiwana pomija: mając przewagę, ile faktycznie ryzykować? Obstawiaj za mało i prawdziwa przewaga kapitalizuje się zbyt wolno, by mieć znaczenie. Obstawiaj za dużo i matematyka obraca się przeciw tobie: bankroll zmniejszony o połowę potrzebuje +100%, żeby wrócić do punktu wyjścia, więc duże stawki niszczą wzrost nawet wtedy, gdy każdy pojedynczy zakład jest korzystny. Kelly znajduje frakcję maksymalizującą tempo wzrostu w długim okresie i okazuje się nią przewaga podzielona przez kurs netto.",
        "Wynik skaluje się z przewagą, nie z pewnością. Przewaga 10% przy kursie 2.00 wymaga 10% bankrolla; ta sama przewaga przy 5.00 wymaga tylko 2,5%, bo dłuższa cena oznacza dłuższe serie przegranych i bardziej wyboistą drogę. Dlatego formuła jest użyteczna nawet dla kogoś, kto nigdy nie stosuje jej dosłownie: mówi, że cena i przewaga razem decydują o stawce, a silne przeczucie nie jest daną wejściową.",
        "Prawie nikt nie powinien grać pełnym Kellym. Formuła zakłada, że twoje prawdopodobieństwo jest dokładne, a nigdy nie jest. Podaj jej zawyżoną przewagę i ochoczo zaleci stawkę zbyt dużą wobec przewagi, którą naprawdę masz — najszybszy sposób utraty bankrolla przy jednoczesnym byciu przeciętnie w porządku. Połowa Kelly'ego rezygnuje z jednej czwartej teoretycznego wzrostu i mniej więcej o połowę obniża zmienność; ćwierć Kelly'ego stosuje wielu profesjonalistów z prawdziwymi modelami. Jeśli twoje prawdopodobieństwa pochodzą z wyczucia, a nie z danych, ćwierć Kelly'ego to nie ostrożność, a realizm.",
        "Gdy cena nie daje przewagi, właściwa stawka to zero, i ten kalkulator to mówi, zamiast zwracać liczbę ujemną przebraną za poradę. Ujemna frakcja Kelly'ego oznacza, że zakład wart byłby zagrania po drugiej stronie, jeśli znajdziesz go po tej cenie: nigdy nie oznacza obstawiania mniej po tej stronie.",
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
      formulaTitle: "Jak liczy się prawdopodobieństwa",
      formula: [
        "kurs = 1 / prawdopodobieństwo",
        "prawdopodobieństwo = 1 / kurs",
        "prawdopodobieństwo progu opłacalności = 1 / kurs",
        "prawdopodobieństwo kuponu = p₁ × p₂ × … × pₙ",
        "kurs kuponu = kurs₁ × kurs₂ × … × kursₙ",
      ],
      explainerTitle: "Najpierw prawdopodobieństwo, potem cena",
      explainer: [
        "Każda cena jest twierdzeniem o prawdopodobieństwie, a przeliczenie między nimi to jedno dzielenie: prawdopodobieństwo 40% to cena 2.50, a cena 2.50 to prawdopodobieństwo 40%. Wykonanie tego przeliczenia przed zakładem zmienia pytanie z «czy podoba mi się ten zakład?» na «czy sądzę, że ten wynik zdarza się częściej niż w 40% przypadków?» — a to pytanie, w którym można się mylić, więc pytanie warte zadania.",
        "Ta sama liczba, czytana od strony ceny, to prawdopodobieństwo progu opłacalności: minimalna szansa, jaką musi mieć wynik, by zakład był neutralny. Cena 1.75 wymaga 57,1%. Cena 1.50 wymaga 66,7%. Długie ceny wymagają bardzo niewiele — 15.00 prosi tylko o 6,7% — dlatego wydają się tanie i dlatego bukmacherzy dokładają tam marży. Próg opłacalności to uczciwy test zakładu: jeśli nie potrafisz uzasadnić, że wynik go przekracza, cena nie jest hojna, tylko poprawna.",
        "Przy kuponach wielokrotnych prawdopodobieństwo staje się nieintuicyjne. Niezależne zdarzenia mnożą się: trzy zakłady oceniane na 50% każdy dają razem 12,5%, a nie coś kojąco bliskiego połowie. Cztery zdarzenia po 60% dają 12,96%. Kurs łączny mnoży się tak samo i tu jest pułapka: kupon po 15.00 wygląda na okazję, dopóki nie zauważysz, że wymaga zdarzenia o 6,7% i że marża bukmachera została nałożona na każde zdarzenie, a potem złożona. Kupon z czterech zdarzeń po 5% marży niesie prawie 21% marży łącznej.",
        "Założenie, o którym trzeba pamiętać: ten kalkulator mnoży, więc przyjmuje niezależność zdarzeń. Dwa wyniki z tego samego meczu — zwycięstwo drużyny i gol jej napastnika — są skorelowane, a mnożenie ich prawdopodobieństw zaniża prawdziwą szansę, że zdarzą się oba. Kupony z jednego meczu bukmacherzy wyceniają osobno właśnie dlatego, że tę korelację trudno policzyć: traktuj tę liczbę jako dolną granicę, nie jako odpowiedź.",
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
