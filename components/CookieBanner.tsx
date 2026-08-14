"use client";

// components/CookieBanner.tsx — #FUNNEL-MEAS-0813
// Estratto da app/app/page.tsx e montato nel root layout: prima viveva DENTRO il
// desk, quindi su /, /tools, /weekly-pick, /blog non veniva chiesto nulla e tutto
// ciò che è gated sul consenso (attribuzione, session_id del beacon, LiveChat)
// restava spento proprio dove arriva il traffico. Markup e stile invariati.
//
// Lingua: come le altre parti fuori dal desk (LiveChat, HouseBanner) legge
// localStorage["agentic-lang"] invece del LanguageCtx del desk, che qui non
// esiste. Stessa fonte che il desk usa per inizializzare uiLanguage.

import { useEffect, useState } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync from localStorage: a lazy initializer would mismatch the server-rendered (hidden) markup at hydration.
    try { if (!localStorage.getItem("gdpr_consent")) setVisible(true); } catch { /* SSR/no-storage */ }
  }, []);
  if (!visible) return null;
  // Letto qui e non in stato: si arriva a questa riga solo dopo il mount (visible
  // parte false), quindi niente mismatch di idratazione e niente secondo setState.
  let it = false;
  try { it = (localStorage.getItem("agentic-lang") ?? "en") === "it"; } catch { /* no-storage */ }
  const decide = (v: "accepted" | "declined") => {
    try { localStorage.setItem("gdpr_consent", v); } catch { /* */ }
    // #PRELAUNCH-AUDIT: segnala il consenso ai client che caricano terze parti solo
    // dopo l'Accept (es. LiveChat/Tawk.to) → si attivano senza reload.
    // #FUNNEL-MEAS-0813: lo ascolta anche PageViewTracker per l'attribuzione.
    try { window.dispatchEvent(new Event("betredge:gdpr-consent")); } catch { /* */ }
    setVisible(false);
  };
  // I bottoni sono dichiarati PRIMA del testo e rimessi al loro posto da order:2.
  // Serve al mobile (vedi .cookie-consent in globals.css): sotto i 640px escono
  // dal flusso in float e il testo li avvolge, e un float non risale sopra il
  // contenuto che lo precede. In flex l'order ripristina l'ordine visivo, quindi
  // da 641px in su la barra resta identica a com'era dentro il desk.
  return (
    <div className="cookie-consent" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "rgba(10,12,18,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)",
      padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", backdropFilter: "blur(8px)" }}>
      <div className="cookie-consent-actions" style={{ display: "flex", gap: "8px", flexShrink: 0, order: 2 }}>
        <button onClick={() => decide("declined")} style={{ fontSize: "10px", fontFamily: "monospace", padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", cursor: "pointer" }}>
          {it ? "Rifiuta" : "Decline"}
        </button>
        <button onClick={() => decide("accepted")} style={{ fontSize: "10px", fontFamily: "monospace", padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(99,212,255,0.4)", background: "rgba(99,212,255,0.08)", color: "#67e8f9", cursor: "pointer" }}>
          {it ? "Accetta" : "Accept"}
        </button>
      </div>
      <p style={{ color: "#94a3b8", fontSize: "11px", fontFamily: "monospace", flex: 1, minWidth: "200px", margin: 0 }}>
        {it ? "Usiamo cookie per migliorare l'esperienza. I link ai bookmaker partner possono essere affiliati — potremmo ricevere una commissione, senza costi aggiuntivi per te."
            : "We use cookies to improve your experience. Links to partner sportsbooks may be affiliate links — we may earn a commission at no extra cost to you."}
      </p>
    </div>
  );
}
