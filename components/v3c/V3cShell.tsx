"use client";
// components/v3c/V3cShell.tsx (#REDESIGN-V3C F1)
// Il contenitore del design system: porta [data-theme="v3c"] (token), il modo
// chiaro/scuro (data-mode) e le variabili dei font. Il modo iniziale arriva
// dal server (query ?mode=), il toggle lo cambia qui e lo scrive nella URL
// senza ricaricare, così uno scatto o un link lo riproducono.
import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import type { V3cMode } from "@/lib/v3c/mode";

export type { V3cMode };

type Props = { initialMode: V3cMode; fontClass: string; children: (mode: V3cMode, toggle: () => void) => ReactNode };

const MODE_KEY = "v3c-mode";

// F3: sulle pagine di prodotto la scelta deve durare. Senza `?mode=` nella URL
// si riprende quella salvata (il server non la conosce: un frame in carta per
// chi ha scelto lo scuro è il costo noto, come la lingua). Letta come store
// esterno, così il primo render client coincide con quello del server.
function readSaved(): V3cMode | null {
  try {
    if (new URL(window.location.href).searchParams.has("mode")) return null;
    const saved = localStorage.getItem(MODE_KEY);
    return saved === "dark" || saved === "light" ? saved : null;
  } catch {
    return null; /* storage vietato: resta il modo iniziale */
  }
}
const noSubscribe = () => () => {};

export function V3cShell({ initialMode, fontClass, children }: Props) {
  const saved = useSyncExternalStore(noSubscribe, readSaved, () => null);
  const [chosen, setChosen] = useState<V3cMode | null>(null);
  const mode: V3cMode = chosen ?? saved ?? initialMode;
  const toggle = useCallback(() => {
    const next: V3cMode = mode === "dark" ? "light" : "dark";
    setChosen(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", next);
      window.history.replaceState(null, "", url);
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* la URL è una comodità, non un requisito */
    }
  }, [mode]);
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
