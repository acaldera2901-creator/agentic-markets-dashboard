// components/lobby/HeroBanner.tsx — #RESTYLING-0921 round 2
//
// Il banner in testa alla Home (ref-01): eyebrow, headline a due righe con
// UNA parola in lime, sottotitolo, le pill dei conteggi veri, la CTA verde
// piena — l'unica della schermata — e, a destra, la scatola dei value prop.
//
// Tutto ciò che è un NUMERO o una PROMESSA arriva dal chiamante:
//   - `stats`  → i conteggi (live / starting soon / high edge). Una stat con
//                value null NON si rende: meglio due pill vere che tre con un
//                trattino.
//   - `points` → la checklist. Nessun default: «Trusted by 100K+ bettors»
//                nell'immagine di riferimento è un placeholder di ChatGPT, non
//                un dato nostro. Se non c'è, la scatola non c'è.
//   - `image`  → foto vera (action-shot) se esiste. Senza, il pattern
//                «floodlight» qui sotto: gradienti + fasci di luce in royal,
//                nessuna foto stock finta.
//
// La parola accentata si passa come <em> dentro `title`: semantica di
// enfasi, resa in lime dal CSS (.br-hero__title em).
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { GlyphArrow, GlyphBars, GlyphCheck, GlyphClock } from "@/components/ui/glyphs";

export type HeroStatKind = "live" | "starting-soon" | "high-edge";

export type HeroStat = {
  kind: HeroStatKind;
  label: string;
  /** null = non lo sappiamo → la pill non si rende. */
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
  /** Scatola a destra. Omessa → niente scatola, il banner va a tutta larghezza. */
  aside?: { title?: ReactNode; subtitle?: string; points: string[] };
  /** Foto vera. Omessa → pattern astratto. */
  image?: { src: string; alt?: string };
  className?: string;
};

function StatIcon({ kind }: { kind: HeroStatKind }) {
  if (kind === "live") return <i className="br-hero__stat-dot" aria-hidden />;
  if (kind === "starting-soon") return <GlyphClock size={16} />;
  return <GlyphBars size={16} />;
}

// Il pattern di default: fasci di luce da stadio (floodlight) in royal, che
// convergono verso l'angolo in alto a destra. Niente blob, niente mesh: linee
// e un'ellisse — riferiscono il dominio (il campo sotto i riflettori).
function Floodlight() {
  return (
    <svg viewBox="0 0 640 300" preserveAspectRatio="xMaxYMid slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id="br-hero-beam" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgb(127,196,255)" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="rgb(90,133,255)" stopOpacity="0.10" />
          <stop offset="1" stopColor="rgb(90,133,255)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="br-hero-pitch" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgb(61,245,110)" stopOpacity="0.28" />
          <stop offset="1" stopColor="rgb(61,245,110)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="520" cy="300" rx="360" ry="120" fill="url(#br-hero-pitch)" />
      <g fill="url(#br-hero-beam)">
        <path d="M640 0 L380 300 L520 300 Z" />
        <path d="M640 0 L120 300 L300 300 Z" opacity="0.7" />
        <path d="M640 0 L560 300 L640 300 Z" opacity="0.5" />
      </g>
      <g stroke="rgb(127,196,255)" strokeOpacity="0.35" strokeWidth="1" fill="none">
        <path d="M0 262 H640" />
        <path d="M0 282 H640" strokeOpacity="0.18" />
        <ellipse cx="520" cy="262" rx="70" ry="18" />
      </g>
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
      aria-label={eyebrow}
    >
      <div className="br-hero__art">
        {image ? <img src={image.src} alt={image.alt ?? ""} /> : <Floodlight />}
      </div>

      <div className="br-hero__body">
        <p className="br-hero__eyebrow">{eyebrow}</p>
        <h1 className="br-hero__title">{title}</h1>
        {subtitle && <p className="br-hero__sub">{subtitle}</p>}

        {shownStats.length > 0 && (
          <ul className="br-hero__stats">
            {shownStats.map((s) => {
              const inner = (
                <>
                  <StatIcon kind={s.kind} />
                  <span>{s.label}</span>
                  <span className="br-hero__stat-n">{s.value}</span>
                </>
              );
              return (
                <li key={s.kind}>
                  {s.href ? (
                    <Link href={s.href} className="br-hero__stat" data-kind={s.kind} onClick={s.onClick}>{inner}</Link>
                  ) : (
                    <span className="br-hero__stat" data-kind={s.kind}>{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="br-hero__ctas">
          <Link href={cta.href} className="br-hero__cta" data-tone="primary" onClick={cta.onClick}>
            {cta.label}
            <GlyphArrow size={16} />
          </Link>
          {secondary && (
            <Link href={secondary.href} className="br-hero__cta" data-tone="ghost" onClick={secondary.onClick}>
              {secondary.label}
            </Link>
          )}
        </div>
      </div>

      {hasAside && aside && (
        <aside className="br-hero__aside">
          {aside.title && <h2 className="br-hero__aside-h">{aside.title}</h2>}
          {aside.subtitle && <p className="br-hero__aside-sub">{aside.subtitle}</p>}
          <ul className="br-hero__points">
            {aside.points.map((p) => (
              <li key={p}><i aria-hidden><GlyphCheck size={12} /></i>{p}</li>
            ))}
          </ul>
        </aside>
      )}
    </section>
  );
}
