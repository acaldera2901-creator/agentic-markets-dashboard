// components/seo/RelatedTools.tsx — #SEO-LINK-INTERNI-1110 (T16)
// Link interni crawlabili (HTML server) verso i calcolatori chiave: GSC 10/11 mostra
// 144 pagine "rilevate, non indicizzate" e quasi nessun link interno che le raggiunga.
import Link from "next/link";

export const RELATED_TOOLS: Array<[string, string]> = [
  ["/tools/odds-converter", "Odds converter"],
  ["/tools/ev-calculator", "Expected value calculator"],
  ["/tools/kelly-criterion", "Kelly criterion calculator"],
  ["/tools/arbitrage-calculator", "Arbitrage calculator"],
  ["/tools/parlay-calculator", "Parlay calculator"],
];

export function RelatedTools() {
  return (
    <nav
      aria-label="Free betting calculators"
      style={{ maxWidth: "68ch", margin: "0 auto", padding: "0 24px 48px", fontSize: 15, color: "var(--am-muted)" }}
    >
      <p style={{ margin: "0 0 8px", color: "var(--am-text)", fontWeight: 700 }}>
        Free calculators to check the numbers yourself
      </p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {RELATED_TOOLS.map(([href, label]) => (
          <li key={href}>
            <Link href={href} style={{ color: "var(--am-text)", textDecoration: "underline" }}>
              {label}
            </Link>
          </li>
        ))}
        <li>
          <Link href="/tools" style={{ color: "var(--am-text)", textDecoration: "underline" }}>
            All 11 calculators
          </Link>
        </li>
      </ul>
    </nav>
  );
}
