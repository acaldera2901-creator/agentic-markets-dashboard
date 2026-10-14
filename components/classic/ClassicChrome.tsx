"use client";
// components/classic/ClassicChrome.tsx — #CLASSIC-COVERAGE-1014
//
// La testata delle pagine che stanno FUORI dal desk (legali, guide, blog,
// partner…). A flag spento non rende niente: la pagina è quella di main. A flag
// acceso è la stessa SiteTopbar che già vestono /tools e il World Cup — nessun
// componente nuovo di barra, solo la lingua letta dallo stesso `agentic-lang`
// che il resto del sito usa, per dare alla nav le sue etichette.
import { useEffect, useState } from "react";
import SiteTopbar from "@/components/world-cup/SiteTopbar";
import { chromeNav } from "@/lib/tools/registry";
import { CLASSIC } from "@/lib/classic/flag";

type L = "it" | "en";

export default function ClassicChrome({ lang: forced }: { lang?: L }) {
  const [stored, setStored] = useState<L>("en");
  useEffect(() => {
    const read = () => {
      try { setStored(localStorage.getItem("agentic-lang") === "it" ? "it" : "en"); } catch { /* storage off → en */ }
    };
    read();
    window.addEventListener("agentic-lang-change", read);
    return () => window.removeEventListener("agentic-lang-change", read);
  }, []);
  if (!CLASSIC) return null;
  const lang = forced ?? stored;
  return <SiteTopbar backHref="/" backLabel="Board" lang={lang} nav={chromeNav(lang)} />;
}
