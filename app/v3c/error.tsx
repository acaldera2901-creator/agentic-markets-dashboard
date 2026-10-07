"use client";
// L'errore del redesign (#REDESIGN-V3C polish): «Lights flickered», la torre faro
// del kit su navy, UNA azione (riprova). Cattura gli errori di rendering delle
// pagine sotto app/v3c; a flag spento nessuna URL pubblica arriva qui.
import { useEffect } from "react";
import "@/components/v3c/v3c.css";
import "@/components/v3c/fixui.css";
import { v3cFontClass } from "@/components/v3c/fonts";
import { V3cChrome } from "@/components/v3c/V3cChrome";
import { StateArt } from "@/components/v3c/States";
import { BackToBoard } from "@/components/v3c/StatesCopy";

export default function V3cError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[v3c] page error", error.digest ?? "");
  }, [error]);
  return (
    <V3cChrome initialMode="light" fontClass={v3cFontClass} boot={false}>
      <main className="v3c-wrap" id="main">
        <StateArt
          kind="500"
          size="page"
          role="alert"
          action={
            <button type="button" className="v3c-btn v3c-btn-cta" onClick={() => reset()}>
              <BackToBoard kind="500" />
            </button>
          }
        />
      </main>
    </V3cChrome>
  );
}
