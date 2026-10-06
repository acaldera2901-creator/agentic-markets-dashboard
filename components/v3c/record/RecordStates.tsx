"use client";
// components/v3c/record/RecordStates.tsx (#REDESIGN-V3C F6)
// Gli stati del registro che non sono «dati»: lo scheletro con la geometria
// vera (riepilogo a tre colonne, grafico quadrato, righe), l'errore con
// «riprova», il vuoto prima del primo sigillo.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useRecordCopy } from "./useRecordCopy";

export function RecordSkeleton() {
  const { t } = useRecordCopy();
  return (
    <div className="v3c-skel" aria-busy="true">
      <span className="v3c-sr" role="status">
        {t.state.loading}
      </span>
      <div className="v3c-rec-kpi" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <i className="v3c-skel-b" style={{ width: 140 }} />
            <i className="v3c-skel-b" style={{ width: 160, height: 44 }} />
            <i className="v3c-skel-b" style={{ width: "80%" }} />
          </div>
        ))}
      </div>
      <div className="v3c-sec v3c-rec-cal-g" aria-hidden="true">
        <i className="v3c-skel-b v3c-rec-skel-chart" />
        <div>
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} className="v3c-skel-b" style={{ display: "block", width: "100%", height: 14, marginBottom: 14 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReceiptsSkeleton() {
  return (
    <div className="v3c-sec v3c-skel" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} className="v3c-skel-b" style={{ display: "block", width: "100%", height: 18, marginBottom: 22 }} />
      ))}
    </div>
  );
}

export function RecordError() {
  const { t } = useRecordCopy();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="v3c-error v3c-rec-state" role="alert">
      <p className="v3c-t-row">{t.state.errorTitle}</p>
      <p className="v3c-small">{t.state.errorBody}</p>
      <button type="button" className="v3c-btn v3c-btn-line v3c-btn-s" disabled={pending} onClick={() => start(() => router.refresh())}>
        {pending ? `${t.state.loading}…` : t.state.retry}
      </button>
    </section>
  );
}

export function RecordEmpty() {
  const { t } = useRecordCopy();
  return (
    <section className="v3c-empty v3c-rec-state">
      <p className="v3c-t-row">{t.state.empty}</p>
      <p className="v3c-small">{t.state.emptyBody}</p>
    </section>
  );
}
