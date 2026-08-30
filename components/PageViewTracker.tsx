"use client";

// components/PageViewTracker.tsx — #FUNNEL-MEAS-0813
// Montato UNA volta nel root layout: prima di questo, il tracking di prima parte
// esisteva solo dentro il desk /app, quindi misuravamo chi era già entrato e non
// chi arriva (landing, /tools, /weekly-pick, /partners, /blog: zero eventi).
// Nessun vendor, nessun cookie: riusa il beacon esistente (lib/track-event).

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAttribution, sourceFromSearch } from "@/lib/attribution";
import { trackEvent } from "@/lib/track-event";

export default function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    // First-touch: scrive solo al primo caricamento e solo col consenso, poi è
    // un no-op (la regola vive dentro initAttribution).
    initAttribution();
    // `path` in meta: è il campo libero della tabella events (meta JSONB);
    // event_type resta "page_view" per non spezzare le query esistenti.
    // La provenienza dichiarata nell'URL (`?src=tg-free` dai canali Telegram).
    // Letta da window.location e non da useSearchParams(): quel hook renderebbe
    // dinamiche le pagine statiche per SEO. Entra nel meta solo se c'e'.
    const prov = typeof window !== "undefined" ? sourceFromSearch(window.location.search) : {};
    trackEvent("page_view", { meta: { path: pathname, ...prov } });
  }, [pathname]);

  // Consenso accettato dopo il caricamento: l'utente è ancora sulla pagina di
  // ingresso, quindi utm e referrer sono ancora leggibili e l'attribuzione si
  // cattura adesso. Stesso evento del banner già ascoltato da LiveChat.
  useEffect(() => {
    const onConsent = () => initAttribution();
    window.addEventListener("betredge:gdpr-consent", onConsent);
    return () => window.removeEventListener("betredge:gdpr-consent", onConsent);
  }, []);

  return null;
}
