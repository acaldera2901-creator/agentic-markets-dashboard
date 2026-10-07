"use client";
// components/v3c/banners/ColourBanner.tsx (#REDESIGN-V3C final3) — i banner colore del kit
// (redesign/brand/README §3b): uno stacco fra le sezioni, con UNA funzione e un link.
//   · arte: SVG inline di default (COD, niente richiesta, niente CLS); `gen` = il fondo Codex
//     via <picture> AVIF → WebP → PNG, lazy, width/height espliciti, alt="" (decorativo) —
//     al massimo uno per pagina (lo decide chi monta il banner, la regola è nel README);
//   · testo e link dal codice (lib/v3c/banner-copy.ts, 11 lingue): il banner non porta parole
//     nell'immagine; il link è secondario (testo + freccia), mai un bottone pieno;
//   · geometria fissa: 4/1 su desktop, 8/5 sotto i 640 px (o sempre, `shape="tall"` nelle colonne
//     strette) — lo spazio è riservato prima che l'arte arrivi.
// Dove NON va (README §3b, applicato alla lettera): sopra la piega della home, su una schermata
// con una CTA partner (board, partita, price check, /partners), dentro il flusso di una partita.
import Link from "next/link";
import { Arrow } from "../Arrow";
import { useV3cLang } from "@/lib/v3c/lang.client";
import { bannerCopyFor, type BannerTheme } from "@/lib/v3c/banner-copy";
import { COLOUR_SVG } from "./colour-svg";
import "./colour-banner.css";

const BASE = "/brand/v3c/banners/colour";
/** I temi che hanno anche il fondo Codex nel repo (public/brand/v3c/banners/colour). */
export const GEN_THEMES = ["record", "learn", "calcio"] as const;
type GenTheme = (typeof GEN_THEMES)[number];

/** I link interni dei banner. Tennis/Calcio: il filtro sport di /predictions (?sport=…); Live: l'ancora del gruppo live. */
export const BANNER_HREF: Record<BannerTheme, string> = {
  record: "/record",
  learn: "/how-it-works",
  calcio: "/predictions?sport=football",
  tennis: "/predictions?sport=tennis",
  live: "/predictions#live",
  pro: "/pricing",
};

function Gen({ theme, tall }: { theme: GenTheme; tall: boolean }) {
  const f = (size: string, ext: string) => `${BASE}/${theme}-${size}.${ext}`;
  const wide = (ext: string) => `${f("1200x300", ext)} 1200w, ${f("1600x400", ext)} 1600w`;
  const sizes = "(max-width: 1232px) calc(100vw - 32px), 1200px";
  return (
    <picture>
      {tall ? null : (
        <>
          <source media="(max-width: 640px)" type="image/avif" srcSet={f("800x500", "avif")} />
          <source media="(max-width: 640px)" type="image/webp" srcSet={f("800x500", "webp")} />
          <source media="(max-width: 640px)" srcSet={f("800x500", "png")} />
        </>
      )}
      <source type="image/avif" srcSet={tall ? f("800x500", "avif") : wide("avif")} sizes={tall ? undefined : sizes} />
      <source type="image/webp" srcSet={tall ? f("800x500", "webp") : wide("webp")} sizes={tall ? undefined : sizes} />
      <img src={tall ? f("800x500", "png") : f("1600x400", "png")} width={tall ? 800 : 1600} height={tall ? 500 : 400} loading="lazy" decoding="async" alt="" />
    </picture>
  );
}

export function ColourBanner({ theme, gen = false, shape = "auto", lang: langProp, href }: { theme: BannerTheme; gen?: boolean; shape?: "auto" | "tall"; lang?: string; href?: string }) {
  const stored = useV3cLang();
  const c = bannerCopyFor(langProp ?? stored)[theme];
  const tall = shape === "tall";
  const useGen = gen && (GEN_THEMES as readonly string[]).includes(theme);
  const svg = COLOUR_SVG[theme];
  return (
    <div className="v3c-cb" data-cb={theme} data-shape={shape}>
      <div className="v3c-cb-art" aria-hidden="true">
        {useGen ? (
          <Gen theme={theme as GenTheme} tall={tall} />
        ) : (
          <>
            {tall ? null : <span className="v3c-cb-w" dangerouslySetInnerHTML={{ __html: svg.wide }} />}
            <span className="v3c-cb-m" dangerouslySetInnerHTML={{ __html: svg.mobile }} />
          </>
        )}
      </div>
      <div className="v3c-cb-txt">
        <p className="v3c-cb-t">{c.title}</p>
        <Link className="v3c-cb-a" href={href ?? BANNER_HREF[theme]}>
          {c.link} <Arrow />
        </Link>
      </div>
    </div>
  );
}
