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

export function MatchSkeleton({ label }: { label?: "match" | "pc" }) {
  const { lang } = useV3cCopy();
  const c = matchCopyFor(lang);
  return (
    <div className="v3c-mt-skel" aria-busy="true">
      <div className="v3c-load-row">
        <BrandLoader label={label === "pc" ? c.pc.loading : c.loading} />
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
