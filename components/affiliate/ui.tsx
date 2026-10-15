"use client";
// components/affiliate/ui.tsx — #AFFILIATE-V2-UI-1015 · pezzi piccoli condivisi.
import { useRef, useState } from "react";
import type { Chip } from "./status";

export function CheckIcon() {
  return (
    <svg className="aff-i" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg className="aff-i" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h2.5" />
    </svg>
  );
}

/** Stato = parola + forma, mai solo colore (SPEC §1). */
export function StateChip({ chip }: { chip: Chip }) {
  return (
    <span className="aff-st" data-state={chip.state}>
      {chip.check && <CheckIcon />}
      {chip.label}
    </span>
  );
}

export function ExplorerLink({ href, text, sr }: { href: string; text: string; sr: string }) {
  return (
    <a className="aff-txl" href={href} target="_blank" rel="noopener noreferrer">
      <span className="aff-addr">{text}</span>
      <ExternalIcon />
      <span className="aff-sr">{sr}</span>
    </a>
  );
}

/** Copia negli appunti, con annuncio `aria-live=polite`. Se la clipboard è negata il testo resta selezionabile. */
export function useCopy(okText: string, failText: string) {
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = async (value: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = false;
    }
    setMsg(ok ? okText : failText);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 4000);
  };
  return { msg, copy };
}

export function Skeleton({ w, h }: { w: string; h?: number }) {
  return <span className="aff-sk" style={{ width: w, height: h ?? 14 }} />;
}
