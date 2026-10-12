// Shared presentational pieces of the v6 design (docs/design-v6/README.md §3):
// the status chip (icon + label, never colour alone), the «why ▸» inline
// disclosure, section titles, the lock glyph for «not measured».

import type { ReactNode } from "react";
import type { KpiStatus } from "@/core/kpi";

/** How a number is shown: the KpiStatus plus the ESTIMATE flavour of PROXY. */
export type Mark = KpiStatus | "EST";

// "LIVE" in the data model means "counted directly": the UI word is «Counted»
// so a snapshot page never carries a badge that reads like "live data". The
// identifiers in core/ and in the tests (LIVE/PROXY/MANCA/ERRORE) do not change:
// MANCA renders as «not measured», ERRORE as «Error».
export const MARK_LABEL: Record<Mark, string> = { LIVE: "Counted", PROXY: "Proxy", EST: "Estimated", MANCA: "not measured", ERRORE: "Error" };
const MARK_GLYPH: Record<Exclude<Mark, "MANCA">, string> = { LIVE: "●", PROXY: "◐", EST: "≈", ERRORE: "△" };

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="5.5" width="8" height="5.5" rx="1" />
      <path d="M4 5.5V3.8a2 2 0 0 1 4 0v1.7" />
    </svg>
  );
}

export function Chip({ mark, title }: { mark: Mark; title?: string }) {
  return (
    <span className="g-chip" data-s={mark} title={title}>
      {mark === "MANCA" ? <LockIcon /> : <span aria-hidden="true">{MARK_GLYPH[mark]}</span>}
      {MARK_LABEL[mark]}
    </span>
  );
}

/** «why ▸»: the definition opens in line under the number, never in a side panel. */
export function Why({ label = "why", children, className = "" }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <details className={`g-why ${className}`}>
      <summary>
        {label} <span className="g-caret" aria-hidden="true">▸</span>
      </summary>
      <div className="g-why-body">{children}</div>
    </details>
  );
}

export function SectionTitle({ id, title, hint, children }: { id?: string; title: string; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="g-h g-h--section">
        {title}
      </h2>
      {hint && <span className="g-caveat">{hint}</span>}
      {children}
    </div>
  );
}

/** Number locale of the whole UI (thousands «,», decimals «.»). Times stay in Europe/Rome. */
export const LOCALE = "en-US";
export const fmtInt = (n: number) => n.toLocaleString(LOCALE);
export const fmtSigned = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmtInt(Math.abs(n));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** YYYY-MM-DD (already a Rome calendar day) → «Oct 7»: month spelled out, never ambiguous between DD/MM and MM/DD. */
export const fmtDay = (ymd: string) => `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;

// The attribution holes and the internal/test row are Italian DATA keys (written
// by core/sql.ts and core/estimate.ts, stored in the snapshot): translated only here,
// at render time, so the queries and the stored data never change.
const SOURCE_LABEL: Record<string, string> = {
  "(nessuna fonte)": "(no source)",
  "(diretto / nessuna fonte)": "(direct / no source)",
  "(non registrata)": "(not recorded)",
  "(signup senza sessione)": "(signup without session)",
  "(sessione senza page_view nella finestra)": "(session without a page_view in the window)",
  "(interni/test, esclusi)": "(internal/test, excluded)",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s;
