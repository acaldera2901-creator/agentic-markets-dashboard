"use client";

// Shared language dropdown for the three site lang switchers (landing topnav,
// desk topbar, World Cup chrome). Presentation + a11y only: the parent owns the
// language state and the side effects (localStorage write, ctx update, event
// dispatch). We just render the current value and call onSelect with the picked
// code. Sleek-coral, theme-aware via --am-* tokens, works in dark and light.

import { useEffect, useId, useRef, useState } from "react";

export type LangCode = "en" | "it" | "es" | "fr" | "ru";

const LANG_OPTIONS: { code: LangCode; name: string }[] = [
  { code: "en", name: "English" },
  { code: "it", name: "Italiano" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "ru", name: "Русский" },
];

export default function LangDropdown({
  value,
  onSelect,
  variant = "topbar",
}: {
  value: LangCode;
  onSelect: (lang: LangCode) => void;
  // `topbar` matches .am-iconbtn (desk + WC), `landing` matches .lp-lang.
  variant?: "topbar" | "landing";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const menuId = useId();

  // Close on outside click + Escape; only listen while open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Move focus into the list when opened so keyboard users land on the active item.
  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector<HTMLButtonElement>('[data-active="1"]');
      (active ?? listRef.current.querySelector<HTMLButtonElement>("button"))?.focus();
    }
  }, [open]);

  const pick = (code: LangCode) => {
    onSelect(code);
    setOpen(false);
  };

  const onItemKey = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>("button");
    if (!items || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  };

  const triggerClass = variant === "landing" ? "lp-lang lang-dd-trigger" : "am-iconbtn lang-dd-trigger";

  return (
    <div className="lang-dd" ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Language"
        onClick={() => setOpen((v) => !v)}
      >
        {value.toUpperCase()}
        <span className="lang-dd-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <ul className="lang-dd-menu" id={menuId} role="listbox" aria-label="Language" ref={listRef}>
          {LANG_OPTIONS.map((opt, idx) => {
            const isActive = opt.code === value;
            return (
              <li key={opt.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive ? "1" : "0"}
                  className="lang-dd-item"
                  onClick={() => pick(opt.code)}
                  onKeyDown={(e) => onItemKey(e, idx)}
                >
                  <span className="lang-dd-name">{opt.name}</span>
                  <span className="lang-dd-code">{opt.code.toUpperCase()}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
