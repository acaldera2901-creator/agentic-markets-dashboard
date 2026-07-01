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

import { useEffect, useState } from "react";

// embed.tawk.to/<propertyId>/<widgetId> — account Tawk.to BetRedge.
// #CHAT-PROXY-VPN: le VPN con filtro anti-tracker (NordVPN Threat Protection,
// Proton NetShield, AdGuard DNS…) bloccano *.tawk.to SUL DISPOSITIVO dell'utente
// → lo script non carica e il widget non appare (blocco client-side, non nostro).
// Se `NEXT_PUBLIC_TAWK_PROXY_HOST` è settato (es. chat.betredge.com, Cloudflare
// Worker), carichiamo lo script — e di riflesso tutte le risorse/XHR/WS del widget,
// perché il Worker riscrive i riferimenti *.tawk.to — dal NOSTRO dominio, che le VPN
// non bloccano. Default = embed.tawk.to diretto → comportamento INVARIATO finché
// l'env NON è settata. Worker: infra/cloudflare/tawk-proxy-worker.js.
const TAWK_PROPERTY = "6a3ac896707bc21d4a185b17";
const TAWK_WIDGET = "1jrqpv3j1";
const TAWK_PROXY_HOST = process.env.NEXT_PUBLIC_TAWK_PROXY_HOST || "";
const TAWK_SRC = TAWK_PROXY_HOST
  ? `https://${TAWK_PROXY_HOST}/__tk/embed.tawk.to/${TAWK_PROPERTY}/${TAWK_WIDGET}`
  : `https://embed.tawk.to/${TAWK_PROPERTY}/${TAWK_WIDGET}`;

// #CHAT-PROXY-VPN fallback (GO Andrea): se il widget Tawk NON carica entro il
// timeout — proxy con una falla, VPN molto aggressiva, Tawk giù — mostriamo un
// bottone di contatto NOSTRO (dominio betredge.com, mai bloccato dalle VPN) così
// il supporto non è MAI invisibile. Se Tawk carica (onLoad) il fallback resta nascosto.
const FALLBACK_TIMEOUT_MS = 6000;
const CONTACT_EMAIL = "info@betredge.com";

export function LiveChat() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Già iniettato (HMR / doppio mount): no-op.
    if (document.getElementById("tawkto-widget")) return;

    let loaded = false;

    // Bootstrap ufficiale Tawk.to.
    const w = window as unknown as { Tawk_API?: Record<string, unknown>; Tawk_LoadStart?: Date };
    w.Tawk_API = w.Tawk_API || {};
    // #HOME-CREATIVE-3d: su mobile il launcher copriva il tile "World Cup" della
    // barra sport in basso → lo alzo (yOffset) sopra la barra. Posizione standard
    // su desktop. customStyle dev'essere settato PRIMA del caricamento dello script.
    w.Tawk_API.customStyle = {
      visibility: {
        desktop: { position: "br", xOffset: 20, yOffset: 20 },
        mobile: { position: "br", xOffset: 12, yOffset: 88 },
      },
    };
    // Callback ufficiale Tawk: se scatta, il widget è vivo → niente fallback.
    w.Tawk_API.onLoad = () => {
      loaded = true;
      setShowFallback(false);
    };
    w.Tawk_LoadStart = new Date();

    const s = document.createElement("script");
    s.id = "tawkto-widget";
    s.async = true;
    s.src = TAWK_SRC;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    // Script irraggiungibile/bloccato (VPN/DNS) → mostra subito il fallback.
    s.onerror = () => {
      if (!loaded) setShowFallback(true);
    };
    document.body.appendChild(s);
    // Niente cleanup dello script: Tawk inietta il proprio launcher/iframe; il
    // guard sull'id basta a evitare doppie iniezioni.

    // Rete di sicurezza: se entro il timeout Tawk non ha fatto onLoad, fallback.
    const t = window.setTimeout(() => {
      if (!loaded) setShowFallback(true);
    }, FALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Widget vivo → Tawk porta il proprio launcher, non renderizziamo nulla.
  if (!showFallback) return null;

  // Widget bloccato → bottone di contatto nostro, sempre raggiungibile.
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      aria-label="Contattaci via email"
      title="Contattaci"
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 2147483000,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 18px",
        borderRadius: 9999,
        background: "#23A559",
        color: "#fff",
        fontWeight: 600,
        fontSize: 14,
        lineHeight: 1,
        textDecoration: "none",
        boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
      }}
    >
      <span aria-hidden="true">✉</span>
      Contattaci
    </a>
  );
}
