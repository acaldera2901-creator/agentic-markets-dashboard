// Presentazionale puro: riceve solo `lang` e consuma il catalogo da lib/partners.
// Nessuna logica geo qui — il gate fail-closed è nel page che lo monta.
import Link from "next/link";
import { PARTNERS, PARTNERS_COPY, PARTNER_TAGLINES, type PartnersLang, type Partner } from "@/lib/partners";

function PartnerCard({ p, lang, featured }: { p: Partner; lang: PartnersLang; featured?: boolean }) {
  const t = PARTNERS_COPY[lang];
  return (
    <a
      className={featured ? "partner-card partner-card-featured" : "partner-card"}
      href={p.url}
      target="_blank"
      rel="nofollow sponsored noopener"
    >
      <span className="partner-logo-wrap">
        {/* loghi statici in /public → <img> semplice, niente next/image */}
        <img src={p.logo} alt={p.name} className="partner-logo" loading="lazy" />
      </span>
      <span className="partner-body">
        <span className="partner-name">{p.name}</span>
        <span className="partner-tagline">{PARTNER_TAGLINES[p.id][lang]}</span>
        <span className="partner-cta">{t.visit} →</span>
      </span>
    </a>
  );
}

export function PartnersShowcase({ lang }: { lang: PartnersLang }) {
  const t = PARTNERS_COPY[lang];
  const featured = PARTNERS.filter((p) => p.featured);
  const sportsbooks = PARTNERS.filter((p) => p.category === "sportsbook" && !p.featured);
  const casinos = PARTNERS.filter((p) => p.category === "casino");
  return (
    <div className="partners-page">
      <header className="partners-hero">
        <Link href="/" className="partners-back">{t.back}</Link>
        <h1 className="partners-title">{t.title}</h1>
        <p className="partners-subtitle">{t.subtitle}</p>
      </header>

      {featured.length > 0 && (
        <section className="partners-section">
          <h2 className="partners-label">{t.featured}</h2>
          <div className="partners-grid partners-grid-featured">
            {featured.map((p) => <PartnerCard key={p.id} p={p} lang={lang} featured />)}
          </div>
        </section>
      )}

      {sportsbooks.length > 0 && (
        <section className="partners-section">
          <h2 className="partners-label">{t.sportsbook}</h2>
          <div className="partners-grid">
            {sportsbooks.map((p) => <PartnerCard key={p.id} p={p} lang={lang} />)}
          </div>
        </section>
      )}

      {casinos.length > 0 && (
        <section className="partners-section">
          <h2 className="partners-label">{t.casino}</h2>
          <div className="partners-grid">
            {casinos.map((p) => <PartnerCard key={p.id} p={p} lang={lang} />)}
          </div>
        </section>
      )}

      <p className="partners-disclosure">{t.disclosure}</p>
    </div>
  );
}
