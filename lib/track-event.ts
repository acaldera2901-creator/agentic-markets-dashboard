// Beacon analytics fire-and-forget verso /api/track.
//
// Estratto da app/app/page.tsx (#PARTNER-CLICK-TRACK-1) perché serve anche a
// MatchDetailSheet: la regola di consenso qui sotto è una regola PRIVACY e deve
// vivere in UN posto solo — due copie divergono e la seconda sbaglia.
// Comportamento identico a prima, stesse chiavi di storage.

// #STORAGE-CRASH-0813: `null` quando lo storage è vietato (vedi trackEvent).
// Meglio un evento senza id che un'eccezione: l'id serve a raggruppare, non a
// far funzionare la pagina.
export function getSessionId(): string | null {
  if (typeof window === "undefined") return "ssr";
  try {
    let sid = sessionStorage.getItem("am_sid");
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("am_sid", sid);
    }
    return sid;
  } catch {
    return null;
  }
}

export function trackEvent(
  event_type: string,
  extra?: { language?: string; plan?: string; partner_id?: string; value?: number; meta?: Record<string, unknown> }
) {
  if (typeof window === "undefined") return;
  // #STORAGE-CRASH-0813: questa lettura era FUORI dal try (quella del consenso,
  // due righe sotto, era già protetta). Dove lo storage è vietato — Safari in
  // navigazione privata, i browser interni delle app, i cookie bloccati —
  // `getItem` LANCIA, e siccome trackEvent gira in un useEffect al mount del desk
  // e a ogni click su lingua/tema/tab/partner, l'eccezione risaliva fino al
  // boundary globale: l'utente vedeva la schermata d'errore al posto del sito.
  // Un beacon di analytics non può poter spegnere il prodotto.
  const stored = (() => {
    try { return localStorage.getItem("agentic-lang"); } catch { return null; }
  })();
  const language = extra?.language ?? stored ?? undefined;
  // #GOLIVE-QW-A: no persistent session_id before GDPR consent is granted — the
  // beacon still fires (anonymous, no id) so we don't tie events to a device
  // identifier the user hasn't accepted. session_id resumes once consent lands.
  const consented = (() => {
    try { return localStorage.getItem("gdpr_consent") === "accepted"; } catch { return false; }
  })();
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // `?? undefined`: con lo storage vietato getSessionId ritorna null, e la
    // chiave va OMESSA dal payload invece di arrivare a null — la forma del
    // beacon resta identica a prima del fix.
    body: JSON.stringify({ event_type, session_id: consented ? (getSessionId() ?? undefined) : undefined, language, ...extra }),
  }).catch(() => { /* ignore */ });
}
