"use client";
// #WIDGET-LANDING-0828 — il widget vero, vivo, dentro la sezione della home che
// lo vende. Non è uno screenshot né una riproduzione: è lo STESSO `/embed` che
// gira sui siti dei partner, quindi la home non può promettere una cosa diversa
// da quella che consegniamo.
import { useEffect, useRef, useState } from "react";

/** Stesso meccanismo del partner (public/widget.js): l'iframe dichiara la sua
 *  altezza, noi la applichiamo. Con un'altezza fissa resterebbe una fascia vuota
 *  sotto il widget — cioè l'unica cosa che il widget vero NON fa. */
export function WidgetLivePreview({ lang, theme }: { lang: string; theme: "dark" | "light" }) {
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

  // Il tema lo passiamo esplicito invece di lasciare `auto`: `auto` segue il
  // sistema operativo, non il toggle del sito, e su una home in chiaro con un
  // OS scuro il widget sarebbe l'unico riquadro nero della pagina.
  // `preview=1` spegne i beacon: le impression della NOSTRA home non vanno
  // nella stessa metrica con cui misuriamo i partner.
  const src = `/embed?sport=all&limit=3&host=betredge.com&preview=1&lang=${encodeURIComponent(lang)}&theme=${theme}`;

  return (
    <iframe
      // cambiare tema o lingua deve RIMONTARE l'iframe: riusarlo lascerebbe
      // l'altezza vecchia finché non arriva il primo messaggio.
      key={src}
      ref={frameRef}
      src={src}
      title="BetRedge widget"
      loading="lazy"
      scrolling="no"
      style={{ display: "block", width: "100%", border: 0, overflow: "hidden", height }}
    />
  );
}
