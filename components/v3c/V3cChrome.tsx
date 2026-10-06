"use client";
// components/v3c/V3cChrome.tsx (#REDESIGN-V3C F3)
// La cornice delle pagine di prodotto: barra in alto (desktop), barra in basso
// (mobile), piede con le righe legali. Le voci sono quelle fisse di
// DIRECTION-v3c §4 — Board · Tools · Price · Record · Books — ma in F3 due
// rotte non esistono ancora: «Price» va alla vista probabilità esistente
// (/probability-view) e «Record» al registro di oggi (/history). Quando F4/F6
// atterrano cambia SOLO questa mappa. Nessun link inventato, nessun 404.
// F4: «Price» va a /price-check (rewrite verso app/v3c/price-check).
// polish: la barra, il piè e la barra in basso sono quelli di ./Chrome (una
// cornice sola per tutto il redesign); qui resta il contenitore del tema.
import type { ReactNode } from "react";
import { getV3cToolsCopy } from "@/lib/i18n/v3c-tools";
import { useV3cLang } from "@/lib/v3c/lang.client";
import type { NavKey } from "./BottomNav";
import { SiteFrame } from "./Chrome";
import { toToolLocale } from "./pages/FrameClient";
import { V3cShell, type V3cMode } from "./V3cShell";

export const V3C_ROUTES: Record<NavKey, string> = {
  board: "/",
  tools: "/tools",
  price: "/price-check",
  record: "/record", // F6: la pagina v3c (a flag acceso /history fa 308 qui)
  books: "/partners",
};

type Props = {
  initialMode: V3cMode;
  fontClass: string;
  current?: NavKey;
  /** vedi V3cShell.boot (F4, pagina not-found) */
  boot?: boolean;
  children: ReactNode;
};

export function V3cChrome({ initialMode, fontClass, current, boot, children }: Props) {
  return (
    <V3cShell initialMode={initialMode} fontClass={fontClass} boot={boot}>
      <Inner current={current}>{children}</Inner>
    </V3cShell>
  );
}

/** polish: la STESSA cornice delle pagine tool e di sito (components/v3c/Chrome). */
function Inner({ current, children }: { current?: NavKey; children: ReactNode }) {
  const locale = toToolLocale(useV3cLang());
  return (
    <SiteFrame current={current} locale={locale} copy={getV3cToolsCopy(locale)}>
      {children}
    </SiteFrame>
  );
}
