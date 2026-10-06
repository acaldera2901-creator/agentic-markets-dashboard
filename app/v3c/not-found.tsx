// Il 404 del redesign (#REDESIGN-V3C polish): «Out of play», l'illustrazione del
// kit, una sola azione. Lo rende ogni notFound() sotto app/v3c (e, a flag acceso,
// ogni URL sconosciuta tramite la rewrite fallback → /v3c/lost). A flag spento
// resta il 404 standard di Next, come prima del redesign.
import Link from "next/link";
import DefaultNotFound from "next/dist/client/components/builtin/not-found";
import "@/components/v3c/v3c.css";
import { v3cFontClass } from "@/components/v3c/fonts";
import { V3cChrome } from "@/components/v3c/V3cChrome";
import { ROUTES } from "@/components/v3c/Chrome";
import { Arrow } from "@/components/v3c/Arrow";
import { StateArt } from "@/components/v3c/States";
import { BackToBoard } from "@/components/v3c/StatesCopy";
import { v3cProductOn } from "@/lib/v3c/board-data.server";

export default function V3cNotFound() {
  if (!v3cProductOn()) return <DefaultNotFound />;
  return (
    <V3cChrome initialMode="light" fontClass={v3cFontClass} boot={false}>
      <main className="v3c-wrap" id="main">
        <StateArt
          kind="404"
          size="page"
          action={
            <Link className="v3c-btn v3c-btn-cta" href={ROUTES.board}>
              <BackToBoard kind="404" /> <Arrow />
            </Link>
          }
        />
      </main>
    </V3cChrome>
  );
}
