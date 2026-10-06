// components/v3c/Chrome.tsx (#REDESIGN-V3C F5 · polish)
// LA cornice di tutte le pagine v3c — board, partita, record, tool, pagine di
// sito: una sola barra in alto, un solo piè di pagina, una sola barra in basso.
// Prima ce n'erano due (questa per tool/pagine con il lockup PNG, e una in
// V3cChrome con un «B» disegnato in CSS): ora V3cChrome usa queste.
//
// Server Component: le isole client sono il ThemeToggle (legge il modo dal
// contesto del V3cShell) e il LangSwitch (lingua salvata nel browser).
// Il marchio è quello ufficiale (redesign/brand/svg, IoU 0,961 sul PNG): un
// solo SVG in cache (public/brand/v3c/lockup.svg) richiamato con <use>, il
// colore della scritta passa per una variabile CSS — navy su carta, bianco
// sullo scuro — quindi nessuna doppia immagine per tema.
//
// Nav (DIRECTION-v3c §4): Board · Tools · Price check · Record · Books, poi
// News · Method · Pricing (queste tre spariscono sotto i 1180 px e restano nel
// piè), poi l'accesso. Su mobile le cinque voci sono la barra in basso.
import type { ReactNode } from "react";
import { LOCALE_NAMES, TOOL_LOCALES, hubPath, toolPath, type ToolLocale, type ToolSlug } from "@/lib/tools/registry";
import { impressumLine } from "@/lib/legal-entity";
import type { V3cToolsCopy } from "@/lib/i18n/v3c-tools";
import { BottomNav, type NavItem, type NavKey } from "./BottomNav";
import { LangSwitch } from "./LangSwitch";
import { ThemeToggle } from "./V3cShell";

export const ROUTES = {
  board: "/",
  price: "/price-check",
  record: "/record", // F6
  books: "/partners",
  news: "/blog",
  pro: "/pricing", // #REDESIGN-V3C pages: /plans → /pricing (308) a flag acceso
  method: "/how-it-works",
  terms: "/terms",
  privacy: "/privacy",
  // #REDESIGN-V3C pages: "/app?auth=login" finiva su /predictions, che a flag acceso
  // è la board v3c senza modale di accesso. /plans?auth= resta la Dashboard (lib/v3c/redirects).
  signIn: "/plans?auth=login",
  responsible: "https://www.begambleaware.org",
} as const;

/**
 * Helpline per paese: PUNTO D'INSERIMENTO, volutamente vuoto. Nessun numero si
 * scrive a memoria: lo riempie legale-compliance (mappa licenze per paese,
 * docs/redesign/F9-pages.md §1d) con fonte e data. Finché è vuoto il piè mostra
 * solo i due servizi internazionali di HELP_LINKS, che non hanno numeri locali.
 * Forma: { IT: { name: "…", url: "https://…" } }
 */
export const HELPLINES_BY_COUNTRY: Readonly<Record<string, { name: string; url: string }>> = {};

/** Servizi di aiuto senza numero e senza paese: link, non telefoni. */
export const HELP_LINKS = [
  { name: "BeGambleAware", url: "https://www.begambleaware.org" },
  { name: "Gambling Therapy", url: "https://www.gamblingtherapy.org" },
] as const;

export type ChromeCurrent = NavKey | "news" | "pro" | "method" | undefined;

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

/** Il lockup ufficiale. `title` = nome accessibile (il link che lo contiene non ha altro testo). */
export function Lockup({ className, title = "BetRedge" }: { className?: string; title?: string }) {
  return (
    <svg className={["v3c-lockup", className].filter(Boolean).join(" ")} viewBox="0 0 1390 459" role="img" aria-label={title}>
      <use href="/brand/v3c/lockup.svg#lockup" />
    </svg>
  );
}

/** Il monogramma ufficiale da solo (sigillo, stati). Decorativo. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={["v3c-mark-svg", className].filter(Boolean).join(" ")} viewBox="0 0 459 459" aria-hidden="true">
      <use href="/brand/v3c/mark.svg#mark" />
    </svg>
  );
}

type TopProps = { current?: ChromeCurrent; locale: ToolLocale; copy: V3cToolsCopy["nav"] };

export function TopBar({ current, locale, copy }: TopProps) {
  const main = navItems(copy, locale).map((n) => (n.key === "price" ? { ...n, label: copy.price } : n));
  const more = [
    { key: "news", label: copy.news, href: ROUTES.news },
    { key: "method", label: copy.method, href: ROUTES.method },
    { key: "pro", label: copy.pricing, href: ROUTES.pro },
  ];
  return (
    <header className="v3c-top">
      <a className="v3c-skip" href="#main">
        {copy.skip}
      </a>
      <div className="v3c-wrap">
        <a className="v3c-logo" href={ROUTES.board}>
          <Lockup title={copy.brand} />
        </a>
        <nav className="v3c-nav" aria-label={copy.primary}>
          {main.map((n) => (
            <a key={n.key} href={n.href} aria-current={n.key === current ? "page" : undefined}>
              {n.label}
            </a>
          ))}
          <span className="v3c-nav-sep" aria-hidden="true" />
          {more.map((n) => (
            <a key={n.key} className="v3c-nav-2" href={n.href} aria-current={n.key === current ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="v3c-top-r">
          <a className="v3c-signin" href={ROUTES.signIn}>
            {copy.signIn}
          </a>
          <ThemeToggle labels={{ toPaper: copy.toPaper, toDark: copy.toDark }} />
        </div>
      </div>
    </header>
  );
}

/**
 * Le undici lingue. Sulle pagine tool sono <a hrefLang> (le stesse URL degli
 * hreflang); sulle altre pagine — una URL sola — un bottone che salva la lingua
 * come fa il sito di oggi (LangSwitch).
 */
export function LangPicker({ locale, slug, hub, label }: { locale: ToolLocale; slug?: ToolSlug; hub?: boolean; label: string }) {
  if (!slug && !hub) return <LangSwitch locale={locale} label={label} />;
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

type FootProps = { locale: ToolLocale; slug?: ToolSlug; hub?: boolean; copy: V3cToolsCopy };

export function Footer({ locale, slug, hub, copy }: FootProps) {
  const f = copy.footer;
  const n = copy.nav;
  return (
    <footer className="v3c-foot">
      <div className="v3c-wrap">
        <div className="v3c-foot-g">
          <div className="v3c-foot-id">
            <a className="v3c-logo v3c-logo-foot" href={ROUTES.board}>
              <Lockup title={n.brand} />
            </a>
            <p className="v3c-small v3c-foot-tag">{f.tagline}</p>
            <LangPicker locale={locale} slug={slug} hub={hub} label={n.language} />
          </div>
          <div>
            <h2 className="v3c-lab">{f.product}</h2>
            <ul>
              <li><a href={ROUTES.board}>{n.board}</a></li>
              <li><a href={hubPath(locale)}>{f.toolsLink}</a></li>
              <li><a href={ROUTES.price}>{n.price}</a></li>
              <li><a href={ROUTES.news}>{n.news}</a></li>
            </ul>
          </div>
          <div>
            <h2 className="v3c-lab">{f.trust}</h2>
            <ul>
              <li><a href={ROUTES.record}>{n.record}</a></li>
              <li><a href={ROUTES.method}>{f.method}</a></li>
              <li><a href={ROUTES.books}>{n.books}</a></li>
            </ul>
          </div>
          <div>
            <h2 className="v3c-lab">{f.account}</h2>
            <ul>
              <li><a href={ROUTES.pro}>{n.pricing}</a></li>
              <li><a href={ROUTES.signIn}>{n.signIn}</a></li>
            </ul>
          </div>
          <div>
            <h2 className="v3c-lab">{f.legal}</h2>
            <ul>
              <li><a href={ROUTES.terms}>{f.terms}</a></li>
              <li><a href={ROUTES.privacy}>{f.privacy}</a></li>
            </ul>
          </div>
        </div>
        <div className="v3c-foot-help">
          <span className="v3c-age">18+</span>
          <p>
            <b>{f.helpTitle}.</b> {f.helpLine}{" "}
            {HELP_LINKS.map((h, i) => (
              <span key={h.url}>
                {i > 0 ? " · " : null}
                <a href={h.url} target="_blank" rel="nofollow noopener noreferrer">
                  {h.name}
                </a>
              </span>
            ))}
          </p>
        </div>
        <div className="v3c-disc">
          <span>{f.notAdvice}</span>
          <span>{f.blend}</span>
          <span>{f.affiliates}</span>
        </div>
        <p className="v3c-fine v3c-foot-imp">{impressumLine()}</p>
      </div>
    </footer>
  );
}

type FrameProps = { current?: ChromeCurrent; locale: ToolLocale; copy: V3cToolsCopy; slug?: ToolSlug; hub?: boolean; children: ReactNode };

/** Barra in alto + contenuto + piè + barra in basso: l'unico ordine ammesso. */
export function SiteFrame({ current, locale, copy, slug, hub, children }: FrameProps) {
  const bottom = current === "news" || current === "pro" || current === "method" ? undefined : current;
  return (
    <>
      <TopBar current={current} locale={locale} copy={copy.nav} />
      {children}
      <Footer locale={locale} slug={slug} hub={hub} copy={copy} />
      <BottomNav current={bottom} items={navItems(copy.nav, locale)} label={copy.nav.primaryMobile} />
    </>
  );
}
