// lib/v3c/home-faq.ts (#REDESIGN-V3C polish) — le sei domande della home v3c.
// Fonte UNICA per la FAQ visibile (components/v3c/home/Faq.tsx) e per il
// FAQPage JSON-LD di "/" a flag acceso (app/v3c/page.tsx): lo schema dice
// esattamente ciò che la pagina mostra.
//
// Perché un file a parte e non lib/home-faq.ts: quello alimenta la home di oggi
// (flag spento) e deve restare identico. Qui cambia SOLO ciò che il redesign
// rende falso: (1) i piani sono due, Free e Pro — «Base» sparisce (regola di
// Andrea 05/10, i clienti base passano a Pro senza cambio di prezzo); (2) la
// riga della board non porta più «un numero solo»: mercato, stima e gap; (3) la
// stima calcio è il blend 70% mercato + 30% modello, dichiarato.
// ui3 (Andrea 07/10): nel tennis non diamo la nostra stima — risposte 2 e 6 lo dicono.
// Fatti invariati, uno per uno: carta mensile/annuale con rinnovo, disdetta
// dall'account; crypto = un pagamento, 30 giorni, nessun rinnovo; calcio 1X2 e
// tennis vincente; live solo Pro; nessuna scommessa, nessun rendimento promesso;
// sulla board Free vede ogni partita con mercato, stima e gap e Pro aggiunge il
// perché: è la promessa di /pricing v3c (lib/v3c/pages-copy.ts), qui ripetuta
// uguale — la quota «tre letture al giorno» del sito di oggi non vale nel redesign.
import type { FaqItem } from "@/lib/home-faq";
import { v3cLang } from "./copy";

export const V3C_HOME_FAQ = {
  en: [
    [
      "How does billing work, and can I cancel?",
      "Pro is an ordinary card subscription. You pick monthly or annual, and it renews by itself until you stop it. You stop it from your account, any day you want, and from that moment we charge you nothing further. Crypto is the odd one out: one payment, 30 days of access, no renewal of any kind. On day 31 nothing happens unless you decide to pay again.",
    ],
    [
      "What’s in a reading, and what does Pro add?",
      "Three numbers, all of them sealed before kick-off. What the market thinks, which is the odds turned into a percentage with the margin removed. Our estimate: in football that is 70% market and 30% model, and we say so next to it. In tennis we give no estimate of ours, only the market price. And the gap between the two, in points. Pro adds the why: open any football match and you see the factors the model actually weighed, like form, expected goals, Elo, head-to-head.",
    ],
    [
      "Which sports do you cover?",
      "Football and tennis. That’s all, for now. In football we read the match result, so home, draw or away; in tennis, who wins the match. Which competitions show up changes from one day to the next, and the board tells you what’s there.",
    ],
    [
      "What happens on the live board?",
      "The number moves while the match does. The score changes, the clock runs, the momentum turns, and the model reads the game again, so you see the probability shift while it’s shifting. Nothing is ever placed or executed for you at any point: you’re reading a screen. Live is Pro only.",
    ],
    [
      "Do you place bets, or promise I’ll make money?",
      "No. We don’t place bets, we’re not a bookmaker, and your money is something we never touch. You don’t need an account anywhere else either, because BetRedge runs on its own. And we don’t promise a return of any kind. A probability is an estimate: when we say 71%, it means that across a lot of situations that resemble this one we would expect that outcome about 71 times in 100. What happens in this particular match, tonight, it does not know. The public record shows how past readings settled, and about the next one it says nothing.",
    ],
    [
      "How do I use it day to day?",
      "Open the board. Each row shows the outcome where our estimate and the market sit furthest apart: the market, our estimate, the gap. Tennis rows show the market price only, with no estimate and no gap. Tap it for all three outcomes and the prices of the connected books. Then look at the public record, because seeing how earlier readings settled tells you how much weight a number like that deserves. What you do with it after that is your call. Free shows every match on the board, gap included; Pro adds why the model disagrees.",
    ],
  ],
  it: [
    [
      "Come funziona il pagamento, e posso disdire?",
      "Pro è un normale abbonamento con carta. Scegli tu se mensile o annuale, e si rinnova da solo finché non lo fermi. Lo fermi dal tuo account, in qualsiasi giorno, e da quel momento non ti addebitiamo più niente. Le crypto vanno per conto loro: pagamento singolo, 30 giorni di accesso, nessun rinnovo. Il giorno 31 non succede niente, a meno che tu non decida di ripagare.",
    ],
    [
      "Cosa c’è dentro una lettura, e cosa aggiunge Pro?",
      "Tre numeri, tutti sigillati prima del fischio d’inizio. Cosa pensa il mercato, cioè la quota convertita in percentuale senza il margine. La nostra stima: nel calcio è 70% mercato e 30% modello, e lo scriviamo accanto. Nel tennis non diamo una nostra stima, solo il prezzo di mercato. E la distanza fra le due, in punti. Pro aggiunge il perché: apri una partita di calcio e vedi i fattori che il modello ha davvero pesato, come forma, gol attesi, Elo, scontri diretti.",
    ],
    [
      "Quali sport coprite?",
      "Calcio e tennis. Per ora basta così. Nel calcio leggiamo il risultato della partita, quindi 1, X o 2; nel tennis, chi vince il match. Quali competizioni ci siano cambia da un giorno all’altro, e te lo dice il board.",
    ],
    [
      "Cosa succede sul board live?",
      "Il numero si muove insieme alla partita. Cambia il punteggio, passano i minuti, gira l’inerzia, e il modello rilegge il match, così vedi la probabilità spostarsi mentre si sta spostando. In nessun momento viene piazzato o eseguito qualcosa per te: stai guardando uno schermo. Il live è solo Pro.",
    ],
    [
      "Piazzate scommesse? Mi promettete un guadagno?",
      "No. Non piazziamo scommesse, non siamo un bookmaker, e i tuoi soldi non li tocchiamo mai. E non ti serve un conto da nessun’altra parte, perché BetRedge funziona per conto suo. Un rendimento non te lo promettiamo, di nessun tipo. Una probabilità è una stima: quando diciamo 71%, vuol dire che su tante situazioni simili a questa ci aspetteremmo quell’esito circa 71 volte su 100. Cosa succede in questa partita qui, stasera, non lo sa. Il registro pubblico mostra come si sono chiuse le letture passate, e sulla prossima non dice nulla.",
    ],
    [
      "Come lo uso, in pratica?",
      "Apri il board. Ogni riga mostra l’esito dove la nostra stima e il mercato sono più lontani: il mercato, la stima, il gap. Le righe del tennis mostrano solo il prezzo di mercato, senza stima né gap. Toccala e vedi tutti e tre gli esiti e i prezzi dei book connessi. Poi guarda il registro pubblico, perché è guardando come si sono chiuse le letture precedenti che capisci quanto peso dare a un numero del genere. Quello che ne fai dopo lo decidi tu. Free mostra ogni partita del board, gap compreso; Pro aggiunge il perché del modello.",
    ],
  ],
    de: [
      [ // REVIEW-NATIVE
        "Wie funktioniert die Abrechnung, und kann ich kündigen?",
        "Pro ist ein ganz normales Kartenabo. Du wählst monatlich oder jährlich, und es verlängert sich von selbst, bis du es beendest. Du beendest es in deinem Konto, an jedem beliebigen Tag, und ab diesem Moment berechnen wir dir nichts mehr. Krypto ist die Ausnahme: eine Zahlung, 30 Tage Zugang, keinerlei Verlängerung. An Tag 31 passiert nichts, außer du entscheidest dich, erneut zu zahlen.",
      ],
      [
        "Was steckt in einer Analyse, und was bringt Pro dazu?",
        "Drei Zahlen, alle vor dem Anstoß versiegelt. Was der Markt denkt, also die Quote als Prozentwert, ohne Marge. Unsere Schätzung: Im Fußball sind das 70% Markt und 30% Modell, und das schreiben wir dazu. Im Tennis geben wir keine eigene Schätzung, nur die Marktquote. Und der Abstand zwischen beiden, in Punkten. Pro ergänzt das Warum: Öffne ein beliebiges Fußballspiel und du siehst die Faktoren, die das Modell tatsächlich gewichtet hat, etwa Form, erwartete Tore, Elo, direkte Duelle.",
      ],
      [
        "Welche Sportarten deckt ihr ab?",
        "Fußball und Tennis. Das ist vorerst alles. Im Fußball lesen wir das Spielergebnis, also Heimsieg, Unentschieden oder Auswärtssieg; im Tennis, wer das Match gewinnt. Welche Wettbewerbe auftauchen, ändert sich von Tag zu Tag, und das Board zeigt dir, was da ist.",
      ],
      [
        "Was passiert auf dem Live-Board?",
        "Die Zahl bewegt sich, während das Spiel läuft. Der Spielstand ändert sich, die Uhr läuft, das Momentum kippt, und das Modell liest das Spiel neu, sodass du siehst, wie sich die Wahrscheinlichkeit verschiebt, während sie sich verschiebt. Nichts wird jemals für dich platziert oder ausgeführt: Du liest einen Bildschirm. Live gibt es nur mit Pro.",
      ],
      [ // REVIEW-NATIVE
        "Platziert ihr Wetten, oder versprecht ihr mir Geld?",
        "Nein. Wir platzieren keine Wetten, wir sind kein Buchmacher, und dein Geld berühren wir nie. Du brauchst auch nirgendwo sonst ein Konto, denn BetRedge läuft für sich. Und wir versprechen keinerlei Rendite. Eine Wahrscheinlichkeit ist eine Schätzung: Wenn wir 71% sagen, heißt das, dass wir über viele ähnliche Situationen diesen Ausgang etwa 71 von 100 Mal erwarten würden. Was in genau diesem Spiel heute Abend passiert, weiß sie nicht. Das öffentliche Register zeigt, wie frühere Analysen ausgingen, und über die nächste sagt es nichts.",
      ],
      [
        "Wie nutze ich es im Alltag?",
        "Öffne das Board. Jede Zeile zeigt den Ausgang, bei dem unsere Schätzung und der Markt am weitesten auseinanderliegen: den Markt, unsere Schätzung, den Abstand. Tennis-Zeilen zeigen nur die Marktquote, ohne Schätzung und ohne Abstand. Tippe darauf für alle drei Ausgänge und die Quoten der verbundenen Buchmacher. Dann schau ins öffentliche Register, denn wie frühere Analysen ausgingen, zeigt dir, wie viel Gewicht eine solche Zahl verdient. Was du danach damit machst, ist deine Entscheidung. Free zeigt jedes Spiel auf dem Board, Abstand inklusive; Pro ergänzt, warum das Modell abweicht.",
      ],
    ],
    es: [
      [ // REVIEW-NATIVE
        "¿Cómo funciona el cobro y puedo cancelar?",
        "Pro es una suscripción normal con tarjeta. Eliges mensual o anual, y se renueva sola hasta que la detengas. La detienes desde tu cuenta, el día que quieras, y desde ese momento no te cobramos nada más. Las cripto son la excepción: un único pago, 30 días de acceso, sin ningún tipo de renovación. El día 31 no pasa nada a menos que decidas volver a pagar.",
      ],
      [
        "¿Qué hay en una lectura y qué añade Pro?",
        "Tres números, todos sellados antes del inicio. Lo que piensa el mercado, es decir, la cuota convertida en porcentaje sin el margen. Nuestra estimación: en fútbol es 70% mercado y 30% modelo, y lo decimos al lado. En tenis no damos estimación propia, solo la cuota del mercado. Y la diferencia entre ambos, en puntos. Pro añade el porqué: abre cualquier partido de fútbol y verás los factores que el modelo ha ponderado de verdad, como la forma, los goles esperados, el Elo o los enfrentamientos directos.",
      ],
      [
        "¿Qué deportes cubrís?",
        "Fútbol y tenis. Nada más, por ahora. En fútbol leemos el resultado del partido, así que local, empate o visitante; en tenis, quién gana el partido. Las competiciones que aparecen cambian de un día a otro, y el tablero te dice lo que hay.",
      ],
      [
        "¿Qué pasa en el tablero en directo?",
        "El número se mueve mientras se mueve el partido. Cambia el marcador, corre el reloj, gira el impulso, y el modelo vuelve a leer el juego, así que ves cómo cambia la probabilidad mientras cambia. En ningún momento se coloca ni se ejecuta nada por ti: estás leyendo una pantalla. El directo es solo para Pro.",
      ],
      [ // REVIEW-NATIVE
        "¿Hacéis apuestas, o me prometéis que ganaré dinero?",
        "No. No hacemos apuestas, no somos una casa de apuestas y tu dinero es algo que nunca tocamos. Tampoco necesitas una cuenta en ningún otro sitio, porque BetRedge funciona por sí solo. Y no prometemos ningún tipo de rentabilidad. Una probabilidad es una estimación: cuando decimos 71%, significa que en muchas situaciones parecidas a esta esperaríamos ese resultado unas 71 veces de cada 100. Lo que pase en este partido concreto, esta noche, no lo sabe. El registro público muestra cómo se liquidaron las lecturas pasadas, y sobre la próxima no dice nada.",
      ],
      [
        "¿Cómo lo uso en el día a día?",
        "Abre el tablero. Cada fila muestra el resultado en el que nuestra estimación y el mercado están más lejos: el mercado, nuestra estimación, la diferencia. Las filas de tenis muestran solo la cuota del mercado, sin estimación ni diferencia. Tócala para ver los tres resultados y las cuotas de las casas conectadas. Luego mira el registro público, porque ver cómo se liquidaron las lecturas anteriores te dice cuánto peso merece un número así. Lo que hagas después es decisión tuya. Free muestra cada partido del tablero, diferencia incluida; Pro añade por qué el modelo discrepa.",
      ],
    ],
  fr: [
      [ // REVIEW-NATIVE
        "Comment fonctionne la facturation, et puis-je résilier ?",
        "Pro est un abonnement par carte classique. Vous choisissez mensuel ou annuel, et il se renouvelle tout seul jusqu’à ce que vous l’arrêtiez. Vous l’arrêtez depuis votre compte, le jour que vous voulez, et à partir de ce moment nous ne vous facturons plus rien. La crypto fait exception : un paiement, 30 jours d’accès, aucun renouvellement d’aucune sorte. Le 31e jour, il ne se passe rien, sauf si vous décidez de payer à nouveau.",
      ],
      [
        "Que contient une lecture, et qu’ajoute Pro ?",
        "Trois chiffres, tous scellés avant le coup d’envoi. Ce que pense le marché, c’est-à-dire la cote convertie en pourcentage, marge retirée. Notre estimation : en football, c’est 70 % marché et 30 % modèle, et nous l’indiquons à côté. Au tennis, nous ne donnons pas d’estimation, seulement la cote du marché. Et l’écart entre les deux, en points. Pro ajoute le pourquoi : ouvrez n’importe quel match de football et vous voyez les facteurs que le modèle a réellement pesés, comme la forme, les buts attendus, l’Elo, les confrontations directes.",
      ],
      [
        "Quels sports couvrez-vous ?",
        "Le football et le tennis. C’est tout, pour l’instant. En football, nous lisons le résultat du match : victoire à domicile, match nul ou victoire à l’extérieur ; au tennis, qui gagne le match. Les compétitions présentes changent d’un jour à l’autre, et le tableau vous dit ce qu’il y a.",
      ],
      [
        "Que se passe-t-il sur le tableau en direct ?",
        "Le chiffre bouge pendant que le match avance. Le score change, le chrono tourne, la dynamique bascule, et le modèle relit la rencontre : vous voyez la probabilité évoluer au moment où elle évolue. Rien n’est jamais placé ni exécuté pour vous, à aucun moment : vous lisez un écran. Le direct est réservé à Pro.",
      ],
      [ // REVIEW-NATIVE
        "Placez-vous des paris, ou me promettez-vous de gagner de l’argent ?",
        "Non. Nous ne plaçons pas de paris, nous ne sommes pas un bookmaker, et votre argent, nous n’y touchons jamais. Vous n’avez pas non plus besoin d’un compte ailleurs, car BetRedge fonctionne seul. Et nous ne promettons aucun rendement, de quelque sorte que ce soit. Une probabilité est une estimation : quand nous disons 71 %, cela signifie que sur un grand nombre de situations semblables à celle-ci, nous attendrions cette issue environ 71 fois sur 100. Ce qui se passera dans ce match précis, ce soir, elle ne le sait pas. Le registre public montre comment les lectures passées se sont réglées, et sur la prochaine il ne dit rien.",
      ],
      [
        "Comment l’utiliser au quotidien ?",
        "Ouvrez le tableau. Chaque ligne montre l’issue où notre estimation et le marché sont le plus éloignés : le marché, notre estimation, l’écart. Les lignes de tennis montrent seulement la cote du marché, sans estimation ni écart. Touchez-la pour les trois issues et les cotes des bookmakers connectés. Puis regardez le registre public, car voir comment les lectures précédentes se sont réglées vous dit quel poids mérite un tel chiffre. Ce que vous en faites ensuite vous appartient. Free montre chaque match du tableau, écart compris ; Pro ajoute pourquoi le modèle n’est pas d’accord.",
      ],
    ],
    nl: [
      [ // REVIEW-NATIVE
        "Hoe werkt de betaling, en kan ik opzeggen?",
        "Pro is een gewoon kaartabonnement. Je kiest maandelijks of jaarlijks, en het verlengt vanzelf tot je het stopt. Stoppen doe je vanuit je account, op elke dag die je wilt, en vanaf dat moment rekenen we je niets meer aan. Crypto is de uitzondering: één betaling, 30 dagen toegang, geen enkele verlenging. Op dag 31 gebeurt er niets, tenzij je zelf besluit opnieuw te betalen.",
      ],
      [
        "Wat zit er in een lezing, en wat voegt Pro toe?",
        "Drie getallen, allemaal verzegeld vóór de aftrap. Wat de markt denkt: de odds omgezet in een percentage, zonder marge. Onze schatting: in het voetbal is dat 70% markt en 30% model, en dat zeggen we er ook bij. Bij tennis geven we geen eigen schatting, alleen de marktodds. En het verschil tussen de twee, in punten. Pro voegt het waarom toe: open een voetbalwedstrijd en je ziet de factoren die het model echt heeft gewogen, zoals vorm, verwachte doelpunten, Elo, onderlinge duels.",
      ],
      [
        "Welke sporten dekken jullie?",
        "Voetbal en tennis. Dat is alles, voorlopig. In het voetbal lezen we de uitslag van de wedstrijd, dus thuis, gelijkspel of uit; in het tennis wie de wedstrijd wint. Welke competities verschijnen, verandert van dag tot dag, en het board laat je zien wat er is.",
      ],
      [
        "Wat gebeurt er op het live board?",
        "Het getal beweegt mee met de wedstrijd. De stand verandert, de klok loopt, het momentum kantelt, en het model leest het spel opnieuw, zodat je de kans ziet verschuiven terwijl ze verschuift. Er wordt op geen enkel moment iets voor je geplaatst of uitgevoerd: je leest een scherm. Live is alleen voor Pro.",
      ],
      [ // REVIEW-NATIVE
        "Plaatsen jullie weddenschappen, of beloven jullie dat ik geld verdien?",
        "Nee. We plaatsen geen weddenschappen, we zijn geen bookmaker en aan je geld komen we nooit. Je hebt ook nergens anders een account nodig, want BetRedge werkt op zichzelf. En we beloven geen enkel rendement. Een kans is een schatting: als we 71% zeggen, betekent dat dat we over veel situaties die op deze lijken die uitkomst ongeveer 71 keer op 100 zouden verwachten. Wat er in deze specifieke wedstrijd vanavond gebeurt, weet ze niet. Het openbare register laat zien hoe eerdere lezingen afliepen, en over de volgende zegt het niets.",
      ],
      [
        "Hoe gebruik ik het van dag tot dag?",
        "Open het board. Elke rij toont de uitkomst waar onze schatting en de markt het verst uit elkaar liggen: de markt, onze schatting, het verschil. Tennisrijen tonen alleen de marktodds, zonder schatting en zonder verschil. Tik erop voor alle drie de uitkomsten en de odds van de gekoppelde bookmakers. Kijk daarna naar het openbare register, want zien hoe eerdere lezingen afliepen vertelt je hoeveel gewicht zo'n getal verdient. Wat je er daarna mee doet, is jouw keuze. Free toont elke wedstrijd op het board, verschil inbegrepen; Pro voegt toe waarom het model het oneens is.",
      ],
    ],
    pl: [
      [ // REVIEW-NATIVE
        "Jak działa płatność i czy mogę zrezygnować?",
        "Pro to zwykła subskrypcja kartą. Wybierasz plan miesięczny albo roczny, a subskrypcja odnawia się sama, dopóki jej nie zatrzymasz. Zatrzymujesz ją na swoim koncie, w dowolnym dniu, i od tej chwili nie pobieramy od ciebie nic więcej. Krypto to wyjątek: jedna płatność, 30 dni dostępu, żadnego odnowienia. 31. dnia nic się nie dzieje, chyba że sam zdecydujesz się zapłacić ponownie.",
      ],
      [
        "Co jest w analizie i co dodaje Pro?",
        "Trzy liczby, wszystkie zapieczętowane przed początkiem meczu. Co myśli rynek, czyli kurs zamieniony na procent bez marży. Nasz szacunek: w piłce nożnej to 70% rynek i 30% model, i piszemy to obok. W tenisie nie podajemy własnego szacunku, tylko kurs rynkowy. Oraz różnica między nimi, w punktach. Pro dodaje dlaczego: otwórz dowolny mecz piłkarski i zobaczysz czynniki, które model faktycznie uwzględnił, takie jak forma, gole oczekiwane, Elo, bezpośrednie mecze.",
      ],
      [
        "Jakie sporty obejmujecie?",
        "Piłkę nożną i tenis. Na razie tylko tyle. W piłce nożnej czytamy wynik meczu, czyli gospodarze, remis albo goście; w tenisie, kto wygra mecz. Które rozgrywki się pojawiają, zmienia się z dnia na dzień, a tablica mówi ci, co na niej jest.",
      ],
      [
        "Co dzieje się na tablicy na żywo?",
        "Liczba rusza się razem z meczem. Zmienia się wynik, biegnie zegar, przechyla się momentum, a model czyta grę od nowa, więc widzisz zmianę prawdopodobieństwa w chwili, gdy zachodzi. Nic nigdy nie jest stawiane ani wykonywane za ciebie: patrzysz na ekran. Na żywo jest tylko w Pro.",
      ],
      [ // REVIEW-NATIVE
        "Czy stawiacie zakłady albo obiecujecie, że zarobię?",
        "Nie. Nie stawiamy zakładów, nie jesteśmy bukmacherem i nigdy nie dotykamy twoich pieniędzy. Nie potrzebujesz też konta nigdzie indziej, bo BetRedge działa samodzielnie. I nie obiecujemy żadnego zwrotu. Prawdopodobieństwo to szacunek: gdy mówimy 71%, znaczy to, że w wielu sytuacjach podobnych do tej spodziewalibyśmy się tego wyniku mniej więcej 71 razy na 100. Co stanie się w tym konkretnym meczu, dziś wieczorem, tego ono nie wie. Publiczny rejestr pokazuje, jak rozliczyły się wcześniejsze analizy, a o następnej nie mówi nic.",
      ],
      [
        "Jak z tego korzystać na co dzień?",
        "Otwórz tablicę. Każdy wiersz pokazuje wynik, przy którym nasz szacunek i rynek są najdalej od siebie: rynek, nasz szacunek, różnica. Wiersze tenisowe pokazują tylko kurs rynkowy, bez szacunku i bez różnicy. Stuknij go, by zobaczyć wszystkie trzy wyniki i kursy połączonych bukmacherów. Potem zajrzyj do publicznego rejestru, bo to, jak rozliczyły się wcześniejsze analizy, mówi ci, na ile wagi zasługuje taka liczba. Co z tym zrobisz potem, to twoja decyzja. Free pokazuje każdy mecz na tablicy, razem z różnicą; Pro dodaje, dlaczego model się nie zgadza.",
      ],
    ],
  pt: [
      [
        "Como funciona a faturação, e posso cancelar?", // REVIEW-NATIVE
        "O Pro é uma subscrição normal por cartão. Escolhes mensal ou anual, e renova-se sozinha até a parares. Paras na tua conta, no dia que quiseres, e a partir desse momento não te cobramos mais nada. A cripto é a exceção: um pagamento, 30 dias de acesso, nenhuma renovação de qualquer tipo. No dia 31 não acontece nada, a menos que decidas pagar de novo.",
      ],
      [
        "O que há numa leitura, e o que acrescenta o Pro?", // REVIEW-NATIVE
        "Três números, todos selados antes do início. O que o mercado pensa, ou seja, as odds transformadas em percentagem sem a margem. A nossa estimativa: no futebol é 70% mercado e 30% modelo, e dizemo-lo ao lado. No ténis não damos estimativa nossa, só a odd de mercado. E a diferença entre as duas, em pontos. O Pro acrescenta o porquê: abre qualquer jogo de futebol e vês os fatores que o modelo realmente pesou, como forma, golos esperados, Elo, confrontos diretos.",
      ],
      [
        "Que desportos cobrem?",
        "Futebol e ténis. É tudo, por agora. No futebol lemos o resultado do jogo, portanto casa, empate ou fora; no ténis, quem ganha o encontro. As competições que aparecem mudam de um dia para o outro, e o board diz-te o que lá está.",
      ],
      [
        "O que acontece no board ao vivo?",
        "O número mexe-se enquanto o jogo decorre. O marcador muda, o relógio corre, o momento vira, e o modelo volta a ler o jogo, por isso vês a probabilidade a mudar enquanto muda. Nada é alguma vez apostado ou executado por ti: estás a ler um ecrã. O ao vivo é só para Pro.",
      ],
      [
        "Fazem apostas, ou prometem que vou ganhar dinheiro?", // REVIEW-NATIVE
        "Não. Não fazemos apostas, não somos uma casa de apostas, e o teu dinheiro é algo em que nunca tocamos. Também não precisas de conta em mais lado nenhum, porque a BetRedge funciona sozinha. E não prometemos nenhum retorno de qualquer tipo. Uma probabilidade é uma estimativa: quando dizemos 71%, significa que, em muitas situações parecidas com esta, esperaríamos esse resultado cerca de 71 vezes em 100. O que acontece neste jogo em concreto, esta noite, ela não sabe. O registo público mostra como as leituras passadas foram liquidadas, e sobre a próxima não diz nada.",
      ],
      [
        "Como o uso no dia a dia?",
        "Abre o board. Cada linha mostra o resultado em que a nossa estimativa e o mercado estão mais afastados: o mercado, a nossa estimativa, a diferença. As linhas de ténis mostram só a odd de mercado, sem estimativa nem diferença. Toca nela para os três resultados e as odds das casas ligadas. Depois olha para o registo público, porque ver como as leituras anteriores foram liquidadas diz-te quanto peso merece um número assim. O que fazes com isso a seguir é decisão tua. O Free mostra cada jogo do board, diferença incluída; o Pro acrescenta porque é que o modelo discorda.",
      ],
    ],
  ru: [
      [ // REVIEW-NATIVE
        "Как устроена оплата и можно ли отменить?",
        "Pro — обычная подписка по карте. Вы выбираете месячную или годовую, и она продлевается сама, пока вы её не остановите. Остановить её можно в своём аккаунте в любой день, и с этого момента мы больше ничего не списываем. Криптовалюта — исключение: один платёж, 30 дней доступа, никакого продления. На 31-й день ничего не происходит, если вы сами не решите заплатить снова.",
      ],
      [
        "Что входит в анализ и что добавляет Pro?",
        "Три числа, и все они зафиксированы до начала матча. Что думает рынок — коэффициенты, переведённые в проценты без маржи. Наша оценка: в футболе это 70% рынок и 30% модель, и мы пишем это рядом. В теннисе мы не даём своей оценки — только рыночный коэффициент. И разрыв между ними, в пунктах. Pro добавляет «почему»: откройте любой футбольный матч и увидите факторы, которые модель действительно учла, — форму, ожидаемые голы, Elo, личные встречи.",
      ],
      [
        "Какие виды спорта вы охватываете?",
        "Футбол и теннис. Пока только их. В футболе мы читаем исход матча — победа хозяев, ничья или победа гостей; в теннисе — кто выиграет матч. Какие турниры появляются, меняется изо дня в день, и панель показывает, что есть.",
      ],
      [
        "Что происходит на панели в режиме live?",
        "Число движется вместе с матчем. Меняется счёт, идёт время, переходит инициатива, и модель заново читает игру, так что вы видите, как вероятность сдвигается прямо в момент сдвига. Ничего и никогда не ставится и не исполняется за вас: вы просто смотрите на экран. Live — только в Pro.",
      ],
      [ // REVIEW-NATIVE
        "Вы делаете ставки или обещаете, что я заработаю?",
        "Нет. Мы не делаем ставок, мы не букмекер, и ваших денег мы никогда не касаемся. Аккаунт где-то ещё вам тоже не нужен: BetRedge работает сам по себе. И мы не обещаем никакой доходности. Вероятность — это оценка: когда мы говорим 71%, это значит, что во множестве похожих ситуаций мы ожидали бы этот исход примерно 71 раз из 100. Что произойдёт именно в этом матче сегодня вечером, она не знает. Публичный реестр показывает, чем закончились прошлые оценки, а о следующей он не говорит ничего.",
      ],
      [
        "Как пользоваться этим каждый день?",
        "Откройте панель. Каждая строка показывает исход, где наша оценка и рынок расходятся сильнее всего: рынок, наша оценка, разрыв. Строки тенниса показывают только рыночный коэффициент, без оценки и разрыва. Нажмите на неё — увидите все три исхода и коэффициенты подключённых букмекеров. Затем загляните в публичный реестр: то, чем закончились прежние оценки, подсказывает, какой вес заслуживает такое число. Что делать с этим дальше — решать вам. Free показывает каждый матч на панели вместе с разрывом; Pro добавляет, почему модель не согласна.",
      ],
    ],
    sv: [
      [ // REVIEW-NATIVE
        "Hur fungerar betalningen, och kan jag säga upp?",
        "Pro är ett vanligt kortabonnemang. Du väljer månadsvis eller årsvis, och det förnyas av sig självt tills du stoppar det. Du stoppar det från ditt konto, vilken dag du vill, och från det ögonblicket debiterar vi dig ingenting mer. Krypto är undantaget: en betalning, 30 dagars tillgång, ingen förnyelse av något slag. Dag 31 händer ingenting om du inte själv bestämmer dig för att betala igen.",
      ],
      [
        "Vad ingår i en läsning, och vad lägger Pro till?",
        "Tre siffror, alla förseglade före avspark. Vad marknaden tror, alltså oddset omvandlat till en procentsats med marginalen borttagen. Vår uppskattning: i fotboll är den 70 % marknad och 30 % modell, och det står bredvid. I tennis ger vi ingen egen uppskattning, bara marknadens odds. Och skillnaden mellan de två, i punkter. Pro lägger till varför: öppna vilken fotbollsmatch som helst och du ser faktorerna modellen faktiskt vägde in, som form, förväntade mål, Elo, inbördes möten.",
      ],
      [
        "Vilka sporter täcker ni?",
        "Fotboll och tennis. Det är allt, för tillfället. I fotboll läser vi matchresultatet, alltså hemmaseger, oavgjort eller bortaseger; i tennis, vem som vinner matchen. Vilka tävlingar som syns ändras från dag till dag, och boarden visar vad som finns.",
      ],
      [
        "Vad händer på liveboarden?",
        "Siffran rör sig medan matchen gör det. Ställningen ändras, klockan går, momentum vänder, och modellen läser matchen igen, så du ser sannolikheten skifta medan den skiftar. Ingenting läggs eller genomförs någonsin åt dig: du läser en skärm. Live finns bara i Pro.",
      ],
      [ // REVIEW-NATIVE
        "Lägger ni spel, eller lovar ni att jag tjänar pengar?",
        "Nej. Vi lägger inga spel, vi är inget spelbolag, och dina pengar rör vi aldrig. Du behöver inte heller något konto någon annanstans, eftersom BetRedge fungerar på egen hand. Och vi lovar ingen avkastning av något slag. En sannolikhet är en uppskattning: när vi säger 71 % betyder det att vi, över många situationer som liknar den här, skulle vänta oss det utfallet ungefär 71 gånger av 100. Vad som händer i just den här matchen, i kväll, vet den inte. Det offentliga registret visar hur tidigare läsningar avgjordes, och om nästa säger det ingenting.",
      ],
      [
        "Hur använder jag det i vardagen?",
        "Öppna boarden. Varje rad visar utfallet där vår uppskattning och marknaden ligger längst isär: marknaden, vår uppskattning, skillnaden. Tennisrader visar bara marknadens odds, utan uppskattning och utan skillnad. Tryck på den för alla tre utfallen och oddsen från de anslutna spelbolagen. Titta sedan på det offentliga registret, för att se hur tidigare läsningar avgjordes säger dig hur mycket vikt en sådan siffra förtjänar. Vad du gör med det sedan är ditt beslut. Free visar varje match på boarden, skillnaden inräknad; Pro lägger till varför modellen inte håller med.",
      ],
    ],
    tr: [
      [ // REVIEW-NATIVE
        "Ödeme nasıl işliyor, iptal edebilir miyim?",
        "Pro sıradan bir kart aboneliğidir. Aylık ya da yıllık seçersin ve sen durdurana kadar kendiliğinden yenilenir. İstediğin gün hesabından durdurursun ve o andan itibaren senden başka bir ücret almayız. Kripto istisnadır: tek ödeme, 30 günlük erişim, hiçbir şekilde yenileme yok. 31. gün, yeniden ödemeye karar vermedikçe hiçbir şey olmaz.",
      ],
      [
        "Bir okumada ne var, Pro ne ekliyor?",
        "Üç sayı, hepsi başlamadan önce mühürlü. Piyasanın düşündüğü: oranın marj çıkarılarak yüzdeye çevrilmiş hali. Tahminimiz: futbolda %70 piyasa ve %30 modeldir ve bunu yanında yazarız. Teniste kendi tahminimizi vermiyoruz, yalnızca piyasa oranını. Ve ikisi arasındaki fark, puan olarak. Pro nedenini ekler: herhangi bir futbol maçını aç ve modelin gerçekten tarttığı etkenleri gör; form, beklenen goller, Elo, ikili rekabet gibi.",
      ],
      [
        "Hangi sporları kapsıyorsunuz?",
        "Futbol ve tenis. Şimdilik bu kadar. Futbolda maç sonucunu okuruz, yani ev sahibi, beraberlik ya da deplasman; teniste maçı kimin kazanacağını. Hangi turnuvaların görüneceği günden güne değişir ve pano neyin olduğunu sana söyler.",
      ],
      [
        "Canlı panoda ne oluyor?",
        "Maç ilerledikçe sayı da hareket eder. Skor değişir, saat işler, üstünlük el değiştirir ve model oyunu yeniden okur; böylece olasılığın kaydığını tam kayarken görürsün. Hiçbir anda senin adına hiçbir şey oynanmaz ya da yürütülmez: bir ekran okuyorsun. Canlı yalnızca Pro'dadır.",
      ],
      [ // REVIEW-NATIVE
        "Bahis oynuyor musunuz ya da para kazanacağımı vaat ediyor musunuz?",
        "Hayır. Bahis oynamayız, bahis sitesi değiliz ve paran asla dokunduğumuz bir şey değildir. Başka bir yerde hesaba da ihtiyacın yok, çünkü BetRedge kendi başına çalışır. Ve hiçbir türde getiri vaat etmeyiz. Olasılık bir tahmindir: %71 dediğimizde, buna benzeyen pek çok durumda o sonucun 100'de yaklaşık 71 kez gerçekleşmesini beklediğimiz anlamına gelir. Bu akşam bu maçta ne olacağını bilmez. Kamuya açık kayıt geçmiş okumaların nasıl sonuçlandığını gösterir; bir sonrakine dair hiçbir şey söylemez.",
      ],
      [
        "Günlük olarak nasıl kullanırım?",
        "Panoyu aç. Her satır, tahminimiz ile piyasanın en çok ayrıştığı sonucu gösterir: piyasa, tahminimiz, fark. Tenis satırları yalnızca piyasa oranını gösterir; tahmin ve fark yoktur. Üç sonucun hepsi ve bağlı bahis sitelerinin oranları için dokun. Sonra kamuya açık kayda bak, çünkü önceki okumaların nasıl sonuçlandığını görmek böyle bir sayıya ne kadar ağırlık verileceğini söyler. Bundan sonra ne yapacağın senin kararın. Free panodaki her maçı, fark dahil gösterir; Pro modelin neden farklı düşündüğünü ekler.",
      ],
    ],
} as const satisfies Record<string, readonly FaqItem[]>;

/** Le 11 lingue; una lingua sconosciuta ricade su EN. */
export function v3cHomeFaq(lang: string): readonly FaqItem[] {
  return V3C_HOME_FAQ[v3cLang(lang)];
}
