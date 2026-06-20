import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — BetRedge",
  description: "Terms of Service for BetRedge — accounts, plans, payments, and acceptable use",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <Link href="/" className="text-[10px] text-[var(--am-muted-2)] hover:text-[var(--am-coral)] uppercase tracking-wider">
            ← Back to BetRedge
          </Link>
          <h1 className="text-xl font-bold text-[var(--am-text)]">Terms of Service</h1>
          <p className="text-[11px] text-[var(--am-muted-2)]">Last updated: June 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">1. Acceptance of Terms</h2>
          <p className="text-xs leading-relaxed">
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the BetRedge platform (&quot;BetRedge&quot;, &quot;we&quot;, &quot;us&quot;). By creating a profile, selecting a plan, or otherwise using the platform, you agree to these Terms and to our <Link href="/privacy" className="underline hover:text-[var(--am-coral)]">Privacy Policy</Link>. If you do not agree, do not use the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">2. What BetRedge Is — and Is Not</h2>
          <p className="text-xs leading-relaxed">
            BetRedge is a sports prediction and data platform. We provide statistical models, probabilities, and informational content about sporting events. BetRedge <strong className="text-[var(--am-text)]">does not accept wagers, does not hold or manage funds placed on outcomes, and does not operate as a bookmaker, casino, or financial intermediary</strong>. Our content is for informational purposes only and does not constitute betting, investment, financial, or legal advice. Any decision to place a bet with a third party is made solely by you, at your own risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">3. Eligibility</h2>
          <p className="text-xs leading-relaxed">
            You must be at least 18 years old (or the age of majority in your jurisdiction, whichever is higher) to use BetRedge. You are responsible for ensuring that your use of the platform, and of any third-party bookmaker we link to, is lawful in your country, state, or region. BetRedge is not available where prohibited by local law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">4. Accounts &amp; Plans</h2>
          <p className="text-xs leading-relaxed">
            BetRedge offers a free tier and paid subscription plans (Base and Pro). The features included in each plan, and the current price, are those displayed on the <Link href="/?tab=account&plans=1" className="underline hover:text-[var(--am-coral)]">Plans page</Link> at the time of purchase. You are responsible for keeping your login credentials secure and for all activity under your profile.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">5. Payments &amp; Billing</h2>
          <ul className="text-xs space-y-2 list-disc list-inside">
            <li>Subscription fees are charged in advance for each billing period at the price shown on the Plans page, via the payment methods offered at checkout.</li>
            <li>Prices are exclusive of any taxes, duties, or transaction fees that may apply; you are responsible for these where applicable.</li>
            <li>By subscribing to a recurring plan, you authorize us (or our payment provider) to charge the applicable fee for each billing period until you cancel.</li>
            <li>We may change plan prices or features; any change applies from your next billing period, and we will give reasonable notice where required by law.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">6. Renewal, Cancellation &amp; Refunds</h2>
          <ul className="text-xs space-y-2 list-disc list-inside">
            <li><strong className="text-[var(--am-text)]">Auto-renewal:</strong> Recurring subscriptions renew automatically at the end of each billing period unless cancelled beforehand.</li>
            <li><strong className="text-[var(--am-text)]">Cancellation:</strong> You may cancel at any time. Cancellation stops future renewals; you retain access until the end of the period already paid for.</li>
            <li><strong className="text-[var(--am-text)]">Refunds:</strong> Except where a refund is required by mandatory consumer-protection law, subscription fees already paid are non-refundable. To request a cancellation or refund, email <a href="mailto:info@agenticmarkets.com" className="underline hover:text-[var(--am-coral)]">info@agenticmarkets.com</a>.</li>
            <li><strong className="text-[var(--am-text)]">Disputes:</strong> If you believe you were charged in error, contact us before initiating a chargeback so we can resolve the issue directly.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">7. Affiliate Links &amp; Third Parties</h2>
          <p className="text-xs leading-relaxed">
            BetRedge may display affiliate links to third-party bookmakers and casinos and may earn a commission if you register or transact with them. This does not affect the independence of our prediction model. We are not responsible for the products, odds, payouts, terms, or conduct of any third-party operator; your relationship with them is governed by their own terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">8. No Guarantee of Results</h2>
          <p className="text-xs leading-relaxed">
            Sports outcomes are inherently uncertain. Our predictions reflect statistical estimates, not certainties. Past performance does not guarantee future results, and no prediction, probability, or track record on the platform should be understood as a promise of profit. You should never bet more than you can afford to lose.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">9. Responsible Use &amp; Account Measures</h2>
          <p className="text-xs leading-relaxed">
            We support responsible gambling. On request, you may ask us to: close your profile, self-exclude from the platform for a defined period, or opt out of promotional and affiliate communications. To exercise any of these, email <a href="mailto:info@agenticmarkets.com" className="underline hover:text-[var(--am-coral)]">info@agenticmarkets.com</a>. If you need support, see <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--am-coral)]">BeGambleAware</a>, <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--am-coral)]">GamCare</a>, or <a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--am-coral)]">Gambling Therapy</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">10. Intellectual Property</h2>
          <p className="text-xs leading-relaxed">
            All content, models, branding, and software on the platform are owned by BetRedge or its licensors and are protected by intellectual-property laws. You may use the platform for your personal, non-commercial use only. You may not copy, scrape, resell, or redistribute our predictions or data without our prior written consent.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">11. Acceptable Use</h2>
          <p className="text-xs leading-relaxed">
            You agree not to misuse the platform, including by attempting to gain unauthorized access, interfering with its operation, automating data extraction, or using it for any unlawful purpose. We may suspend or terminate access that violates these Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">12. Limitation of Liability</h2>
          <p className="text-xs leading-relaxed">
            To the maximum extent permitted by law, BetRedge is not liable for any losses, including betting losses, arising from your use of the platform or reliance on its content. The platform is provided &quot;as is&quot; without warranties of any kind. Nothing in these Terms excludes liability that cannot be excluded under applicable law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">13. Termination</h2>
          <p className="text-xs leading-relaxed">
            You may stop using the platform at any time. We may suspend or terminate your access if you breach these Terms or if required by law. Sections that by their nature should survive termination (e.g., intellectual property, limitation of liability) will continue to apply.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">14. Governing Law</h2>
          <p className="text-xs leading-relaxed">
            These Terms are governed by the laws applicable at BetRedge&apos;s place of establishment, without prejudice to any mandatory consumer-protection rights you may have in your country of residence.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">15. Changes to These Terms</h2>
          <p className="text-xs leading-relaxed">
            We may update these Terms from time to time. We will update the &quot;Last updated&quot; date above, and continued use of the platform after changes take effect constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--am-text)] uppercase tracking-wider border-b border-[var(--am-line)] pb-2">16. Contact</h2>
          <p className="text-xs leading-relaxed">
            Questions about these Terms? Email <a href="mailto:info@agenticmarkets.com" className="underline hover:text-[var(--am-coral)]">info@agenticmarkets.com</a>.
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
