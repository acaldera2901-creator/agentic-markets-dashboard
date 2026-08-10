"use client";

import { useEffect } from "react";

// #PIXELS-TRACKING-0810: Google Tag Manager come UNICO tag in pagina — GA4, Meta
// Pixel e futuri pixel ads vivono dentro il container GTM (pannello, zero deploy).
// Stessa regola privacy di LiveChat/Tawk (#PRELAUNCH-AUDIT): niente terze parti
// prima del consenso — GTM si inietta SOLO con "gdpr_consent"==="accepted", su
// Accept senza reload via evento "betredge:gdpr-consent" o storage cross-tab.
// Consent Mode v2: default DENIED dichiarato prima di gtm.js, poi update GRANTED
// (il banner oggi è binario: Accept = tutti i consensi; se diventa granulare,
// l'update va mappato sulle scelte). Senza NEXT_PUBLIC_GTM_ID il componente è un
// no-op: il codice può andare live prima che gli account Maven esistano.

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

type GtmWindow = Window & { dataLayer?: unknown[] };

export function TrackingScripts() {
  useEffect(() => {
    if (typeof window === "undefined" || !GTM_ID) return;

    const hasConsent = () => {
      try { return localStorage.getItem("gdpr_consent") === "accepted"; } catch { return false; }
    };

    const injectGtm = () => {
      // Già iniettato (HMR / doppio mount / secondo trigger di consenso): no-op.
      if (document.getElementById("gtm-loader")) return;

      const w = window as GtmWindow;
      w.dataLayer = w.dataLayer || [];
      const gtag = (...args: unknown[]) => { w.dataLayer!.push(args); };

      // Consent Mode v2: il default va dichiarato PRIMA che gtm.js parta.
      gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
      // Siamo qui solo post-Accept del banner (binario) → tutto granted.
      gtag("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "granted",
      });
      w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

      const s = document.createElement("script");
      s.id = "gtm-loader";
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
      document.body.appendChild(s);
      // Niente cleanup: il guard sull'id evita doppie iniezioni; rimuovere il tag
      // non "scarica" GTM comunque.
    };

    // Consenso già dato → inietta subito. Altrimenti aspetta l'Accept.
    if (hasConsent()) {
      injectGtm();
      return;
    }
    const onConsent = () => { if (hasConsent()) injectGtm(); };
    const onStorage = (e: StorageEvent) => { if (e.key === "gdpr_consent") onConsent(); };
    window.addEventListener("betredge:gdpr-consent", onConsent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("betredge:gdpr-consent", onConsent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
