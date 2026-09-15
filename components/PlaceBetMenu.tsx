// components/PlaceBetMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { BetSelection, BetLinkOption } from "@/lib/sportsbooks/types";
import { trackEvent } from "@/lib/track-event";

// CTA "Piazza scommessa" + dropdown dei book affiliati.
// Mostrato dal parent SOLO quando betLinksEnabled è true (geo-gate server-side).
// Le opzioni sono caricate lazy all'apertura. Noi non gestiamo mai fondi/scommesse.
export function PlaceBetMenu({
  selection,
  label,
  disclaimer,
  buttonClassName = "bonus-cta",
}: {
  selection: BetSelection;
  label: string;
  disclaimer: string;
  buttonClassName?: string;
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

  async function toggle() {
    const next = !open;
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

  // analytics beacon fire-and-forget: non blocca mai la navigazione.
  // #ATTRIB-EVERYWHERE-0915: passa da lib/track-event invece di rifare la POST
  // a mano. Questa copia non mandava né lingua né session_id, quindi il click su
  // "piazza scommessa" — l'ultimo gradino del funnel — era l'unico evento che
  // non si poteva legare alla sessione che l'aveva generato nemmeno col consenso
  // dato. `keepalive` ora vive dentro trackEvent, quindi non si perde nulla.
  function track(book: string) {
    trackEvent("sportsbook_click", { meta: { book, sport: selection.sport } });
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
