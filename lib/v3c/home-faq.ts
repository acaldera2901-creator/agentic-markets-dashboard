// lib/v3c/home-faq.ts (#REDESIGN-V3C polish · fixui3 R1) — le domande della home v3c.
// Fonte UNICA per la FAQ visibile (components/v3c/home/Faq.tsx) e per il
// FAQPage JSON-LD di "/" a flag acceso (app/v3c/page.tsx): lo schema dice
// esattamente ciò che la pagina mostra.
//
// Perché un file a parte e non lib/home-faq.ts: quello alimenta la home di oggi
// (flag spento) e deve restare identico.
//
// fixui3 R1 (QA-REPORT-3, 07/10): riscritta per dire SOLO ciò che il sito fa oggi, ≤ 22 parole per
// risposta (lib/v3c/i18n-parity.test.ts lo misura). Tolto, perché falso:
//   · «il modello rilegge la partita in diretta»: il live è solo il punteggio (/api/v3/live, «never part of
//     the estimates»); una partita iniziata mostra i numeri pre-partita, senza prezzi;
//   · «tre numeri, tutti sigillati prima del calcio d'inizio»: la stima tennis mostrata (90% mercato +
//     10% Elo) non è sigillata; nel calcio mercato e stima sì, e stanno nel registro;
//   · «funzioni Pro comprese» / «il live è una funzione Pro aperta a tutti»: in Fase 0 Pro è un'anteprima,
//     non c'è niente da comprare né una funzione Pro da aprire (DECISIONI-FREE-PRO §f);
//   · «tutti e tre gli esiti»: nel tennis gli esiti sono due. «I prezzi dei book» restano: li mostra la
//     pagina partita quando la partita non è iniziata.
// Nessun claim nuovo: blend calcio 70/30 e tennis 90/10 sono quelli dichiarati sulla board.
import type { FaqItem } from "@/lib/home-faq";
import { v3cLang } from "./copy";

export const V3C_HOME_FAQ = {
  en: [
    ["Do I have to pay anything?", "No. Everything on BetRedge is free today. Pro is a preview: there is nothing to buy yet."],
    ["What’s in a reading?", "The market’s probability with the margin removed, our estimate, and the gap between them, in points."],
    ["How is the estimate made?", "Football: 70% market, 30% our model. Tennis, where our Elo is fresh: 90% market, 10% Elo; otherwise the market only."],
    ["What is sealed before kick-off?", "Football: market and estimate are sealed before kick-off and kept in the record. Tennis: the estimate shown isn’t sealed yet."],
    ["Which sports do you cover?", "Football and tennis. Football: home, draw or away. Tennis: who wins the match. The board shows what’s on."],
    ["What happens during a match?", "A live score updates while the match is on; our market and estimate numbers are from before kick-off."],
    ["Do you place bets, or promise I’ll make money?", "No. We take no bets, never touch your money and promise no return: a probability is an estimate."],
    ["How do I use it day to day?", "Open the board and tap a match: every outcome, the books’ prices. Then check the record of past readings."],
  ],
  it: [
    ["Devo pagare qualcosa?", "No. Oggi tutto su BetRedge è gratuito. Pro è un’anteprima: non c’è ancora niente da comprare."],
    ["Cosa c’è dentro una lettura?", "La probabilità del mercato senza il margine, la nostra stima e il gap fra le due, in punti."],
    ["Come nasce la stima?", "Calcio: 70% mercato, 30% nostro modello. Tennis, dove il nostro Elo è recente: 90% mercato, 10% Elo; altrimenti solo il mercato."],
    ["Cosa viene sigillato prima del fischio d’inizio?", "Calcio: mercato e stima sono sigillati prima dell’inizio e restano nel registro. Tennis: la stima mostrata non è ancora sigillata."],
    ["Quali sport coprite?", "Calcio e tennis. Calcio: 1, X o 2. Tennis: chi vince il match. Il board mostra cosa c’è in programma."],
    ["Cosa succede durante la partita?", "Un punteggio live si aggiorna mentre si gioca; i nostri numeri di mercato e stima sono di prima del fischio d’inizio."],
    ["Piazzate scommesse? Mi promettete un guadagno?", "No. Non accettiamo scommesse, non tocchiamo i tuoi soldi e non promettiamo rendimenti: una probabilità è una stima."],
    ["Come lo uso, in pratica?", "Apri il board e tocca una partita: tutti gli esiti, i prezzi dei book. Poi guarda il registro delle letture passate."],
  ],
  de: [
    // REVIEW-NATIVE (1 · 7)
    ["Muss ich etwas bezahlen?", "Nein. Auf BetRedge ist heute alles kostenlos. Pro ist eine Vorschau: Noch gibt es nichts zu kaufen."],
    ["Was steckt in einer Analyse?", "Die Marktwahrscheinlichkeit ohne Marge, unsere Schätzung und der Abstand zwischen beiden, in Punkten."],
    ["Wie entsteht die Schätzung?", "Fußball: 70% Markt, 30% unser Modell. Tennis, wo unser Elo aktuell ist: 90% Markt, 10% Elo; sonst nur der Markt."],
    ["Was wird vor dem Anstoß versiegelt?", "Fußball: Markt und Schätzung werden vor dem Anstoß versiegelt und bleiben im Register. Tennis: Die gezeigte Schätzung ist noch nicht versiegelt."],
    ["Welche Sportarten deckt ihr ab?", "Fußball und Tennis. Fußball: Heimsieg, Unentschieden oder Auswärtssieg. Tennis: wer das Match gewinnt. Das Board zeigt, was ansteht."],
    ["Was passiert während des Spiels?", "Ein Live-Spielstand wird während des Spiels aktualisiert; unsere Markt- und Schätzwerte stammen von vor dem Anstoß."],
    ["Platziert ihr Wetten, oder versprecht ihr mir Geld?", "Nein. Wir nehmen keine Wetten an, berühren nie dein Geld und versprechen keine Rendite: Eine Wahrscheinlichkeit ist eine Schätzung."],
    ["Wie nutze ich es im Alltag?", "Öffne das Board und tippe auf ein Spiel: alle Ausgänge, die Quoten der Buchmacher. Dann schau ins Register früherer Analysen."],
  ],
  es: [
    // REVIEW-NATIVE (1 · 7)
    ["¿Tengo que pagar algo?", "No. Hoy todo en BetRedge es gratis. Pro es una vista previa: todavía no hay nada que comprar."],
    ["¿Qué hay en una lectura?", "La probabilidad del mercado sin el margen, nuestra estimación y la diferencia entre ambas, en puntos."],
    ["¿Cómo se calcula la estimación?", "Fútbol: 70% mercado, 30% nuestro modelo. Tenis, donde nuestro Elo es reciente: 90% mercado, 10% Elo; si no, solo el mercado."],
    ["¿Qué se sella antes del inicio?", "Fútbol: mercado y estimación se sellan antes del inicio y quedan en el registro. Tenis: la estimación mostrada aún no está sellada."],
    ["¿Qué deportes cubrís?", "Fútbol y tenis. Fútbol: local, empate o visitante. Tenis: quién gana el partido. El tablero muestra lo que hay."],
    ["¿Qué pasa durante el partido?", "Un marcador en directo se actualiza mientras se juega; nuestras cifras de mercado y estimación son de antes del inicio."],
    ["¿Hacéis apuestas, o me prometéis que ganaré dinero?", "No. No aceptamos apuestas, nunca tocamos tu dinero ni prometemos rendimientos: una probabilidad es una estimación."],
    ["¿Cómo lo uso en el día a día?", "Abre el tablero y toca un partido: cada resultado y las cuotas de las casas. Luego mira el registro de lecturas pasadas."],
  ],
  fr: [
    // REVIEW-NATIVE (1 · 7)
    ["Dois-je payer quelque chose ?", "Non. Aujourd’hui, tout est gratuit sur BetRedge. Pro est un aperçu : il n’y a encore rien à acheter."],
    ["Que contient une lecture ?", "La probabilité du marché sans la marge, notre estimation et l’écart entre les deux, en points."],
    ["Comment l’estimation est-elle faite ?", "Football : 70% marché, 30% notre modèle. Tennis, avec un Elo récent : 90% marché, 10% Elo ; sinon le marché."],
    ["Qu’est-ce qui est scellé avant le coup d’envoi ?", "Au football, marché et estimation sont scellés avant le match et gardés au registre. Au tennis, l’estimation affichée n’est pas encore scellée."],
    ["Quels sports couvrez-vous ?", "Football et tennis. Football : domicile, nul ou extérieur. Tennis : qui gagne le match. Le tableau montre le programme."],
    ["Que se passe-t-il pendant le match ?", "Un score en direct s’actualise pendant la rencontre ; nos chiffres de marché et d’estimation datent d’avant le coup d’envoi."],
    ["Placez-vous des paris, ou me promettez-vous de gagner de l’argent ?", "Non. Nous ne prenons pas de paris, ne touchons pas votre argent, ne promettons aucun gain : une probabilité est une estimation."],
    ["Comment l’utiliser au quotidien ?", "Ouvrez le tableau et touchez un match : chaque issue, les cotes des bookmakers. Puis consultez le registre des lectures passées."],
  ],
  nl: [
    // REVIEW-NATIVE (1 · 7)
    ["Moet ik iets betalen?", "Nee. Alles op BetRedge is vandaag gratis. Pro is een preview: er is nog niets te koop."],
    ["Wat zit er in een lezing?", "De marktkans zonder marge, onze schatting en het verschil tussen beide, in punten."],
    ["Hoe komt de schatting tot stand?", "Voetbal: 70% markt, 30% ons model. Tennis, waar onze Elo recent is: 90% markt, 10% Elo; anders alleen de markt."],
    ["Wat wordt vóór de aftrap verzegeld?", "Voetbal: markt en schatting worden vóór de aftrap verzegeld en bewaard in het register. Tennis: de getoonde schatting is nog niet verzegeld."],
    ["Welke sporten dekken jullie?", "Voetbal en tennis. Voetbal: thuis, gelijk of uit. Tennis: wie de wedstrijd wint. Het board toont wat er op het programma staat."],
    ["Wat gebeurt er tijdens de wedstrijd?", "Een livescore wordt bijgewerkt zolang er gespeeld wordt; onze markt- en schattingscijfers zijn van vóór de aftrap."],
    ["Plaatsen jullie weddenschappen, of beloven jullie dat ik geld verdien?", "Nee. We nemen geen weddenschappen aan, raken je geld nooit aan en beloven geen rendement: een kans is een schatting."],
    ["Hoe gebruik ik het van dag tot dag?", "Open het board en tik op een wedstrijd: elke uitkomst, de odds van de bookmakers. Bekijk daarna het register van eerdere lezingen."],
  ],
  pl: [
    // REVIEW-NATIVE (1 · 7)
    ["Czy muszę za coś płacić?", "Nie. Dziś wszystko na BetRedge jest darmowe. Pro to podgląd: na razie nie ma nic do kupienia."],
    ["Co jest w analizie?", "Prawdopodobieństwo rynku bez marży, nasz szacunek i różnica między nimi, w punktach."],
    ["Jak powstaje szacunek?", "Piłka nożna: 70% rynek, 30% nasz model. Tenis, gdy nasze Elo jest aktualne: 90% rynek, 10% Elo; inaczej tylko rynek."],
    ["Co jest pieczętowane przed początkiem meczu?", "Piłka nożna: rynek i szacunek są pieczętowane przed początkiem i zostają w rejestrze. Tenis: pokazany szacunek nie jest jeszcze zapieczętowany."],
    ["Jakie sporty obejmujecie?", "Piłka nożna i tenis. W piłce: gospodarze, remis lub goście. W tenisie: kto wygra mecz. Tablica pokazuje, co jest w programie."],
    ["Co dzieje się w trakcie meczu?", "Wynik na żywo aktualizuje się w trakcie gry; nasze liczby rynku i szacunku pochodzą sprzed początku meczu."],
    ["Czy stawiacie zakłady albo obiecujecie, że zarobię?", "Nie. Nie przyjmujemy zakładów, nie dotykamy twoich pieniędzy i nie obiecujemy zysku: prawdopodobieństwo to szacunek."],
    ["Jak z tego korzystać na co dzień?", "Otwórz tablicę i dotknij meczu: każdy wynik, kursy bukmacherów. Potem zajrzyj do rejestru wcześniejszych analiz."],
  ],
  pt: [
    // REVIEW-NATIVE (1 · 7)
    ["Tenho de pagar alguma coisa?", "Não. Hoje, tudo no BetRedge é gratuito. O Pro é uma pré-visualização: ainda não há nada para comprar."],
    ["O que há numa leitura?", "A probabilidade do mercado sem a margem, a nossa estimativa e a diferença entre as duas, em pontos."],
    ["Como é feita a estimativa?", "Futebol: 70% mercado, 30% nosso modelo. Ténis, onde o nosso Elo é recente: 90% mercado, 10% Elo; senão, só o mercado."],
    ["O que é selado antes do início?", "Futebol: mercado e estimativa são selados antes do início e ficam no registo. Ténis: a estimativa mostrada ainda não está selada."],
    ["Que desportos cobrem?", "Futebol e ténis. Futebol: casa, empate ou fora. Ténis: quem ganha o encontro. O board mostra o que está em programa."],
    ["O que acontece durante o jogo?", "Um resultado ao vivo atualiza-se enquanto se joga; os nossos números de mercado e estimativa são de antes do início."],
    ["Fazem apostas, ou prometem que vou ganhar dinheiro?", "Não. Não aceitamos apostas, nunca tocamos no teu dinheiro e não prometemos rendimento: uma probabilidade é uma estimativa."],
    ["Como o uso no dia a dia?", "Abre o board e toca num jogo: cada resultado, as odds das casas. Depois vê o registo das leituras anteriores."],
  ],
  ru: [
    // REVIEW-NATIVE (1 · 7)
    ["Нужно ли за что-то платить?", "Нет. Сегодня всё на BetRedge бесплатно. Pro — это предпросмотр: покупать пока нечего."],
    ["Что входит в анализ?", "Вероятность рынка без маржи, наша оценка и разрыв между ними в процентных пунктах."],
    ["Как получается оценка?", "Футбол: 70% рынок, 30% наша модель. Теннис, где наш Elo свежий: 90% рынок, 10% Elo; иначе только рынок."],
    ["Что фиксируется до начала матча?", "Футбол: рынок и оценка фиксируются до начала и хранятся в реестре. Теннис: показанная оценка пока не зафиксирована."],
    ["Какие виды спорта вы охватываете?", "Футбол и теннис. Футбол: победа хозяев, ничья или победа гостей. Теннис: кто выиграет матч. Панель показывает, что в программе."],
    ["Что происходит во время матча?", "Счёт в реальном времени обновляется по ходу игры; наши цифры рынка и оценки сняты до начала матча."],
    ["Вы делаете ставки или обещаете, что я заработаю?", "Нет. Мы не принимаем ставки, не касаемся ваших денег и не обещаем доходности: вероятность — это оценка."],
    ["Как пользоваться этим каждый день?", "Откройте панель и нажмите на матч: все исходы, коэффициенты букмекеров. Затем загляните в реестр прошлых анализов."],
  ],
  sv: [
    // REVIEW-NATIVE (1 · 7)
    ["Måste jag betala något?", "Nej. Allt på BetRedge är gratis i dag. Pro är en förhandsvisning: det finns inget att köpa än."],
    ["Vad ingår i en läsning?", "Marknadens sannolikhet utan marginal, vår uppskattning och skillnaden mellan dem, i punkter."],
    ["Hur tas uppskattningen fram?", "Fotboll: 70% marknad, 30% vår modell. Tennis, där vår Elo är färsk: 90% marknad, 10% Elo; annars bara marknaden."],
    ["Vad förseglas före avspark?", "Fotboll: marknad och uppskattning förseglas före avspark och sparas i registret. Tennis: den visade uppskattningen är inte förseglad än."],
    ["Vilka sporter täcker ni?", "Fotboll och tennis. Fotboll: hemma, oavgjort eller borta. Tennis: vem som vinner matchen. Boarden visar vad som står på programmet."],
    ["Vad händer under matchen?", "Ett liveresultat uppdateras medan matchen pågår; våra siffror för marknad och uppskattning är från före avspark."],
    ["Lägger ni spel, eller lovar ni att jag tjänar pengar?", "Nej. Vi tar inte emot spel, rör aldrig dina pengar och lovar ingen avkastning: en sannolikhet är en uppskattning."],
    ["Hur använder jag det i vardagen?", "Öppna boarden och tryck på en match: alla utfall, spelbolagens odds. Titta sedan i registret över tidigare läsningar."],
  ],
  tr: [
    // REVIEW-NATIVE (1 · 7)
    ["Bir şey ödemem gerekiyor mu?", "Hayır. Bugün BetRedge'deki her şey ücretsiz. Pro bir önizleme: henüz satın alınacak bir şey yok."],
    ["Bir okumada ne var?", "Marj çıkarılmış piyasa olasılığı, tahminimiz ve ikisi arasındaki fark, puan olarak."],
    ["Tahmin nasıl yapılıyor?", "Futbol: %70 piyasa, %30 modelimiz. Tenis, Elo’muz güncelse: %90 piyasa, %10 Elo; değilse yalnızca piyasa."],
    ["Başlamadan önce ne mühürleniyor?", "Futbol: piyasa ve tahmin başlama öncesi mühürlenir ve kayıt defterinde kalır. Tenis: gösterilen tahmin henüz mühürlü değil."],
    ["Hangi sporları kapsıyorsunuz?", "Futbol ve tenis. Futbol: ev sahibi, beraberlik ya da deplasman. Tenis: maçı kimin kazandığı. Pano programda olanı gösterir."],
    ["Maç sırasında ne oluyor?", "Maç sürerken canlı skor güncellenir; piyasa ve tahmin sayılarımız başlama öncesine aittir."],
    ["Bahis oynuyor musunuz ya da para kazanacağımı vaat ediyor musunuz?", "Hayır. Bahis almayız, parana asla dokunmayız ve getiri vaat etmeyiz: olasılık bir tahmindir."],
    ["Günlük olarak nasıl kullanırım?", "Panoyu aç ve bir maça dokun: tüm sonuçlar, bahis sitelerinin oranları. Sonra geçmiş okumaların kayıt defterine bak."],
  ],
} as const satisfies Record<string, readonly FaqItem[]>;

/** Le 11 lingue; una lingua sconosciuta ricade su EN. */
export function v3cHomeFaq(lang: string): readonly FaqItem[] {
  return V3C_HOME_FAQ[v3cLang(lang)];
}
