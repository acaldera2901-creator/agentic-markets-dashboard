// Shared presentational pieces of the v6 design (docs/design-v6/README.md §3):
// the status chip (icon + label, never colour alone), the «perché ▸» inline
// disclosure, section titles, the lock glyph for «non misurato».

import type { ReactNode } from "react";
import type { KpiStatus } from "@/core/kpi";

/** How a number is shown: the KpiStatus plus the ESTIMATE flavour of PROXY. */
export type Mark = KpiStatus | "EST";

// "LIVE" in the data model means "counted directly": the UI word is «Contato»
// so a snapshot page never carries a badge that reads like "live data". The
// identifier in core/ and in the tests does not change.
export const MARK_LABEL: Record<Mark, string> = { LIVE: "Contato", PROXY: "Proxy", EST: "Stimato", MANCA: "non misurato", ERRORE: "Errore" };
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

/** «perché ▸»: the definition opens in line under the number, never in a side panel. */
export function Why({ label = "perché", children, className = "" }: { label?: string; children: ReactNode; className?: string }) {
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

export const fmtInt = (n: number) => n.toLocaleString("it-IT");
export const fmtSigned = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmtInt(Math.abs(n));
export const fmtDay = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
