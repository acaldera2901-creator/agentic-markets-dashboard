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

type L = "it" | "en" | "es" | "fr" | "ru";
const LANGS: readonly string[] = ["it", "en", "es", "fr", "ru"];

// `syncHtmlLang`: per le pagine il cui TESTO segue la lingua scelta (partner,
// community, weekly case): <html lang> era "en" anche con la pagina in italiano.
// Le pagine solo-inglese (legali, guide) NON lo passano: lì "en" è giusto.
export default function ClassicChrome({ lang: forced, syncHtmlLang = false }: { lang?: L; syncHtmlLang?: boolean }) {
  const [stored, setStored] = useState<L>("en");
  useEffect(() => {
    const read = () => {
      try { const v = localStorage.getItem("agentic-lang") ?? ""; setStored((LANGS.includes(v) ? v : "en") as L); } catch { /* storage off → en */ }
    };
    read();
    window.addEventListener("agentic-lang-change", read);
    return () => window.removeEventListener("agentic-lang-change", read);
  }, []);
  const lang = forced ?? stored;
  useEffect(() => {
    if (CLASSIC && syncHtmlLang) document.documentElement.lang = lang;
  }, [lang, syncHtmlLang]);
  if (!CLASSIC) return null;
  return <SiteTopbar backHref="/" backLabel="Board" lang={lang} nav={chromeNav(lang)} />;
}
