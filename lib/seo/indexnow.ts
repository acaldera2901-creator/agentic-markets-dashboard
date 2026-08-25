// lib/seo/indexnow.ts — #SEO-AEO-0825
// IndexNow: si notifica a Bing (e quindi a Copilot, che indicizza lo stesso
// indice) che certe URL sono cambiate, invece di aspettare il crawl. Su un
// dominio nuovo Bing si muove prima di Google, ed e' l'unica lettura gratuita
// sulle citazioni di Copilot.
//
// La chiave NON e' un segreto: il protocollo richiede che sia pubblicamente
// scaricabile da https://www.betredge.com/<chiave>.txt, ed e' proprio quel file
// a dimostrare che chi invia controlla il dominio. Vive in public/ come file
// statico; lib/seo/indexnow.test.ts fallisce se il file e questa costante
// divergono, che e' l'unico modo in cui questa cosa puo' rompersi in silenzio.
export const INDEXNOW_KEY = "188d0bb4b2e914e0decb873c38501788";

export const INDEXNOW_HOST = "www.betredge.com";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";

/** Massimo consentito dal protocollo in un solo POST. */
export const INDEXNOW_MAX_URLS = 10000;

export type IndexNowReceipt = {
  submitted: number;
  status: number;
  /**
   * true SOLO su 200, che e' l'unico codice in cui IndexNow dice di aver
   * verificato la chiave. Misurato il 25/08 con la chiave non ancora
   * pubblicata: l'endpoint risponde 202 lo stesso. 202 significa "URL
   * ricevute, validazione della chiave in sospeso", quindi leggerlo come
   * successo e' esattamente l'errore che questo campo esiste per evitare.
   */
  ok: boolean;
  /** 202: ricevuto ma non ancora validato. Non e' un fallimento, non e' una prova. */
  pendingValidation: boolean;
  body: string;
};

/**
 * Estrae le <loc> dalla sitemap. Parsing con regex e non con un parser XML
 * perche' la sitemap la generiamo noi e la forma e' nota: aggiungere una
 * dipendenza per leggere il nostro stesso output sarebbe sproporzionato.
 */
export function extractSitemapUrls(xml: string): string[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  return [...new Set(urls)];
}

export async function submitToIndexNow(urlList: string[]): Promise<IndexNowReceipt> {
  const list = urlList.slice(0, INDEXNOW_MAX_URLS);
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: list,
    }),
  });
  // Il body puo' essere vuoto: e' normale su 200, non e' un errore.
  const body = await res.text().catch(() => "");
  return {
    submitted: list.length,
    status: res.status,
    ok: res.status === 200,
    pendingValidation: res.status === 202,
    body: body.slice(0, 500),
  };
}
