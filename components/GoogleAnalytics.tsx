"use client";

// components/GoogleAnalytics.tsx — #GA4-TAG-1110 (Andrea 10/11: «fai direttamente il deploy inserendo il tag»).
// GA4 della proprietà BetRedge (account calde@mavenagency.io, ID G-8XWQD5N6T7).
// GDPR/ePrivacy: stessa regola di VercelAnalytics.tsx — gtag.js si inietta SOLO dopo
// l'Accept del banner (chiave "gdpr_consent", evento "betredge:gdpr-consent", `storage`
// per gli altri tab). Senza consenso non montiamo nulla. Se il consenso viene tolto dopo,
// lo script resta nel documento: consent update a "denied" ferma l'invio dei cookie/hit.
import Script from "next/script";
import { useEffect, useState } from "react";

export const GA_MEASUREMENT_ID = "G-8XWQD5N6T7";

function hasConsent(): boolean {
  try { return localStorage.getItem("gdpr_consent") === "accepted"; } catch { return false; }
}

export default function GoogleAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync da localStorage (vedi VercelAnalytics.tsx).
    setConsented(hasConsent());
    const onConsent = () => {
      const ok = hasConsent();
      setConsented(ok);
      const w = window as unknown as { gtag?: (...a: unknown[]) => void };
      if (!ok && w.gtag) w.gtag("consent", "update", { analytics_storage: "denied", ad_storage: "denied" });
    };
    const onStorage = (e: StorageEvent) => { if (e.key === "gdpr_consent" || e.key === null) onConsent(); };
    window.addEventListener("betredge:gdpr-consent", onConsent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("betredge:gdpr-consent", onConsent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!consented) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('config','${GA_MEASUREMENT_ID}',{anonymize_ip:true});`}
      </Script>
    </>
  );
}
