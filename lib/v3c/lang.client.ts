"use client";
// lib/v3c/lang.client.ts (#REDESIGN-V3C F3)
// La lingua del visitatore, come la tiene il sito oggi: localStorage
// «agentic-lang» (scritta dal desk e dal LangDropdown). Il server non la
// conosce, quindi il primo render è in inglese e dopo il mount si passa alla
// lingua salvata — lo stesso schema di useRedesignEnabled. Il fuso è il
// gemello: il server scrive UTC, il browser il suo.
import { useSyncExternalStore } from "react";
import { copyFor, type V3cCopy } from "./copy";

const LANG_KEY = "agentic-lang";

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener("agentic-lang", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("agentic-lang", cb);
  };
}
function getLang(): string {
  try {
    return localStorage.getItem(LANG_KEY) || "en";
  } catch {
    return "en";
  }
}

export function useV3cLang(): string {
  return useSyncExternalStore(subscribe, getLang, () => "en");
}

export function useV3cCopy(): { lang: string; t: V3cCopy } {
  const lang = useV3cLang();
  return { lang, t: copyFor(lang) };
}

/** Il fuso del browser dopo il mount; `undefined` (= UTC) al primo render e sul server. */
export function useLocalTimeZone(): string | undefined {
  return useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => undefined,
  );
}
