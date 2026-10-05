// Privacy guard on the only free-text labels the queries return (traffic
// sources and signup channels). Counts are never changed — only labels are
// coarsened, and rows that end up with the same label are summed.
//
// Why: measured on 2026-10-05, a referrer host was
// "betredge-studio-0922.<first>-<last>-<n>.chatgpt.site" — a person's name in a
// subdomain. Referrers are cut to the registrable domain (chatgpt.site), and
// referral codes (often a creator's handle) are masked.

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);

export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const keep = tld.length === 2 && SECOND_LEVEL.has(sld) ? 3 : 2;
  return parts.slice(-keep).join(".");
}

export function coarsenLabel(label: string): string {
  if (label.startsWith("referrer:")) return "referrer:" + registrableDomain(label.slice("referrer:".length));
  if (label.startsWith("ref:")) return "ref:(codice referral)";
  return label;
}

/** Coarsen `labelKey` and sum `countKey` across rows that collapse together; sorted desc. */
export function coarsenRows<T extends Record<string, unknown>>(rows: T[], labelKey: keyof T, countKey: keyof T): T[] {
  const acc = new Map<string, T>();
  for (const r of rows) {
    const label = coarsenLabel(String(r[labelKey]));
    const prev = acc.get(label);
    if (prev) acc.set(label, { ...prev, [countKey]: Number(prev[countKey]) + Number(r[countKey]) });
    else acc.set(label, { ...r, [labelKey]: label });
  }
  return [...acc.values()].sort(
    (a, b) => Number(b[countKey]) - Number(a[countKey]) || String(a[labelKey]).localeCompare(String(b[labelKey])),
  );
}
