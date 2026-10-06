"use client";
// components/v3c/community/LegalFrame.tsx (#REDESIGN-V3C · filone pages)
// Cornice leggera di /privacy, /terms e /profilo: la fascia e la nota di
// lingua. Il contenuto (testo legale, schermata profilo) arriva come children
// IDENTICO a quello di sempre; qui cambia solo come si legge (community.css).
import type { ReactNode } from "react";
import { Fascia } from "../Fascia";
import { useCommunityCopy } from "./useCopy";

type Kind = "privacy" | "terms" | "profile";

export function V3cLegalFrame({ kind, children }: { kind: Kind; children: ReactNode }) {
  const c = useCommunityCopy();
  const tab = kind === "privacy" ? c.legal.privacyTab : kind === "terms" ? c.legal.termsTab : c.profile.tab;
  return (
    <main className="v3c-wrap v3c-cm" id="main">
      {/* il testo legale porta già il suo h1 (il titolo del documento): la fascia è un h2 */}
      {kind === "profile" ? (
        <Fascia tab={tab} title={c.profile.title} />
      ) : (
        <Fascia tab={tab} title={c.legal.title} as="h2" meta={<span>{c.legal.note}</span>} />
      )}
      <div className={kind === "profile" ? "v3c-cm-profile" : "v3c-cm-legal"}>{children}</div>
    </main>
  );
}
