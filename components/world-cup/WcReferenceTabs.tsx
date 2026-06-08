"use client";

// Tabbed reference block for the WC hub (Who wins / Groups / Calendar /
// Squads). Collapses four long stacked sections into one, so the page stops
// being a dispersive endless scroll below the board. Content is server-
// rendered and passed in as nodes; all panels stay mounted (hidden when
// inactive) so the public groups/calendar/squads stay crawlable.
import { useEffect, useState, type ReactNode } from "react";

type Tab = { id: string; label: string; content: ReactNode };

export default function WcReferenceTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  // Sidebar "jump links" (and WinnerOddsCompact) navigate via #hash — switch to
  // the matching tab and scroll the block into view instead of a dead anchor.
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "");
      if (tabs.some((t) => t.id === h)) {
        setActive(h);
        document.getElementById("wc-reference")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [tabs]);

  return (
    <div id="wc-reference" className="wc-ref">
      <div className="wc-ref-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={`wc-ref-tab${active === t.id ? " active" : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
