// lib/bot-filter.ts — #SESSIONI-1006 leva 2
//
// Il beacon /api/track parte da JS: lo mandano solo i client che eseguono la
// pagina, quindi browser veri E crawler che renderizzano (Googlebot, Bing,
// ChatGPT-User, headless di test, Lighthouse, screenshot di Vercel). Misurato
// il 06/10: ~770 page_view/30g in raffiche o da paesi senza nessuna sessione,
// con un pattern da crawler hreflang (/pt /de /nl /pl in sequenza).
//
// Lo user-agent si LEGGE qui e si butta: non entra mai nel DB ne' nei log.
// Pattern conservativi: si scarta solo chi si dichiara bot, strumento o
// anteprima. Un browser vero non si scarta mai per un indizio indiretto.
//
// `userAgent().isBot` di next/server e' stato valutato: non copre
// HeadlessChrome, Lighthouse, ChatGPT-User, ClaudeBot, PerplexityBot, le
// librerie HTTP, e contiene `yandex`/`tumblr` che toccano app vere.

const BOT_UA = new RegExp(
  [
    // `bot` come fine parola o seguito da `/`: Googlebot, bingbot, YandexBot,
    // TelegramBot, Twitterbot... `(?<!cu)`: Cubot e' un marchio di telefoni
    // Android ("Cubot X30"), compare in UA di browser veri.
    String.raw`(?<!cu)bot\b`,
    String.raw`bot/`,
    "crawler", "spider", "slurp", "scrapy",
    // Browser automatizzati e misuratori di performance.
    "headless", "lighthouse", "pagespeed", "ptst", "gtmetrix", "phantomjs",
    "puppeteer", "playwright", "selenium", "prerender",
    // Anteprime di link dichiarate (unfurl) e screenshot.
    "vercel-screenshot", "vercel-favicon", "facebookexternalhit", "facebookcatalog",
    "meta-externalagent", String.raw`^whatsapp/`, "skypeuripreview", "quora link preview",
    "embedly", "iframely", "bingpreview", "google web preview", "google-pagerenderer",
    "google-inspectiontool", "googleother", "mediapartners-google", "google-read-aloud",
    "slack-imgproxy",
    // Agenti AI che leggono per conto di un utente (non navigano il sito).
    "chatgpt-user", "claude-user", "perplexity-user", "bytespider",
    // Librerie HTTP: un browser non si presenta cosi'.
    String.raw`^curl/`, String.raw`^wget/`, "python-requests", "python-urllib", "aiohttp",
    String.raw`^httpx`, "go-http-client", "node-fetch", "undici", String.raw`^axios/`,
    String.raw`^okhttp`, String.raw`^java/`, "libwww-perl", "apache-httpclient",
  ].join("|"),
  "i",
);

/**
 * Vero se lo user-agent appartiene a un bot/strumento noto, o manca.
 * Un browser manda sempre un UA: un beacon senza e' uno script.
 */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  const s = (ua ?? "").trim();
  if (!s) return true;
  return BOT_UA.test(s);
}

/**
 * Contatore aggregato dei beacon scartati come bot: solo un NUMERO, nessun UA.
 * In memoria per istanza serverless, svuotato al massimo una volta per
 * finestra: chi lo chiama scrive una riga sola con il totale. E' un limite
 * inferiore (un'istanza che muore prima della finestra perde il suo conto).
 */
export function createDropCounter(windowMs: number) {
  let count = 0;
  let since = 0;
  return {
    /** Registra uno scarto. Ritorna il totale da scrivere se la finestra e' chiusa, altrimenti null. */
    hit(now: number): { count: number; since: string } | null {
      if (count === 0) since = now;
      count += 1;
      if (now - since < windowMs) return null;
      const out = { count, since: new Date(since).toISOString() };
      count = 0;
      return out;
    },
  };
}
