import { shouldSkipAnalyticsPath } from "./analytics-quality";

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
  // `anonymous` (#SESSIONI-1006): l'evento non porta MAI il session_id, anche
  // col consenso — per i conteggi aggregati come `consent_choice`.
  extra?: { language?: string; plan?: string; partner_id?: string; value?: number; meta?: Record<string, unknown>; anonymous?: boolean }
) {
  if (typeof window === "undefined" || shouldSkipAnalyticsPath(window.location.pathname)) return;
  const { anonymous, ...fields } = extra ?? {};
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
  const language = fields.language ?? stored ?? undefined;
  // #GOLIVE-QW-A: no persistent session_id before GDPR consent is granted — the
  // beacon still fires (anonymous, no id) so we don't tie events to a device
  // identifier the user hasn't accepted. session_id resumes once consent lands.
  const consented = !anonymous && (() => {
    try { return localStorage.getItem("gdpr_consent") === "accepted"; } catch { return false; }
  })();
  const internal = (() => { try { return localStorage.getItem("betredge_internal") === "1"; } catch { return false; } })();
  if (internal) fields.meta = { ...fields.meta, internal: true };
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // #ATTRIB-EVERYWHERE-0915: `keepalive` perché metà di questi eventi sono
    // esattamente quelli sparati un istante PRIMA di lasciare la pagina
    // (conversion, plan_cta_click, checkout_opened, partner_click,
    // sportsbook_click): senza, il browser è libero di annullare la richiesta
    // al unload e l'evento che misura la conversione è proprio quello che si
    // perde. Il payload è di poche centinaia di byte, molto sotto il limite di
    // 64 KiB che la specifica impone alle richieste keepalive.
    keepalive: true,
    // `?? undefined`: con lo storage vietato getSessionId ritorna null, e la
    // chiave va OMESSA dal payload invece di arrivare a null — la forma del
    // beacon resta identica a prima del fix.
    body: JSON.stringify({ event_type, analytics_consent: consented, session_id: consented ? (getSessionId() ?? undefined) : undefined, language, ...fields }),
  }).catch(() => { /* ignore */ });
}

// #PLAN-VIEW-PLAN-0928 — il piano di chi GUARDA, per `plan_view`. Prima
// l'evento partiva senza `plan`, quindi nel funnel un anonimo, un Free e un
// Pro sulla pagina piani erano la stessa riga. Su `plan_cta_click`,
// `checkout_opened` e `conversion` il campo `plan` resta il piano SCELTO;
// su `plan_view` è il piano ATTUALE del visitatore (non ne ha scelto uno).
// "anon" invece di null: null è anche lo storico prima di questo fix, e le due
// cose devono potersi distinguere. Senza sessione server si è anonimi anche se
// in localStorage resta un profilo: è il cookie che decide, non lo storage.
export function viewerPlan(hasSession: boolean, profile: { plan: string } | null): string {
  if (!hasSession) return "anon";
  return profile?.plan ?? "unknown";
}

/** Session anchor only after consent; a blocked storage never creates a durable ID. */
export function anchorSession(meta:Record<string,unknown>):void {
 if(typeof window==='undefined'||shouldSkipAnalyticsPath(window.location.pathname))return;
 try{
  if(localStorage.getItem('gdpr_consent')!=='accepted')return;
  const sid=getSessionId();
  if(!sid||sessionStorage.getItem('br_session_anchor')===sid)return;
  sessionStorage.setItem('br_session_anchor',sid);
  trackEvent('session_start',{meta});
 }catch{ /* analytics must never block navigation */ }
}

type ConsentSync='ready'|'disabled'|'revoked'|'failed';
let bootstrap:Promise<ConsentSync>|null=null;
/** Resolves only after the browser has installed the server's signed cookie. */
export async function syncAnalyticsConsent(entry?:Record<string,unknown>,forceRevoke=false):Promise<ConsentSync> {
 if(typeof window==='undefined'||shouldSkipAnalyticsPath(window.location.pathname))return 'disabled';
 let consent:string|null;try{consent=forceRevoke?'declined':localStorage.getItem('gdpr_consent');}catch{return 'disabled';}
 if(consent!=='accepted'&&consent!=='declined')return 'disabled';
 if(consent==='declined')try{sessionStorage.removeItem('am_sid');sessionStorage.removeItem('br_session_anchor');localStorage.removeItem('am_attrib');}catch{/* storage denied */}
 if(process.env.NEXT_PUBLIC_ANALYTICS_LINKING_ENABLED!=='1')return 'disabled';
 let internal=false;try{internal=localStorage.getItem('betredge_internal')==='1';}catch{}
 const request=(choice:'accepted'|'revoked')=>fetch('/api/analytics/session',{method:'POST',headers:{'content-type':'application/json'},keepalive:true,body:JSON.stringify({consent:choice,entry:{...entry,...(internal?{internal:true}:{})}})});
 if(consent==='declined'){
  // A late accept response must not install its cookie after the withdrawal response.
  if(bootstrap)await bootstrap;
  try{const response=await request('revoked');return response.ok?'revoked':'failed';}catch{return 'failed';}
 }
 if(bootstrap)return bootstrap;
 bootstrap=(async()=>{
  try{
   const response=await request('accepted');if(!response.ok)return 'failed';
   if(localStorage.getItem('gdpr_consent')!=='accepted'){
    await request('revoked');return 'revoked';
   }
   return 'ready';
  }catch{return 'failed';}
 })();
 try{return await bootstrap;}finally{bootstrap=null;}
}
