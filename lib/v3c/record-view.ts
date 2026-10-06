// lib/v3c/record-view.ts (#REDESIGN-V3C F6) — formatting for /record, pure.
import type { V3ReliabilityBucket } from "./contracts";

const MINUS = "−";

/** 0.61290 → "0.6129"; null → "—". Brier always with four decimals. */
export function brier4(x: number | null | undefined, locale = "en-GB"): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return x.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/** Signed with a typographic minus: +0.0026 / −0.0012. */
export function signed4(x: number | null | undefined, locale = "en-GB"): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const s = Math.abs(x).toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return `${x < 0 ? MINUS : "+"}${s}`;
}

/** Signed points with one decimal: +4.0 / −0.7 (gap). */
export function signedPp(x: number | null | undefined, locale = "en-GB", digits = 1): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const r = Number(x.toFixed(digits));
  const s = Math.abs(r).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${r < 0 ? MINUS : r > 0 ? "+" : "±"}${s}`;
}

export function int(n: number | null | undefined, locale = "en-GB"): string {
  return n == null || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString(locale);
}

/** 0.6976 → "69.8%" */
export function pct1(p: number | null | undefined, locale = "en-GB"): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return `${(p * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** «14 Jun 2026» in UTC. */
export function dateUtc(iso: string | null | undefined, locale = "en-GB"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** «09 Oct 09:02» in UTC — the receipt's seal. */
export function stampUtc(iso: string, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "2-digit", month: "short" }).format(d);
  const hm = new Intl.DateTimeFormat(locale, { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${day} ${hm}`;
}

/** «a91f…c3» — SHA-256 abbreviated like the seal. */
export function shortFingerprint(h: string): string {
  return /^[0-9a-f]{64}$/.test(h) ? `${h.slice(0, 4)}…${h.slice(-2)}` : "";
}

/** «60–70%» */
export function binLabel(b: Pick<V3ReliabilityBucket, "from" | "to">): string {
  return `${Math.round(b.from * 100)}–${Math.round(b.to * 100)}%`;
}

/** Buckets worth drawing: with at least one outcome and an observed rate. */
export function drawable(buckets: V3ReliabilityBucket[]): V3ReliabilityBucket[] {
  return buckets.filter((b) => b.n > 0 && b.mean_predicted != null && b.observed != null);
}

/** Dot radius by n (area ∝ n), clamped so a bin of 3 is still visible and one of 2,000 does not cover its neighbours. */
export function dotRadius(n: number, maxN: number): number {
  if (maxN <= 0) return 3;
  return Math.max(3, Math.min(9, 9 * Math.sqrt(n / maxN)));
}

export type ReceiptSport = "all" | "football" | "tennis";
/** A page past this is refused (offset scans grow); the CSV export is the proposal's job. */
export const MAX_RECEIPT_PAGE = 40;

/** Default = football: calcio e tennis si leggono separati; «all» resta a richiesta. */
export function parseReceiptSport(v: unknown): ReceiptSport {
  return v === "all" || v === "tennis" ? v : "football";
}
export function parseReceiptPage(v: unknown): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_RECEIPT_PAGE ? n : 0;
}
