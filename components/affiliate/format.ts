// components/affiliate/format.ts — #AFFILIATE-V2-UI-1015
// Formattazione pura (importi, date, indirizzi). Nessuna dipendenza da DOM o rete.
import type { AffLang } from "./copy";

const LOCALE: Record<AffLang, string> = { it: "it-IT", en: "en-GB" };

/** `$23,39` (it) / `$23.39` (en). Il segno meno è U+2212, come nel mockup. */
export function usd(n: number, lang: AffLang): string {
  const abs = Math.abs(n).toLocaleString(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "−" : ""}$${abs}`;
}

/** USDT ricevuti, 2 decimali: `60,00`. */
export function coinAmount(n: number, lang: AffLang): string {
  return n.toLocaleString(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/** `18 ott` / `18 Oct`. Data non valida → "—" (mai "Invalid Date"). */
export function shortDate(iso: string | null | undefined, lang: AffLang): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" });
}

/** `18 ott, 14:32`. */
export function dateTime(iso: string | null | undefined, lang: AffLang): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE[lang], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** `"2026-10-01"` → `"Ottobre 2026"`. Il mese è quello di ESECUZIONE del payout. */
export function monthLabel(period: string, months: readonly string[]): string {
  const m = /^(\d{4})-(\d{2})/.exec(period);
  if (!m) return period;
  const name = months[Number(m[2]) - 1];
  if (!name) return period;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${m[1]}`;
}

/** `0x4b1e…91d7` → `0x7c2e…5f83` per un hash. */
export function shortHash(h: string): string {
  return h.length <= 12 ? h : `${h.slice(0, 6)}…${h.slice(-4)}`;
}

/** Indirizzo a gruppi di 8 dopo `0x`: primi 6 e ultimi 6 caratteri marcati (SPEC §3.3). */
export type AddrChunk = { text: string; hl: boolean }[];
export function addressGroups(address: string): AddrChunk[] {
  const a = address.trim();
  const hlStart = /^0x/i.test(a) ? 2 : 0;
  const hlEnd = a.length - 6;
  const groups: AddrChunk[] = [];
  let i = 0;
  while (i < a.length) {
    const size = i === 0 ? 10 : 8; // 0x + 8 caratteri, poi gruppi da 8
    const end = Math.min(i + size, a.length);
    const chunk: AddrChunk = [];
    for (let k = i; k < end; k++) {
      const hl = (k >= hlStart && k < hlStart + 6) || k >= hlEnd;
      const last = chunk[chunk.length - 1];
      if (last && last.hl === hl) last.text += a[k];
      else chunk.push({ text: a[k], hl });
    }
    groups.push(chunk);
    i = end;
  }
  return groups;
}
