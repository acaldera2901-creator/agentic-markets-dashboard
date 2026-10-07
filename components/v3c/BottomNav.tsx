// components/v3c/BottomNav.tsx (#REDESIGN-V3C F1)
// La barra in basso su mobile: cinque voci, fisse (DIRECTION-v3c §4).
// Board · Tools · Price · Record · Books. Glifi disegnati a mano con la
// grammatica del sistema (tratto 1.5, angoli vivi), non icone da kit.
export type NavKey = "board" | "tools" | "price" | "record" | "books";

export type NavItem = { key: NavKey; label: string; href: string };

export const V3C_NAV: readonly NavItem[] = [
  { key: "board", label: "Board", href: "/" },
  { key: "tools", label: "Tools", href: "/tools" },
  { key: "price", label: "Price", href: "/price-check" },
  { key: "record", label: "Record", href: "/record" },
  { key: "books", label: "Books", href: "/partners" },
];

const GLYPH: Record<NavKey, React.ReactNode> = {
  // la board: tre righe con la colonna del gap a destra
  board: (
    <>
      <path d="M3 6h10M3 10h10M3 14h10" />
      <path d="M16 5v2M16 9v2M16 13v2" strokeWidth="2.5" />
    </>
  ),
  // i tool: il cartellino con la banda in basso
  tools: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" />
      <path d="M3.5 13.5h13" strokeWidth="2.5" />
      <path d="M7 9h6" />
    </>
  ),
  // il price check: tre prezzi → uno
  price: (
    <>
      <path d="M3 5h5M3 10h5M3 15h5" />
      <path d="M10 10h4" />
      <path d="M14 7l3 3-3 3" />
    </>
  ),
  // il record: il sigillo
  record: (
    <>
      <path d="M3 4h14l-2 12H3z" />
      <path d="M6 10l2.5 2.5L14 8" />
    </>
  ),
  // i book: due cartellini sovrapposti
  books: (
    <>
      <rect x="3" y="6" width="10" height="11" />
      <path d="M7 6V3h10v11h-3" />
    </>
  ),
};

type Props = {
  current?: NavKey;
  items?: readonly NavItem[];
  className?: string;
  label?: string;
  /** fixui: la sesta voce «More» (components/v3c/guide/MoreMenu), già un <li>. Le cinque restano. */
  more?: React.ReactNode;
};

export function BottomNav({ current, items = V3C_NAV, className, label = "Primary (mobile)", more }: Props) {
  return (
    <nav className={["v3c-bnav", className].filter(Boolean).join(" ")} aria-label={label}>
      <ul>
        {items.map((it) => (
          <li key={it.key}>
            <a href={it.href} aria-current={it.key === current ? "page" : undefined}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
                {GLYPH[it.key]}
              </svg>
              {it.label}
            </a>
          </li>
        ))}
        {more}
      </ul>
    </nav>
  );
}
