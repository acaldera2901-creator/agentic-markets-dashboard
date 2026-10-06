"use client";
// components/v3c/V3cChrome.tsx (#REDESIGN-V3C F3)
// La cornice delle pagine di prodotto: barra in alto (desktop), barra in basso
// (mobile), piede con le righe legali. Le voci sono quelle fisse di
// DIRECTION-v3c §4 — Board · Tools · Price · Record · Books — ma in F3 due
// rotte non esistono ancora: «Price» va alla vista probabilità esistente
// (/probability-view) e «Record» al registro di oggi (/history). Quando F4/F6
// atterrano cambia SOLO questa mappa. Nessun link inventato, nessun 404.
// F4: «Price» va a /price-check (rewrite verso app/v3c/price-check).
import Link from "next/link";
import type { ReactNode } from "react";
import { impressumLine } from "@/lib/legal-entity";
import { useV3cCopy } from "@/lib/v3c/lang.client";
import type { V3cCopy } from "@/lib/v3c/copy";
import { BottomNav, type NavItem, type NavKey } from "./BottomNav";
import { ThemeToggle, V3cShell, type V3cMode } from "./V3cShell";

export const V3C_ROUTES: Record<NavKey, string> = {
  board: "/",
  tools: "/tools",
  price: "/price-check",
  record: "/record", // F6: la pagina v3c (a flag acceso /history fa 308 qui)
  books: "/partners",
};

function navItems(t: V3cCopy): NavItem[] {
  return [
    { key: "board", label: t.nav.board, href: V3C_ROUTES.board },
    { key: "tools", label: t.nav.tools, href: V3C_ROUTES.tools },
    { key: "price", label: t.nav.priceShort, href: V3C_ROUTES.price },
    { key: "record", label: t.nav.record, href: V3C_ROUTES.record },
    { key: "books", label: t.nav.books, href: V3C_ROUTES.books },
  ];
}

type Props = {
  initialMode: V3cMode;
  fontClass: string;
  current: NavKey;
  /** vedi V3cShell.boot (F4, pagina not-found) */
  boot?: boolean;
  children: ReactNode;
};

export function V3cChrome({ initialMode, fontClass, current, boot, children }: Props) {
  return (
    <V3cShell initialMode={initialMode} fontClass={fontClass} boot={boot}>
      {(mode, toggle) => (
        <Inner mode={mode} toggle={toggle} current={current}>
          {children}
        </Inner>
      )}
    </V3cShell>
  );
}

function Inner({ mode, toggle, current, children }: { mode: V3cMode; toggle: () => void; current: NavKey; children: ReactNode }) {
  const { lang, t } = useV3cCopy();
  const items = navItems(t);
  return (
    <>
      <header className="v3c-top">
        <div className="v3c-wrap">
          <Link className="v3c-logo" href="/">
            <span className="v3c-logo-mark" aria-hidden="true">
              B
            </span>
            BetRedge
          </Link>
          <nav className="v3c-nav" aria-label={t.nav.primary}>
            {items.map((n) => (
              <Link key={n.key} href={n.href} aria-current={n.key === current ? "page" : undefined}>
                {n.key === "price" ? t.nav.price : n.label}
              </Link>
            ))}
            <Link href="/blog">{t.nav.news}</Link>
            <Link href="/plans">{t.nav.pro}</Link>
          </nav>
          <div className="v3c-top-r">
            <ThemeToggle mode={mode} onToggle={toggle} />
          </div>
        </div>
      </header>
      {children}
      <footer className="v3c-foot">
        <div className="v3c-wrap v3c-foot-g">
          <div>
            <p className="v3c-t-row">BetRedge</p>
            <p className="v3c-small v3c-foot-lede">{t.foot.lede}</p>
            <p className="v3c-fine">{impressumLine()}</p>
          </div>
          <div>
            <h2 className="v3c-lab">{t.foot.product}</h2>
            <ul>
              <li>
                <Link href="/">{t.nav.board}</Link>
              </li>
              <li>
                <Link href="/tools">{t.foot.tools}</Link>
              </li>
              <li>
                <Link href={V3C_ROUTES.price}>{t.nav.price}</Link>
              </li>
              <li>
                <Link href="/blog">{t.nav.news}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="v3c-lab">{t.foot.trust}</h2>
            <ul>
              <li>
                <Link href={V3C_ROUTES.record}>{t.nav.record}</Link>
              </li>
              <li>
                <Link href="/how-it-works">{t.foot.method}</Link>
              </li>
              <li>
                <Link href="/partners">{t.foot.partners}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="v3c-lab">{t.foot.legal}</h2>
            <ul>
              <li>
                <Link href="/terms">{t.foot.terms}</Link>
              </li>
              <li>
                <Link href="/privacy">{t.foot.privacy}</Link>
              </li>
              <li>
                <a href="https://www.begambleaware.org" rel="nofollow noopener noreferrer" target="_blank">
                  {t.foot.responsible} ↗
                </a>
              </li>
            </ul>
          </div>
          <div className="v3c-disc">
            <span className="v3c-age">{t.foot.age}</span>
            <span>{t.foot.disclaimer}</span>
            <span>{t.foot.blend}</span>
            <span>{t.foot.affiliates}</span>
            <span lang={lang === "it" ? "it" : "en"} className="v3c-sr">
              {lang}
            </span>
          </div>
        </div>
      </footer>
      <BottomNav current={current} items={items} />
    </>
  );
}
