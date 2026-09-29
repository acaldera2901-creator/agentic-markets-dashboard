"use client";

// components/SignupPopup.tsx — #SIGNUP-POPUP-D-0928
//
// Gancio D: il pop-up d'iscrizione/upgrade. #SESSION-POPUP-0929 (direttiva
// Andrea, 29/09): compare al PRIMO caricamento della sessione, su qualunque tab
// del desk, una volta per sessione; anonimo → profilo gratuito, Free → Base,
// Base → Pro. Sostituisce il trigger differito del 28/09 (90 s attivi +
// engagement + pausa, design psicologia-persuasione). Resta ciò che non si
// somma: aspetta finché c'è un overlay aperto (muro auth, checkout, una scheda
// partita), il banner cookie senza risposta, o la scheda nascosta. Regole e
// copy in lib/signup-popup.ts.
//
// NON è una modale, anche se sta al centro (#SIGNUP-POPUP-CENTER-0929, richiesta
// di Andrea sull'anteprima: «al centro della pagina, non nell'angolo»). Il
// compromesso: la card è centrata nella porzione visibile, ma il contenitore
// (`.br-nudge-host`) ha pointer-events: none — nessun velo, nessun blocco dello
// scroll, nessuna trappola del focus; il board sotto resta cliccabile e
// scrollabile. Un click fuori dalla card la chiude E arriva al board: il gesto
// dell'utente non va perso. Focus sul titolo all'apertura, restituito alla
// chiusura (non dopo un click fuori: lì il focus è dove l'utente ha cliccato),
// Esc chiude. «Non ora» ha la stessa geometria della CTA (griglia 1fr 1fr):
// la simmetria è nella struttura, non nella disciplina di chi edita — lo stesso
// principio della CookieBanner (EDPB). Divergono solo per tinta.
//
// Cosa NON c'è, di proposito: countdown, «solo oggi», badge «più scelto»,
// conteggi di utenti, chiusura colpevolizzante. La riga di prova sociale compare
// solo con un numero vero dal DB (letture chiuse), altrimenti non c'è.
//
// Il trigger: un polling a 500 ms dal mount, finché compare o la sessione lo
// esclude; poi si ferma. Nessun listener di scroll/tasti.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/house-banners";
import { trackEvent } from "@/lib/track-event";
import { showcaseAllowance } from "@/lib/access-projection";
import {
  SIGNUP_POPUP_COPY, SIGNUP_POPUP_POLL_MS,
  gdprConsentDecided, markSignupPopupShown, readSignupPopupMemory, readSignupPopupSession,
  recordSignupPopupDismissal, recordSignupPopupNever,
  signupPopupEligible, signupPopupPlanRows,
  type SignupPopupAudience,
} from "@/lib/signup-popup";

export type SignupPopupProps = {
  lang: Lang;
  /** null = non montare la logica (Pro, sessione non ancora verificata…). */
  audience: SignupPopupAudience | null;
  /** Un dettaglio partita è aperto adesso: «non adesso», si aspetta che la chiuda. */
  cardOpen: boolean;
  /** Qualunque altro overlay (auth, checkout, founder): non ci si somma. */
  overlayOpen: boolean;
  /** Righe coperte oggi (conteggio reale), per le varianti Free e Base. */
  lockedToday: number | null;
  /** Letture chiuse dal DB, per la riga di prova sociale. null = riga assente. */
  settledCount: number | null;
  onCreateProfile: () => void;
  onComparePlans: () => void;
};

type Phase = "idle" | "visible" | "closed";

export function SignupPopup({ lang, audience, cardOpen, overlayOpen, lockedToday, settledCount, onCreateProfile, onComparePlans }: SignupPopupProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const overlayRef = useRef(overlayOpen);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    overlayRef.current = overlayOpen || cardOpen;
  }, [overlayOpen, cardOpen]);

  useEffect(() => {
    if (!audience || phase !== "idle") return;
    // Pre-check economico: se la memoria o la sessione dicono no, niente
    // polling. Il consenso si rivaluta a ogni tick (può arrivare dopo).
    if (!signupPopupEligible({ audience, memory: readSignupPopupMemory(), session: readSignupPopupSession(), consentDecided: true })) return;

    const poll = setInterval(() => {
      if (overlayRef.current || document.visibilityState !== "visible") return;
      // Rilettura: un blocker (piani aperti, CTA cliccata, registrazione) può
      // essere arrivato nel frattempo, e il consenso cookie può mancare ancora.
      const session = readSignupPopupSession();
      const memory = readSignupPopupMemory();
      if (!signupPopupEligible({ audience, memory, session, consentDecided: true })) { clearInterval(poll); return; }
      if (!gdprConsentDecided()) return;
      clearInterval(poll);
      markSignupPopupShown();
      trackEvent("signup_popup_shown", { meta: { audience } });
      setPhase("visible");
    }, SIGNUP_POPUP_POLL_MS);
    return () => clearInterval(poll);
  }, [audience, phase]);

  // Apertura: focus sul titolo (tabIndex -1), ricordando da dove si viene.
  useEffect(() => {
    if (phase !== "visible") return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const close = useCallback((reason: "x" | "not_now" | "esc" | "never" | "cta" | "outside") => {
    if (reason === "never") recordSignupPopupNever();
    else recordSignupPopupDismissal();
    if (reason !== "cta") trackEvent("signup_popup_dismissed", { meta: { audience, reason } });
    setPhase("closed");
    // Dopo un click fuori il focus è già dove l'utente ha cliccato: non glielo
    // si toglie per riportarlo indietro.
    if (reason === "outside") return;
    const back = restoreFocusRef.current;
    if (back && document.contains(back)) back.focus({ preventScroll: true });
  }, [audience]);

  useEffect(() => {
    if (phase !== "visible") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close("esc"); };
    // Click/tocco fuori dalla card: chiude. Non si ferma l'evento (nessun
    // preventDefault/stopPropagation): il board riceve il gesto come se la card
    // non ci fosse — è la differenza fra questo e un velo modale.
    const onPointerDown = (e: PointerEvent) => {
      const card = cardRef.current;
      if (!card || !(e.target instanceof Node) || card.contains(e.target)) return;
      close("outside");
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [phase, close]);

  if (phase !== "visible" || !audience) return null;

  const c = SIGNUP_POPUP_COPY[lang];
  const free = audience === "free";
  const base = audience === "base";
  const rows = signupPopupPlanRows(lang);
  const cta = (kind: "primary" | "plans") => {
    trackEvent("signup_popup_cta_click", { meta: { audience, cta: kind } });
    close("cta");
    if (kind === "plans" || audience !== "anon") onComparePlans();
    else onCreateProfile();
  };

  return (
    // L'host copre la porzione visibile solo per centrare: pointer-events none,
    // quindi non è un velo e non intercetta niente (test «non blocca il board»).
    <div className="br-nudge-host" data-testid="signup-popup-host">
    <aside ref={cardRef} className="br-nudge" role="region" aria-labelledby="br-nudge-title" data-audience={audience} data-testid="signup-popup">
      <button type="button" className="br-nudge__x" onClick={() => close("x")} aria-label={c.close}>×</button>
      <p className="br-label br-nudge__eyebrow">{base ? c.eyebrowBase : free ? c.eyebrowFree : c.eyebrowAnon}</p>
      <h2 id="br-nudge-title" ref={titleRef} tabIndex={-1} className="br-nudge__title">{base ? c.titleBase : free ? c.titleFree : c.titleAnon}</h2>
      <p className="br-nudge__body">{base ? c.bodyBase(lockedToday) : free ? c.bodyFree(lockedToday, showcaseAllowance("base")) : c.bodyAnon}</p>

      <dl className="br-nudge__plans">
        {rows.map((r) => (
          <div className="br-nudge__plan" data-plan={r.key} key={r.key}>
            <dt className="br-nudge__plan-k">{r.name}</dt>
            <dd className="br-nudge__plan-p">{r.price}{r.per ? <small>{r.per}</small> : null}</dd>
            {r.perDay ? <dd className="br-nudge__plan-u">{r.perDay}</dd> : null}
            <dd className="br-nudge__plan-a">{r.allowance}</dd>
          </div>
        ))}
      </dl>

      {settledCount != null && settledCount > 0 ? (
        <p className="br-nudge__proof">{c.proof(settledCount)}</p>
      ) : null}

      <div className="br-nudge__actions">
        <button type="button" className="br-cta" data-tone="primary" onClick={() => cta("primary")}>{base ? c.ctaBase : free ? c.ctaFree : c.ctaAnon}</button>
        <button type="button" className="br-cta" data-tone="quiet" onClick={() => close("not_now")}>{c.notNow}</button>
      </div>
      <div className="br-nudge__links">
        <button type="button" data-kind="compare" onClick={() => cta("plans")}>{c.compare}</button>
        <button type="button" data-kind="never" onClick={() => close("never")}>{c.never}</button>
      </div>
      <p className="br-nudge__legal">
        {/* La coda «18+ · Gioco responsabile» è un'unità (nowrap): l'unico punto
            di a-capo possibile è prima del 18+, mai un «·» orfano a inizio riga. */}
        {c.legal}{" · "}
        <span className="br-nudge__legal-tail">18+ · <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer">{c.legalLink}</a></span>
      </p>
    </aside>
    </div>
  );
}
