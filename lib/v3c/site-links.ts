// lib/v3c/site-links.ts (#REDESIGN-V3C fixui · QA M7) — gli articoli del blog sono HTML
// scritto per il sito di oggi e puntano a https://www.betredge.com/… in assoluto
// (es. /history). Nella cornice v3c quei link diventano relativi, così restano sullo
// stesso host (la preview, o il sito con il redesign) e passano per i redirect v3c
// (/history → /record). Solo l'href degli <a>: testo, immagini e link esterni intatti.
const SITE = /(<a\b[^>]*?\bhref=)(["'])https?:\/\/(?:www\.)?betredge\.com(\/[^"']*)?\2/gi;

export function relativizeSiteLinks(html: string): string {
  return html.replace(SITE, (_m, pre: string, q: string, path: string | undefined) => `${pre}${q}${path || "/"}${q}`);
}
