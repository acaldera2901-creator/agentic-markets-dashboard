// La partita non trovata, con la grafica v3c (#REDESIGN-V3C F4). Status 404:
// notFound() parte dalla pagina prima dello streaming. A flag spento questa
// rotta non è raggiungibile da /match/… (nessuna rewrite) e risponde con il
// 404 standard di Next, come prima del redesign.
import DefaultNotFound from "next/dist/client/components/builtin/not-found";
import "@/components/v3c/v3c.css";
import "@/components/v3c/match/match.css";
import { v3cFontClass } from "@/components/v3c/fonts";
import { V3cChrome } from "@/components/v3c/V3cChrome";
import { MatchNotFound } from "@/components/v3c/match/MatchStates";
import { v3cProductOn } from "@/lib/v3c/board-data.server";

export default function NotFound() {
  if (!v3cProductOn()) return <DefaultNotFound />;
  return (
    <V3cChrome initialMode="light" fontClass={v3cFontClass} current="board" boot={false}>
      <main className="v3c-wrap" id="main">
        <MatchNotFound />
      </main>
    </V3cChrome>
  );
}
