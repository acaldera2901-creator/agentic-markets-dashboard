// components/v3c/Chrome.tsx (#REDESIGN-V3C F5)
// La chrome delle pagine v3c: barra in alto (lockup, nav primaria, accesso,
// tema) e piè di pagina (quattro colonne, le lingue, la riga 18+). Server
// Component: l'unica isola client è il ThemeToggle, che legge il modo dal
// contesto del V3cShell. Le voci della nav sono quelle di DIRECTION-v3c §4:
// Board · Tools · Price check · Record · Books, poi News e Pro.
//
// Rotte: /price-check e /record arrivano con F4 e F6 (piano); fino ad allora
// Record punta a /history, che F6 farà 308 su /record, e Price check resta
// l'unica voce senza pagina — il flag è OFF in produzione.
import { LOCALE_NAMES, TOOL_LOCALES, hubPath, toolPath, type ToolLocale, type ToolSlug } from "@/lib/tools/registry";
import type { V3cToolsCopy } from "@/lib/i18n/v3c-tools";
import { type NavItem, type NavKey } from "./BottomNav";
import { ThemeToggle } from "./V3cShell";

export const ROUTES = {
  board: "/",
  price: "/price-check",
  record: "/record", // F6
  books: "/partners",
  news: "/blog",
  pro: "/plans",
  method: "/how-it-works",
  terms: "/terms",
  privacy: "/privacy",
  signIn: "/app?auth=login",
  responsible: "https://www.begambleaware.org",
} as const;

/** Le cinque voci della barra in basso, tradotte, con l'hub nella lingua giusta. */
export function navItems(c: V3cToolsCopy["nav"], locale: ToolLocale): NavItem[] {
  return [
    { key: "board", label: c.board, href: ROUTES.board },
    { key: "tools", label: c.tools, href: hubPath(locale) },
    { key: "price", label: c.priceShort, href: ROUTES.price },
    { key: "record", label: c.record, href: ROUTES.record },
    { key: "books", label: c.books, href: ROUTES.books },
  ];
}

export function Lockup({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={["v3c-on-paper", className].filter(Boolean).join(" ")} src="/brand/v3c/lockup-navy.png" alt="BetRedge" width={1390} height={459} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={["v3c-on-dark", className].filter(Boolean).join(" ")} src="/brand/v3c/lockup-white.png" alt="BetRedge" width={1390} height={459} />
    </>
  );
}

type TopProps = { current: NavKey | "news" | "pro"; locale: ToolLocale; copy: V3cToolsCopy["nav"] };

export function TopBar({ current, locale, copy }: TopProps) {
  const items: { key: string; label: string; href: string }[] = [
    ...navItems(copy, locale).map((n) => (n.key === "price" ? { ...n, label: copy.price } : n)),
    { key: "news", label: copy.news, href: ROUTES.news },
    { key: "pro", label: copy.pro, href: ROUTES.pro },
  ];
  return (
    <header className="v3c-top">
      <div className="v3c-wrap">
        <a className="v3c-logo" href={ROUTES.board} aria-label={copy.brand}>
          <Lockup />
        </a>
        <nav className="v3c-nav" aria-label={copy.primary}>
          {items.map((n) => (
            <a key={n.key} href={n.href} aria-current={n.key === current ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="v3c-top-r">
          <a className="v3c-ghost" href={ROUTES.signIn}>
            {copy.signIn}
          </a>
          <ThemeToggle labels={{ toPaper: copy.toPaper, toDark: copy.toDark }} />
        </div>
      </div>
    </header>
  );
}

/** Le undici lingue, come <a hrefLang>: sono le stesse URL degli hreflang. */
export function LangPicker({ locale, slug, label }: { locale: ToolLocale; slug?: ToolSlug; label: string }) {
  return (
    <nav className="v3c-langs" aria-label={label}>
      {TOOL_LOCALES.map((l) => (
        <a key={l} href={slug ? toolPath(slug, l) : hubPath(l)} hrefLang={l} lang={l} aria-current={l === locale ? "true" : undefined}>
          {LOCALE_NAMES[l]}
        </a>
      ))}
    </nav>
  );
}

type FootProps = { locale: ToolLocale; slug?: ToolSlug; copy: V3cToolsCopy };

export function Footer({ locale, slug, copy }: FootProps) {
  const f = copy.footer;
  const n = copy.nav;
  return (
    <footer className="v3c-foot">
      <div className="v3c-foot-g">
        <div>
          <a className="v3c-logo v3c-logo-foot" href={ROUTES.board} aria-label={n.brand}>
            <Lockup />
          </a>
          <p className="v3c-small v3c-foot-tag">{f.tagline}</p>
          <LangPicker locale={locale} slug={slug} label={n.language} />
        </div>
        <div>
          <h3 className="v3c-lab">{f.product}</h3>
          <ul>
            <li>
              <a href={ROUTES.board}>{n.board}</a>
            </li>
            <li>
              <a href={hubPath(locale)}>{f.toolsLink}</a>
            </li>
            <li>
              <a href={ROUTES.price}>{n.price}</a>
            </li>
            <li>
              <a href={ROUTES.news}>{n.news}</a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="v3c-lab">{f.trust}</h3>
          <ul>
            <li>
              <a href={ROUTES.record}>{n.record}</a>
            </li>
            <li>
              <a href={ROUTES.method}>{f.method}</a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="v3c-lab">{f.booksCol}</h3>
          <ul>
            <li>
              <a href={ROUTES.books}>{n.books}</a>
            </li>
            <li>
              <a href={ROUTES.pro}>{n.pro}</a>
            </li>
            <li>
              <a href={ROUTES.terms}>{f.terms}</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="v3c-disc">
        <span className="v3c-age">18+</span>
        <span>{f.notAdvice}</span>
        <span>{f.blend}</span>
        <span>{f.affiliates}</span>
        <a href={ROUTES.responsible} target="_blank" rel="noopener noreferrer">
          {f.responsible}
        </a>
      </div>
    </footer>
  );
}
