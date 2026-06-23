// components/PlaceBetMenu.tsx
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { BetSelection, BetLinkOption } from "@/lib/sportsbooks/types";

// CTA "Piazza scommessa" + dropdown dei book affiliati.
// Mostrato dal parent SOLO quando betLinksEnabled è true (geo-gate server-side).
// Le opzioni sono caricate lazy all'apertura. Noi non gestiamo mai fondi/scommesse.
//
// #UI-ODDS-CLICK-0623: il parent può aprire il menu via `openRef` (es. click
// sulla quota) — registriamo qui un handler open() che il parent invoca. Così la
// scelta del sportsbook è raggiungibile sia dal bottone sia dal click sull'odd,
// senza duplicare la logica /api/bet-links.
export function PlaceBetMenu({
  selection,
  label,
  disclaimer,
  buttonClassName = "bonus-cta",
  openRef,
}: {
  selection: BetSelection;
  label: string;
  disclaimer: string;
  buttonClassName?: string;
  openRef?: RefObject<(() => void) | null>;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<BetLinkOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Chiusura: click fuori dal menu + tasto Escape. Senza questo il dropdown
  // resta aperto ("non si chiude più").
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function setMenuOpen(next: boolean) {
    setOpen(next);
    if (next && options === null && !loading) {
      setLoading(true);
      try {
        const res = await fetch("/api/bet-links", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(selection),
        });
        const json = (await res.json()) as { options?: BetLinkOption[] };
        setOptions(Array.isArray(json.options) ? json.options : []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }
  }

  function toggle() {
    void setMenuOpen(!open);
  }

  // #UI-ODDS-CLICK-0623: espone open() al parent (click sulla quota) tramite ref.
  useEffect(() => {
    if (!openRef) return;
    openRef.current = () => { void setMenuOpen(true); };
    return () => { if (openRef) openRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registrazione stabile dell'handler; setMenuOpen usa state aggiornato via setter.
  }, [openRef]);

  // analytics beacon fire-and-forget: non blocca mai la navigazione.
  function track(book: string) {
    fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_type: "sportsbook_click",
        meta: { book, sport: selection.sport },
      }),
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <div className={open ? "place-bet-menu open" : "place-bet-menu"} ref={rootRef}>
      <button
        type="button"
        className={buttonClassName}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label}
      </button>
      {open && (
        <div className="place-bet-dropdown" role="menu">
          {loading && <span className="place-bet-loading">…</span>}
          {options?.map((o) => (
            <a
              key={o.id}
              role="menuitem"
              className="place-bet-option"
              href={o.url}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              onClick={() => {
                track(o.id);
                setOpen(false);
              }}
            >
              <img src={o.logo} alt="" className="place-bet-logo" width={20} height={20} />
              <span>{o.name}</span>
            </a>
          ))}
          {options !== null && options.length === 0 && !loading && (
            <span className="place-bet-empty">—</span>
          )}
          <p className="place-bet-disclaimer">{disclaimer}</p>
        </div>
      )}
    </div>
  );
}
