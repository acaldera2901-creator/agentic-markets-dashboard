"use client";
// components/v3c/LangSwitch.tsx (#REDESIGN-V3C polish)
// Le undici lingue sulle pagine con una URL sola (board, partita, record, pagine
// di sito): salvano la scelta dove la tiene il sito di oggi (localStorage
// «agentic-lang») e avvisano chi ascolta l'evento «agentic-lang» — la copia
// passa alla lingua senza ricaricare. Le pagine tool usano invece i link
// hreflang (Chrome.LangPicker).
import { LOCALE_NAMES, TOOL_LOCALES, type ToolLocale } from "@/lib/tools/registry";
import { useV3cLang } from "@/lib/v3c/lang.client";

export function LangSwitch({ locale, label }: { locale: ToolLocale; label: string }) {
  const saved = useV3cLang();
  const current = (TOOL_LOCALES as readonly string[]).includes(saved) ? saved : locale;
  const pick = (l: ToolLocale) => {
    try {
      localStorage.setItem("agentic-lang", l);
    } catch {
      /* senza storage la scelta vale per questa vista soltanto */
    }
    window.dispatchEvent(new Event("agentic-lang"));
  };
  return (
    <nav className="v3c-langs" aria-label={label}>
      {TOOL_LOCALES.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={l === current} onClick={() => pick(l)}>
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </nav>
  );
}
