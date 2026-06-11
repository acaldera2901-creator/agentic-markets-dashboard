// components/PlaceBetMenu.tsx
"use client";

import { useState } from "react";
import type { BetSelection, BetLinkOption } from "@/lib/sportsbooks/types";

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
    <div className="place-bet-menu">
      <button
        type="button"
        className={buttonClassName}
        onClick={toggle}
        aria-expanded={open}
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
              onClick={() => track(o.id)}
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
