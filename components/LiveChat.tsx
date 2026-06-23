"use client";

// components/LiveChat.tsx (#UI-LIVECHAT-0623 → Tawk.to live)
// Widget live chat Tawk.to. L'id del widget è PUBBLICO (lo snippet ufficiale di
// Tawk.to gira lato client e l'id è visibile nel sorgente per design) → non è un
// segreto e può stare nel codice. Caricato dinamicamente solo lato client al
// mount, con guard anti-doppia-iniezione (fast-refresh / doppio mount).
//
// NOTA CSP: i domini Tawk.to sono aggiunti a script-src/connect-src/img-src/
// frame-src in next.config.ts. Oggi la CSP è Report-Only (non blocca), ma è
// pronta per l'enforcing.

import { useEffect } from "react";

// embed.tawk.to/<propertyId>/<widgetId> — account Tawk.to BetRedge.
const TAWK_SRC = "https://embed.tawk.to/6a3ac896707bc21d4a185b17/1jrqpv3j1";

export function LiveChat() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Già iniettato (HMR / doppio mount): no-op.
    if (document.getElementById("tawkto-widget")) return;

    // Bootstrap ufficiale Tawk.to.
    const w = window as unknown as { Tawk_API?: unknown; Tawk_LoadStart?: Date };
    w.Tawk_API = w.Tawk_API || {};
    w.Tawk_LoadStart = new Date();

    const s = document.createElement("script");
    s.id = "tawkto-widget";
    s.async = true;
    s.src = TAWK_SRC;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    document.body.appendChild(s);
    // Niente cleanup: Tawk inietta il proprio launcher/iframe; il guard sull'id
    // basta a evitare doppie iniezioni. Il componente è montato una volta a pagina.
  }, []);

  // Il widget Tawk porta il proprio launcher: non renderizziamo nulla qui.
  return null;
}
