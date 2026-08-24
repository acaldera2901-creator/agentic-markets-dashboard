// #WIDGET-EMBED-0824 — HTML del widget servito dentro l'iframe.
//
// HTML puro invece di React: questa pagina si carica su siti di terzi, dove il
// peso e l'isolamento contano più del riuso dei componenti. Nessun bundle
// client, nessun font remoto, nessun cookie: solo markup, CSS inline e ~20
// righe di script (altezza al parent + due eventi di misura).
import type { EmbedRow, EmbedLang, EmbedMode } from "@/lib/embed-feed";
import { SITE_ORIGIN } from "@/lib/tools/registry";

export type EmbedTheme = "light" | "dark" | "auto";

const esc = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Copy (le 5 lingue della chrome) ──────────────────────────────────────────
// Nessun claim di performance, qui e in ogni futura riga: il perimetro FTC vale
// sul widget come sulle card. E nessun edge: l'ancoraggio al mercato lo porta a
// zero per costruzione, stamparlo sarebbe stampare rumore (#TG-EDGE-ZERO).
const COPY: Record<EmbedLang, Record<string, string>> = {
  it: { kicker: "Pronostici del modello", model: "modello", unlock: "Sblocca", cta: "Vedi tutti i pronostici",
        empty: "Nessuna partita in programma adesso.", off: "Questo widget non è attivo.", disclaimer: "Solo a scopo informativo. Gioco riservato ai maggiorenni.", top: "Top pick" },
  en: { kicker: "Model predictions", model: "model", unlock: "Unlock", cta: "See all predictions",
        empty: "No matches scheduled right now.", off: "This widget is not active.", disclaimer: "For informational purposes only. Adults only.", top: "Top pick" },
  es: { kicker: "Pronósticos del modelo", model: "modelo", unlock: "Desbloquear", cta: "Ver todos los pronósticos",
        empty: "No hay partidos programados ahora.", off: "Este widget no está activo.", disclaimer: "Solo con fines informativos. Solo para mayores de edad.", top: "Top pick" },
  fr: { kicker: "Pronostics du modèle", model: "modèle", unlock: "Débloquer", cta: "Voir tous les pronostics",
        empty: "Aucun match programmé pour le moment.", off: "Ce widget n'est pas actif.", disclaimer: "À titre informatif uniquement. Réservé aux majeurs.", top: "Top pick" },
  ru: { kicker: "Прогнозы модели", model: "модель", unlock: "Открыть", cta: "Все прогнозы",
        empty: "Сейчас нет запланированных матчей.", off: "Этот виджет не активен.", disclaimer: "Только в информационных целях. Только для совершеннолетних.", top: "Top pick" },
};

/** Ogni link porta l'attribuzione. Si punta alla home e non a /r/CODICE perché
 *  quel redirect ricostruisce l'URL e conserva solo `ref`, buttando via gli utm. */
export function embedLink(ref: string | null, host: string | null): string {
  const url = new URL(SITE_ORIGIN);
  if (ref) url.searchParams.set("ref", ref);
  url.searchParams.set("utm_source", "widget");
  url.searchParams.set("utm_medium", "embed");
  url.searchParams.set("utm_campaign", host || "unknown");
  return url.toString();
}

/** Altezza al parent + due beacon di misura. Estratto perché la route ne calcola
 *  lo sha256 per la CSP: nessun 'unsafe-inline' sulla pagina del widget. */
export const EMBED_INLINE_SCRIPT = `
(function () {
  var last = 0;
  function report() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h === last) return;
    last = h;
    parent.postMessage({ type: "betredge-embed-height", height: h }, "*");
  }
  report();
  window.addEventListener("load", report);
  if (window.ResizeObserver) new ResizeObserver(report).observe(document.documentElement);
  var d = document.documentElement.dataset;
  function beacon(type) {
    try {
      fetch("/api/track", {
        method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: type, meta: { host: d.host || null, ref: d.ref || null, mode: d.mode || null } })
      }).catch(function () {});
    } catch (e) {}
  }
  beacon("widget_view");
  document.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("a")) beacon("widget_click");
  });
  var tz = document.querySelectorAll("time[data-ts]");
  for (var i = 0; i < tz.length; i++) {
    var t = new Date(tz[i].getAttribute("data-ts"));
    if (!isNaN(t.getTime())) {
      tz[i].textContent = t.toLocaleString(document.documentElement.lang || "en", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });
    }
  }
})();`.trim();

const utcLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
};

function card(r: EmbedRow, t: Record<string, string>, href: string): string {
  const teams = [r.homeTeam, r.awayTeam].filter(Boolean).map((s) => esc(String(s)));
  const head = `<div class="br-meta">${esc(r.competition)}${r.startsAt ? ` · <time data-ts="${esc(r.startsAt)}">${utcLabel(r.startsAt)}</time>` : ""}</div>`;
  const names = `<div class="br-teams">${teams.map((n) => `<span>${n}</span>`).join('<i class="br-vs">vs</i>')}</div>`;

  if (r.locked) {
    return `<article class="br-card br-locked">${head}${names}
      <div class="br-row"><span class="br-mask" aria-hidden="true">••••••••</span>
      <a class="br-unlock" href="${href}" target="_blank" rel="noopener nofollow">${t.unlock}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a></div>
    </article>`;
  }
  const conf = r.confidence !== null ? `<span class="br-conf"><b>${r.confidence}%</b> ${t.model}</span>` : "";
  const decision = r.decision ? `<span class="br-pick">${esc(r.decision)}</span>` : `<span class="br-pick br-none">—</span>`;
  return `<article class="br-card${r.topPick ? " br-top" : ""}">${head}${names}
    <div class="br-row">${decision}${conf}</div>
  </article>`;
}

export function renderEmbedHtml(opts: {
  rows: EmbedRow[];
  ref: string | null;
  lang: EmbedLang;
  theme: EmbedTheme;
  host: string | null;
  mode: EmbedMode;
  /** ref spento dalla blocklist: si serve il guscio, mai le predizioni. */
  disabled?: boolean;
}): string {
  const t = COPY[opts.lang] ?? COPY.en;
  const href = embedLink(opts.ref, opts.host);
  const body = opts.disabled
    ? `<article class="br-card br-empty">${esc(t.off)}</article>`
    : opts.rows.length
      ? opts.rows.map((r) => card(r, t, href)).join("")
      : `<article class="br-card br-empty">${esc(t.empty)}</article>`;

  // Token dal sito (app/globals.css --am-*): il widget deve sembrare BetRedge
  // anche fuori da betredge.com. Copiati come valori perché questa pagina non
  // carica il CSS del sito — se cambiano lì, cambiano qui a mano.
  const css = `
:root{--bg:#0B0C0E;--panel:#131519;--panel2:#181B20;--line:#21252C;--text:#EDEFF2;--muted:#AEB4BE;--brand:#23A559;--brand-dim:rgba(35,165,89,.13);--brand-b:rgba(35,165,89,.34)}
:root.br-light{--bg:#FFFFFF;--panel:#F6F7F9;--panel2:#FFFFFF;--line:#E3E6EA;--text:#14171C;--muted:#4A515B}
${opts.theme === "auto" ? `@media (prefers-color-scheme: light){:root{--bg:#FFFFFF;--panel:#F6F7F9;--panel2:#FFFFFF;--line:#E3E6EA;--text:#14171C;--muted:#4A515B}}` : ""}
*{box-sizing:border-box;margin:0}
html,body{background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
body{padding:10px}
.br-w{border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden}
.br-h{display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid var(--line);background:var(--panel2)}
.br-logo{display:flex;align-items:center;gap:6px;font-weight:800;letter-spacing:-.01em;font-size:12px;color:var(--text);text-decoration:none}
.br-k{margin-left:auto;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.br-card{padding:10px 11px;border-bottom:1px solid var(--line)}
.br-card:last-of-type{border-bottom:0}
.br-top{background:linear-gradient(90deg,var(--brand-dim),transparent 55%)}
.br-meta{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums;letter-spacing:.01em}
.br-teams{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-top:3px;font-size:13.5px;font-weight:650;letter-spacing:-.01em}
.br-vs{font-style:normal;font-size:10px;color:var(--muted);font-weight:500}
.br-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px}
.br-pick{font-size:12.5px;font-weight:700;color:var(--brand)}
.br-none{color:var(--muted);font-weight:600}
.br-conf{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
.br-conf b{color:var(--text);font-size:12.5px;font-weight:750}
.br-mask{filter:blur(3.5px);opacity:.55;letter-spacing:2px;font-size:13px;user-select:none}
.br-unlock{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--brand);text-decoration:none;border:1px solid var(--brand-b);background:var(--brand-dim);padding:3px 8px;border-radius:999px}
.br-empty{font-size:12px;color:var(--muted)}
.br-f{display:flex;align-items:center;gap:8px;padding:9px 11px;border-top:1px solid var(--line);background:var(--panel2)}
.br-cta{font-size:11.5px;font-weight:750;color:#fff;background:var(--brand);padding:6px 11px;border-radius:8px;text-decoration:none;white-space:nowrap}
.br-dis{font-size:9.5px;line-height:1.35;color:var(--muted)}
.br-age{display:inline-block;border:1px solid var(--line);border-radius:4px;padding:0 3px;font-weight:750;font-size:9px;color:var(--muted);margin-right:4px}
a:focus-visible,.br-cta:focus-visible{outline:2px solid var(--brand);outline-offset:2px}`.trim();

  // Il glifo è lo stesso segno del brand (chevron ascendente), non un'icona
  // presa altrove: inline SVG, mai emoji.
  const logo = `<a class="br-logo" href="${href}" target="_blank" rel="noopener nofollow">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 17.5 9.5 11l4 4L21 7" stroke="${"#23A559"}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 7H21v5.5" stroke="${"#23A559"}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    BETREDGE</a>`;

  return `<!doctype html>
<html lang="${opts.lang}" class="${opts.theme === "light" ? "br-light" : ""}" data-host="${esc(opts.host ?? "")}" data-ref="${esc(opts.ref ?? "")}" data-mode="${opts.mode}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>BetRedge</title><style>${css}</style></head>
<body><div class="br-w">
<header class="br-h">${logo}<span class="br-k">${esc(t.kicker)}</span></header>
${body}
<footer class="br-f"><span class="br-dis"><span class="br-age">18+</span>${esc(t.disclaimer)}</span>
<a class="br-cta" href="${href}" target="_blank" rel="noopener nofollow">${esc(t.cta)}</a></footer>
</div><script>${EMBED_INLINE_SCRIPT}</script></body></html>`;
}
