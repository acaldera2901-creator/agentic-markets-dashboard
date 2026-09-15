import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ENTITY } from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "Privacy Policy | BetRedge",
  description: "Privacy Policy and GDPR information for BetRedge.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen font-mono mc-scene-clay" data-mc-ground style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      {/* #UI-MACHINA-0802 fase 3 — la scena del fondo cinematico, come sul desk. */}
      <span className="bgfix" aria-hidden="true" />
      <div className="legal-sheet max-w-2xl mx-auto my-10 px-7 py-11 space-y-8">
        <div className="space-y-2">
          <Link href="/" className="text-[10px] text-[var(--am-muted-2)] hover:text-[var(--am-coral)] uppercase tracking-wider">
            ← Back to BetRedge
          </Link>
          <h1 className="text-xl font-bold text-[var(--am-text)]">Privacy Policy</h1>
          <p className="text-[11px] text-[var(--am-muted-2)]">Last updated: September 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">1. Controller</h2>
          <p className="text-xs leading-relaxed">
            {/* #SITE-ENTITY-0824 — l'identità arriva da lib/legal-entity.ts, la stessa
                fonte del footer e delle email.
                ⚠️ AVVOCATO: GDPR art. 13(1)(a) richiede l'identità del TITOLARE del
                trattamento. Qui ora c'è marchio + indirizzo di corrispondenza, senza
                forma societaria né numero di registro: non si asserisce nulla di falso,
                ma nessuna persona giuridica è nominata come titolare. Da riconciliare
                quando l'entità è decisa. */}
            BetRedge (&quot;we&quot;, &quot;us&quot;) is a sports prediction platform. For GDPR purposes, the data controller is {LEGAL_ENTITY.senderName}, {LEGAL_ENTITY.correspondence}. Contact: <a href={`mailto:${LEGAL_ENTITY.contactEmail}`} className="underline hover:text-[var(--am-coral)]">{LEGAL_ENTITY.contactEmail}</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">2. Data We Collect</h2>
          <ul className="text-xs space-y-2 list-disc list-inside">
            <li><strong className="text-[var(--am-text)]">Profile data:</strong> When you create an account — including free ones — we store your email address, selected plan, name, language, timezone and marketing-consent flag (with timestamps) server-side in our database (Supabase). Interface preferences such as language and theme are also cached locally in your browser (localStorage).</li>
            {/* #PRIVACY-ANALYTICS-0915 — era "anonymous usage events". Non lo sono:
                gli eventi portano un id di sessione casuale che li raggruppa, quindi
                sono PSEUDONIMI (Cons. 26 GDPR). La parola "anonymous" toglieva al
                trattamento la base giuridica che gli serve davvero (consenso). */}
            <li><strong className="text-[var(--am-text)]">Usage events:</strong> Product usage events (page and tab views, tab clicks, plan views, banner views, partner link clicks, sign-up and checkout steps) recorded in our own first-party database. They contain no name, email or account reference, but they can be grouped by a randomly generated session identifier, so they are pseudonymous rather than anonymous. That identifier is created and sent <strong className="text-[var(--am-text)]">only after you accept cookies</strong> via the banner; if you decline, or have not answered yet, events are still counted but carry no identifier and cannot be linked to one another.</li>
            <li><strong className="text-[var(--am-text)]">Acquisition source:</strong> When you create an account, we store how you first reached the site (campaign parameters in the link you followed, the referring website, and the first page you landed on). This is first-party data kept in your browser&apos;s localStorage until sign-up and then saved with your profile; it is never shared with advertising networks.</li>
            <li><strong className="text-[var(--am-text)]">Deposit requests:</strong> For paying clients, name, email, and payment method are stored securely in Supabase with row-level security.</li>
            <li><strong className="text-[var(--am-text)]">Technical data:</strong> Standard server logs (IP address, browser type, request timestamps) retained for up to 30 days for security purposes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">3. Legal Basis</h2>
          <ul className="text-xs space-y-2 list-disc list-inside">
            <li><strong className="text-[var(--am-text)]">Contract performance:</strong> Processing necessary to provide the prediction service you requested.</li>
            {/* #PRIVACY-ANALYTICS-0915 — le analytics NON stanno sul legittimo
                interesse: l'accesso allo storage del terminale per finalità non
                strettamente necessarie richiede consenso (art. 5(3) Dir. ePrivacy,
                art. 122 Codice Privacy), e il trattamento a valle segue quella base
                (art. 6(1)(a) GDPR). Il legittimo interesse resta dov'è vero:
                sicurezza dei log e soft opt-in della sez. 10. */}
            <li><strong className="text-[var(--am-text)]">Consent:</strong> Product analytics and any other non-essential storage on your device, including the session identifier described in Section 4 (Art. 6(1)(a) GDPR, together with Art. 5(3) of the ePrivacy Directive — Art. 122 of the Italian Privacy Code). Marketing communications where applicable. You may withdraw consent at any time through the cookie banner; withdrawal does not affect processing already carried out while consent was in place.</li>
            <li><strong className="text-[var(--am-text)]">Legitimate interest:</strong> Security and abuse prevention (server logs, rate limiting) and the &quot;soft opt-in&quot; emails to existing clients described in Section 10.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">4. Cookies and Local Storage</h2>
          {/* #PRIVACY-ANALYTICS-0915 — la vecchia frase ("essential technical storage
              … and anonymous usage analytics") metteva le analytics fra le cose
              esenti da consenso. Qui ogni chiave è elencata con la sua qualificazione
              esatta, così la pagina si può verificare leggendo il codice. */}
          <p className="text-xs leading-relaxed">
            BetRedge does not set first-party cookies for analytics: what we keep on your device is browser storage, listed key by key below. Each entry says whether it is exempt from consent (strictly necessary or a preference you set yourself) or requires your consent.
          </p>
          <ul className="text-xs space-y-2 list-disc list-inside">
            <li><strong className="text-[var(--am-text)]">gdpr_consent</strong> (localStorage) — records your answer to the cookie banner. Strictly necessary: it is what makes your choice work, so it is stored whatever you answer. <em>No consent required.</em></li>
            <li><strong className="text-[var(--am-text)]">agentic-lang</strong> (localStorage) — the interface language. Set when you pick a language, and pre-filled on your first visit with the language your browser announces. It is a display preference, used only to show you the site in the right language. <em>No consent required.</em></li>
            <li><strong className="text-[var(--am-text)]">br_house_dismissed</strong> (localStorage) — remembers that you closed one of our own in-app promotional banners, so it is not shown to you again. <em>No consent required.</em></li>
            <li><strong className="text-[var(--am-text)]">am_attrib</strong> (localStorage) — the acquisition source described in Section 2 (campaign parameters, referring website, landing page). Not necessary to run the service. <em>Written only after you accept cookies.</em></li>
            <li><strong className="text-[var(--am-text)]">am_sid</strong> (sessionStorage) — a randomly generated identifier that groups the usage events of a single browsing session, so that ten page views by one visitor are not counted as ten visitors. It contains no personal detail, but it makes those events pseudonymous rather than anonymous. <em>Created and sent only after you accept cookies</em>, and discarded when you close the tab.</li>
          </ul>
          <p className="text-xs leading-relaxed">
            Non-essential third-party tools are loaded only after you accept cookies via the banner; if you decline, they are not loaded. These are: our live-chat provider (Tawk.to), which sets its own cookies, and — where active — Google advertising and analytics tools (Google Tag Manager, Google Analytics 4, Google Ads) and the Meta Pixel, which set their own cookies and identifiers. Consent signals are passed to Google via Consent Mode; without your acceptance these tools remain fully disabled. Partner links to bookmakers and casinos may set their own cookies — please review their privacy policies before clicking.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">5. Data Sharing</h2>
          <p className="text-xs leading-relaxed">
            We do not sell personal data. We use Supabase (EU-hosted) as our database provider. Vercel (US-based) hosts the application; their DPA applies. We use Resend, Inc. (US-based) to deliver account and marketing emails, as our processor under a Data Processing Agreement, with EU-US transfers covered by Standard Contractual Clauses and/or the EU-US Data Privacy Framework. Only if you accept cookies via the banner, Google LLC (US-based) and Meta Platforms, Inc. (US-based) receive usage and advertising data (such as pseudonymous identifiers, page views and conversion events) through the tools listed in Section 4; these transfers are covered by the EU-US Data Privacy Framework and/or Standard Contractual Clauses. No other third parties receive your personal data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">6. Retention</h2>
          <p className="text-xs leading-relaxed">
            Profile data stored in your browser can be deleted at any time by clearing localStorage. Server-side data for paying clients is retained for 2 years after account closure for legal and tax purposes, then deleted.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">7. Your Rights (GDPR)</h2>
          <p className="text-xs leading-relaxed">
            Under GDPR you have the right to: access, rectify, erase, restrict processing, data portability, and object to processing. To exercise these rights, email <a href="mailto:info@betredge.com" className="underline hover:text-[var(--am-coral)]">info@betredge.com</a>. You may also lodge a complaint with your local supervisory authority.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">8. Responsible Gambling</h2>
          <p className="text-xs leading-relaxed">
            BetRedge provides sports prediction data for informational purposes only. Past performance does not guarantee future results. We strongly support responsible gambling. If you need help, please contact:
          </p>
          <ul className="text-xs space-y-1 list-disc list-inside">
            <li><a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--am-coral)]">GamCare</a> — UK gambling support</li>
            <li><a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--am-coral)]">BeGambleAware</a> — gambling awareness</li>
            <li><a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--am-coral)]">Gambling Therapy</a> — free global support</li>
          </ul>
          <p className="text-xs text-[var(--am-muted-2)]">This service is strictly for users aged 18 and over.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">9. Affiliate Disclosure</h2>
          <p className="text-xs leading-relaxed">
            Some links on this platform are commercial affiliate links. We may receive a commission if you register with a partner bookmaker or casino. This does not affect the independence of our prediction model.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">10. Direct Marketing (CRM &amp; Email)</h2>
          <p className="text-xs leading-relaxed">
            <strong className="text-[var(--am-text)]">Purpose.</strong> We send marketing communications about BetRedge (product news, content, offers and promotions) by email through our CRM.
          </p>
          <p className="text-xs leading-relaxed">
            <strong className="text-[var(--am-text)]">Legal basis.</strong> For prospects (free users who have never purchased) we rely on your explicit consent (Art. 6(1)(a) GDPR), collected via an unticked opt-in checkbox at sign-up. For current and former clients we rely on the &quot;soft opt-in&quot; for similar services (Art. 6(1)(f) GDPR), with a free right to object at any time.
          </p>
          <p className="text-xs leading-relaxed">
            <strong className="text-[var(--am-text)]">Email processor &amp; transfers.</strong> Marketing and account emails are delivered through Resend, Inc. (USA), acting as our processor under a Data Processing Agreement (Art. 28 GDPR); US transfers are covered by Standard Contractual Clauses (Art. 46) and/or the EU-US Data Privacy Framework, with supplementary measures.
          </p>
          <p className="text-xs leading-relaxed">
            <strong className="text-[var(--am-text)]">Retention &amp; your choices.</strong> We keep your email in the marketing list until you withdraw consent or object; the timestamp of your opt-in is retained as proof of consent. You can withdraw consent or object at any time via the one-click unsubscribe link in every email, or by emailing <a href="mailto:info@betredge.com" className="underline hover:text-[var(--am-coral)]">info@betredge.com</a> — free of charge and without affecting your use of the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">11. Changes</h2>
          <p className="text-xs leading-relaxed">
            We may update this policy periodically. Continued use of the platform after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <div className="pt-8 border-t border-[var(--am-line)] text-center">
          <Link href="/" className="text-[10px] text-[var(--am-muted-2)] hover:text-[var(--am-coral)] uppercase tracking-wider">
            ← Return to BetRedge
          </Link>
        </div>
      </div>
    </div>
  );
}
