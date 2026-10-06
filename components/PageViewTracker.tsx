"use client";

// components/PageViewTracker.tsx — #FUNNEL-MEAS-0813
// Montato UNA volta nel root layout: prima di questo, il tracking di prima parte
// esisteva solo dentro il desk /app, quindi misuravamo chi era già entrato e non
// chi arriva (landing, /tools, /weekly-pick, /partners, /blog: zero eventi).
// Nessun vendor, nessun cookie: riusa il beacon esistente (lib/track-event).

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { externalReferrerHost, initAttribution, sourceFromSearch } from "@/lib/attribution";
import { trackEvent } from "@/lib/track-event";
import { storageGet } from "@/lib/safe-storage";

// Il cap di meta in app/api/track/route.ts è 2048 byte, e se lo si supera la
// route butta via l'INTERO meta (`metaJson = "{}"`), quindi anche `path`. Le
// sette chiavi di provenienza sono già tagliate a 40 caratteri ciascuna
// (~380 byte in tutto) e ref_host a 80: tagliando anche il path il peggior
// caso resta sotto il cap invece di dipendere dalla lunghezza di una URL che
// chiunque può allungare.
const MAX_PATH_LEN = 512;

export default function PageViewTracker() {
  const pathname = usePathname();
  // #ATTRIB-EVERYWHERE-0915: `document.referrer` NON cambia durante le
  // navigazioni client-side — resta quello del caricamento iniziale. Allegarlo
  // a ogni page_view direbbe che tutte le pagine della sessione arrivano da
  // Reddit. È una proprietà dell'INGRESSO, quindi si registra una volta sola.
  const entryView = useRef(true);
  const pendingEntry = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    // First-touch: scrive solo al primo caricamento e solo col consenso, poi è
    // un no-op (la regola vive dentro initAttribution).
    initAttribution();
    // `path` in meta: è il campo libero della tabella events (meta JSONB);
    // event_type resta "page_view" per non spezzare le query esistenti.
    // La provenienza dichiarata nell'URL (`?src=tg-free` dai canali Telegram,
    // `?utm_source=…` da Reddit/newsletter/widget, `?crm=…` dalle email CRM).
    // Letta da window.location e non da useSearchParams(): quel hook renderebbe
    // dinamiche le pagine statiche per SEO. Entra nel meta solo se c'e'.
    const prov = typeof window !== "undefined" ? sourceFromSearch(window.location.search) : {};
    const isEntry = entryView.current;
    entryView.current = false;
    // Solo l'host, mai la URL completa: dice "reddit.com" senza dire cosa
    // stesse leggendo l'utente. Vedi externalReferrerHost.
    const refHost = isEntry ? externalReferrerHost() : null;
    const meta = { path: pathname.slice(0, MAX_PATH_LEN), ...prov, ...(refHost ? { ref_host: refHost } : {}) };
    trackEvent("page_view", { meta });
    // #SESSIONI-1006 leva 3 — chi non ha ancora risposto al banner: l'ingresso
    // resta SOLO in questa ref (memoria JS, mai storage) finche' non decide.
    // Chi ha gia' accettato non serve (il page_view porta gia' il sid); chi ha
    // gia' rifiutato non lo deve avere.
    if (isEntry && storageGet("gdpr_consent") === null) pendingEntry.current = meta;
  }, [pathname]);

  // Consenso accettato dopo il caricamento: l'utente è ancora sulla pagina di
  // ingresso, quindi utm e referrer sono ancora leggibili e l'attribuzione si
  // cattura adesso. Stesso evento del banner già ascoltato da LiveChat.
  useEffect(() => {
    const onConsent = () => {
      initAttribution();
      // #SESSIONI-1006 leva 3 — accept: l'ingresso si lega al session_id con un
      // evento DISTINTO (non un secondo page_view), una volta sola. Rifiuto: si
      // scarta. In entrambi i casi la memoria si svuota. Una ricarica parte col
      // consenso gia' deciso, quindi non ricrea il pendente: niente doppioni.
      const entry = pendingEntry.current;
      pendingEntry.current = null;
      if (entry && storageGet("gdpr_consent") === "accepted") {
        trackEvent("entry_attributed", { meta: entry });
      }
    };
    window.addEventListener("betredge:gdpr-consent", onConsent);
    return () => window.removeEventListener("betredge:gdpr-consent", onConsent);
  }, []);

  return null;
}
