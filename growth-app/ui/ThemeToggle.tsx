"use client";

// Paper / navy switch. The source of truth is the data-theme attribute on
// <html> (set before first paint by app/layout.tsx from localStorage); this
// component only reads it and writes it. Without storage (private window,
// blocked site data) the choice still applies, it just is not remembered.

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const KEY = "growth-theme";

const read = (): Theme => (typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const serverSnapshot = (): Theme => "light";
function subscribe(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function apply(next: Theme) {
  if (next === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, serverSnapshot);
  return (
    <div className="g-theme" role="group" aria-label="Tema">
      <button type="button" data-v="light" aria-pressed={theme === "light"} onClick={() => apply("light")}>
        Carta
      </button>
      <button type="button" data-v="dark" aria-pressed={theme === "dark"} onClick={() => apply("dark")}>
        Navy
      </button>
    </div>
  );
}
