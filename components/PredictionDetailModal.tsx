"use client";

// PREDICTION DETAIL MODAL — #CARDS-DETAIL-MODAL-0623
// Unico shell riusabile (calcio · tennis · World Cup). La card della griglia
// resta una sintesi compatta; al click si "ingrandisce" in una scheda-dettaglio
// completa centrata (~75% viewport) con backdrop oscurato. Niente librerie (no
// framer-motion): l'animazione "zoom dalla posizione" è puro CSS + transform
// calcolato dalla bounding-rect della card cliccata (shared-element style).
// Lo shell possiede SOLO la presentazione/interazione (zoom, backdrop, Esc,
// focus-trap, scroll-lock, layout 2 colonne, sezione "Mercati extra · in arrivo").
// Ogni card passa il proprio contenuto già costruito come slot → zero logica/dato
// spostato, presentation-only.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type DetailLang = "it" | "en" | "es" | "fr" | "ru";
function L<T>(lang: DetailLang, v: { it: T; en: T; es: T; fr: T; ru: T }): T { return v[lang]; }

// Stato + wiring condiviso: una card "ingrandibile" registra la sua rect al
// click e apre il modal. I controlli interni della card (bet/affiliate/select)
// fermano la propagazione → non aprono il modal.
export function useDetailModal(enabled: boolean) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const openModal = useCallback(() => {
    if (!enabled) return;
    if (cardRef.current) setRect(cardRef.current.getBoundingClientRect());
    setOpen(true);
  }, [enabled]);
  const close = useCallback(() => {
    setOpen(false);
    // ripristina il focus sulla card alla chiusura (dopo l'unmount del portal)
    window.setTimeout(() => cardRef.current?.focus(), 0);
  }, []);
  const onCardKey = useCallback((ev: ReactKeyboardEvent) => {
    if (!enabled) return;
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openModal(); }
  }, [enabled, openModal]);
  // props da spalmare sull'elemento `.pred` quando è ingrandibile
  const cardProps = enabled
    ? { ref: cardRef, role: "button" as const, tabIndex: 0, "aria-haspopup": "dialog" as const, onClick: openModal, onKeyDown: onCardKey }
    : { ref: cardRef };
  return { open, rect, close, cardProps };
}

// click guard per i controlli interni alla card della griglia (non devono
// propagare al click che apre il modal).
export const stopCardClick = (ev: ReactMouseEvent | ReactKeyboardEvent) => ev.stopPropagation();

export function PredictionDetailModal({
  open, onClose, anchorRect, titleId, title, subtitle, lang, children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  titleId: string;
  title: ReactNode;
  subtitle?: ReactNode;
  lang: DetailLang;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false); // pilota la classe di stato per la transizione

  // portal target: solo dopo il mount (SSR-safe)
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) { setShown(false); return; }
    // scroll-lock del body mentre il modal è aperto
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // calcola la transform iniziale dalla rect della card → "zoom dalla posizione"
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const panel = panelRef.current;
    if (panel && anchorRect && !reduce) {
      const pr = panel.getBoundingClientRect();
      const sx = Math.max(0.2, anchorRect.width / pr.width);
      const sy = Math.max(0.2, anchorRect.height / pr.height);
      const tx = (anchorRect.left + anchorRect.width / 2) - (pr.left + pr.width / 2);
      const ty = (anchorRect.top + anchorRect.height / 2) - (pr.top + pr.height / 2);
      panel.style.transformOrigin = "center center";
      panel.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
    }
    // focus iniziale dentro il pannello (close button) al frame successivo
    const r = requestAnimationFrame(() => {
      setShown(true);
      if (panel) panel.style.transform = "";
    });
    // il focus dopo un tick (post-paint del portal) → affidabile su tutti i browser
    const tid = window.setTimeout(() => {
      const focusTarget = panel?.querySelector<HTMLElement>("[data-modal-initial-focus]");
      (focusTarget ?? panel)?.focus();
    }, 40);
    return () => {
      cancelAnimationFrame(r);
      window.clearTimeout(tid);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, anchorRect]);

  // Esc per chiudere + focus trap (Tab cicla dentro il pannello)
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") { ev.preventDefault(); onClose(); return; }
      if (ev.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (ev.shiftKey && active === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && active === last) { ev.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={`pdm-backdrop${shown ? " is-shown" : ""}`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={`pdm-panel${shown ? " is-shown" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pdm-head">
          <div className="pdm-titlewrap">
            <h2 className="pdm-title" id={titleId}>{title}</h2>
            {subtitle && <div className="pdm-sub">{subtitle}</div>}
          </div>
          <button
            type="button"
            className="pdm-close"
            data-modal-initial-focus
            onClick={onClose}
            aria-label={L(lang, { it: "Chiudi", en: "Close", es: "Cerrar", fr: "Fermer", ru: "Закрыть" })}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="pdm-body">
          {children}
          {/* NUOVA sezione predisposta — Mercati soft in costruzione. Nessun
              numero inventato: placeholder onesto "In arrivo". */}
          <section className="pdm-soon" aria-label={L(lang, { it: "Mercati extra in arrivo", en: "Extra markets coming soon", es: "Mercados extra próximamente", fr: "Marchés supplémentaires à venir", ru: "Дополнительные рынки скоро" })}>
            <div className="pdm-soon-head">
              <span className="pdm-soon-title">{L(lang, { it: "Mercati extra — Corner · Cartellini · Falli", en: "Extra markets — Corners · Cards · Fouls", es: "Mercados extra — Córners · Tarjetas · Faltas", fr: "Marchés extra — Corners · Cartons · Fautes", ru: "Доп. рынки — Угловые · Карточки · Фолы" })}</span>
              <span className="pdm-soon-tag">{L(lang, { it: "In arrivo", en: "Coming soon", es: "Próximamente", fr: "À venir", ru: "Скоро" })}</span>
            </div>
            <p className="pdm-soon-txt">
              {L(lang, {
                it: "Stiamo costruendo i modelli per i mercati soft. Compariranno qui quando i dati saranno affidabili — niente stime improvvisate.",
                en: "We are building the models for the soft markets. They'll appear here once the data is reliable — no guessed numbers.",
                es: "Estamos construyendo los modelos para los mercados soft. Aparecerán aquí cuando los datos sean fiables — sin cifras improvisadas.",
                fr: "Nous construisons les modèles pour les marchés soft. Ils apparaîtront ici une fois les données fiables — aucun chiffre improvisé.",
                ru: "Мы строим модели для soft-рынков. Они появятся здесь, когда данные будут надёжными — без выдуманных цифр.",
              })}
            </p>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
