"use client";
// components/v3c/guide/DocLang.tsx (#REDESIGN-V3C fixui · QA M1) — <html lang> e <title>
// nella lingua della vista, SOLO sulle rotte v3c (la cornice lo monta; il sito di oggi
// non lo importa). `locale` è quella che la cornice già usa: la URL sulle pagine tool
// con prefisso, la lingua salvata nel browser altrove. Il title inglese del server
// resta la base (lo legge chi non esegue JS e i motori): qui si traduce dopo il mount.
// Next 16 può scrivere il <title> in streaming DOPO l'idratazione: un MutationObserver
// sulla <head> lo ritraduce ogni volta che torna inglese (localTitle è idempotente sui
// title già tradotti, che non combaciano con nessuna chiave inglese).
import { useEffect, useRef } from "react";
import { localTitle } from "@/lib/v3c/doc-titles";

export function DocLang({ locale }: { locale: string }) {
  // il title inglese (quello scritto dal server/Next) e l'ultimo scritto qui: cambiando lingua si riparte dall'inglese
  const base = useRef<string | null>(null);
  const mine = useRef<string | null>(null);
  useEffect(() => {
    document.documentElement.lang = locale;
    const apply = () => {
      if (document.title !== mine.current) base.current = document.title;
      const t = localTitle(base.current ?? document.title, locale);
      mine.current = t;
      if (t !== document.title) document.title = t;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [locale]);
  return null;
}
