"use client";
// components/v3c/V3cShell.tsx (#REDESIGN-V3C F1 · F5)
// Il contenitore del design system: porta [data-theme="v3c"] (token), il modo
// chiaro/scuro (data-mode) e le variabili dei font.
//
// F1: il modo iniziale arriva dal server (query ?mode=) e i figli sono una
// funzione (mode, toggle) => nodo — resta supportato (pagina /dev/ds).
// F5: le pagine tool sono statiche (force-static) e non leggono la query sul
// server. Il modo arriva dal browser: uno script inline, eseguito mentre la
// pagina si costruisce, legge ?mode= o la scelta salvata e scrive data-mode
// PRIMA del primo paint, così chi ha scelto lo scuro non vede un lampo di
// carta. React poi allinea lo stato nel primo effetto. I figli possono essere
// nodi normali (anche Server Components) e il ThemeToggle legge il modo dal
// contesto.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { V3cMode } from "@/lib/v3c/mode";

export type { V3cMode };

const STORAGE_KEY = "v3c-mode";

type ModeCtx = { mode: V3cMode; toggle: () => void };
const ModeContext = createContext<ModeCtx | null>(null);

// document.currentScript è lo <script> stesso; il genitore è il contenitore.
const BOOT = `(function(){try{var s=document.currentScript,d=s&&s.parentNode;if(!d)return;var q=new URLSearchParams(location.search).get("mode"),m=q||localStorage.getItem("${STORAGE_KEY}");if(m==="dark"||m==="light")d.setAttribute("data-mode",m);}catch(e){}})();`;

function readBrowserMode(): V3cMode | null {
  try {
    const q = new URLSearchParams(window.location.search).get("mode");
    const m = q ?? window.localStorage.getItem(STORAGE_KEY);
    return m === "dark" || m === "light" ? m : null;
  } catch {
    return null;
  }
}

type Props = {
  initialMode?: V3cMode;
  fontClass: string;
  /** Lingua della pagina, sul contenitore (hreflang e screen reader). */
  lang?: string;
  children: ReactNode | ((mode: V3cMode, toggle: () => void) => ReactNode);
};

export function V3cShell({ initialMode = "light", fontClass, lang, children }: Props) {
  const [mode, setMode] = useState<V3cMode>(initialMode);

  useEffect(() => {
    const m = readBrowserMode();
    // Intenzionale: il tema salvato esiste solo nel browser (pagine statiche).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (m) setMode(m);
  }, []);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next: V3cMode = m === "dark" ? "light" : "dark";
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("mode", next);
        window.history.replaceState(null, "", url);
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* la URL e la memoria sono una comodità, non un requisito */
      }
      return next;
    });
  }, []);

  return (
    // suppressHydrationWarning: lo script di boot può aver già scritto data-mode
    // prima dell'idratazione; lo stato lo raggiunge nel primo effetto.
    <div data-theme="v3c" data-mode={mode} lang={lang} className={`${fontClass} v3c-page`} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <ModeContext.Provider value={{ mode, toggle }}>{typeof children === "function" ? children(mode, toggle) : children}</ModeContext.Provider>
    </div>
  );
}

type ToggleProps = {
  mode?: V3cMode;
  onToggle?: () => void;
  /** Etichette accessibili tradotte; default inglese. */
  labels?: { toPaper: string; toDark: string };
};

/** Il bottone carta/scuro: sole o luna disegnati a tratto, stato nell'aria-label. */
export function ThemeToggle({ mode, onToggle, labels }: ToggleProps) {
  const ctx = useContext(ModeContext);
  const m = mode ?? ctx?.mode ?? "light";
  const fn = onToggle ?? ctx?.toggle;
  const dark = m === "dark";
  const toPaper = labels?.toPaper ?? "Switch to paper";
  const toDark = labels?.toDark ?? "Switch to dark";
  return (
    <button type="button" className="v3c-theme" onClick={fn} aria-label={dark ? toPaper : toDark} aria-pressed={dark}>
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
