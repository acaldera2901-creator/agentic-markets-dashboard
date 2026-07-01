// Deep-link pagina-partita FortunePlay/BetConstruct (#FORTUNEPLAY-LIVE-ODDS-1).
// Pattern route SPA candidato: {baseUrl}/{locale}/sports/{slug}-{id}.
// Param affiliate BetConstruct = `stag` (verificato da robots.txt fortuneplay.com,
// non `btag`). ⚠️ DA CONFERMARE AL GATE (Task 8): il route esatto e se l'attribuzione
// affiliate passa via deep-link diretto o richiede il redirect di tracking
// (mediaroosters short-link). Se non confermato, il board degrada al landing.
export function buildFortuneplayMatchUrl(opts: {
  baseUrl: string;
  locale?: string;
  slug: string;
  id: number;
  code?: string;
}): string {
  const locale = opts.locale || "en";
  const base = opts.baseUrl.replace(/\/+$/, "");
  let url = `${base}/${locale}/sports/${opts.slug}-${opts.id}`;
  if (opts.code) url += `?stag=${encodeURIComponent(opts.code)}`;
  return url;
}
