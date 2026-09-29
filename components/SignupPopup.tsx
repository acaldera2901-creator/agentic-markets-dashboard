"use client";

// components/SignupPopup.tsx — #SIGNUP-POPUP-D-0928
//
// Gancio D: il pop-up d'iscrizione DIFFERITO. Design di psicologia-persuasione
// (scratchpad popup-design.md): arriva dopo 90 s di tempo attivo, solo se
// l'utente ha già scrollato oltre la prima schermata o aperto una card, e solo
// in una pausa di 3 s. Fogg B=MAP: all'ingresso la motivazione è zero perché
// non si è ancora visto niente; dopo un minuto e mezzo di lucchetti esiste già
// e il prompt la incontra, non la crea. Regole e copy in lib/signup-popup.ts.
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
// Il timer: un solo setTimeout sul tempo residuo, che si ferma a `hidden` e
// riparte a `visible` (visibilitychange). I listener di scroll/tasti/tocco sono
// passivi e aggiornano un ref. Il polling (500 ms) parte SOLO dopo che il timer
// è scaduto: prima di allora la pagina non paga nulla.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/house-banners";
import { trackEvent } from "@/lib/track-event";
import { showcaseAllowance } from "@/lib/access-projection";
import {
  SIGNUP_POPUP_ACTIVE_MS, SIGNUP_POPUP_COPY, SIGNUP_POPUP_POLL_MS,
  gdprConsentDecided, markSignupPopupShown, readSignupPopupMemory, readSignupPopupSession,
  recordSignupPopupDismissal, recordSignupPopupNever,
  signupPopupEligible, signupPopupEngaged, signupPopupPauseOk, signupPopupPlanRows,
  type SignupPopupAudience,
} from "@/lib/signup-popup";

export type SignupPopupProps = {
  lang: Lang;
  /** null = non montare la logica (Base/Pro, sessione non ancora verificata…). */
  audience: SignupPopupAudience | null;
  /** Un dettaglio partita è aperto adesso. Vale sia come engagement (una card
   *  aperta, latch) sia come «non adesso» (si aspetta che la chiuda). */
  cardOpen: boolean;
  /** Qualunque altro overlay (auth, checkout, founder): non ci si somma. */
  overlayOpen: boolean;
  /** Righe coperte oggi (conteggio reale), per la variante Free. */
  lockedToday: number | null;
  /** Letture chiuse dal DB, per la riga di prova sociale. null = riga assente. */
  settledCount: number | null;
  onCreateProfile: () => void;
  onComparePlans: () => void;
};

type Phase = "idle" | "visible" | "closed";

const isFieldFocused = (): boolean => {
  const el = document.activeElement;
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable === true;
};

export function SignupPopup({ lang, audience, cardOpen, overlayOpen, lockedToday, settledCount, onCreateProfile, onComparePlans }: SignupPopupProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const engagedRef = useRef(false);
  const overlayRef = useRef(overlayOpen);
  const lastInteractionRef = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    overlayRef.current = overlayOpen || cardOpen;
  }, [overlayOpen, cardOpen]);
  useEffect(() => {
    if (cardOpen) engagedRef.current = true;
    // Aprire o chiudere una scheda è un gesto: la pausa riparte da qui.
    lastInteractionRef.current = Date.now();
  }, [cardOpen]);

  useEffect(() => {
    if (!audience || phase !== "idle") return;
    // Pre-check economico: se la memoria o la sessione dicono no, non si
    // installa nemmeno un listener. Il consenso si rivaluta al momento dello
    // show (può arrivare durante i 90 secondi).
    if (!signupPopupEligible({ audience, memory: readSignupPopupMemory(), session: readSignupPopupSession(), consentDecided: true })) return;

    let activeMs = 0;
    let since: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let armed = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let done = false;
    lastInteractionRef.current = Date.now();

    const stopPoll = () => { if (poll) { clearInterval(poll); poll = null; } };
    const clearArm = () => { if (timeout) { clearTimeout(timeout); timeout = null; } };

    const tryShow = () => {
      if (done) return;
      const now = Date.now();
      const engaged = signupPopupEngaged({ scrollY: window.scrollY, viewportH: window.innerHeight, cardOpened: engagedRef.current });
      if (!engaged) return;
      if (!signupPopupPauseOk({ now, lastInteractionAt: lastInteractionRef.current, overlayOpen: overlayRef.current, fieldFocused: isFieldFocused(), visible: document.visibilityState === "visible" })) return;
      // Rilettura: un blocker (piani aperti, CTA cliccata, registrazione) può
      // essere arrivato durante l'attesa, e il consenso cookie può mancare ancora.
      if (!signupPopupEligible({ audience, memory: readSignupPopupMemory(), session: readSignupPopupSession(), consentDecided: gdprConsentDecided(), now })) return;
      done = true;
      teardown();
      markSignupPopupShown();
      trackEvent("signup_popup_shown", { meta: { audience } });
      setPhase("visible");
    };

    const startPoll = () => { if (!poll && armed && !done) poll = setInterval(tryShow, SIGNUP_POPUP_POLL_MS); };
    const schedule = () => {
      if (since === null || armed || done) return;
      clearArm();
      timeout = setTimeout(() => { armed = true; timeout = null; startPoll(); }, Math.max(0, SIGNUP_POPUP_ACTIVE_MS - activeMs));
    };

    const onVisibility = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        if (since === null) since = now;
        lastInteractionRef.current = now; // rientrare è un gesto: pausa da capo
        schedule();
        startPoll();
      } else {
        if (since !== null) { activeMs += now - since; since = null; }
        clearArm();
        stopPoll();
      }
    };
    const onScroll = () => {
      lastInteractionRef.current = Date.now();
      if (!engagedRef.current && signupPopupEngaged({ scrollY: window.scrollY, viewportH: window.innerHeight, cardOpened: false })) engagedRef.current = true;
    };
    const onInteract = () => { lastInteractionRef.current = Date.now(); };

    const teardown = () => {
      clearArm();
      stopPoll();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onInteract);
      window.removeEventListener("touchmove", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("pointerdown", onInteract);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onInteract, { passive: true });
    window.addEventListener("touchmove", onInteract, { passive: true });
    window.addEventListener("keydown", onInteract, { passive: true });
    window.addEventListener("pointerdown", onInteract, { passive: true });
    schedule();
    return teardown;
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
  const rows = signupPopupPlanRows(lang);
  const cta = (kind: "primary" | "plans") => {
    trackEvent("signup_popup_cta_click", { meta: { audience, cta: kind } });
    close("cta");
    if (kind === "plans" || free) onComparePlans();
    else onCreateProfile();
  };

  return (
    // L'host copre la porzione visibile solo per centrare: pointer-events none,
    // quindi non è un velo e non intercetta niente (test «non blocca il board»).
    <div className="br-nudge-host" data-testid="signup-popup-host">
    <aside ref={cardRef} className="br-nudge" role="region" aria-labelledby="br-nudge-title" data-audience={audience} data-testid="signup-popup">
      <button type="button" className="br-nudge__x" onClick={() => close("x")} aria-label={c.close}>×</button>
      <p className="br-label br-nudge__eyebrow">{free ? c.eyebrowFree : c.eyebrowAnon}</p>
      <h2 id="br-nudge-title" ref={titleRef} tabIndex={-1} className="br-nudge__title">{free ? c.titleFree : c.titleAnon}</h2>
      <p className="br-nudge__body">{free ? c.bodyFree(lockedToday, showcaseAllowance("base")) : c.bodyAnon}</p>

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
        <button type="button" className="br-cta" data-tone="primary" onClick={() => cta("primary")}>{free ? c.ctaFree : c.ctaAnon}</button>
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
