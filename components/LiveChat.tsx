"use client";

// components/LiveChat.tsx (#UI-LIVECHAT-0623)
// Scaffold per la live chat (talk.to). L'account non è ancora pronto, quindi
// questo componente è INERTE finché non viene settata la env pubblica:
//
//   NEXT_PUBLIC_TALKTO_ID   (id del widget talk.to)
//
// Senza valore: NON renderizza nulla, NON carica script, NON fa richieste di
// rete e NON genera errori. Quando l'id sarà disponibile, basta settare la env
// e ridistribuire: lo snippet talk.to viene iniettato lato client.
//
// NOTA CSP: quando si attiva, aggiungere i domini talk.to a script-src/connect-src
// in next.config.ts (oggi la CSP è Report-Only, quindi non blocca nulla; va
// promossa con i domini corretti prima di passare a enforcing).
//
// Nessuno snippet/segreto è hardcoded qui.

import { useEffect } from "react";

const TALKTO_ID = process.env.NEXT_PUBLIC_TALKTO_ID;

export function LiveChat() {
  useEffect(() => {
    // Flag spento (env non settata): no-op assoluto, nessuna richiesta di rete.
    if (!TALKTO_ID) return;
    // Evita doppia iniezione (es. fast-refresh o doppio mount).
    if (document.getElementById("talkto-widget")) return;

    // Snippet ufficiale talk.to caricato dinamicamente SOLO quando l'id esiste.
    // L'id arriva dalla env pubblica, non è hardcoded.
    const s = document.createElement("script");
    s.id = "talkto-widget";
    s.async = true;
    s.src = `https://widgets.talk.to/${encodeURIComponent(TALKTO_ID)}.js`;
    document.body.appendChild(s);

    return () => {
      // Cleanup difensivo in dev/HMR.
      document.getElementById("talkto-widget")?.remove();
    };
  }, []);

  // Flag spento: renderizza nulla (stato inerte) — niente launcher fantasma.
  if (!TALKTO_ID) return null;

  // Con la env attiva il widget talk.to porta il suo launcher; non aggiungiamo
  // un bottone duplicato. Manteniamo un nodo segnaposto per eventuali hook futuri.
  return <div id="live-chat-root" aria-hidden="true" />;
}
