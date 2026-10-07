"use client";
// components/v3c/match/MatchStates.tsx (#REDESIGN-V3C F4)
// Gli stati della pagina partita che non sono dati: lo scheletro (mentre il
// server legge board e storico prezzi), l'errore (la fonte non ha risposto) e
// la partita non trovata (404 con la fascia v3c, mai una pagina bianca).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useV3cCopy } from "@/lib/v3c/lang.client";
import { matchCopyFor } from "@/lib/v3c/match-copy";
import { V3C_ROUTES } from "../V3cChrome";
import { Arrow } from "../Arrow";
import { BrandLoader, StateArt } from "../States";
import "../ui2.css";

/**
 * ui2 (CLS): lo scheletro occupa lo stesso spazio della pagina che arriva. Con la
 * board grande (~440 partite) il corpo arriva ~180 ms dopo la cornice; prima lo
 * scheletro era alto la metà della pagina, il piè finiva nel primo schermo e
 * veniva spinto giù di ~750 px (CLS 0,88 su mobile). Ora: stessa briciola (stesso
 * margine, quindi `main` non si sposta), stessa fascia, e i tre passi + «More»
 * con l'altezza minima misurata della pagina vera (components/v3c/ui2.css).
 */
export function MatchSkeleton({ label, sport = "football" }: { label?: "match" | "pc"; sport?: "football" | "tennis" }) {
  const { lang } = useV3cCopy();
  const c = matchCopyFor(lang);
  if (label === "pc") {
    return (
      <div className="v3c-mt-skel v3c-mt-skel-pc" aria-busy="true">
        <div className="v3c-load-row">
          <BrandLoader label={c.pc.loading} />
        </div>
        <i style={{ height: 112, background: "var(--v3c-navy)" }} aria-hidden="true" />
        <i style={{ width: "40%" }} aria-hidden="true" />
        <i style={{ height: 96, width: "70%" }} aria-hidden="true" />
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <i style={{ height: 240 }} aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className={`v3c-mt-skel2 v3c-mt-skel2-${sport}`} aria-busy="true">
      <p className="v3c-mt-crumbs" aria-hidden="true">
        <i className="v3c-mt-skel2-bar" style={{ width: 160 }} />
      </p>
      <div className="v3c-fascia v3c-mt-skel2-fascia" aria-hidden="true" />
      <div className="v3c-mt-step v3c-mt-skel2-s1">
        <div className="v3c-load-row">
          <BrandLoader label={c.loading} />
        </div>
        <i className="v3c-mt-skel2-bar" style={{ width: "40%" }} aria-hidden="true" />
        <i className="v3c-mt-skel2-bar" style={{ height: 96, width: "70%" }} aria-hidden="true" />
      </div>
      <div className="v3c-mt-step v3c-mt-skel2-s2" aria-hidden="true">
        <i className="v3c-mt-skel2-bar" style={{ height: 240 }} />
      </div>
      <div className="v3c-mt-step v3c-mt-skel2-s3" aria-hidden="true" />
      <div className="v3c-sec v3c-mt-skel2-more" aria-hidden="true" />
    </div>
  );
}

export function MatchError() {
  const { lang } = useV3cCopy();
  const c = matchCopyFor(lang);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <StateArt
      kind="500"
      role="alert"
      title={c.errorTitle}
      body={c.errorBody}
      action={
        <button type="button" className="v3c-btn v3c-btn-line v3c-btn-s" disabled={pending} onClick={() => start(() => router.refresh())}>
          {pending ? c.loading : c.retry}
        </button>
      }
    />
  );
}

export function MatchNotFound() {
  const { lang } = useV3cCopy();
  const c = matchCopyFor(lang);
  return (
    <StateArt
      kind="404"
      size="page"
      title={c.notFoundTitle}
      body={c.notFoundBody}
      action={
        <Link className="v3c-btn v3c-btn-cta" href={V3C_ROUTES.board}>
          {c.backToBoard} <Arrow />
        </Link>
      }
    />
  );
}
