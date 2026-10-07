"use client";
// components/v3c/guide/MoreMenu.tsx (#REDESIGN-V3C fixui · QA percorso 6, UX-AUDIT #11)
// La sesta voce della barra in basso: le cinque restano (Board · Tools · Price ·
// Record · Books) e «More» apre, sopra la barra, News · Method · Pricing e la lingua —
// su mobile prima stavano solo nel piè. Un bottone con aria-expanded e un pannello:
// Esc chiude e riporta il focus al bottone, un tocco fuori chiude.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function MoreMenu({ label, title, active, children }: { label: string; title: string; active?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const out = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", out);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", out);
    };
  }, [open]);

  return (
    <li ref={box} className="v3c-more-li">
      <button ref={btn} type="button" className="v3c-more-b" aria-expanded={open} aria-controls={id} aria-current={active ? "page" : undefined} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true">
          {/* tre righe corte: «il resto del sito», stessa grammatica dei glifi della barra */}
          <path d="M4 6h12M4 10h12M4 14h7" />
        </svg>
        {label}
      </button>
      <div id={id} className="v3c-more" role="region" aria-label={title} hidden={!open}>
        {children}
      </div>
    </li>
  );
}
