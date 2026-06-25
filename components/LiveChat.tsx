"use client";

// components/LiveChat.tsx (#UI-LIVECHAT-0623 → Tawk.to live)
// (#UI-LIVECHAT-OFFSET-HIDE-0625) Il launcher di Tawk.to copriva CTA/contenuti
// (specie su mobile e sopra il cookie banner). Due interventi UI-only,
// probability-neutral:
//   1) OFFSET — Tawk_API.customStyle alza il launcher sopra footer/cookie banner
//      (offset diverso desktop/mobile) così non copre più i bottoni.
//   2) NASCONDI/MOSTRA — una × accanto al launcher lo nasconde (hideWidget) e
//      memorizza la scelta; quando è nascosto mostriamo una piccola pill "Chat"
//      per riaprirlo (showWidget). Scelta persistita in localStorage.
//
// L'id del widget è PUBBLICO (lo snippet ufficiale di Tawk.to gira lato client e
// l'id è visibile nel sorgente per design) → non è un segreto e può stare nel
// codice. Caricato dinamicamente solo lato client al mount, con guard
// anti-doppia-iniezione (fast-refresh / doppio mount).
//
// NOTA CSP: i domini Tawk.to sono aggiunti a script-src/connect-src/img-src/
// frame-src in next.config.ts. Oggi la CSP è Report-Only (non blocca), ma è
// pronta per l'enforcing.

import { useEffect, useState } from "react";

// embed.tawk.to/<propertyId>/<widgetId> — account Tawk.to BetRedge.
const TAWK_SRC = "https://embed.tawk.to/6a3ac896707bc21d4a185b17/1jrqpv3j1";
const HIDE_KEY = "betredge:chat-hidden";

// Solo i membri di Tawk_API che usiamo. customStyle DEVE essere settato prima
// che l'embed parta; gli altri sono disponibili dopo onLoad → opzionali + guard.
type TawkApi = {
  customStyle?: unknown;
  onLoad?: () => void;
  onChatMaximized?: () => void;
  onChatMinimized?: () => void;
  hideWidget?: () => void;
  showWidget?: () => void;
};

function getTawk(): TawkApi | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Tawk_API?: TawkApi }).Tawk_API ?? null;
}

export function LiveChat() {
  // Render solo dopo il mount: evita mismatch di idratazione (il server non
  // conosce la scelta salvata in localStorage) e l'eventuale flash.
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMounted(true);
    setHidden(window.localStorage.getItem(HIDE_KEY) === "1");

    // Già iniettato (HMR / doppio mount): no-op sul bootstrap.
    if (document.getElementById("tawkto-widget")) return;

    const w = window as unknown as { Tawk_API?: TawkApi; Tawk_LoadStart?: Date };
    const api: TawkApi = w.Tawk_API || {};
    // (1) OFFSET — va impostato PRIMA che l'embed venga caricato.
    api.customStyle = {
      visibility: {
        desktop: { position: "br", xOffset: 20, yOffset: 90 },
        mobile: { position: "br", xOffset: 10, yOffset: 80 },
      },
    };
    api.onLoad = () => {
      // Se l'utente l'aveva nascosto, parte nascosto.
      if (window.localStorage.getItem(HIDE_KEY) === "1") getTawk()?.hideWidget?.();
    };
    // Quando il pannello chat è aperto nascondiamo i nostri controlli (× / pill)
    // per non sovrapporci ad esso.
    api.onChatMaximized = () => setChatOpen(true);
    api.onChatMinimized = () => setChatOpen(false);
    w.Tawk_API = api;
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

  function hideChat() {
    getTawk()?.hideWidget?.();
    window.localStorage.setItem(HIDE_KEY, "1");
    setHidden(true);
  }

  function showChat() {
    getTawk()?.showWidget?.();
    window.localStorage.setItem(HIDE_KEY, "0");
    setHidden(false);
  }

  // Prima del mount, o mentre il pannello chat è aperto, non renderizziamo
  // controlli nostri (il launcher Tawk si gestisce da sé).
  if (!mounted || chatOpen) return null;

  if (hidden) {
    // Pill discreta per riaprire la chat dopo che è stata nascosta.
    return (
      <button
        type="button"
        onClick={showChat}
        aria-label="Mostra la chat di supporto"
        style={{
          position: "fixed",
          right: "16px",
          bottom: "16px",
          zIndex: 2147483000,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 12px",
          borderRadius: "999px",
          border: "none",
          background: "var(--am-coral, #FF6A5E)",
          color: "#fff",
          font: "600 13px/1 'Hanken Grotesk', system-ui, sans-serif",
          boxShadow: "0 4px 14px rgba(0,0,0,.18)",
          cursor: "pointer",
        }}
      >
        💬 Chat
      </button>
    );
  }

  // × per nascondere, ancorata appena sopra il launcher (che con l'offset sta a
  // ~90px dal fondo a destra).
  return (
    <button
      type="button"
      onClick={hideChat}
      aria-label="Nascondi la chat di supporto"
      title="Nascondi la chat"
      style={{
        position: "fixed",
        right: "18px",
        bottom: "150px",
        zIndex: 2147483000,
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        border: "none",
        background: "rgba(11,12,14,.72)",
        color: "#fff",
        font: "700 13px/1 system-ui, sans-serif",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,.25)",
      }}
    >
      ×
    </button>
  );
}
