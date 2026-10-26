// lib/news/copy.ts (#NEWS-FOTMOB-PROD-1026) — the words of the FotMob news
// (News on /blog, the «Latest news» strip on the board, the News card of the
// match sheet), in the 11 languages of the site, in the shape of
// lib/classic/lobby-copy.ts (plain strings, `{placeholders}`, parity test).
// Translations carried over from betredge/v3c-newswatch:lib/v3c/news-copy.ts
// (REVIEW-NATIVE on the legal lines: AI label, takedown); three keys are new
// here (romeTime, allNews, newsSection). The notes themselves are EN/IT; the
// other 9 languages show EN, labelled «In English».
//
// The news says WHEN, never WHY: «news at», never «because of». Lexicon: no
// tips, lock, guaranteed, odds, bet — the notes are checked for the same list
// by the watcher before they are written.

export const NEWS_LANGS = ["en", "it", "es", "fr", "de", "pt", "nl", "pl", "tr", "sv", "ru"] as const;
export type NewsLang = (typeof NEWS_LANGS)[number];

export type NewsCopy = {
  latest: string;
  /** {time} */
  updatedAt: string;
  /** {time} */
  lastUpdateAt: string;
  pausedMeta: string;
  romeTime: string;
  /** {source} */
  aiLabel: string;
  inEnglish: string;
  readOriginal: string;
  onBoard: string;
  allNews: string;
  newsSection: string;
  /** {source} */
  matchBody: string;
  error: string;
  empty: string;
  pending: string;
  paused: string;
  takedown: string;
};

const en: NewsCopy = {
  latest: "Latest football news",
  updatedAt: "Updated at {time}",
  lastUpdateAt: "Last update at {time}",
  pausedMeta: "News paused",
  romeTime: "Rome time",
  aiLabel: "Rewritten with AI from {source}",
  inEnglish: "In English",
  readOriginal: "Read the original",
  onBoard: "On the board",
  allNews: "All news",
  newsSection: "News",
  matchBody: "Reported by {source}. We show when it happened, not what moved the price.",
  error: "The news feed is unavailable right now. The guides below are unaffected.",
  empty: "No news in the feed right now.",
  pending: "News is on its way. We only show a story once we have rewritten it. Our guides are below.",
  paused: "The news source is paused. The guides below are unaffected.",
  takedown: "Own this story? Write to info@betredge.com and we take it down within 24 hours.",
};

const it: NewsCopy = {
  latest: "Ultime notizie di calcio",
  updatedAt: "Aggiornato alle {time}",
  lastUpdateAt: "Ultimo aggiornamento alle {time}",
  pausedMeta: "Notizie in pausa",
  romeTime: "Ora di Roma",
  aiLabel: "Riscritto con l’IA a partire da {source}", // REVIEW-NATIVE
  inEnglish: "In inglese",
  readOriginal: "Leggi l’originale",
  onBoard: "Sul board",
  allNews: "Tutte le notizie",
  newsSection: "Notizie",
  matchBody: "Riportata da {source}. Mostriamo quando è successo, non cosa ha mosso la quota.",
  error: "Il feed delle notizie ora non è disponibile. Le guide qui sotto non cambiano.",
  empty: "Nessuna notizia nel feed in questo momento.",
  pending: "Notizie in arrivo. Mostriamo una notizia solo dopo averla riscritta. Le nostre guide sono qui sotto.",
  paused: "La fonte delle notizie è in pausa. Le guide qui sotto non cambiano.",
  takedown: "La notizia è tua? Scrivi a info@betredge.com e la togliamo entro 24 ore.", // REVIEW-NATIVE
};

const de: NewsCopy = {
  latest: "Aktuelle Fußball-News",
  updatedAt: "Aktualisiert um {time}",
  lastUpdateAt: "Letzte Aktualisierung um {time}",
  pausedMeta: "News pausiert",
  romeTime: "Zeit in Rom",
  aiLabel: "Mit KI umgeschrieben, Quelle: {source}", // REVIEW-NATIVE
  inEnglish: "Auf Englisch",
  readOriginal: "Original lesen",
  onBoard: "Auf dem Board",
  allNews: "Alle News",
  newsSection: "News",
  matchBody: "Gemeldet von {source}. Wir zeigen, wann es passiert ist, nicht was die Quote bewegt hat.",
  error: "Der News-Feed ist gerade nicht verfügbar. Die Guides unten sind davon nicht betroffen.",
  empty: "Gerade keine Meldungen im Feed.",
  pending: "News folgen in Kürze. Wir zeigen eine Meldung erst, wenn wir sie umgeschrieben haben. Unsere Guides stehen unten.",
  paused: "Die News-Quelle ist pausiert. Die Guides unten sind davon nicht betroffen.",
  takedown: "Deine Meldung? Schreib an info@betredge.com, wir entfernen sie innerhalb von 24 Stunden.", // REVIEW-NATIVE
};

const es: NewsCopy = {
  latest: "Últimas noticias de fútbol",
  updatedAt: "Actualizado a las {time}",
  lastUpdateAt: "Última actualización a las {time}",
  pausedMeta: "Noticias en pausa",
  romeTime: "Hora de Roma",
  aiLabel: "Reescrito con IA a partir de {source}", // REVIEW-NATIVE
  inEnglish: "En inglés",
  readOriginal: "Leer el original",
  onBoard: "En el tablero",
  allNews: "Todas las noticias",
  newsSection: "Noticias",
  matchBody: "Publicada por {source}. Mostramos cuándo ocurrió, no qué movió la cuota.",
  error: "El feed de noticias no está disponible ahora. Las guías de abajo no cambian.",
  empty: "Ahora no hay noticias en el feed.",
  pending: "Noticias en camino. Solo mostramos una noticia después de reescribirla. Nuestras guías están abajo.",
  paused: "La fuente de noticias está en pausa. Las guías de abajo no cambian.",
  takedown: "¿Es tu noticia? Escribe a info@betredge.com y la retiramos en 24 horas.", // REVIEW-NATIVE
};

const fr: NewsCopy = {
  latest: "Dernières actus football",
  updatedAt: "Mis à jour à {time}",
  lastUpdateAt: "Dernière mise à jour à {time}",
  pausedMeta: "Actus en pause",
  romeTime: "Heure de Rome",
  aiLabel: "Réécrit par IA à partir de {source}", // REVIEW-NATIVE
  inEnglish: "En anglais",
  readOriginal: "Lire l’original",
  onBoard: "Sur le tableau",
  allNews: "Toutes les actus",
  newsSection: "Actus",
  matchBody: "Rapporté par {source}. Nous montrons quand c’est arrivé, pas ce qui a fait bouger la cote.",
  error: "Le flux d’actus est indisponible pour le moment. Les guides ci-dessous ne changent pas.",
  empty: "Aucune actu dans le flux pour le moment.",
  pending: "Actus en route. Nous ne montrons une actu qu’après l’avoir réécrite. Nos guides sont ci-dessous.",
  paused: "La source d’actus est en pause. Les guides ci-dessous ne changent pas.",
  takedown: "C’est votre article ? Écrivez à info@betredge.com, nous le retirons sous 24 heures.", // REVIEW-NATIVE
};

const nl: NewsCopy = {
  latest: "Laatste voetbalnieuws",
  updatedAt: "Bijgewerkt om {time}",
  lastUpdateAt: "Laatst bijgewerkt om {time}",
  pausedMeta: "Nieuws gepauzeerd",
  romeTime: "Tijd in Rome",
  aiLabel: "Met AI herschreven op basis van {source}", // REVIEW-NATIVE
  inEnglish: "In het Engels",
  readOriginal: "Lees het origineel",
  onBoard: "Op het board",
  allNews: "Al het nieuws",
  newsSection: "Nieuws",
  matchBody: "Gemeld door {source}. We tonen wanneer het gebeurde, niet wat de odds bewoog.",
  error: "De nieuwsfeed is nu niet beschikbaar. De gidsen hieronder veranderen niet.",
  empty: "Nu geen nieuws in de feed.",
  pending: "Nieuws komt eraan. We tonen een bericht pas nadat we het herschreven hebben. Onze gidsen staan hieronder.",
  paused: "De nieuwsbron is gepauzeerd. De gidsen hieronder veranderen niet.",
  takedown: "Is dit jouw bericht? Mail info@betredge.com en we halen het binnen 24 uur weg.", // REVIEW-NATIVE
};

const pl: NewsCopy = {
  latest: "Najnowsze wiadomości piłkarskie",
  updatedAt: "Zaktualizowano o {time}",
  lastUpdateAt: "Ostatnia aktualizacja o {time}",
  pausedMeta: "Newsy wstrzymane",
  romeTime: "Czas rzymski",
  aiLabel: "Przepisane przez AI na podstawie {source}", // REVIEW-NATIVE
  inEnglish: "Po angielsku",
  readOriginal: "Przeczytaj oryginał",
  onBoard: "Na tablicy",
  allNews: "Wszystkie wiadomości",
  newsSection: "Wiadomości",
  matchBody: "Podał {source}. Pokazujemy, kiedy to się stało, a nie co ruszyło kursem.",
  error: "Kanał wiadomości jest teraz niedostępny. Poradniki poniżej się nie zmieniają.",
  empty: "Teraz brak wiadomości w kanale.",
  pending: "Wiadomości w drodze. Pokazujemy wiadomość dopiero po jej przepisaniu. Nasze poradniki są poniżej.",
  paused: "Źródło wiadomości jest wstrzymane. Poradniki poniżej się nie zmieniają.",
  takedown: "To twój tekst? Napisz na info@betredge.com, usuniemy go w ciągu 24 godzin.", // REVIEW-NATIVE
};

const pt: NewsCopy = {
  latest: "Últimas notícias de futebol",
  updatedAt: "Atualizado às {time}",
  lastUpdateAt: "Última atualização às {time}",
  pausedMeta: "Notícias em pausa",
  romeTime: "Hora de Roma",
  aiLabel: "Reescrito com IA a partir de {source}", // REVIEW-NATIVE
  inEnglish: "Em inglês",
  readOriginal: "Ler o original",
  onBoard: "No board",
  allNews: "Todas as notícias",
  newsSection: "Notícias",
  matchBody: "Noticiada por {source}. Mostramos quando aconteceu, não o que mexeu a odd.",
  error: "O feed de notícias não está disponível agora. Os guias abaixo não mudam.",
  empty: "Agora não há notícias no feed.",
  pending: "Notícias a caminho. Só mostramos uma notícia depois de a reescrever. Os nossos guias estão abaixo.",
  paused: "A fonte de notícias está em pausa. Os guias abaixo não mudam.",
  takedown: "A notícia é tua? Escreve para info@betredge.com e retiramo-la em 24 horas.", // REVIEW-NATIVE
};

const ru: NewsCopy = {
  latest: "Свежие футбольные новости",
  updatedAt: "Обновлено в {time}",
  lastUpdateAt: "Последнее обновление в {time}",
  pausedMeta: "Новости на паузе",
  romeTime: "Время Рима",
  aiLabel: "Переписано с помощью ИИ по материалу {source}", // REVIEW-NATIVE
  inEnglish: "На английском",
  readOriginal: "Читать оригинал",
  onBoard: "На панели",
  allNews: "Все новости",
  newsSection: "Новости",
  matchBody: "Сообщил {source}. Мы показываем, когда это произошло, а не что сдвинуло коэффициент.",
  error: "Лента новостей сейчас недоступна. Руководства ниже не меняются.",
  empty: "Сейчас в ленте нет новостей.",
  pending: "Новости скоро появятся. Мы показываем новость только после того, как перепишем её. Наши руководства ниже.",
  paused: "Источник новостей приостановлен. Руководства ниже не меняются.",
  takedown: "Это ваш материал? Напишите на info@betredge.com, и мы уберём его в течение 24 часов.", // REVIEW-NATIVE
};

const sv: NewsCopy = {
  latest: "Senaste fotbollsnyheterna",
  updatedAt: "Uppdaterad kl. {time}",
  lastUpdateAt: "Senast uppdaterad kl. {time}",
  pausedMeta: "Nyheterna pausade",
  romeTime: "Tid i Rom",
  aiLabel: "Omskriven med AI utifrån {source}", // REVIEW-NATIVE
  inEnglish: "På engelska",
  readOriginal: "Läs originalet",
  onBoard: "På boarden",
  allNews: "Alla nyheter",
  newsSection: "Nyheter",
  matchBody: "Rapporterad av {source}. Vi visar när det hände, inte vad som flyttade oddset.",
  error: "Nyhetsflödet är inte tillgängligt just nu. Guiderna nedan påverkas inte.",
  empty: "Inga nyheter i flödet just nu.",
  pending: "Nyheter är på väg. Vi visar en nyhet först när vi har skrivit om den. Våra guider finns nedan.",
  paused: "Nyhetskällan är pausad. Guiderna nedan påverkas inte.",
  takedown: "Är det din artikel? Skriv till info@betredge.com så tar vi bort den inom 24 timmar.", // REVIEW-NATIVE
};

const tr: NewsCopy = {
  latest: "Son futbol haberleri",
  updatedAt: "{time} itibarıyla güncellendi",
  lastUpdateAt: "Son güncelleme: {time}",
  pausedMeta: "Haberler duraklatıldı",
  romeTime: "Roma saati",
  aiLabel: "{source} kaynağından yapay zekâ ile yeniden yazıldı", // REVIEW-NATIVE
  inEnglish: "İngilizce",
  readOriginal: "Orijinali oku",
  onBoard: "Panoda",
  allNews: "Tüm haberler",
  newsSection: "Haberler",
  matchBody: "{source} bildirdi. Ne zaman olduğunu gösteriyoruz, oranı neyin oynattığını değil.",
  error: "Haber akışı şu anda kullanılamıyor. Aşağıdaki rehberler etkilenmez.",
  empty: "Şu anda akışta haber yok.",
  pending: "Haberler yolda. Bir haberi yalnızca yeniden yazdıktan sonra gösteriyoruz. Rehberlerimiz aşağıda.",
  paused: "Haber kaynağı duraklatıldı. Aşağıdaki rehberler etkilenmez.",
  takedown: "Haber senin mi? info@betredge.com adresine yaz, 24 saat içinde kaldıralım.", // REVIEW-NATIVE
};

export const NEWS_COPY: Record<NewsLang, NewsCopy> = { en, it, es, fr, de, pt, nl, pl, tr, sv, ru };

/** Unknown language → English (declared fallback). */
export function newsCopy(lang: string | null | undefined): NewsCopy {
  return (NEWS_COPY as Record<string, NewsCopy>)[lang ?? ""] ?? en;
}

/** Replaces the `{name}` placeholders. */
export function fillNews(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
