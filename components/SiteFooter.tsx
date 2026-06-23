"use client";

// components/SiteFooter.tsx (#UI-FOOTER-UNIFIED-0623)
// Footer unico del sito, usato su home, dashboard e pagine World Cup (che prima
// non avevano footer). Presentazionale: rischio/18+, gioco responsabile,
// Terms + Privacy IN-SITE (route interne, niente target="_blank" → il back
// funziona), e una riga social con link PLACEHOLDER.
//
// I link responsabilità di gioco (GamCare/BeGambleAware) sono ESTERNI → restano
// target="_blank". Terms/Privacy sono route interne → <Link> client-side.
//
// Tema: usa i token --am-* via le utility, quindi segue data-theme come il resto
// del sito. Stringhe nelle 5 lingue del desk (it/en/es/fr/ru) con fallback en.

import Link from "next/link";

// TODO #UI-FOOTER-SOCIAL: sostituire "#" con gli URL reali dei profili social
// BetRedge quando disponibili. Per ora sono PLACEHOLDER (href="#") così la riga
// è presente nel layout ma non punta a nulla di esterno.
const SOCIAL_LINKS: { label: string; href: string }[] = [
  { label: "X", href: "#" },
  { label: "Instagram", href: "#" },
  { label: "Telegram", href: "#" },
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
        {SOCIAL_LINKS.map((s) => (
          // href="#": placeholder finché non ci sono gli URL reali (vedi TODO sopra)
          <a key={s.label} href={s.href} className="site-footer-social-link" aria-label={s.label}>
            {s.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
