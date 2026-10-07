// components/v3c/record/RecordPage.tsx (#REDESIGN-V3C F6)
// /record, lato server. Ordine della pagina = ordine delle domande:
//   1. fascia            — da quando, quante, niente si modifica
//   2. il riepilogo      — sigillate · Brier nostro e del mercato affiancati · copertura
//   3. calibrazione      — reliability con n e intervalli (#calibration: la sezione dedicata)
//   4. atteso/osservato  — per settimana
//   5. tennis            — a parte, con il suo n e cosa è davvero il numero
//   6. ricevute          — vinte E perse, sigillo UTC e impronta
//   7. correzioni        — come correzioni, con il motivo
// Tutto da pick_ledger + pick_settlement(_current) (+ prediction_log per il
// mercato al sigillo), MAI da unified_predictions. Nessun ROI, CLV, hit-rate.
// Montata SOLO a flag acceso (app/v3c/record/page.tsx).
import { Suspense } from "react";
import { connection } from "next/server";
import "@/components/v3c/v3c.css";
import "@/components/v3c/record.css";
import { v3cFontClass } from "@/components/v3c/fonts";
import { V3cChrome } from "@/components/v3c/V3cChrome";
import { getCorrections, getReceipts, getRecordSummary } from "@/lib/v3c/record-data.server";
import { parseReceiptPage, parseReceiptSport } from "@/lib/v3c/record-view";
import { parseMode } from "@/lib/v3c/mode";
import { RecordFascia, RecordFasciaMeta } from "./RecordFascia";
import { RecordSummaryView } from "./RecordSummary";
import { Receipts } from "./Receipts";
import { Corrections } from "./Corrections";
import { ColourBanner } from "@/components/v3c/banners/ColourBanner";
import { RecordError, RecordSkeleton, ReceiptsSkeleton } from "./RecordStates";

async function MetaBlock() {
  const s = await getRecordSummary();
  if (!s.ok) return <RecordFasciaMeta since={null} sealed={null} failed />;
  const r = s.data.record;
  return <RecordFasciaMeta since={r.scope.since} sealed={r.counts.sealed} sealedTennis={r.tennis.groups.reduce((a, g) => a + g.sealed, 0)} />;
}

async function SummaryBlock() {
  const s = await getRecordSummary();
  if (!s.ok) return <RecordError />;
  return <RecordSummaryView data={s.data} />;
}

async function ReceiptsBlock({ sport, page }: { sport: ReturnType<typeof parseReceiptSport>; page: number }) {
  const r = await getReceipts(sport, page);
  return <Receipts result={r.ok ? r.data : null} sport={sport} page={page} />;
}

async function CorrectionsBlock() {
  const c = await getCorrections();
  return <Corrections data={c.ok ? c.data : null} />;
}

export async function RecordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // per-richiesta: il registro cresce a ogni sigillo
  const sp = await searchParams;
  const sport = parseReceiptSport(sp.sport);
  const page = parseReceiptPage(sp.page);
  return (
    <V3cChrome initialMode={parseMode(sp.mode)} fontClass={v3cFontClass} current="record">
      <main className="v3c-wrap v3c-rec" id="main">
        <RecordFascia
          meta={
            <Suspense fallback={<RecordFasciaMeta since={null} sealed={null} pending />}>
              <MetaBlock />
            </Suspense>
          }
        />
        <Suspense fallback={<RecordSkeleton />}>
          <SummaryBlock />
        </Suspense>
        {/* final3: banner colore (README §3b) — Metodo in testa alle ricevute (il solo GEN della pagina), Pro in fondo, separato */}
        <ColourBanner theme="learn" gen />
        <Suspense fallback={<ReceiptsSkeleton />}>
          <ReceiptsBlock sport={sport} page={page} />
        </Suspense>
        <Suspense fallback={null}>
          <CorrectionsBlock />
        </Suspense>
        <ColourBanner theme="pro" />
      </main>
    </V3cChrome>
  );
}
