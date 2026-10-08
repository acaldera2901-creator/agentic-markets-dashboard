// components/classic/ClassicBanners.tsx — filone «classic», lobby (#CLASSIC-LOBBY-1008)
//
// I tre banner in testa alla lobby (la riga di Roobet), ma con i NOSTRI tre
// ingressi: il board di oggi, il live, lo storico. Niente bonus, niente
// urgenza, niente scarsità: un banner dice dove porta e basta.
//
// LO SLOT IMMAGINE. Le foto le sta producendo l'agente `banners`
// (~/Desktop/01-BETREDGE/redesign/classic/banners/). Finché non arrivano, il
// fondo è un SVG a codice coi colori BetRedge — lastra blu sul navy, un
// motivo diverso per banner — alle STESSE proporzioni della foto attesa:
//   2:1 · consegna 1200×600 (desktop) + 16:10 · 800×500 (telefono, `srcSm`), testo NON cotto
//   dentro (sta in HTML qui sotto, così si traduce in 11 lingue), soggetto
//   nella metà destra, metà sinistra scura per il testo.
// Per montarle basta passare `image` al banner: la scatola non cambia misura
// (aspect-ratio fisso → CLS 0 in entrambi i casi).

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

/** #CLASSIC-INT-1008 — le foto approvate (public/images/classic/, 16:9).
 *  `src` è il PNG grande (1280×720), `srcSm` il PNG piccolo (800×450): gli
 *  AVIF e WebP stanno accanto con lo stesso nome, e il <picture> li offre in
 *  quell'ordine. `fallback` è il ripiego SVG a codice: se la foto non arriva
 *  (errore di rete, formato), la scatola mostra lui invece di un buco. */
export type ClassicBannerImage = { src: string; srcSm?: string; fallback?: string; alt?: string };

/** I banner sono 3 colonne da ~1/3 della pagina su desktop, uno al 90% sul telefono. */
const BANNER_SIZES = "(max-width: 640px) 90vw, 33vw";

function srcSetFor(img: ClassicBannerImage, ext: "avif" | "webp" | "png"): string {
  const swap = (u: string) => u.replace(/\.png$/, `.${ext}`);
  return [img.srcSm ? `${swap(img.srcSm)} 800w` : null, `${swap(img.src)} 1280w`].filter(Boolean).join(", ");
}

export type ClassicBanner = {
  id: "board" | "live" | "record";
  title: string;
  sub: string;
  cta: string;
  href: string;
  /** Quando c'è, il click resta dentro il desk (cambio vista senza ricaricare).
   *  L'href resta vero per il tasto centrale e la condivisione. */
  onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void;
  image?: ClassicBannerImage;
  /** #CLASSIC-INT-1008 — un secondo link, piccolo (il banner «record» porta anche a /tools). */
  more?: { href: string; label: string };
};

/** Il fondo a codice. viewBox 1200×600 = la proporzione della foto attesa. */
function Placeholder({ id }: { id: ClassicBanner["id"] }) {
  const gid = `brc-bn-${id}`;
  let motif: ReactNode;
  if (id === "board") {
    // Il board: righe di partite, ognuna con la sua barra di probabilità.
    motif = (
      <g transform="translate(640 120)">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(0 ${i * 76})`}>
            <rect width="460" height="56" rx="8" fill="#0a1f47" opacity={0.85 - i * 0.12} />
            <rect x="20" y="20" width={120 + ((i * 53) % 90)} height="6" rx="3" fill="#dce8fb" opacity="0.55" />
            <rect x="20" y="32" width={80 + ((i * 37) % 70)} height="6" rx="3" fill="#dce8fb" opacity="0.3" />
            <rect x="330" y="18" width={i === 1 ? 104 : 60 + ((i * 29) % 50)} height="20" rx="4" fill={i === 1 ? "#C8FF00" : "#145AFF"} opacity={i === 1 ? 1 : 0.7} />
          </g>
        ))}
      </g>
    );
  } else if (id === "live") {
    // Il live: un tabellone e la traccia della partita che si muove.
    motif = (
      <g transform="translate(640 140)">
        <rect width="460" height="150" rx="10" fill="#0a1f47" opacity="0.9" />
        <circle cx="34" cy="36" r="8" fill="#FFE818" />
        <rect x="54" y="30" width="70" height="12" rx="3" fill="#dce8fb" opacity="0.5" />
        <text x="230" y="118" textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize="76" fill="#EDEFF2">2 – 1</text>
        <polyline points="0,330 60,300 120,318 180,262 240,280 300,226 360,244 420,196 460,206" fill="none" stroke="#6EA4FF" strokeWidth="5" strokeLinejoin="round" />
        <circle cx="420" cy="196" r="9" fill="#FFE818" />
      </g>
    );
  } else {
    // Lo storico: una colonna di esiti chiusi, vinti e persi, uno sotto l'altro.
    motif = (
      <g transform="translate(700 90)">
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i} transform={`translate(0 ${i * 68})`}>
            <rect width="400" height="50" rx="8" fill="#0a1f47" opacity={0.9 - i * 0.1} />
            <rect x="20" y="20" width={150 + ((i * 41) % 80)} height="8" rx="4" fill="#dce8fb" opacity="0.45" />
            <rect x="330" y="11" width="50" height="28" rx="4" fill={[0, 2, 3, 5].includes(i) ? "#C8FF00" : "#909AAE"} opacity={[0, 2, 3, 5].includes(i) ? 1 : 0.55} />
          </g>
        ))}
      </g>
    );
  }
  return (
    <svg className="brc-banner__art" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#155ce3" />
          <stop offset="1" stopColor="#102b63" />
        </linearGradient>
      </defs>
      <rect width="1200" height="600" fill={`url(#${gid})`} />
      {/* La metà sinistra più scura: è dove sta il testo HTML. */}
      <rect width="640" height="600" fill="#071329" opacity="0.45" />
      {motif}
    </svg>
  );
}

export function ClassicBanners({ banners, label }: { banners: ClassicBanner[]; label: string }) {
  // Le foto che non sono arrivate passano al ripiego SVG. L'errore può
  // scattare PRIMA dell'idratazione (l'<img> arriva nell'HTML del server e
  // React non c'era ancora ad ascoltare): al montaggio si guarda lo stato vero.
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const rowRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    const broken: Record<string, boolean> = {};
    rowRef.current?.querySelectorAll<HTMLImageElement>("img.brc-banner__art").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) broken[img.dataset.banner ?? ""] = true;
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legge lo stato del DOM (errori avvenuti prima dell'idratazione): non esiste in render
    if (Object.keys(broken).length) setFailed((f) => ({ ...f, ...broken }));
  }, []);
  return (
    <nav className="brc-banners" aria-label={label}>
      <ul className="brc-banners__row" ref={rowRef}>
        {banners.map((b, i) => (
          <li
            key={b.id}
            className="brc-banner"
            data-banner={b.id}
            data-photo={b.image && !failed[b.id] ? "" : undefined}
          >
            {b.image && failed[b.id] && b.image.fallback ? (
              // eslint-disable-next-line @next/next/no-img-element -- SVG statico, ripiego
              <img className="brc-banner__art" src={b.image.fallback} alt="" width={1280} height={720} />
            ) : b.image && !failed[b.id] ? (
              <picture className="brc-banner__media">
                <source type="image/avif" srcSet={srcSetFor(b.image, "avif")} sizes={BANNER_SIZES} />
                <source type="image/webp" srcSet={srcSetFor(b.image, "webp")} sizes={BANNER_SIZES} />
                <img
                  className="brc-banner__art"
                  src={b.image.src}
                  srcSet={srcSetFor(b.image, "png")}
                  sizes={BANNER_SIZES}
                  alt={b.image.alt ?? ""}
                  width={1280}
                  height={720}
                  // il primo è sopra la piega a ogni larghezza; gli altri due, sul
                  // telefono, sono fuori schermo nel carosello
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                  decoding="async"
                  data-banner={b.id}
                  onError={() => setFailed((f) => ({ ...f, [b.id]: true }))}
                />
              </picture>
            ) : (
              <Placeholder id={b.id} />
            )}
            <div className="brc-banner__text">
              <h2 className="brc-banner__title">{b.title}</h2>
              <p className="brc-banner__sub">{b.sub}</p>
              {/* Tutto il banner è cliccabile (il link si allarga con ::after),
                  ma il nome accessibile resta il verbo del link, non il paragrafo. */}
              <p className="brc-banner__links">
              {b.href.startsWith("/") && !b.onClick ? (
                <Link className="brc-banner__cta" href={b.href}>{b.cta} <span aria-hidden="true">→</span></Link>
              ) : (
                <a className="brc-banner__cta" href={b.href} onClick={b.onClick}>{b.cta} <span aria-hidden="true">→</span></a>
              )}
              {b.more && <Link className="brc-banner__more" href={b.more.href}>{b.more.label} <span aria-hidden="true">→</span></Link>}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}
