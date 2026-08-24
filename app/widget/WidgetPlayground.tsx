"use client";
// #WIDGET-LANDING-0824 — l'anteprima viva di /widget: il partner cambia le
// opzioni e vede, nello stesso momento, il widget vero e il tag da copiare.
// L'iframe punta al NOSTRO /embed: è lo stesso codice che girerà da lui.
import { useEffect, useMemo, useRef, useState } from "react";
import { buildSnippet, buildPreviewUrl, sanitizeRef, WIDGET_DEFAULTS, type WidgetConfig } from "./snippet";

const SPORTS: WidgetConfig["sport"][] = ["all", "tennis", "football"];
const LANGS: WidgetConfig["lang"][] = ["en", "it", "es", "fr", "ru"];
const THEMES: WidgetConfig["theme"][] = ["auto", "light", "dark"];

export function WidgetPlayground() {
  const [cfg, setCfg] = useState<WidgetConfig>(WIDGET_DEFAULTS);
  const [copied, setCopied] = useState(false);
  // L'anteprima si ridimensiona con lo STESSO meccanismo che userà il partner
  // (public/widget.js): l'iframe dichiara la sua altezza, noi la applichiamo.
  // Con un'altezza fissa la cornice mostrava una fascia vuota sotto il widget —
  // cioè esattamente quello che il widget vero non fa.
  const [height, setHeight] = useState(300);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.source !== frameRef.current?.contentWindow) return;
      if (ev.origin !== window.location.origin) return;
      const d = ev.data as { type?: string; height?: number };
      if (d?.type !== "betredge-embed-height") return;
      const h = Number(d.height);
      if (Number.isFinite(h)) setHeight(Math.min(800, Math.max(120, h)));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const snippet = useMemo(() => buildSnippet(cfg), [cfg]);
  const preview = useMemo(() => buildPreviewUrl(cfg), [cfg]);
  const set = <K extends keyof WidgetConfig>(k: K, v: WidgetConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false); // clipboard negata (http, permessi): il tag resta selezionabile a mano
    }
  }

  return (
    <div className="wg-play">
      <div className="wg-controls">
        <label className="wg-field">
          <span>Your partner code</span>
          <input
            value={cfg.ref}
            onChange={(e) => set("ref", sanitizeRef(e.target.value))}
            placeholder="YOUR-CODE"
            spellCheck={false}
            aria-describedby="wg-ref-hint"
          />
        </label>
        <label className="wg-field">
          <span>Sport</span>
          <select value={cfg.sport} onChange={(e) => set("sport", e.target.value as WidgetConfig["sport"])}>
            {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="wg-field">
          <span>Matches</span>
          <select value={cfg.limit} onChange={(e) => set("limit", Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="wg-field">
          <span>Language</span>
          <select value={cfg.lang} onChange={(e) => set("lang", e.target.value as WidgetConfig["lang"])}>
            {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="wg-field">
          <span>Theme</span>
          <select value={cfg.theme} onChange={(e) => set("theme", e.target.value as WidgetConfig["theme"])}>
            {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="wg-split">
        <div className="wg-frame-wrap">
          <div className="wg-frame-bar"><span className="wg-dot" /><span>your-site.com</span></div>
          {/* key: cambiare i parametri deve RIMONTARE l'iframe, altrimenti il
              browser tiene la vecchia pagina e l'anteprima mente. */}
          <iframe
            key={preview}
            ref={frameRef}
            src={preview}
            title="BetRedge widget preview"
            className="wg-frame"
            style={{ height }}
            loading="lazy"
          />
        </div>

        <div className="wg-code">
          <div className="wg-code-head">
            <span>Paste this where you want it</span>
            <button type="button" onClick={copy} className="v-btn v-btn--utility v-btn--sm">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre><code>{snippet}</code></pre>
          <p id="wg-ref-hint" className="wg-hint">
            {sanitizeRef(cfg.ref)
              ? "Every click from this widget carries your code, so the signup is credited to you."
              : "Without a partner code the widget still works — but the signups it brings can't be credited to anyone."}
          </p>
        </div>
      </div>
    </div>
  );
}
