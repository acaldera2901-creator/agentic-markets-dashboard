"use client";

// components/SiteFooter.tsx (#UI-FOOTER-UNIFIED-0623)
// Footer unico del sito, usato su home, dashboard e pagine World Cup (che prima
// non avevano footer). Presentazionale: rischio/18+, gioco responsabile,
// Terms + Privacy IN-SITE (route interne, niente target="_blank" → il back
// funziona), e una riga social con icone (Instagram/X/Facebook link; Telegram
// solo icona finché non c'è il canale community).
//
// I link responsabilità di gioco (GamCare/BeGambleAware) sono ESTERNI → restano
// target="_blank". Terms/Privacy sono route interne → <Link> client-side.
//
// Tema: usa i token --am-* via le utility, quindi segue data-theme come il resto
// del sito. Stringhe nelle 5 lingue del desk (it/en/es/fr/ru) con fallback en.

import Link from "next/link";
import type { ReactNode } from "react";

// #UI-FOOTER-SOCIAL-0623: icone social inline (SVG, currentColor → seguono il
// tema). URL reali BetRedge. Telegram = SOLO icona, senza link: il canale/gruppo
// community non esiste ancora; il link verrà attaccato quando sarà creato.
const ICONS: Record<string, ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.332.014 7.052.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.59-7.933zm-1.291 19.482h2.039L6.486 3.24H4.298l13.312 17.395z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  ),
};

// href: null → icona presente ma non cliccabile (Telegram, in attesa del canale).
const SOCIAL_LINKS: { key: string; label: string; href: string | null }[] = [
  { key: "instagram", label: "Instagram", href: "https://www.instagram.com/betr.edge/" },
  { key: "x", label: "X", href: "https://x.com/BetrEdge" },
  { key: "facebook", label: "Facebook", href: "https://www.facebook.com/" },
  { key: "telegram", label: "Telegram", href: null },
];

type FooterLang = "it" | "en" | "es" | "fr" | "ru";

const COPY: Record<FooterLang, {
  note: string; pastperf: string; partnerlinks: string; terms: string; privacy: string; social: string;
}> = {
  it: {
    note: "BetRedge mostra analisi probabilistiche. Non garantisce profitti e non sostituisce la gestione del rischio personale.",
    pastperf: "Le performance passate non garantiscono risultati futuri.",
    partnerlinks: "I link partner sono affiliati commerciali.",
    terms: "Termini di Servizio", privacy: "Privacy Policy", social: "Seguici",
  },
  en: {
    note: "BetRedge shows probabilistic analysis. It does not guarantee profits and does not replace personal risk management.",
    pastperf: "Past performance does not guarantee future results.",
    partnerlinks: "Partner links are commercial affiliates.",
    terms: "Terms of Service", privacy: "Privacy Policy", social: "Follow us",
  },
  es: {
    note: "BetRedge muestra análisis probabilísticos. No garantiza beneficios y no sustituye la gestión personal del riesgo.",
    pastperf: "El rendimiento pasado no garantiza resultados futuros.",
    partnerlinks: "Los enlaces de partners son afiliados comerciales.",
    terms: "Términos del Servicio", privacy: "Política de Privacidad", social: "Síguenos",
  },
  fr: {
    note: "BetRedge montre des analyses probabilistes. Elle ne garantit pas de profits et ne remplace pas la gestion personnelle du risque.",
    pastperf: "Les performances passées ne garantissent pas les résultats futurs.",
    partnerlinks: "Les liens partners sont des affiliés commerciaux.",
    terms: "Conditions de Service", privacy: "Politique de Confidentialité", social: "Suivez-nous",
  },
  ru: {
    note: "BetRedge показывает вероятностный анализ. Он не гарантирует прибыль и не заменяет личное управление рисками.",
    pastperf: "Прошлые результаты не гарантируют будущих.",
    partnerlinks: "Партнёрские ссылки — коммерческие аффилиаты.",
    terms: "Условия обслуживания", privacy: "Политика конфиденциальности", social: "Мы в соцсетях",
  },
};

function pick(lang: string): FooterLang {
  return lang === "it" || lang === "es" || lang === "fr" || lang === "ru" ? lang : "en";
}

export function SiteFooter({ lang = "en" }: { lang?: string }) {
  const t = COPY[pick(lang)];
  return (
    <footer className="site-footer">
      <p className="site-footer-note">{t.note}</p>
      <div className="site-footer-row">
        <span className="site-footer-18">18+</span>
        <span>{t.pastperf}</span>
        <span className="site-footer-sep">|</span>
        {/* gioco responsabile = link ESTERNI → restano target="_blank" */}
        <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer">GamCare</a>
        <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer">BeGambleAware</a>
        <span className="site-footer-sep">|</span>
        <span>{t.partnerlinks}</span>
        <span className="site-footer-sep">|</span>
        {/* Terms/Privacy = route INTERNE → <Link>, navigano nel sito (back ok) */}
        <Link href="/terms">{t.terms}</Link>
        <Link href="/privacy">{t.privacy}</Link>
      </div>
      <div className="site-footer-social" aria-label={t.social}>
        <span className="site-footer-social-lab">{t.social}</span>
        {SOCIAL_LINKS.map((s) =>
          s.href ? (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="site-footer-social-link"
              aria-label={s.label}
            >
              {ICONS[s.key]}
            </a>
          ) : (
            // Telegram: solo icona finché il canale community non esiste (no link).
            <span key={s.key} className="site-footer-social-icon" aria-label={s.label} role="img">
              {ICONS[s.key]}
            </span>
          )
        )}
      </div>
    </footer>
  );
}
