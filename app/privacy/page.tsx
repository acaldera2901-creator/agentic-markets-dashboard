import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — BetRedge",
  description: "Privacy Policy and GDPR information for BetRedge",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <Link href="/" className="text-[10px] text-[var(--am-muted-2)] hover:text-[var(--am-coral)] uppercase tracking-wider">
            ← Back to BetRedge
          </Link>
          <h1 className="text-xl font-bold text-[var(--am-text)]">Privacy Policy</h1>
          <p className="text-[11px] text-[var(--am-muted-2)]">Last updated: May 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">1. Controller</h2>
          <p className="text-xs leading-relaxed">
            BetRedge (&quot;we&quot;, &quot;us&quot;) operates this sports prediction platform. For GDPR purposes, the data controller is BetRedge. Contact: <a href="mailto:info@agenticmarkets.com" className="underline hover:text-[var(--am-coral)]">info@agenticmarkets.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">2. Data We Collect</h2>
          <ul className="text-xs space-y-2 list-disc list-inside">
            <li><strong className="text-[var(--am-text)]">Profile data:</strong> Email address, plan selection, and preferences stored locally in your browser (localStorage). No server-side account is created for free users.</li>
            <li><strong className="text-[var(--am-text)]">Usage events:</strong> Anonymous usage events (tab views, plan upgrades) collected via Supabase to improve the service. No personally identifiable information is included.</li>
            <li><strong className="text-[var(--am-text)]">Deposit requests:</strong> For paying clients, name, email, and payment method are stored securely in Supabase with row-level security.</li>
            <li><strong className="text-[var(--am-text)]">Technical data:</strong> Standard server logs (IP address, browser type, request timestamps) retained for up to 30 days for security purposes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">3. Legal Basis</h2>
          <ul className="text-xs space-y-2 list-disc list-inside">
            <li><strong className="text-[var(--am-text)]">Contract performance:</strong> Processing necessary to provide the prediction service you requested.</li>
            <li><strong className="text-[var(--am-text)]">Legitimate interest:</strong> Anonymous analytics to maintain and improve platform quality.</li>
            <li><strong className="text-[var(--am-text)]">Consent:</strong> Cookie preferences and marketing communications (where applicable).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">4. Cookies</h2>
          <p className="text-xs leading-relaxed">
            We use only essential technical storage (localStorage for your plan profile). No third-party tracking cookies are set. Partner links to bookmakers and casinos may set their own cookies — please review their privacy policies before clicking.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">5. Data Sharing</h2>
          <p className="text-xs leading-relaxed">
            We do not sell personal data. We use Supabase (EU-hosted) as our database provider. Vercel (US-based) hosts the application; their DPA applies. No other third parties receive your personal data.
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
            Under GDPR you have the right to: access, rectify, erase, restrict processing, data portability, and object to processing. To exercise these rights, email <a href="mailto:info@agenticmarkets.com" className="underline hover:text-[var(--am-coral)]">info@agenticmarkets.com</a>. You may also lodge a complaint with your local supervisory authority.
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
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">10. Changes</h2>
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
