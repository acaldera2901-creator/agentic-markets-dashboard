// components/v3c/Banner.tsx (#REDESIGN-V3C fidelity)
// I banner fotografici del kit (brand/banners, GEN Codex, nessun marchio di
// terzi, nessuno stemma) come fondo decorativo della fascia: AVIF con ripiego
// WebP, due larghezze, dimensioni esplicite (niente CLS). Il testo della fascia
// resta HTML sopra un velo navy: il banner non porta mai parole né numeri.
import { getImageProps } from "next/image";

export type BannerName = "hero-football" | "hero-tennis" | "partner-crowd";

const BASE = "/brand/v3c/banners";
const W = 1200;
const H = 628;

export function Banner({ name, priority = false, position = "70% 40%" }: { name: BannerName; priority?: boolean; position?: string }) {
  // unoptimized: i due formati sono già codificati a mano (scripts nel report fidelity), Next li serve così come sono
  const { props } = getImageProps({
    src: `${BASE}/${name}-1200.webp`,
    alt: "",
    width: W,
    height: H,
    unoptimized: true,
    priority,
    sizes: "(max-width: 820px) 100vw, 720px",
  });
  const set = (ext: "avif" | "webp") => `${BASE}/${name}-720.${ext} 720w, ${BASE}/${name}-1200.${ext} 1200w`;
  return (
    <picture className="v3c-banner">
      <source type="image/avif" srcSet={set("avif")} sizes={props.sizes} />
      <source type="image/webp" srcSet={set("webp")} sizes={props.sizes} />
      {/* getImageProps dentro <picture>: il pattern di next/image per l'art direction; alt vuoto = decorativo */}
      <img {...props} alt="" style={{ objectPosition: position }} />
    </picture>
  );
}
