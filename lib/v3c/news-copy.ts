// lib/v3c/news-copy.ts (#REDESIGN-V3C news) — the copy of the live news (News
// page + the «News at hh:mm» note on the match page), 11 languages, glossary in
// docs/redesign/i18n-glossary.md. ≤22 words per element. The news says WHEN, never
// WHY: «news at», never «because of». Legal lines (AI label, takedown) carry
// REVIEW-NATIVE. The notes themselves are EN/IT; the other 9 show EN, labelled.
import { v3cLang, type V3cLang } from "./copy";

const EN = {
  latest: "Latest football news",
  updatedAt: (time: string) => `Updated at ${time}`,
  count: (n: number) => (n === 1 ? "1 note" : `${n} notes`),
  aiLabel: (source: string) => `Rewritten with AI from ${source}`,
  inEnglish: "In English",
  readOriginal: "Read the original",
  filterLabel: "Filter the news",
  all: "All",
  onBoardFilter: "On today’s board",
  onBoard: "On the board",
  mostMoved: "Most moved today",
  mostMovedSub: "Biggest price moves on the board in 24 hours, with the nearest news. Timing only, not a cause.",
  newsAt: (time: string) => `News at ${time}`,
  noNewsNear: "No news near this move",
  noMoves: "No lead price on the board moved in the last 24 hours.",
  draw: "Draw",
  error: "The news feed is unavailable right now. The guides below are unaffected.",
  empty: "No news in the feed right now.",
  pending: "News is on its way. We only show a story once we have rewritten it. Our guides are below.",
  paused: "The news source is paused. The guides below are unaffected.",
  guides: "Guides",
  guidesSub: "Written by us: numbers explained, no picks.",
  takedown: "Own this story? Write to info@betredge.com and we take it down within 24 hours.",
  matchBody: (source: string) => `Reported by ${source}. We show when it happened, not what moved the price.`,
};

export type NewsCopy = typeof EN;

const IT: NewsCopy = {
  latest: "Ultime notizie di calcio",
  updatedAt: (time) => `Aggiornato alle ${time}`,
  count: (n) => (n === 1 ? "1 notizia" : `${n} notizie`),
  aiLabel: (source) => `Riscritto con l’IA a partire da ${source}`, // REVIEW-NATIVE
  inEnglish: "In inglese",
  readOriginal: "Leggi l’originale",
  filterLabel: "Filtra le notizie",
  all: "Tutte",
  onBoardFilter: "Sul board di oggi",
  onBoard: "Sul board",
  mostMoved: "Le quote più mosse oggi",
  mostMovedSub: "I maggiori movimenti di quota sul board in 24 ore, con la notizia più vicina. Solo l’ora, non la causa.",
  newsAt: (time) => `Notizia alle ${time}`,
  noNewsNear: "Nessuna notizia vicina a questo movimento",
  noMoves: "Nessuna quota guida del board si è mossa nelle ultime 24 ore.",
  draw: "Pareggio",
  error: "Il feed delle notizie ora non è disponibile. Le guide qui sotto non cambiano.",
  empty: "Nessuna notizia nel feed in questo momento.",
  pending: "Notizie in arrivo. Mostriamo una notizia solo dopo averla riscritta. Le nostre guide sono qui sotto.",
  paused: "La fonte delle notizie è in pausa. Le guide qui sotto non cambiano.",
  guides: "Guide",
  guidesSub: "Scritte da noi: numeri spiegati, nessun pronostico.",
  takedown: "La notizia è tua? Scrivi a info@betredge.com e la togliamo entro 24 ore.", // REVIEW-NATIVE
  matchBody: (source) => `Riportata da ${source}. Mostriamo quando è successo, non cosa ha mosso la quota.`,
};

const DE: NewsCopy = {
  latest: "Aktuelle Fußball-News",
  updatedAt: (time) => `Aktualisiert um ${time}`,
  count: (n) => (n === 1 ? "1 Meldung" : `${n} Meldungen`),
  aiLabel: (source) => `Mit KI umgeschrieben, Quelle: ${source}`, // REVIEW-NATIVE
  inEnglish: "Auf Englisch",
  readOriginal: "Original lesen",
  filterLabel: "News filtern",
  all: "Alle",
  onBoardFilter: "Auf dem heutigen Board",
  onBoard: "Auf dem Board",
  mostMoved: "Heute am stärksten bewegt",
  mostMovedSub: "Die größten Quotenbewegungen auf dem Board in 24 Stunden, mit der nächsten Meldung. Nur der Zeitpunkt, keine Ursache.",
  newsAt: (time) => `News um ${time}`,
  noNewsNear: "Keine Meldung nahe dieser Bewegung",
  noMoves: "Keine Leitquote auf dem Board hat sich in den letzten 24 Stunden bewegt.",
  draw: "Unentschieden",
  error: "Der News-Feed ist gerade nicht verfügbar. Die Guides unten sind davon nicht betroffen.",
  empty: "Gerade keine Meldungen im Feed.",
  pending: "News folgen in Kürze. Wir zeigen eine Meldung erst, wenn wir sie umgeschrieben haben. Unsere Guides stehen unten.",
  paused: "Die News-Quelle ist pausiert. Die Guides unten sind davon nicht betroffen.",
  guides: "Guides",
  guidesSub: "Von uns geschrieben: Zahlen erklärt, keine Tipps.",
  takedown: "Deine Meldung? Schreib an info@betredge.com, wir entfernen sie innerhalb von 24 Stunden.", // REVIEW-NATIVE
  matchBody: (source) => `Gemeldet von ${source}. Wir zeigen, wann es passiert ist, nicht was die Quote bewegt hat.`,
};

const ES: NewsCopy = {
  latest: "Últimas noticias de fútbol",
  updatedAt: (time) => `Actualizado a las ${time}`,
  count: (n) => (n === 1 ? "1 noticia" : `${n} noticias`),
  aiLabel: (source) => `Reescrito con IA a partir de ${source}`, // REVIEW-NATIVE
  inEnglish: "En inglés",
  readOriginal: "Leer el original",
  filterLabel: "Filtrar las noticias",
  all: "Todas",
  onBoardFilter: "En el tablero de hoy",
  onBoard: "En el tablero",
  mostMoved: "Lo que más se movió hoy",
  mostMovedSub: "Los mayores movimientos de cuota del tablero en 24 horas, con la noticia más cercana. Solo la hora, no la causa.",
  newsAt: (time) => `Noticia a las ${time}`,
  noNewsNear: "Ninguna noticia cerca de este movimiento",
  noMoves: "Ninguna cuota principal del tablero se ha movido en las últimas 24 horas.",
  draw: "Empate",
  error: "El feed de noticias no está disponible ahora. Las guías de abajo no cambian.",
  empty: "Ahora no hay noticias en el feed.",
  pending: "Noticias en camino. Solo mostramos una noticia después de reescribirla. Nuestras guías están abajo.",
  paused: "La fuente de noticias está en pausa. Las guías de abajo no cambian.",
  guides: "Guías",
  guidesSub: "Escritas por nosotros: números explicados, sin pronósticos.",
  takedown: "¿Es tu noticia? Escribe a info@betredge.com y la retiramos en 24 horas.", // REVIEW-NATIVE
  matchBody: (source) => `Publicada por ${source}. Mostramos cuándo ocurrió, no qué movió la cuota.`,
};

const FR: NewsCopy = {
  latest: "Dernières actus football",
  updatedAt: (time) => `Mis à jour à ${time}`,
  count: (n) => (n === 1 ? "1 actu" : `${n} actus`),
  aiLabel: (source) => `Réécrit par IA à partir de ${source}`, // REVIEW-NATIVE
  inEnglish: "En anglais",
  readOriginal: "Lire l’original",
  filterLabel: "Filtrer les actus",
  all: "Toutes",
  onBoardFilter: "Sur le tableau du jour",
  onBoard: "Sur le tableau",
  mostMoved: "Les plus fortes variations du jour",
  mostMovedSub: "Les plus forts mouvements de cote du tableau en 24 heures, avec l’actu la plus proche. L’heure, pas la cause.",
  newsAt: (time) => `Actu à ${time}`,
  noNewsNear: "Aucune actu proche de ce mouvement",
  noMoves: "Aucune cote principale du tableau n’a bougé ces dernières 24 heures.",
  draw: "Match nul",
  error: "Le flux d’actus est indisponible pour le moment. Les guides ci-dessous ne changent pas.",
  empty: "Aucune actu dans le flux pour le moment.",
  pending: "Actus en route. Nous ne montrons une actu qu’après l’avoir réécrite. Nos guides sont ci-dessous.",
  paused: "La source d’actus est en pause. Les guides ci-dessous ne changent pas.",
  guides: "Guides",
  guidesSub: "Écrits par nous : chiffres expliqués, aucun pronostic.",
  takedown: "C’est votre article ? Écrivez à info@betredge.com, nous le retirons sous 24 heures.", // REVIEW-NATIVE
  matchBody: (source) => `Rapporté par ${source}. Nous montrons quand c’est arrivé, pas ce qui a fait bouger la cote.`,
};

const NL: NewsCopy = {
  latest: "Laatste voetbalnieuws",
  updatedAt: (time) => `Bijgewerkt om ${time}`,
  count: (n) => (n === 1 ? "1 bericht" : `${n} berichten`),
  aiLabel: (source) => `Met AI herschreven op basis van ${source}`, // REVIEW-NATIVE
  inEnglish: "In het Engels",
  readOriginal: "Lees het origineel",
  filterLabel: "Nieuws filteren",
  all: "Alles",
  onBoardFilter: "Op het board van vandaag",
  onBoard: "Op het board",
  mostMoved: "Vandaag het meest bewogen",
  mostMovedSub: "De grootste oddsbewegingen op het board in 24 uur, met het dichtstbijzijnde nieuws. Alleen het tijdstip, geen oorzaak.",
  newsAt: (time) => `Nieuws om ${time}`,
  noNewsNear: "Geen nieuws in de buurt van deze beweging",
  noMoves: "Geen hoofdodds op het board is de afgelopen 24 uur bewogen.",
  draw: "Gelijkspel",
  error: "De nieuwsfeed is nu niet beschikbaar. De gidsen hieronder veranderen niet.",
  empty: "Nu geen nieuws in de feed.",
  pending: "Nieuws komt eraan. We tonen een bericht pas nadat we het herschreven hebben. Onze gidsen staan hieronder.",
  paused: "De nieuwsbron is gepauzeerd. De gidsen hieronder veranderen niet.",
  guides: "Gidsen",
  guidesSub: "Door ons geschreven: cijfers uitgelegd, geen tips.",
  takedown: "Is dit jouw bericht? Mail info@betredge.com en we halen het binnen 24 uur weg.", // REVIEW-NATIVE
  matchBody: (source) => `Gemeld door ${source}. We tonen wanneer het gebeurde, niet wat de odds bewoog.`,
};

const PL: NewsCopy = {
  latest: "Najnowsze wiadomości piłkarskie",
  updatedAt: (time) => `Zaktualizowano o ${time}`,
  count: (n) => (n === 1 ? "1 wiadomość" : `${n} wiadomości`), // 2–4 and 5+ share the form
  aiLabel: (source) => `Przepisane przez AI na podstawie ${source}`, // REVIEW-NATIVE
  inEnglish: "Po angielsku",
  readOriginal: "Przeczytaj oryginał",
  filterLabel: "Filtruj wiadomości",
  all: "Wszystkie",
  onBoardFilter: "Na dzisiejszej tablicy",
  onBoard: "Na tablicy",
  mostMoved: "Największe ruchy dnia",
  mostMovedSub: "Największe ruchy kursów na tablicy w 24 godziny, z najbliższą wiadomością. Tylko godzina, nie przyczyna.",
  newsAt: (time) => `Wiadomość o ${time}`,
  noNewsNear: "Brak wiadomości blisko tego ruchu",
  noMoves: "Żaden główny kurs na tablicy nie zmienił się w ostatnich 24 godzinach.",
  draw: "Remis",
  error: "Kanał wiadomości jest teraz niedostępny. Poradniki poniżej się nie zmieniają.",
  empty: "Teraz brak wiadomości w kanale.",
  pending: "Wiadomości w drodze. Pokazujemy wiadomość dopiero po jej przepisaniu. Nasze poradniki są poniżej.",
  paused: "Źródło wiadomości jest wstrzymane. Poradniki poniżej się nie zmieniają.",
  guides: "Poradniki",
  guidesSub: "Napisane przez nas: liczby wyjaśnione, bez typów.",
  takedown: "To twój tekst? Napisz na info@betredge.com, usuniemy go w ciągu 24 godzin.", // REVIEW-NATIVE
  matchBody: (source) => `Podał ${source}. Pokazujemy, kiedy to się stało, a nie co ruszyło kursem.`,
};

const PT: NewsCopy = {
  latest: "Últimas notícias de futebol",
  updatedAt: (time) => `Atualizado às ${time}`,
  count: (n) => (n === 1 ? "1 notícia" : `${n} notícias`),
  aiLabel: (source) => `Reescrito com IA a partir de ${source}`, // REVIEW-NATIVE
  inEnglish: "Em inglês",
  readOriginal: "Ler o original",
  filterLabel: "Filtrar as notícias",
  all: "Todas",
  onBoardFilter: "No board de hoje",
  onBoard: "No board",
  mostMoved: "O que mais mexeu hoje",
  mostMovedSub: "Os maiores movimentos de odd no board em 24 horas, com a notícia mais próxima. Só a hora, não a causa.",
  newsAt: (time) => `Notícia às ${time}`,
  noNewsNear: "Nenhuma notícia perto deste movimento",
  noMoves: "Nenhuma odd principal do board se mexeu nas últimas 24 horas.",
  draw: "Empate",
  error: "O feed de notícias não está disponível agora. Os guias abaixo não mudam.",
  empty: "Agora não há notícias no feed.",
  pending: "Notícias a caminho. Só mostramos uma notícia depois de a reescrever. Os nossos guias estão abaixo.",
  paused: "A fonte de notícias está em pausa. Os guias abaixo não mudam.",
  guides: "Guias",
  guidesSub: "Escritos por nós: números explicados, sem prognósticos.",
  takedown: "A notícia é tua? Escreve para info@betredge.com e retiramo-la em 24 horas.", // REVIEW-NATIVE
  matchBody: (source) => `Noticiada por ${source}. Mostramos quando aconteceu, não o que mexeu a odd.`,
};

const RU: NewsCopy = {
  latest: "Свежие футбольные новости",
  updatedAt: (time) => `Обновлено в ${time}`,
  count: (n) => {
    const d = n % 10;
    const h = n % 100;
    return d === 1 && h !== 11 ? `${n} новость` : d >= 2 && d <= 4 && (h < 12 || h > 14) ? `${n} новости` : `${n} новостей`;
  },
  aiLabel: (source) => `Переписано с помощью ИИ по материалу ${source}`, // REVIEW-NATIVE
  inEnglish: "На английском",
  readOriginal: "Читать оригинал",
  filterLabel: "Фильтр новостей",
  all: "Все",
  onBoardFilter: "На сегодняшней панели",
  onBoard: "На панели",
  mostMoved: "Сильнее всего сдвинулось сегодня",
  mostMovedSub: "Самые большие движения коэффициентов на панели за 24 часа и ближайшая новость. Только время, не причина.",
  newsAt: (time) => `Новость в ${time}`,
  noNewsNear: "Рядом с этим движением новостей нет",
  noMoves: "За последние 24 часа ни один основной коэффициент на панели не сдвинулся.",
  draw: "Ничья",
  error: "Лента новостей сейчас недоступна. Руководства ниже не меняются.",
  empty: "Сейчас в ленте нет новостей.",
  pending: "Новости скоро появятся. Мы показываем новость только после того, как перепишем её. Наши руководства ниже.",
  paused: "Источник новостей приостановлен. Руководства ниже не меняются.",
  guides: "Руководства",
  guidesSub: "Написаны нами: цифры объяснены, без прогнозов.",
  takedown: "Это ваш материал? Напишите на info@betredge.com, и мы уберём его в течение 24 часов.", // REVIEW-NATIVE
  matchBody: (source) => `Сообщил ${source}. Мы показываем, когда это произошло, а не что сдвинуло коэффициент.`,
};

const SV: NewsCopy = {
  latest: "Senaste fotbollsnyheterna",
  updatedAt: (time) => `Uppdaterad kl. ${time}`,
  count: (n) => (n === 1 ? "1 nyhet" : `${n} nyheter`),
  aiLabel: (source) => `Omskriven med AI utifrån ${source}`, // REVIEW-NATIVE
  inEnglish: "På engelska",
  readOriginal: "Läs originalet",
  filterLabel: "Filtrera nyheterna",
  all: "Alla",
  onBoardFilter: "På dagens board",
  onBoard: "På boarden",
  mostMoved: "Mest rörelse i dag",
  mostMovedSub: "De största oddsrörelserna på boarden på 24 timmar, med närmaste nyhet. Bara tidpunkten, inte orsaken.",
  newsAt: (time) => `Nyhet kl. ${time}`,
  noNewsNear: "Ingen nyhet nära den här rörelsen",
  noMoves: "Inga huvudodds på boarden har rört sig de senaste 24 timmarna.",
  draw: "Oavgjort",
  error: "Nyhetsflödet är inte tillgängligt just nu. Guiderna nedan påverkas inte.",
  empty: "Inga nyheter i flödet just nu.",
  pending: "Nyheter är på väg. Vi visar en nyhet först när vi har skrivit om den. Våra guider finns nedan.",
  paused: "Nyhetskällan är pausad. Guiderna nedan påverkas inte.",
  guides: "Guider",
  guidesSub: "Skrivna av oss: siffror förklarade, inga tips.",
  takedown: "Är det din artikel? Skriv till info@betredge.com så tar vi bort den inom 24 timmar.", // REVIEW-NATIVE
  matchBody: (source) => `Rapporterad av ${source}. Vi visar när det hände, inte vad som flyttade oddset.`,
};

const TR: NewsCopy = {
  latest: "Son futbol haberleri",
  updatedAt: (time) => `${time} itibarıyla güncellendi`,
  count: (n) => `${n} haber`,
  aiLabel: (source) => `${source} kaynağından yapay zekâ ile yeniden yazıldı`, // REVIEW-NATIVE
  inEnglish: "İngilizce",
  readOriginal: "Orijinali oku",
  filterLabel: "Haberleri filtrele",
  all: "Tümü",
  onBoardFilter: "Bugünkü panoda",
  onBoard: "Panoda",
  mostMoved: "Bugün en çok hareket edenler",
  mostMovedSub: "Panodaki son 24 saatin en büyük oran hareketleri ve en yakın haber. Yalnızca zaman, neden değil.",
  newsAt: (time) => `${time} haberi`,
  noNewsNear: "Bu hareketin yakınında haber yok",
  noMoves: "Son 24 saatte panodaki hiçbir ana oran hareket etmedi.",
  draw: "Beraberlik",
  error: "Haber akışı şu anda kullanılamıyor. Aşağıdaki rehberler etkilenmez.",
  empty: "Şu anda akışta haber yok.",
  pending: "Haberler yolda. Bir haberi yalnızca yeniden yazdıktan sonra gösteriyoruz. Rehberlerimiz aşağıda.",
  paused: "Haber kaynağı duraklatıldı. Aşağıdaki rehberler etkilenmez.",
  guides: "Rehberler",
  guidesSub: "Bizim yazdıklarımız: sayılar açıklanır, tahmin yok.",
  takedown: "Haber senin mi? info@betredge.com adresine yaz, 24 saat içinde kaldıralım.", // REVIEW-NATIVE
  matchBody: (source) => `${source} bildirdi. Ne zaman olduğunu gösteriyoruz, oranı neyin oynattığını değil.`,
};

export const NEWS_COPY: Record<V3cLang, NewsCopy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function newsCopyFor(lang: string | null | undefined): NewsCopy {
  return NEWS_COPY[v3cLang(lang)];
}
