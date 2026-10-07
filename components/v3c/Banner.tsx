// components/v3c/Banner.tsx (#REDESIGN-V3C fidelity · banners-fix)
// I banner fotografici del kit (brand/banners, GEN Codex, nessun marchio di
// terzi, nessuno stemma) come fondo decorativo della fascia: AVIF con ripiego
// WebP, due larghezze, dimensioni esplicite (niente CLS). Il testo della fascia
// resta HTML sopra un velo navy: il banner non porta mai parole né numeri.
//
// banners-fix: la fascia è una striscia (744×208 su desktop = 3,6:1; 736×168 a 768 = 4,4:1) e il
// 1200×628 del kit (1,9:1) in `object-fit: cover` perdeva la testa del calciatore (fino a 65 px a 768)
// e la palla/racchetta del tennis a ogni larghezza ≥ 430. Nessun object-position lo salva: il soggetto
// (testa → palla) è più alto di quanto la striscia mostri. Calcio e tennis usano quindi un ritaglio
// «fit» dai verticali 1080×1350 del kit (scripts/v3c/banner-fit-crops.mjs: soggetto intero, margine
// sopra, sotto e ai lati) in un riquadro con il SUO rapporto, alto quanto la fascia minima (208 px,
// 168 sotto gli 820) e ancorato in alto: niente da ritagliare a nessuna larghezza, anche quando la
// fascia cresce (titolo lungo, altre lingue). Il testo della fascia si ferma prima del riquadro
// (banner-fit.css), così testa e palla non passano sotto le parole da 600 px in su. La folla resta `cover`: nessuna testa esce dal riquadro (audit in docs/redesign/banners-crop-audit.md, test in e2e/v3c-banner-crop.spec.ts).
import { getImageProps } from "next/image";
import { preload } from "react-dom";
import "./banner-fit.css";

export type BannerName = "hero-football" | "hero-tennis" | "partner-crowd";

const BASE = "/brand/v3c/banners";
const W = 1200;
const H = 628;
/** larghezza resa del banner: la fascia meno i margini su mobile, ≤760 px su desktop (fidelity.css) */
const SIZES = "(max-width: 820px) calc(100vw - 32px), 760px";
/**
 * v3c-final: su mobile il banner sta sotto un velo navy dell'82→35% (fidelity.css) — il 720 basta a
 * ogni densità. Senza questa sorgente un telefono a 3× sceglieva il 1200 (15–39 KB invece di 7–17 KB)
 * proprio sull'elemento LCP. Desktop invariato: 720/1200 su 760 px.
 */
const MOBILE = "(max-width: 820px)";
const DESKTOP = "(min-width: 821px)";
const DESKTOP_SIZES = "760px";
/**
 * final4 (decisione di Andrea): sotto i 600 px la fascia non porta la foto (coprirebbe il soggetto) ma
 * una fascia pulita, colore + motivo (banner-fit.css). Questa sorgente vuota, prima di tutte, fa sì che
 * il telefono non scarichi la foto che non mostra; i preload hanno la stessa soglia.
 */
const NO_PHOTO = "(max-width: 599px)";
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** I ritagli «fit» (360/720 px di larghezza, scripts/v3c/banner-fit-crops.mjs): le dimensioni del 720. */
const FIT: Partial<Record<BannerName, { w: number; h: number }>> = {
  "hero-football": { w: 720, h: 485 },
  "hero-tennis": { w: 720, h: 437 },
};
/** resa: 208 × 1,55–1,65 = 323–343 px su desktop, 168 × … = 261–277 px sotto gli 820 (a 3× sceglie il 720) */
const FIT_SIZES = "(max-width: 820px) 280px, 345px";

export function Banner({ name, priority = false, position = "70% 40%" }: { name: BannerName; priority?: boolean; position?: string }) {
  const fit = FIT[name];
  if (fit) return <FitBanner name={name} priority={priority} {...fit} />;
  // unoptimized: i due formati sono già codificati a mano (scripts nel report fidelity), Next li serve così come sono
  const { props } = getImageProps({
    src: `${BASE}/${name}-1200.webp`,
    alt: "",
    width: W,
    height: H,
    unoptimized: true,
    // niente preload di next/image: punterebbe al WebP mentre il browser sceglie l'AVIF del <picture> (doppio
    // download, LCP peggiore). Sopra la piega: eager + fetchPriority alta sulla sorgente che il browser sceglie.
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : "auto",
    sizes: SIZES,
  });
  const set = (ext: "avif" | "webp") => `${BASE}/${name}-720.${ext} 720w, ${BASE}/${name}-1200.${ext} 1200w`;
  const mobile = (ext: "avif" | "webp") => `${BASE}/${name}-720.${ext}`;
  // sopra la piega: il preload dell'AVIF nell'<head> (la sorgente che il browser sceglie, una per breakpoint),
  // così il banner non aspetta il parsing del body e non allunga l'LCP della pagina
  if (priority) {
    preload(mobile("avif"), { as: "image", type: "image/avif", media: "(min-width: 600px) and (max-width: 820px)", fetchPriority: "high" });
    preload(`${BASE}/${name}-1200.avif`, { as: "image", type: "image/avif", media: DESKTOP, imageSrcSet: set("avif"), imageSizes: DESKTOP_SIZES, fetchPriority: "high" });
  }
  return (
    <picture className="v3c-banner">
      <source media={NO_PHOTO} srcSet={BLANK} />
      <source media={MOBILE} type="image/avif" srcSet={mobile("avif")} />
      <source media={MOBILE} type="image/webp" srcSet={mobile("webp")} />
      <source type="image/avif" srcSet={set("avif")} sizes={DESKTOP_SIZES} />
      <source type="image/webp" srcSet={set("webp")} sizes={DESKTOP_SIZES} />
      {/* getImageProps dentro <picture>: il pattern di next/image per l'art direction; alt vuoto = decorativo */}
      <img {...props} alt="" style={{ objectPosition: position }} />
    </picture>
  );
}

function FitBanner({ name, priority, w, h }: { name: BannerName; priority: boolean; w: number; h: number }) {
  const set = (ext: "avif" | "webp") => `${BASE}/${name}-fit-360.${ext} 360w, ${BASE}/${name}-fit-720.${ext} 720w`;
  const { props } = getImageProps({
    src: `${BASE}/${name}-fit-720.webp`,
    alt: "",
    width: w,
    height: h,
    unoptimized: true,
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : "auto",
    sizes: FIT_SIZES,
  });
  if (priority) preload(`${BASE}/${name}-fit-720.avif`, { as: "image", type: "image/avif", media: "(min-width: 600px)", imageSrcSet: set("avif"), imageSizes: FIT_SIZES, fetchPriority: "high" });
  return (
    // --fit-ar: il rapporto del ritaglio, da cui banner-fit.css ricava la larghezza del riquadro
    <picture className="v3c-banner v3c-banner-fit" data-banner={name} style={{ ["--fit-ar" as string]: (w / h).toFixed(3) }}>
      <source media={NO_PHOTO} srcSet={BLANK} />
      <source type="image/avif" srcSet={set("avif")} sizes={FIT_SIZES} />
      <source type="image/webp" srcSet={set("webp")} sizes={FIT_SIZES} />
      <img {...props} alt="" />
    </picture>
  );
}
