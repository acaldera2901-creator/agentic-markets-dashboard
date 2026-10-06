"use client";
// components/v3c/States.tsx (#REDESIGN-V3C polish) — «la firma» negli stati che
// non sono dati: il loader col marchio, e le tre illustrazioni del kit
// (redesign/brand/states, GEN visti a occhio, nessun testo dentro) per 404,
// errore e vuoto. Un titolo da cartellone, una riga, UNA azione.
// Le illustrazioni sono WebP ridotti dal PNG del kit (public/brand/v3c/states).
import type { ReactNode } from "react";
import { useV3cLang } from "@/lib/v3c/lang.client";

type Kind = "404" | "500" | "empty";

const ART: Record<Kind, { src: string; w: number; h: number }> = {
  "404": { src: "/brand/v3c/states/illustration-404.webp", w: 880, h: 599 },
  "500": { src: "/brand/v3c/states/illustration-500.webp", w: 720, h: 720 },
  empty: { src: "/brand/v3c/states/illustration-empty.webp", w: 800, h: 415 },
};

/** Copia del kit (README §4): EN e IT. Le altre lingue ricadono sull'inglese (F10). */
export const STATE_COPY = {
  en: {
    loading: "Loading",
    "404": { code: "404", title: "Out of play", body: "This page went over the touchline.", action: "Back to the board" },
    "500": { code: "Error", title: "Lights flickered", body: "Something broke on our side. Try again in a minute.", action: "Try again" },
    empty: { code: "", title: "Bench is empty", body: "Nothing here yet.", action: "Back to the board" },
  },
  it: {
    loading: "Caricamento",
    "404": { code: "404", title: "Palla fuori", body: "Questa pagina è uscita oltre la linea laterale.", action: "Torna al board" },
    "500": { code: "Errore", title: "Luci a intermittenza", body: "Qualcosa si è rotto da noi. Riprova fra un minuto.", action: "Riprova" },
    empty: { code: "", title: "Panchina vuota", body: "Qui non c'è ancora niente.", action: "Torna al board" },
  },
} as const;

export function useStateCopy() {
  const lang = useV3cLang();
  return lang.startsWith("it") ? STATE_COPY.it : STATE_COPY.en;
}

/** Il monogramma che si accende pezzo per pezzo (rispetta prefers-reduced-motion dentro l'SVG). */
export function BrandLoader({ label, size = 40 }: { label?: string; size?: number }) {
  const c = useStateCopy();
  return (
    <span className="v3c-loader" role="status">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/v3c/loader.svg" alt="" width={size} height={Math.round((size * 479) / 456)} />
      <span>{label ?? c.loading}</span>
    </span>
  );
}

type ArtProps = {
  kind: Kind;
  /** sovrascrive titolo e riga del kit (per es. «Match not found») */
  title?: string;
  body?: ReactNode;
  /** l'unica azione: un nodo (link o bottone) già pronto */
  action?: ReactNode;
  /** «page» = 404/500 a pagina intera; «inline» = dentro una sezione */
  size?: "page" | "inline";
  role?: "alert";
};

export function StateArt({ kind, title, body, action, size = "inline", role }: ArtProps) {
  const c = useStateCopy()[kind];
  const a = ART[kind];
  const H = size === "page" ? "h1" : "h2";
  return (
    <section className={`v3c-state v3c-state-${kind} v3c-state-${size}`} role={role}>
      <div className="v3c-state-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.src} alt="" width={a.w} height={a.h} loading={size === "page" ? "eager" : "lazy"} decoding="async" />
      </div>
      <div className="v3c-state-txt">
        {c.code ? <p className="v3c-lab">{c.code}</p> : null}
        <H className="v3c-t-page">{title ?? c.title}</H>
        {body == null || typeof body === "string" ? <p className="v3c-lede">{body ?? c.body}</p> : <div className="v3c-lede">{body}</div>}
        {action ? <div className="v3c-state-act">{action}</div> : null}
      </div>
    </section>
  );
}
