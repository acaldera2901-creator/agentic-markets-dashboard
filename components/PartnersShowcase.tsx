"use client";

// Presentazionale puro: riceve `lang` + il `country` già risolto e consuma il
// catalogo da lib/partners. Nessuna logica geo qui — il gate fail-closed
// (blocked) è nel page che lo monta; il `country` serve solo a risolvere i
// partner con un link diverso per paese (#PARTNERS-VELOBET-CASEA).
//
// #MIS-B — client component per una ragione sola: il beacon sul click
// affiliato. La vetrina mandava gli utenti ai partner senza lasciare traccia,
// quindi i click dalla scheda partita erano l'UNICO click misurato e
// /partners contava zero per costruzione.
import { offerFor, partnersFor, PARTNERS_COPY, PARTNER_TAGLINES, type PartnersLang, type ResolvedPartner } from "@/lib/partners";
import { trackEvent } from "@/lib/track-event";

function PartnerCard({ p, lang, featured, offer }: { p: ResolvedPartner; lang: PartnersLang; featured?: boolean; offer?: string }) {
  const t = PARTNERS_COPY[lang];
  return (
    <a
      className={featured ? "partner-card partner-card-featured" : "partner-card"}
      href={p.url}
      target="_blank"
      rel="nofollow sponsored noopener"
      onClick={() => {
        // Stessa forma del click partner nella scheda partita: `partner_id` e'
        // il NOME, cosi' l'aggregazione admin per partner_id continua a
        // funzionare e guadagna la vetrina. Fire-and-forget (il .catch sta in
        // trackEvent): non attende e non puo' mai bloccare l'apertura del link.
        // L'href non si tocca — i parametri di tracking delle reti restano
        // esattamente quelli.
        trackEvent("partner_click", {
          partner_id: p.name,
          meta: { surface: "partners_page" },
        });
      }}
    >
      <span className="partner-logo-wrap">
        {/* loghi statici in /public → <img> semplice, niente next/image */}
        <img
          src={p.logo}
          alt={p.name}
          className={p.logoShape === "emblem" ? "partner-logo partner-logo-emblem" : "partner-logo"}
          loading="lazy"
        />
      </span>
      <span className="partner-body">
        <span className="partner-name">{p.name}</span>
        <span className="partner-tagline">{PARTNER_TAGLINES[p.id][lang]}</span>
        {offer && (
          <span className="partner-offer">
            <span className="partner-offer-label">{t.offerLabel}</span>
            <span className="partner-offer-text">{offer}</span>
          </span>
        )}
        <span className="partner-cta">{t.visit} →</span>
      </span>
    </a>
  );
}

export function PartnersShowcase({ lang, country }: { lang: PartnersLang; country?: string }) {
  const t = PARTNERS_COPY[lang];
  const partners = partnersFor(country);
  const offers = new Map(partners.flatMap((p) => { const o = offerFor(p.id, country); return o ? [[p.id, o] as const] : []; }));
  const featured = partners.filter((p) => p.featured);
  const sportsbooks = partners.filter((p) => p.category === "sportsbook" && !p.featured);
  const casinos = partners.filter((p) => p.category === "casino");
  return (
    <>
      {featured.length > 0 && (
        <section className="partners-section">
          <h2 className="partners-label">{t.featured}</h2>
          <div className="partners-grid partners-grid-featured">
            {featured.map((p) => <PartnerCard key={p.id} p={p} lang={lang} featured offer={offers.get(p.id)} />)}
          </div>
        </section>
      )}

      {sportsbooks.length > 0 && (
        <section className="partners-section">
          <h2 className="partners-label">{t.sportsbook}</h2>
          <div className="partners-grid">
            {sportsbooks.map((p) => <PartnerCard key={p.id} p={p} lang={lang} offer={offers.get(p.id)} />)}
          </div>
        </section>
      )}

      {casinos.length > 0 && (
        <section className="partners-section">
          <h2 className="partners-label">{t.casino}</h2>
          <div className="partners-grid">
            {casinos.map((p) => <PartnerCard key={p.id} p={p} lang={lang} offer={offers.get(p.id)} />)}
          </div>
        </section>
      )}

      <p className="partners-disclosure">{offers.size > 0 && <>{t.offerTerms}<br /></>}{t.disclosure}</p>
    </>
  );
}
