"use client";
// components/v3c/pages/FrameClient.tsx (#REDESIGN-V3C · filone pages)
// La cornice delle pagine «di sito» del redesign (News, Books, Pro, Metodo,
// leaderboard, community, invite, legali): la STESSA chrome delle pagine tool
// (TopBar · Footer · BottomNav di components/v3c/Chrome), con la lingua che il
// sito tiene oggi in localStorage «agentic-lang». Queste pagine hanno una URL
// sola (inglese, canonical): il server scrive inglese, il browser passa alla
// lingua salvata dopo il mount — lo stesso schema della board F3.
import type { ReactNode } from "react";
import { getV3cToolsCopy } from "@/lib/i18n/v3c-tools";
import { TOOL_LOCALES, type ToolLocale } from "@/lib/tools/registry";
import { useV3cLang } from "@/lib/v3c/lang.client";
import { SiteFrame, type ChromeCurrent } from "../Chrome";
import { V3cShell } from "../V3cShell";

export type FrameCurrent = ChromeCurrent;

/** «it» → «it»; una lingua che il registry non conosce → inglese. */
export function toToolLocale(lang: string): ToolLocale {
  const l = lang.toLowerCase().slice(0, 2);
  return (TOOL_LOCALES as readonly string[]).includes(l) ? (l as ToolLocale) : "en";
}

type Props = { fontClass: string; current?: FrameCurrent; children: ReactNode };

export function FrameClient({ fontClass, current, children }: Props) {
  const locale = toToolLocale(useV3cLang());
  const c = getV3cToolsCopy(locale);
  return (
    <V3cShell fontClass={fontClass} lang={locale}>
      <SiteFrame current={current} locale={locale} copy={c}>
        {children}
      </SiteFrame>
    </V3cShell>
  );
}
