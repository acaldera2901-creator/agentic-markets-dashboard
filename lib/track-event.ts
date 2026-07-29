// Beacon analytics fire-and-forget verso /api/track.
//
// Estratto da app/app/page.tsx (#PARTNER-CLICK-TRACK-1) perché serve anche a
// MatchDetailSheet: la regola di consenso qui sotto è una regola PRIVACY e deve
// vivere in UN posto solo — due copie divergono e la seconda sbaglia.
// Comportamento identico a prima, stesse chiavi di storage.

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = sessionStorage.getItem("am_sid");
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("am_sid", sid);
  }
  return sid;
}

export function trackEvent(
  event_type: string,
  extra?: { language?: string; plan?: string; partner_id?: string; value?: number; meta?: Record<string, unknown> }
) {
  if (typeof window === "undefined") return;
  const language = extra?.language ?? localStorage.getItem("agentic-lang") ?? undefined;
  // #GOLIVE-QW-A: no persistent session_id before GDPR consent is granted — the
  // beacon still fires (anonymous, no id) so we don't tie events to a device
  // identifier the user hasn't accepted. session_id resumes once consent lands.
  const consented = (() => {
    try { return localStorage.getItem("gdpr_consent") === "accepted"; } catch { return false; }
  })();
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type, session_id: consented ? getSessionId() : undefined, language, ...extra }),
  }).catch(() => { /* ignore */ });
}
