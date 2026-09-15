// lib/analytics-events.ts — #RETENTION-ANALYTICS-0915
//
// La colonna `events.session_id` e' POLISEMICA: due famiglie di scritture ci
// mettono dentro cose diverse.
//
//   1. Il browser, via /api/track, ci mette `am_sid` — l'identificatore
//      pseudonimo del visitatore (Cons. 26 GDPR). E' un dato personale e su
//      questo il registro dei trattamenti fissa una retention di 14 mesi.
//   2. Il server ci mette ID ORDINE e sorgenti (paygate, weekly pick, audit
//      admin). Non sono identificatori di visitatore: sono record contabili,
//      conservati 2 anni per obblighi fiscali (privacy policy §6).
//
// Una retention scritta come `session_id <> 'admin'` azzererebbe anche la (2).
// Misurato sul DB di produzione il 15/09: `paygate_reconcile_diag` e' il
// PRIMO event_type per numero di righe con session_id (8.147), e tutte
// portano un ID ordine. Da qui l'allowlist esplicita invece del filtro
// negativo.
//
// Le liste vivono qui e non nelle route perche' /api/track e il cron di
// retention devono leggere LA STESSA lista: due copie divergono e la seconda
// sbaglia — e' la lezione di #PRIVACY-ANALYTICS-0915, dove il tracker
// duplicato di HouseBanner aveva perso il gate di consenso.

/** Eventi che il browser manda a /api/track. Allowlist di scrittura E perimetro di retention. */
export const BROWSER_ANALYTICS_EVENTS = [
  "page_view", "tab_click", "plan_view", "language_change", "theme_change",
  "conversion", "partner_click", "mb_link_copied",
  "operator_sidebar_click", "sportsbook_sidebar_click", "sportsbook_click",
  // #INVITE-ROBUSTNESS-0813 — il boundary globale (app/global-error.tsx) riporta
  // qui digest + path + user agent. Senza questa riga il report verrebbe scartato
  // in silenzio e la schermata d'errore resterebbe invisibile, com'e' successo il
  // 2026-08-13. `value` resta 0 come per ogni evento client: non e' una metrica.
  "client_error",
  "house_banner_view", "house_banner_click", "house_banner_dismiss",
  // #FUNNEL-MEAS-0813 — funnel di acquisizione. Gli ultimi tre erano GIÀ emessi
  // dal codice (referral V2, consenso prelievo) e scartati in silenzio qui.
  "signup_started", "signup_completed",
  "referral_code_claimed", "referral_link_copied", "withdrawal_consent",
  // #FUNNEL-INTENT-0908 — il gradino che mancava fra "vedo il prezzo"
  // (plan_view) e "pago" (conversion). Senza questi due, un funnel rotto
  // in mezzo è indistinguibile da un funnel senza domanda: misurato l'08/09,
  // 11 registrazioni reali e ZERO aperture del checkout, e nulla nel DB
  // diceva quanti ci avessero almeno provato.
  "plan_cta_click", "checkout_opened",
  // #WIDGET-EMBED-0824 — widget incorporato su siti terzi. `meta.host` dice
  // QUALE sito converte (dichiarato dal client, come ogni altro evento qui:
  // buono per misurare, mai per decidere accessi).
  "widget_view", "widget_click",
] as const;

// Eventi che il client NON emette piu' ma che restano nello storico con un
// `am_sid` addosso. /api/track oggi li rifiuta; la retention deve comunque
// coprirli, altrimenti un identificatore vecchio non scadrebbe mai.
// `operator_b2b_click`: 6 righe, 3 sessioni, dal 05/06 (misurato il 15/09).
export const RETIRED_BROWSER_ANALYTICS_EVENTS = ["operator_b2b_click"] as const;

// Scritti dal server. Qui `session_id` e' un ID ordine o una sorgente, MAI
// l'identificatore di un visitatore: fuori dal perimetro dei 14 mesi.
export const SERVER_WRITTEN_EVENTS = [
  "paygate_callback_hit",      // app/api/paygate/callback — order id
  "paygate_reconcile_diag",    // app/api/cron/paygate-reconcile — order id
  "weekly_pick_purchased",     // lib/weekly-pick-server — order id (record contabile)
  "admin_profile_plan_changed", // lib/plan-grant — sorgente del grant
  "admin_profile_switched",    // app/api/admin/profiles/switch — audit ('admin')
  "admin_profile_impersonated", // app/api/admin/profiles — audit ('admin')
  "signup_geo_denied",         // app/api/auth — session_id sempre NULL
] as const;

/** Eventi il cui `session_id`, quando c'e', e' l'identificatore pseudonimo del visitatore. */
export const PSEUDONYMOUS_EVENTS: readonly string[] = [
  ...BROWSER_ANALYTICS_EVENTS,
  ...RETIRED_BROWSER_ANALYTICS_EVENTS,
];

export const BROWSER_ANALYTICS_EVENT_SET: ReadonlySet<string> = new Set(BROWSER_ANALYTICS_EVENTS);

// Il termine pubblicato su /privacy §6 e registrato nel registro dei
// trattamenti. Un ciclo di stagione sportiva piu' il confronto anno su anno,
// sotto il tetto di 25 mesi raccomandato per gli identificatori di analytics.
// Cambiarlo qui cambia il job: la pagina va aggiornata nello stesso commit.
export const ANALYTICS_SESSION_RETENTION_INTERVAL = "14 months";

const placeholders = (values: readonly string[], offset = 0) =>
  values.map((_, i) => `$${offset + i + 1}`).join(", ");

export type SqlFragment = { where: string; params: unknown[] };

/**
 * Righe il cui identificatore pseudonimo ha superato i 14 mesi.
 * Il predicato e' uno solo, condiviso da conteggio e UPDATE: se divergessero,
 * il job direbbe di aver ripulito righe diverse da quelle che ha toccato.
 */
export function expiredPseudonymousRows(): SqlFragment {
  const ev = PSEUDONYMOUS_EVENTS;
  return {
    where:
      `session_id IS NOT NULL ` +
      `AND event_type IN (${placeholders(ev)}) ` +
      `AND created_at < now() - ($${ev.length + 1})::interval`,
    params: [...ev, ANALYTICS_SESSION_RETENTION_INTERVAL],
  };
}

/**
 * Righe scadute con un identificatore che il job non sa classificare: ne'
 * browser ne' server. Non le tocca — le SEGNALA. Un allowlist che tace
 * quando incontra qualcosa di nuovo e' un allowlist che conserva per sempre
 * senza dirlo, ed e' esattamente il difetto che questo job chiude.
 */
export function unclassifiedExpiredRows(): SqlFragment {
  const known = [...PSEUDONYMOUS_EVENTS, ...SERVER_WRITTEN_EVENTS];
  return {
    where:
      `session_id IS NOT NULL ` +
      `AND event_type NOT IN (${placeholders(known)}) ` +
      `AND created_at < now() - ($${known.length + 1})::interval`,
    params: [...known, ANALYTICS_SESSION_RETENTION_INTERVAL],
  };
}
