// components/lobby/SportHero.tsx — #RESTYLING-0921 round 6
//
// L'hero a piena larghezza in testa alle viste di sezione (Calcio, Tennis).
// Fino al round 5 quelle viste non avevano NIENTE in cima: si cliccava
// «Calcio» in nav e partiva la griglia di card, senza una riga che dicesse
// dove si era finiti (`view !== "home" ? null : <HeroBanner/>`).
//
// LA FORMA viene dal riferimento di Andrea (betredge-studio-0922, hero della
// pagina Calcio, screenshot in docs/reference/round6/): fascia bassa e larga,
// foto d'azione sul lato destro che sfuma nel navy verso sinistra, e SOPRA —
// in HTML, non cotto nell'immagine — eyebrow, headline su due righe con la
// seconda in lime, una riga di sottotitolo, e in un angolo un badge con UN
// numero.
//
// PERCHÉ IL TESTO NON STA NELL'IMMAGINE. Una headline dentro un JPEG non si
// traduce (il sito parla cinque lingue), non si seleziona, non si legge con
// uno screen reader e va rigenerata a ogni ritocco di copy. La foto porta
// l'atmosfera, il testo lo porta l'HTML.
//
// IL BADGE È UN DATO VERO. `stat.value` è il conteggio delle partite che
// stanno davvero sul board di quello sport, passato dal chiamante. A null
// (o a zero) il badge NON si rende: la stessa regola delle pill di
// HeroBanner — «meglio nessuna cifra che una cifra finta». Lo zero-padding a
// due cifre («08») è solo formato, non gonfia il numero.
//
// L'IMMAGINE È OPZIONALE, e oggi manca: art-director sta generando le foto
// d'azione (round 6). Senza `image` il componente rende `data-art="type"` —
// un fondo a gradiente nei token di casa — che è un hero completo e
// spedibile, non un buco. Quando le foto arrivano basta passare `image`.
import type { ReactNode } from "react";

export type SportHeroStat = {
  /** Conteggio reale. null → il badge non si rende. */
  value: number | null;
  label: string;
};

export type SportHeroProps = {
  eyebrow: string;
  /** Prima riga della headline, nel colore del testo. */
  title: string;
  /** Seconda riga, in lime. È l'accento: una parola o una frase breve. */
  accent: string;
  subtitle?: string;
  stat?: SportHeroStat;
  /** La foto d'azione. Omessa → fondo a gradiente. Decorativa: `alt` "" di default. */
  image?: { src: string; srcSm?: string; alt?: string };
  /** Il segno dello sport accanto all'eyebrow (opzionale). */
  mark?: ReactNode;
  className?: string;
};

/** «8» → «08». Solo formato: sopra il 99 si scrive com'è. */
function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function SportHero({ eyebrow, title, accent, subtitle, stat, image, mark, className }: SportHeroProps) {
  const showStat = !!stat && stat.value != null && stat.value > 0;
  return (
    <section
      className={["br-sporthero", className].filter(Boolean).join(" ")}
      data-art={image ? "photo" : "type"}
      aria-label={eyebrow}
    >
      <div className="br-sporthero__art">
        {image && (
          <img
            className="br-sporthero__img"
            src={image.src}
            srcSet={image.srcSm ? `${image.srcSm} 720w, ${image.src} 1440w` : undefined}
            sizes="(max-width: 640px) 100vw, 1340px"
            alt={image.alt ?? ""}
            /* È il primo elemento della vista: si carica subito, non in coda. */
            fetchPriority="high"
            decoding="async"
          />
        )}
      </div>

      <div className="br-sporthero__text">
        <p className="br-sporthero__eyebrow">
          {mark}
          {eyebrow}
        </p>
        <h1 className="br-sporthero__title">
          <span className="br-sporthero__line">{title}</span>
          <em className="br-sporthero__line">{accent}</em>
        </h1>
        {subtitle && <p className="br-sporthero__sub">{subtitle}</p>}
      </div>

      {showStat && stat && (
        <p className="br-sporthero__stat">
          <b className="br-sporthero__stat-n">{pad2(stat.value!)}</b>
          <span className="br-sporthero__stat-l">{stat.label}</span>
        </p>
      )}
    </section>
  );
}
