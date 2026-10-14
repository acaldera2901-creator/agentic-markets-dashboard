"use client";
// components/classic/ClassicNotFound.tsx — #CLASSIC-COVERAGE-1014
// La 404 a flag acceso: la pagina bianca di default di Next era l'unica
// schermata del sito senza barra, senza fondo e senza voce. Stessa testata delle
// altre pagine fuori dal desk, un messaggio, due strade (la home e le previsioni).
import { useEffect, useState } from "react";
import Link from "next/link";
import ClassicChrome from "./ClassicChrome";

export default function ClassicNotFound() {
  const [it, setIt] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la lingua sta in localStorage: non esiste lato server
    try { setIt(localStorage.getItem("agentic-lang") === "it"); } catch { /* storage off → en */ }
  }, []);
  return (
    <div className="cl-nf" lang={it ? "it" : "en"}>
      <ClassicChrome />
      <main className="cl-nf-main">
        <p className="cl-nf-code">404</p>
        <h1>{it ? "Questa pagina non esiste." : "This page doesn’t exist."}</h1>
        <p className="cl-nf-sub">
          {it ? "Il link è vecchio o scritto male. Le letture di oggi sono in home." : "The link is old or mistyped. Today’s readings are on the board."}
        </p>
        <div className="cl-nf-actions">
          <Link href="/" className="cl-nf-cta">{it ? "Vai alla home" : "Go to the board"}</Link>
          <Link href="/tools" className="cl-nf-link">{it ? "Strumenti gratuiti →" : "Free tools →"}</Link>
        </div>
      </main>
    </div>
  );
}
