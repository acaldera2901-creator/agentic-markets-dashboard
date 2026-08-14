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
  // Geometria condivisa: un oggetto solo, spread in entrambi i bottoni. La
  // simmetria che l'EDPB chiede (stessa dimensione, stessa prominenza) è
  // garantita dalla struttura, non dalla disciplina di chi edita. Divergono SOLO
  // per tinta, sotto. Presidiata da CookieBanner.test.tsx.
  // I tre numeri da non toccare a occhio (misurati a 390px):
  // - minWidth 68px = larghezza naturale della label più lunga in EN e IT:
  //   pareggia i due box SENZA allargare il gruppo. A 72px il gruppo cresce di
  //   8px, la riga di testo perde 2 caratteri, la disclosure IT passa a 3 righe
  //   e la barra torna da 43,4px a 56,6px.
  // - minHeight 26px = il pavimento della barra è il testo (2 righe, 26,4px),
  //   non i bottoni (24px): alzare il target fin qui costa zero altezza. Oltre,
  //   si paga — per questo non c'è il min-height:32px, incompatibile con lo
  //   stretch goal.
  // - borderRadius 0 = --am-btn-radius, il linguaggio dei bottoni di casa e
  //   della .v-btn--primary che sta 4px sopra. Neutralizza anche il radius:6px
  //   che la regola globale :focus-visible impone.
  const btnBase = {
    fontSize: "10px", fontFamily: "monospace", fontWeight: 700,
    letterSpacing: "0.05em", textTransform: "uppercase" as const,
    lineHeight: 1, padding: "6px 10px", minWidth: "68px", minHeight: "26px",
    whiteSpace: "nowrap" as const, textAlign: "center" as const,
    borderRadius: "0px", borderWidth: "1px", borderStyle: "solid" as const,
    cursor: "pointer",
  };
  // Token vivi --am-* nella variante DARK, scritti per esteso e NON come var():
  // la barra ha sfondo dark hardcoded in ENTRAMBI i temi, mentre i token si
  // ribaltano su :root[data-theme="light"] (--am-muted #AEB4BE → #4A515B,
  // --am-coral #23A559 → #15803D). Un var() qui renderebbe illeggibile la barra
  // proprio in light, che è il tema di default della landing.
  // Stesso fill su entrambi (--am-panel-2): sparisce l'opposizione pieno-vs-ghost,
  // la struttura precisa che l'EDPB contesta. Divergono solo label e bordo.
  // Misurati sul render, in light e dark: testo 8,28:1 (Decline) e 5,42:1
  // (Accept) sul chip, bordi 4,26:1 e 6,14:1 sulla barra (SC 1.4.11 vuole 3:1).
  // Il residuo pende a favore del RIFIUTO, l'unica direzione che le linee guida
  // non puniscono mai. --am-muted-2 #6E7682 come TESTO fallirebbe (4,26 < 4,5),
  // come BORDO gli bastano 3:1 — token giusto per il mestiere giusto.
  const declineTint = { color: "#AEB4BE", background: "#181B20", borderColor: "#6E7682" };
  const acceptTint  = { color: "#23A559", background: "#181B20", borderColor: "#23A559" };
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
        <button onClick={() => decide("declined")} style={{ ...btnBase, ...declineTint }}>
          {it ? "Rifiuta" : "Decline"}
        </button>
        <button onClick={() => decide("accepted")} style={{ ...btnBase, ...acceptTint }}>
          {it ? "Accetta" : "Accept"}
        </button>
      </div>
      {/* Copy accorciata (#FUNNEL-MEAS-0813): la disclosure affiliate resta nella
          sostanza — link ai bookmaker partner + possibile commissione — mentre
          cadono le parti non necessarie ("per migliorare l'esperienza", "senza
          costi aggiuntivi per te"). Il 18+ non serve qui: sta nel SiteFooter, su
          tutto il sito. Il taglio non è estetico ma di altezza: a 390px queste
          due lingue stanno in 2 righe dentro l'altezza dei bottoni, e la barra
          scende da 103,5px a 44px liberando entrambe le CTA della home.
          ATTENZIONE: la copy è sensibile al wrapping. A 390px la prima riga ha
          30 caratteri (monospace 11px accanto ai bottoni in float); una parola
          in più manda a 3 righe e la barra torna a 56,6px — non si rompe nulla,
          ma la CTA secondaria torna coperta. Rimisurare se si ritocca. */}
      <p style={{ color: "#AEB4BE", fontSize: "11px", lineHeight: 1.2, fontFamily: "monospace", flex: 1, minWidth: "200px", margin: 0 }}>
        {it ? "Cookie. I link ai bookmaker possono darci una commissione."
            : "Cookies. Sportsbook links may earn us a commission."}
      </p>
    </div>
  );
}
