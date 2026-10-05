"use client";
// components/v3c/board/BoardStates.tsx (#REDESIGN-V3C F3)
// Gli stati della board che non sono «dati»: lo scheletro (mentre il server
// legge) e l'errore (la fonte non ha risposto). Lo scheletro ha la geometria
// delle righe vere, così l'arrivo dei dati non sposta niente (CLS).
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useV3cCopy } from "@/lib/v3c/lang.client";

export function BoardSkeleton({ rows = 8 }: { rows?: number }) {
  const { t } = useV3cCopy();
  return (
    <div className="v3c-board-w v3c-skel" aria-busy="true">
      <div className="v3c-toolbar">
        <div className="v3c-chips">
          <span className="v3c-chip v3c-skel-b" style={{ width: 64 }} />
          <span className="v3c-chip v3c-skel-b" style={{ width: 92 }} />
          <span className="v3c-chip v3c-skel-b" style={{ width: 76 }} />
        </div>
      </div>
      <section className="v3c-board" aria-label={t.loading}>
        <span className="v3c-sr" role="status">
          {t.loading}
        </span>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="v3c-row v3c-row-skel" aria-hidden="true">
            <span className="v3c-r-time">
              <i className="v3c-skel-b" style={{ width: 38 }} />
            </span>
            <span className="v3c-r-teams">
              <i className="v3c-skel-b" style={{ width: 64, height: 30 }} />
              <i className="v3c-skel-b" style={{ width: `${50 + ((i * 17) % 35)}%` }} />
            </span>
            <span className="v3c-r-price">
              <i className="v3c-skel-b" style={{ width: 36 }} />
            </span>
            <span className="v3c-r-scale">
              <i className="v3c-skel-b" style={{ width: "100%", height: 4 }} />
            </span>
            <span className="v3c-r-gap">
              <i className="v3c-skel-b" style={{ width: 44 }} />
            </span>
            <span className="v3c-r-book">
              <i className="v3c-skel-b" style={{ width: 70, height: 30 }} />
            </span>
            <span />
          </div>
        ))}
      </section>
    </div>
  );
}

export function BoardError() {
  const { t } = useV3cCopy();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="v3c-board-w">
      <section className="v3c-board v3c-error" role="alert" aria-label={t.board.label}>
        <p className="v3c-t-row">{t.error.title}</p>
        <p className="v3c-small">{t.error.body}</p>
        <button type="button" className="v3c-btn v3c-btn-line v3c-btn-s" disabled={pending} onClick={() => start(() => router.refresh())}>
          {pending ? t.loading : t.error.retry}
        </button>
      </section>
    </div>
  );
}
