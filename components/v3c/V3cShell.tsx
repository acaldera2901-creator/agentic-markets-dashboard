"use client";
// components/v3c/V3cShell.tsx (#REDESIGN-V3C F1)
// Il contenitore del design system: porta [data-theme="v3c"] (token), il modo
// chiaro/scuro (data-mode) e le variabili dei font. Il modo iniziale arriva
// dal server (query ?mode=), il toggle lo cambia qui e lo scrive nella URL
// senza ricaricare, così uno scatto o un link lo riproducono.
import { useCallback, useState, type ReactNode } from "react";
import type { V3cMode } from "@/lib/v3c/mode";

export type { V3cMode };

type Props = { initialMode: V3cMode; fontClass: string; children: (mode: V3cMode, toggle: () => void) => ReactNode };

export function V3cShell({ initialMode, fontClass, children }: Props) {
  const [mode, setMode] = useState<V3cMode>(initialMode);
  const toggle = useCallback(() => {
    setMode((m) => {
      const next: V3cMode = m === "dark" ? "light" : "dark";
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("mode", next);
        window.history.replaceState(null, "", url);
      } catch {
        /* la URL è una comodità, non un requisito */
      }
      return next;
    });
  }, []);
  return (
    <div data-theme="v3c" data-mode={mode} className={`${fontClass} v3c-page`}>
      {children(mode, toggle)}
    </div>
  );
}

/** Il bottone carta/scuro: sole o luna disegnati a tratto, stato nell'aria-label. */
export function ThemeToggle({ mode, onToggle }: { mode: V3cMode; onToggle: () => void }) {
  const dark = mode === "dark";
  return (
    <button type="button" className="v3c-theme" onClick={onToggle} aria-label={dark ? "Switch to paper" : "Switch to dark"} aria-pressed={dark}>
      {dark ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M13 10.5A6 6 0 1 1 5.5 3a5 5 0 0 0 7.5 7.5z" />
        </svg>
      )}
    </button>
  );
}
