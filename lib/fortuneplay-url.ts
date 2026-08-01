// Deep-link pagina-partita FortunePlay/BetConstruct (#FORTUNEPLAY-LIVE-ODDS-1).
// Pattern VERIFICATO dal vivo 2026-07-01: {baseUrl}/{locale}/sports/{sport}/{slug}-m-{id}
// - segmento SPORT obbligatorio ("soccer"/"tennis"); senza → 404
// - suffisso "-m" = token fisso "match" (NON genere): verificato su calcio, tennis M e W
// - lo slug è quello del feed (`slug`); FortunePlay risolve con slug-feed + "-m" + id
// Param affiliate BetConstruct = `stag` (da robots.txt). Costruibile SENZA API operatore.
// #NEWSPORTS: type widened to PairSport (baseball/mma in the feed per Andrea's
// 2026-07-05 check). The {sport}/{slug}-m-{id} pattern for baseball/mma is
// plausible but NOT yet live-verified — Tommy owns that confirmation before
// any baseball/mma CTA ships (coverage-agnostic: no feed match → no CTA).
export function buildFortuneplayMatchUrl(opts: {
  baseUrl: string;
  locale?: string;
  sport: import("./team-pair-key").PairSport;
  slug: string;
  id: number;
  code?: string;
}): string {
  const locale = opts.locale || "en";
  const base = opts.baseUrl.replace(/\/+$/, "");
  let url = `${base}/${locale}/sports/${opts.sport}/${opts.slug}-m-${opts.id}`;
  if (opts.code) url += `?stag=${encodeURIComponent(opts.code)}`;
  return url;
}
