"use client";
// components/v3c/board/BoardFascia.tsx (#REDESIGN-V3C F3)
// La fascia della board: tab con il contesto, il giorno come titolo, i fatti
// nella riga meta. Il titolo non dipende dal DB (è il primo elemento grande
// della pagina, LCP): la riga meta arriva quando arrivano i dati.
import type { ReactNode } from "react";
import { dayLong } from "@/lib/v3c/board-view";
import { useLocalTimeZone, useV3cCopy } from "@/lib/v3c/lang.client";
import { Fascia } from "../Fascia";
import { Banner } from "../Banner";
import "../fidelity.css";
import { v3cLocale } from "@/lib/v3c/copy";
import { guideCopyFor } from "@/lib/v3c/guide-copy";
import { hmLocal } from "@/lib/v3c/time-ui";
import { TzNote } from "../guide/TzNote";
import { InfoButton } from "../guide/Glossary";

export function BoardFascia({ surface, nowIso, meta }: { surface: "home" | "predictions"; nowIso: string; meta: ReactNode }) {
  const { lang, t } = useV3cCopy();
  const tz = useLocalTimeZone();
  const locale = v3cLocale(lang);
  const title = surface === "home" ? dayLong(nowIso, tz, locale) : t.fascia.titlePredictions;
  // fidelity: la home apre con il banner calcio del kit dietro la fascia da regia, la board intera con quello tennis (kit §3)
  // fixui A1 / UX-AUDIT #1: sotto la data, la frase che dice cos'è BetRedge (solo home)
  const lede = surface === "home" ? guideCopyFor(lang).hero.what : undefined;
  return <Fascia tab={surface === "home" ? t.fascia.tab : t.fascia.tabPredictions} title={title} lede={lede} meta={meta} art={surface === "home" ? <Banner name="hero-football" priority /> : <Banner name="hero-tennis" priority />} />;
}

export type FasciaFacts = { n: number; sealed: number; generatedAt: string; windowDays: number };

/** Solo i fatti della riga meta: il payload della board non passa di qui. */
export function FasciaMeta({ facts }: { facts: FasciaFacts | null }) {
  const { lang, t } = useV3cCopy();
  const tz = useLocalTimeZone();
  const locale = v3cLocale(lang);
  if (!facts) return <span>{t.fascia.unavailable}</span>;
  return (
    <>
      <b>{t.fascia.matches(facts.n)}</b>
      {/* fixui M2: l'ora dei prezzi nel fuso della vista (era UTC accanto a orari locali) */}
      <span>{t.fascia.pricesAsOf(hmLocal(facts.generatedAt, tz, locale))}</span>
      <span className="v3c-fm-i">
        {t.fascia.sealedCount(facts.sealed, facts.n)}
        <InfoButton term="sealed" label={t.fascia.sealed} />
      </span>
      <span>{t.fascia.window(facts.windowDays)}</span>
      <TzNote />
    </>
  );
}

export function FasciaMetaPending() {
  const { t } = useV3cCopy();
  return <span>{t.loading}…</span>;
}
