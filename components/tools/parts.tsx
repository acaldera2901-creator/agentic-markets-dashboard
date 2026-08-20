"use client";
// components/tools/parts.tsx (#TOOLS-HUB-0805)
// Pezzi condivisi dai cinque calcolatori: un campo etichettato, una riga di
// readout e le formattazioni. Tutto qui dentro rispetta la regola del modulo di
// matematica: se il valore non è calcolabile si mostra il trattino, non "NaN".

import { useId } from "react";

export function Field({
  label,
  value,
  onChange,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <label className="tl-field" htmlFor={id}>
      <span className="tl-field-lab">{label}</span>
      <span className="tl-field-box">
        <input
          id={id}
          className="tl-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          // Il nome accessibile viene da qui e non dal testo del <label>: il
          // suffisso "%" vive dentro l'etichetta e altrimenti finirebbe letto
          // due volte ("Your probability (%) %").
          aria-label={label}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix ? (
          <span className="tl-field-suffix" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function Readout({
  label,
  value,
  testId,
  tone,
  strong,
}: {
  label: string;
  value: string;
  testId: string;
  tone?: "up" | "down" | "flat";
  strong?: boolean;
}) {
  return (
    <div className={`tl-out ${strong ? "is-strong" : ""}`}>
      <span className="tl-out-lab">{label}</span>
      <span className={`tl-out-val ${tone ? `is-${tone}` : ""}`} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tl-seg-wrap" role="group" aria-label={label}>
      <span className="tl-field-lab">{label}</span>
      <div className="tl-seg">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`tl-seg-btn ${value === o.id ? "is-on" : ""}`}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── formattazioni ───────────────────────────
// `dash` arriva dal dizionario (common.invalid) così il trattino resta una
// scelta editoriale e non una costante sparsa nei componenti.

export const num = (v: number | null | undefined, dash: string, digits = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? dash : v.toFixed(digits);

export const signed = (v: number | null | undefined, dash: string, digits = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? dash
    : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;

export const pct = (v: number | null | undefined, dash: string, digits = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? dash : `${(v * 100).toFixed(digits)}%`;

export const signedPct = (v: number | null | undefined, dash: string, digits = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? dash
    : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

export const toneOf = (v: number | null | undefined): "up" | "down" | "flat" | undefined => {
  if (v === null || v === undefined || !Number.isFinite(v)) return undefined;
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "flat";
};

/** Percentuale scritta da un umano ("55" o "55,5") → probabilità 0..1. */
export function parsePercent(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s) / 100;
  return n > 0 && n < 1 ? n : null;
}

/** Importo scritto da un umano → numero positivo. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}
