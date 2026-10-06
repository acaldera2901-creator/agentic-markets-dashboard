// components/v3c/Banner.tsx (#REDESIGN-V3C fidelity)
// I banner fotografici del kit (brand/banners, GEN Codex, nessun marchio di
// terzi, nessuno stemma) come fondo decorativo della fascia: AVIF con ripiego
// WebP, due larghezze, dimensioni esplicite (niente CLS). Il testo della fascia
// resta HTML sopra un velo navy: il banner non porta mai parole né numeri.
import { getImageProps } from "next/image";
import { preload } from "react-dom";

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

export function Banner({ name, priority = false, position = "70% 40%" }: { name: BannerName; priority?: boolean; position?: string }) {
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
    preload(mobile("avif"), { as: "image", type: "image/avif", media: MOBILE, fetchPriority: "high" });
    preload(`${BASE}/${name}-1200.avif`, { as: "image", type: "image/avif", media: DESKTOP, imageSrcSet: set("avif"), imageSizes: DESKTOP_SIZES, fetchPriority: "high" });
  }
  return (
    <picture className="v3c-banner">
      <source media={MOBILE} type="image/avif" srcSet={mobile("avif")} />
      <source media={MOBILE} type="image/webp" srcSet={mobile("webp")} />
      <source type="image/avif" srcSet={set("avif")} sizes={DESKTOP_SIZES} />
      <source type="image/webp" srcSet={set("webp")} sizes={DESKTOP_SIZES} />
      {/* getImageProps dentro <picture>: il pattern di next/image per l'art direction; alt vuoto = decorativo */}
      <img {...props} alt="" style={{ objectPosition: position }} />
    </picture>
  );
}
