"use client";
// components/v3c/board/BoardFascia.tsx (#REDESIGN-V3C F3)
// La fascia della board: tab con il contesto, il giorno come titolo, i fatti
// nella riga meta. Il titolo non dipende dal DB (è il primo elemento grande
// della pagina, LCP): la riga meta arriva quando arrivano i dati.
import type { ReactNode } from "react";
import { dayLong, timeHM } from "@/lib/v3c/board-view";
import { useLocalTimeZone, useV3cCopy } from "@/lib/v3c/lang.client";
import { Fascia } from "../Fascia";
import { v3cLocale } from "@/lib/v3c/copy";

export function BoardFascia({ surface, nowIso, meta }: { surface: "home" | "predictions"; nowIso: string; meta: ReactNode }) {
  const { lang, t } = useV3cCopy();
  const tz = useLocalTimeZone();
  const locale = v3cLocale(lang);
  const title = surface === "home" ? dayLong(nowIso, tz, locale) : t.fascia.titlePredictions;
  return <Fascia tab={surface === "home" ? t.fascia.tab : t.fascia.tabPredictions} title={title} meta={meta} />;
}

export type FasciaFacts = { n: number; sealed: number; generatedAt: string; windowDays: number };

/** Solo i fatti della riga meta: il payload della board non passa di qui. */
export function FasciaMeta({ facts }: { facts: FasciaFacts | null }) {
  const { lang, t } = useV3cCopy();
  const locale = v3cLocale(lang);
  if (!facts) return <span>{t.fascia.unavailable}</span>;
  return (
    <>
      <b>{t.fascia.matches(facts.n)}</b>
      <span>{t.fascia.pricesAsOf(`${timeHM(facts.generatedAt, "UTC", locale)} UTC`)}</span>
      <span>{t.fascia.sealedCount(facts.sealed, facts.n)}</span>
      <span>{t.fascia.window(facts.windowDays)}</span>
    </>
  );
}

export function FasciaMetaPending() {
  const { t } = useV3cCopy();
  return <span>{t.loading}…</span>;
}
