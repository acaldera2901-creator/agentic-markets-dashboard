// /v3c/profilo — solo la cornice v3c attorno alla stessa ProfileScreen.
// (#REDESIGN-V3C pages) NON è un URL pubblico: con NEXT_PUBLIC_REDESIGN acceso
// next.config.ts riscrive la URL di oggi qui (beforeFiles, lib/v3c/pages-routes.ts;
// l'URL nel browser non cambia); spento risponde 404 e la pagina di oggi resta
// intatta. Metadata identici a quelli di oggi (app/v3c/v3c-pages-routes.test.tsx).
import { notFound } from "next/navigation";
import { ProfileScreen } from "@/features/profile/ProfileScreen";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { V3cFrame } from "@/components/v3c/pages/Frame";
import { V3cLegalFrame } from "@/components/v3c/community/LegalFrame";

export default function Page() {
  // stesso gate di app/profilo/page.tsx, più il flag del redesign
  if (process.env.NEXT_PUBLIC_UX_NEW !== "1" || !v3cProductOn()) notFound();
  return (
    <V3cFrame>
      <V3cLegalFrame kind="profile">
        <ProfileScreen />
      </V3cLegalFrame>
    </V3cFrame>
  );
}
