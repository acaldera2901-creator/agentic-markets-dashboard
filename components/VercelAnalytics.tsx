"use client";

// components/VercelAnalytics.tsx — #SEO-ANALYTICS-0915
// Vercel Web Analytics. Il sito misurava solo di prima parte (PageViewTracker →
// tabella events): nessuno strumento dava retention, referrer aggregati e
// confronto fra pagine senza scrivere query a mano.
//
// GDPR/ePrivacy: lo script è servito da /_vercel/insights/script.js (prima parte
// nel path, ma il dato esce verso Vercel) → si carica SOLO col consenso
// preventivo, esattamente come Tawk.to in LiveChat.tsx: stessa chiave
// "gdpr_consent", stesso evento "betredge:gdpr-consent" per attivarsi senza
// reload, stesso ascolto di `storage` per gli altri tab. Prima dell'Accept NON
// montiamo <Analytics />, quindi lo script non viene nemmeno iniettato.
//
// Perché <Analytics /> di "@vercel/analytics/next" e non lo <script> nudo: il
// componente Next legge useParams() e manda la rotta PARAMETRICA
// ("/tools/[tool]") accanto al path concreto. Senza, le 121 pagine-tool
// finirebbero in 121 righe separate invece di raggrupparsi sotto la rotta.

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";

function hasConsent(): boolean {
  try { return localStorage.getItem("gdpr_consent") === "accepted"; } catch { return false; }
}

export default function VercelAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    // Consenso già dato in una sessione precedente → monta subito.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync da localStorage: un lazy initializer divergerebbe dal markup renderizzato lato server (dove consented è sempre false).
    setConsented(hasConsent());

    // Accept dato adesso: stesso tab via evento custom del banner, altri tab via storage.
    const onConsent = () => setConsented(hasConsent());
    const onStorage = (e: StorageEvent) => { if (e.key === "gdpr_consent" || e.key === null) onConsent(); };
    window.addEventListener("betredge:gdpr-consent", onConsent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("betredge:gdpr-consent", onConsent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!consented) return null;
  // Unmounting does not remove the SDK already injected into the document.
  // Its callback must consult current consent before every subsequent event.
  return <Analytics beforeSend={(event) => hasConsent() ? event : null} />;
}
