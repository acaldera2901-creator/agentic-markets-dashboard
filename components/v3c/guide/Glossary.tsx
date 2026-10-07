"use client";
// components/v3c/guide/Glossary.tsx (#REDESIGN-V3C fixui · UX-AUDIT #2, §5)
// Un solo pannello «How to read this page», stesso testo ovunque: le nove voci del
// UX-AUDIT §5 (lib/v3c/guide-copy). Il dialogo è montato UNA volta dalla cornice
// (Chrome.SiteFrame); lo aprono il link nella legenda della board, nella pagina
// partita e nel piè, e i bottoni «i» accanto a Market, Estimate, Gap, Sealed e
// Margin removed — ognuno porta la sua voce in evidenza. <dialog> nativo: focus
// intrappolato, Esc chiude, il focus torna al bottone che l'ha aperto.
// Il bottone «i» non sta mai dentro un link o una riga cliccabile (niente
// interattivi annidati): solo in legende ed etichette.
import { useEffect, useRef, useState } from "react";
import { GLOSSARY_KEYS, guideCopyFor, type GlossaryKey } from "@/lib/v3c/guide-copy";
import { useV3cLang } from "@/lib/v3c/lang.client";

const EVT = "v3c-glossary";

/** Apre il pannello, con la voce `term` in evidenza (nessuna = in cima). */
export function openGlossary(term?: GlossaryKey | null) {
  window.dispatchEvent(new CustomEvent<GlossaryKey | null>(EVT, { detail: term ?? null }));
}

export function GlossaryDialog({ locale, methodHref = "/how-it-works" }: { locale?: string; methodHref?: string }) {
  const saved = useV3cLang();
  const g = guideCopyFor(locale ?? saved).glossary;
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const [focus, setFocus] = useState<GlossaryKey | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      opener.current = document.activeElement;
      setFocus((e as CustomEvent<GlossaryKey | null>).detail);
      const d = ref.current;
      if (d && !d.open) {
        if (typeof d.showModal === "function") d.showModal();
        else d.setAttribute("open", "");
      }
    };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`v3c-gls-${focus}`)?.scrollIntoView({ block: "nearest" });
  }, [focus]);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="v3c-gls"
      aria-labelledby="v3c-gls-h"
      onClose={() => {
        setFocus(null);
        const o = opener.current;
        if (o instanceof HTMLElement) o.focus();
      }}
      onClick={(e) => {
        // clic sul fondale (fuori dal riquadro) = chiudi
        if (e.target === ref.current) close();
      }}
    >
      <div className="v3c-gls-in">
        <div className="v3c-gls-head">
          <h2 className="v3c-t-sec" id="v3c-gls-h">
            {g.title}
          </h2>
          <button type="button" className="v3c-gls-x" onClick={close} aria-label={g.close}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        </div>
        <dl className="v3c-gls-list">
          {GLOSSARY_KEYS.map((k) => (
            <div key={k} id={`v3c-gls-${k}`} className={k === focus ? "v3c-gls-row v3c-gls-on" : "v3c-gls-row"}>
              <dt>{g.terms[k][0]}</dt>
              <dd>{g.terms[k][1]}</dd>
            </div>
          ))}
        </dl>
        <p className="v3c-gls-foot">
          <a className="v3c-ghost" href={methodHref}>
            {g.method} →
          </a>
        </p>
      </div>
    </dialog>
  );
}

/** Il bottone «i» accanto a un termine. `label` = il termine com'è scritto lì (nome accessibile). */
export function InfoButton({ term, label }: { term: GlossaryKey; label?: string }) {
  const g = guideCopyFor(useV3cLang()).glossary;
  return (
    <button
      type="button"
      className="v3c-gls-i"
      aria-haspopup="dialog"
      aria-label={g.info(label ?? g.terms[term][0])}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openGlossary(term);
      }}
    >
      <span aria-hidden="true">i</span>
    </button>
  );
}

/** Il link testuale «How to read this page». */
export function GlossaryLink({ className, locale }: { className?: string; locale?: string }) {
  const saved = useV3cLang();
  const g = guideCopyFor(locale ?? saved).glossary;
  return (
    <button type="button" className={["v3c-gls-link", className].filter(Boolean).join(" ")} aria-haspopup="dialog" onClick={() => openGlossary()}>
      {g.title}
    </button>
  );
}
