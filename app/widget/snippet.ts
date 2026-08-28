// #WIDGET-LANDING-0824 — lo snippet che il partner copia da /widget.
// Puro: la pagina lo mostra, il test lo verifica, nessuno lo riscrive a mano.
import { SITE_ORIGIN } from "@/lib/tools/registry";
import { EMBED_MAX_LIMIT } from "@/lib/embed-feed";

export type WidgetConfig = {
  ref: string;
  sport: "all" | "tennis" | "football";
  limit: number;
  lang: "en" | "it" | "es" | "fr" | "ru";
  theme: "auto" | "light" | "dark";
};

export const WIDGET_DEFAULTS: WidgetConfig = {
  ref: "", sport: "all", limit: 3, lang: "en", theme: "auto",
};

/** Stessa forma che il server accetta (lib/embed-feed#normalizeEmbedRef): la
 *  pagina non deve mostrare uno snippet che poi finisce in teaser per un
 *  carattere di troppo. Qui si RIPULISCE mentre si digita — il server invece
 *  rifiuta, perché lì un codice storto non va indovinato. */
export function sanitizeRef(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
}

export function buildSnippet(cfg: WidgetConfig): string {
  const ref = sanitizeRef(cfg.ref) || "YOUR-CODE";
  const limit = Math.min(EMBED_MAX_LIMIT, Math.max(1, Math.round(cfg.limit)));
  return `<script src="${SITE_ORIGIN}/widget.js" async
        data-ref="${ref}" data-sport="${cfg.sport}" data-limit="${limit}"
        data-lang="${cfg.lang}" data-theme="${cfg.theme}"></script>`;
}

/** L'anteprima gira sulla NOSTRA origin, quindi il path relativo basta. */
export function buildPreviewUrl(cfg: WidgetConfig): string {
  const p = new URLSearchParams({
    sport: cfg.sport,
    limit: String(Math.min(EMBED_MAX_LIMIT, Math.max(1, Math.round(cfg.limit)))),
    lang: cfg.lang,
    theme: cfg.theme,
    host: "betredge.com",
    // Anteprima nostra, non impression di un partner: niente beacon.
    preview: "1",
  });
  const ref = sanitizeRef(cfg.ref);
  if (ref) p.set("ref", ref);
  return `/embed?${p.toString()}`;
}
