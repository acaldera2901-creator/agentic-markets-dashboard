"use client";

// app/components/LandingCarousel.tsx (#HOME-BETMODE-1 · #HOME-CREATIVE-1)
// Hero della landing pubblica: il vecchio mega-hero a tutto schermo
// (.lp-hero-img) è sostituito da un banner più piccolo che RUOTA in carosello,
// stile "betmode": 2 slide per vista su desktop, 1 su mobile, frecce ‹ ›, dots
// (attivo allungato in coral), autoplay 6s con pausa su hover/focus, disattivato
// con prefers-reduced-motion.
//
// Due TIPI di slide:
//  · "overlay"  — foto reale (/public/banners) + copy HTML sovrapposta, riusa le
//    CAMPAGNE i18n di lib/house-banners.ts (eyebrow/headline/accent/cta). Overlay
//    scuro→coral per contrasto WCAG del testo bianco. [comportamento storico]
//  · "creative" — banner creativo FINITO (16:9, logo+testo+CTA GIÀ nell'immagine),
//    /public/banners/creatives/*. Si renderizza SOLO l'<Image> dentro un <Link>:
//    niente overlay, niente body HTML (sarebbe doppio-testo). #HOME-CREATIVE-1
//
// NB: i creativi 16:9 nello slot 2-up (~518×228, ratio ~2.27) vengono ritagliati
// in alto/basso con object-fit:cover — atteso/accettato (decisione Andrea).

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { copyFor, ctaLabelFor, HOUSE_CAMPAIGNS, type HouseCampaign, type Lang } from "@/lib/house-banners";

const AUTOPLAY_MS = 6000;
const MOBILE_BP = 860; // sotto = 1 slide per vista (coerente con il proto)

// Set lingua ampio del desk → cade su "en" per le lingue non coperte (copyFor lo
// rifà comunque, ma normalizzo qui per il tipo Lang).
function asLang(lang: string): Lang {
  return lang === "it" || lang === "es" || lang === "fr" || lang === "ru" ? lang : "en";
}

// L'ordine dell'array è l'ordine in carosello.
//
// Slide "creative": banner finito (image-only). Solo img + href + alt.
// Slide "overlay": foto + campagna i18n (campaignId → HOUSE_CAMPAIGNS); se l'id
// sparisse la slide viene saltata, nessun crash. #HOME-BETMODE-1 / #HOME-CREATIVE-1
type CreativeDef = {
  kind: "creative";
  img: string;
  href: string;
  /** alt descrittivo del banner (contenuto + sport). */
  imgAlt: string;
};
type OverlayDef = {
  kind: "overlay";
  campaignId: string;
  img: string;
  /** alt fotografico oltre alla headline (descrive l'immagine, non ripete la copy). */
  imgAlt: string;
};
type SlideDef = CreativeDef | OverlayDef;

const ACCOUNT_HREF = "/app?tab=account";

// Rotazione curata di creativi (16:9 finiti). #HOME-CREATIVE-1
// Sono scelti puntando a quelli che reggono meglio il ritaglio 2-up (soggetto +
// headline centrati, footer non indispensabile). I restanti creativi su disco
// (5849/5851/5852/5857/5858) sono tenuti per altri usi.
const SLIDE_DEFS: SlideDef[] = [
  // 1 · creativo "grosso" hero — IT'S AN EDGE / MORE THAN PREDICTIONS (calcio, esultanza)
  //     con pannelli Leaderboard + Big Wins. Prima slide, priority.
  { kind: "creative", img: "/banners/creatives/creative-5855.jpg", href: ACCOUNT_HREF, imgAlt: "BetRedge — It's an edge. More than predictions. Calciatore in esultanza con classifica e vincite" },
  // 2 · creativo calcio — MORE INSIGHT. MORE PROFITS. (soggetto a destra, layout pulito)
  { kind: "creative", img: "/banners/creatives/creative-5854.jpg", href: ACCOUNT_HREF, imgAlt: "BetRedge — More insight. More profits. Calciatore in azione" },
  // 3 · creativo tennis — PREDICT. BET. WIN BIG. (tennista, layout pulito e leggibile)
  { kind: "creative", img: "/banners/creatives/creative-5850.jpg", href: ACCOUNT_HREF, imgAlt: "BetRedge — Predict. Bet. Win big. Tennista in azione" },
  // 4 · creativo basket — SMARTER PICKS. BIGGER WINS. (cestista, buon contrasto)
  { kind: "creative", img: "/banners/creatives/creative-5853.jpg", href: ACCOUNT_HREF, imgAlt: "BetRedge — Smarter picks. Bigger wins. Cestista in azione" },
  // 5 · creativo tennis — DATA. STRATEGY. WINNING EDGE. (tennista donna)
  { kind: "creative", img: "/banners/creatives/creative-5859.jpg", href: ACCOUNT_HREF, imgAlt: "BetRedge — Data. Strategy. Winning edge. Tennista in azione" },
  // 6 · vecchio hero grosso betredge — banner storico tutti-gli-sport (Andrea: tienine
  //     uno come quello vecchio grosso). Image-only come i creativi. #HOME-CREATIVE-1
  { kind: "creative", img: "/banners/hero-allsports.jpg", href: ACCOUNT_HREF, imgAlt: "BetRedge — La tua edge su ogni sport" },
];

type Slide =
  | (CreativeDef & { campaign?: undefined })
  | (OverlayDef & { campaign: HouseCampaign });

const SLIDES: Slide[] = SLIDE_DEFS.flatMap((d): Slide[] => {
  if (d.kind === "creative") return [d];
  const campaign = HOUSE_CAMPAIGNS.find((c) => c.id === d.campaignId);
  return campaign ? [{ ...d, campaign }] : [];
});

export default function LandingCarousel({ lang }: { lang: string }) {
  const L = asLang(lang);
  const total = SLIDES.length;
  const [perView, setPerView] = useState(1); // SSR-safe: 1; corretto al mount
  const [idx, setIdx] = useState(0);
  const reduceRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hoverRef = useRef(false);

  const maxIdx = Math.max(0, total - perView);

  // perView reattivo + flag reduced-motion. Solo client (window).
  useEffect(() => {
    const mqMobile = window.matchMedia(`(max-width:${MOBILE_BP}px)`);
    const mqReduce = window.matchMedia("(prefers-reduced-motion:reduce)");
    const syncView = () => setPerView(mqMobile.matches ? 1 : 2);
    const syncReduce = () => { reduceRef.current = mqReduce.matches; };
    syncView();
    syncReduce();
    mqMobile.addEventListener("change", syncView);
    mqReduce.addEventListener("change", syncReduce);
    return () => {
      mqMobile.removeEventListener("change", syncView);
      mqReduce.removeEventListener("change", syncReduce);
    };
  }, []);

  // Tieni idx nei limiti quando perView cambia (resize desktop↔mobile).
  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, total - perView)));
  }, [perView, total]);

  const stopAuto = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startAuto = useCallback(() => {
    stopAuto();
    if (reduceRef.current || hoverRef.current || total <= perView) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i >= Math.max(0, total - perView) ? 0 : i + 1));
    }, AUTOPLAY_MS);
  }, [stopAuto, perView, total]);

  // (Ri)avvia l'autoplay quando cambiano i parametri rilevanti.
  useEffect(() => {
    startAuto();
    return stopAuto;
  }, [startAuto, stopAuto, idx]);

  const go = useCallback((next: number) => {
    setIdx(() => (next < 0 ? maxIdx : next > maxIdx ? 0 : next));
  }, [maxIdx]);

  const onEnter = () => { hoverRef.current = true; stopAuto(); };
  const onLeave = () => { hoverRef.current = false; startAuto(); };

  if (total === 0) return null;

  const slideWidthPct = 100 / perView;

  return (
    <div className="lp-carousel-wrap">
      <div
        className="lp-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label={L === "it" ? "In evidenza su BetRedge" : "Featured on BetRedge"}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocusCapture={onEnter}
        onBlurCapture={onLeave}
      >
        <button
          type="button"
          className="lp-carousel-arrow lp-carousel-prev"
          onClick={() => go(idx - 1)}
          aria-label={L === "it" ? "Slide precedente" : "Previous slide"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          className="lp-carousel-arrow lp-carousel-next"
          onClick={() => go(idx + 1)}
          aria-label={L === "it" ? "Slide successiva" : "Next slide"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="lp-carousel-vp">
          <ul
            className="lp-carousel-track"
            style={{
              transform: `translateX(-${idx * slideWidthPct}%)`,
              // larghezza slide gestita in CSS via questa custom property
              ["--lp-per-view" as string]: String(perView),
            }}
          >
            {SLIDES.map((s, i) => {
              // Visibile = nel range [idx, idx+perView). Le altre sono fuori
              // schermo → fuori dal flusso di tabulazione (aria-hidden/inert-like).
              const visible = i >= idx && i < idx + perView;

              // CREATIVE — banner finito: solo <Image> dentro <Link>, niente
              // overlay/body (il testo è già nell'immagine). #HOME-CREATIVE-1
              if (s.kind === "creative") {
                return (
                  <li
                    key={s.img}
                    className="lp-carousel-slide is-creative"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} / ${total}`}
                    aria-hidden={!visible}
                  >
                    <Link
                      href={s.href}
                      className="lp-carousel-creative"
                      aria-label={s.imgAlt}
                      tabIndex={visible ? undefined : -1}
                    >
                      <Image
                        src={s.img}
                        alt={s.imgAlt}
                        fill
                        sizes="(max-width:860px) 100vw, 580px"
                        className="lp-carousel-img"
                        priority={i === 0}
                      />
                    </Link>
                  </li>
                );
              }

              // OVERLAY — foto + copy i18n sovrapposta. [storico #HOME-BETMODE-1]
              const c = copyFor(s.campaign, L);
              const cta = ctaLabelFor(s.campaign, L);
              return (
                <li
                  key={s.campaignId}
                  className="lp-carousel-slide"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} / ${total}`}
                  aria-hidden={!visible}
                >
                  <div className="lp-carousel-art">
                    <Image
                      src={s.img}
                      alt={s.imgAlt}
                      fill
                      sizes="(max-width:860px) 100vw, 580px"
                      className="lp-carousel-img"
                      priority={i === 0}
                    />
                    <span className="lp-carousel-ov" aria-hidden="true" />
                  </div>
                  <div className="lp-carousel-body">
                    <span className="lp-carousel-eyebrow">{c.eyebrow}</span>
                    <h2 className="lp-carousel-head">
                      {c.headline}
                      {c.accent ? <> <span className="lp-carousel-accent">{c.accent}</span></> : null}
                    </h2>
                    <p className="lp-carousel-sub">{c.sub}</p>
                    <Link
                      href={s.campaign.cta.href}
                      className="lp-carousel-cta"
                      tabIndex={visible ? undefined : -1}
                    >
                      {cta}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="lp-carousel-dots" role="tablist" aria-label={L === "it" ? "Seleziona slide" : "Select slide"}>
        {Array.from({ length: maxIdx + 1 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === idx}
            aria-label={`${i + 1} / ${maxIdx + 1}`}
            className={`lp-carousel-dot${i === idx ? " is-active" : ""}`}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}
