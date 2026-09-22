// components/lobby/HeroBanner.tsx — #RESTYLING-0921 round 3
//
// Il banner in testa alla Home. Round 3 (direzione d'arte in
// docs/redesign-brief-digest.md): via la foto dell'atleta — la TIPOGRAFIA è
// l'immagine. Headline in Saira Condensed 800 maiuscolo a corpo enorme, una
// sola parola in lime; sotto, i tre numeri veri come striscia di cifre
// tabulari (niente pill, niente bordo, niente puntino luminoso); una sola CTA
// piena col taglio della casa in alto a sinistra. Zero glow, zero gradiente
// radiale: il fondo è un MATERIALE reale in duotone navy (variante A) oppure,
// senza asset e su telefono, solo il pannello con una riga di calce disegnata
// (variante B). Vedi docs/reference/round3/hero-concept.html.
//
// Tutto ciò che è un NUMERO o una PROMESSA arriva dal chiamante:
//   - `stats`  → i conteggi (live / starting soon / high edge). Una stat con
//                value null NON si rende: meglio due cifre vere che tre con un
//                trattino.
//   - `points` → la checklist (`aside`). Nessun default: «Trusted by 100K+
//                bettors» nell'immagine di riferimento era un placeholder di
//                ChatGPT, non un dato nostro. Round 3: la scatola a destra non
//                esiste più; se il chiamante passa i punti, stanno in coda al
//                banner come una riga piana, senza cornice.
//   - `image`  → la TEXTURE (materiale vero, macro, trattato in duotone dal
//                CSS). Senza, la variante B. È decorativa: `alt` di default "".
//
// La parola accentata si passa come <em> dentro `title`: semantica di
// enfasi, resa in lime dal CSS (.br-hero__title em).
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { IconArrow, IconCheck } from "@/components/ui/icons";

export type HeroStatKind = "live" | "starting-soon" | "high-edge";

export type HeroStat = {
  kind: HeroStatKind;
  label: string;
  /** null = non lo sappiamo → la cifra non si rende. */
  value: number | null;
  href?: string;
  onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void;
};

export type HeroBannerProps = {
  eyebrow: string;
  /** Headline; la parola accentata va in <em>. Es. <>Top opportunities <em>today.</em></> */
  title: ReactNode;
  subtitle?: string;
  stats?: HeroStat[];
  cta: { label: string; href: string; onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void };
  secondary?: { label: string; href: string; onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void };
  /** Punti in coda al banner. Omessi → niente. */
  aside?: { title?: ReactNode; subtitle?: string; points: string[] };
  /** Texture di fondo (materiale reale). Omessa → variante B, solo tipografia. */
  image?: { src: string; alt?: string };
  className?: string;
};

// La riga di calce della variante B: una linea sola, 2px, −7°. È un <svg>
// (non un div ruotato) così la linea è disegnata, scala col banner e non
// produce overflow. Su telefono la texture si spegne e resta questa.
function ChalkLine() {
  return (
    <svg className="br-hero__line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false">
      <line x1="-4" y1="52" x2="104" y2="40" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function HeroBanner({ eyebrow, title, subtitle, stats, cta, secondary, aside, image, className }: HeroBannerProps) {
  const shownStats = (stats ?? []).filter((s) => s.value != null);
  const hasAside = !!aside && aside.points.length > 0;
  return (
    <section
      className={["br-hero", className].filter(Boolean).join(" ")}
      data-has-aside={hasAside ? "true" : "false"}
      data-art={image ? "material" : "type"}
      aria-label={eyebrow}
    >
      {/* Fondo: texture (se c'è) + riga di calce. Il velo duotone e la grana
          stanno nel CSS (.br-hero__art::after, .br-hero__grain). */}
      <div className="br-hero__art">
        {image && <img className="br-hero__tex" src={image.src} alt={image.alt ?? ""} />}
        <ChalkLine />
      </div>
      <i className="br-hero__grain" aria-hidden />

      <p className="br-hero__eyebrow">{eyebrow}</p>
      <h1 className="br-hero__title">{title}</h1>

      <div className="br-hero__row">
        {subtitle && <p className="br-hero__sub">{subtitle}</p>}
        {shownStats.length > 0 && (
          <ul className="br-hero__stats">
            {shownStats.map((s) => {
              const inner = (
                <>
                  <b className="br-hero__stat-n">{s.value}</b>
                  <span className="br-hero__stat-l">{s.label}</span>
                </>
              );
              return (
                <li key={s.kind} data-kind={s.kind}>
                  {s.href ? (
                    <Link href={s.href} className="br-hero__stat" onClick={s.onClick}>{inner}</Link>
                  ) : (
                    <span className="br-hero__stat">{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="br-hero__ctas">
        <Link href={cta.href} className="br-hero__cta" data-tone="primary" onClick={cta.onClick}>
          {cta.label}
          <IconArrow size={16} />
        </Link>
        {secondary && (
          <Link href={secondary.href} className="br-hero__cta" data-tone="ghost" onClick={secondary.onClick}>
            {secondary.label}
          </Link>
        )}
      </div>

      {hasAside && aside && (
        <aside className="br-hero__aside">
          {aside.title && <h2 className="br-hero__aside-h">{aside.title}</h2>}
          {aside.subtitle && <p className="br-hero__aside-sub">{aside.subtitle}</p>}
          <ul className="br-hero__points">
            {aside.points.map((p) => (
              <li key={p}><IconCheck size={12} stroke={2} />{p}</li>
            ))}
          </ul>
        </aside>
      )}
    </section>
  );
}
