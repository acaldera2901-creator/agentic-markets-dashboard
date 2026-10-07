// /v3c/profilo — solo la cornice v3c attorno alla stessa ProfileScreen.
// (#REDESIGN-V3C pages) NON è un URL pubblico: con NEXT_PUBLIC_REDESIGN acceso
// next.config.ts riscrive la URL di oggi qui (beforeFiles, lib/v3c/pages-routes.ts;
// l'URL nel browser non cambia); spento risponde 404 e la pagina di oggi resta
// intatta.
// fixui3 L1: a flag acceso ma senza NEXT_PUBLIC_UX_NEW (oggi, in Fase 0) non è più un 404: una pagina
// neutra «Account: coming with Pro», noindex. Con NEXT_PUBLIC_UX_NEW=1 resta la ProfileScreen di sempre.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileScreen } from "@/features/profile/ProfileScreen";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cLegalFrame } from "@/components/v3c/community/LegalFrame";
import { AccountSoon } from "@/components/v3c/pages/AccountSoon";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function Page() {
  if (!v3cProductOn()) notFound();
  // stesso gate di app/profilo/page.tsx per la schermata vera
  const screen = process.env.NEXT_PUBLIC_UX_NEW === "1";
  return (
    <V3cFrame>
      <V3cLegalFrame kind="profile">{screen ? <ProfileScreen /> : <AccountSoon />}</V3cLegalFrame>
    </V3cFrame>
  );
}
