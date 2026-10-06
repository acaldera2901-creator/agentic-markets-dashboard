"use client";
// components/v3c/record/RecordFascia.tsx (#REDESIGN-V3C F6)
// La fascia del registro: il titolo non aspetta il DB (LCP), la riga dei fatti
// — da quando, quante sigillate — arriva con i dati.
import type { ReactNode } from "react";
import { dateUtc, int } from "@/lib/v3c/record-view";
import { Fascia } from "../Fascia";
import { useRecordCopy } from "./useRecordCopy";

export function RecordFascia({ meta }: { meta: ReactNode }) {
  const { t } = useRecordCopy();
  // polish: il sigillo grande del kit (public/brand/v3c/seal.svg, geometria da codice) accanto al titolo
  return (
    <div className="v3c-rec-fascia">
      <Fascia tab={t.fascia.tab} title={t.fascia.title} meta={meta} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="v3c-rec-seal" src="/brand/v3c/seal.svg" alt="" width={112} height={112} />
    </div>
  );
}

export function RecordFasciaMeta({ since, sealed, sealedTennis, failed, pending }: { since: string | null; sealed: number | null; sealedTennis?: number | null; failed?: boolean; pending?: boolean }) {
  const { t, locale } = useRecordCopy();
  if (pending) return <span>{t.state.loading}…</span>;
  if (failed) return <span>{t.fascia.unavailable}</span>;
  return (
    <>
      {since ? <b>{t.fascia.since(dateUtc(since, locale))}</b> : null}
      {sealed != null ? <span>{t.fascia.sealed(int(sealed, locale), int(sealedTennis ?? 0, locale))}</span> : null}
      <span>{t.fascia.edit}</span>
    </>
  );
}
