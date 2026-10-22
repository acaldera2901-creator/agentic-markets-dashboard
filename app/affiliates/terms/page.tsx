import type { Metadata } from 'next';
import Link from 'next/link';
import ClassicChrome from '@/components/classic/ClassicChrome';
import { SiteFooter } from '@/components/SiteFooter';
import { PRIVACY_CONTROLLER, LEGAL_ENTITY } from '@/lib/legal-entity';
import { AFFILIATE_TERMS_PUBLISHED_VERSION } from '@/lib/affiliate/config';

export const metadata: Metadata = { title: 'Affiliate Program Terms | BetRedge', alternates: { canonical: '/affiliates/terms' } };
const sections = [
  ['1. Participation', 'Participation is free and limited to adults with a valid BetRedge account. Enrollment requires acceptance of these terms, confirmation of age and separate acceptance of sections 4, 6 and 8. You act independently and cannot enter into contracts or collect money on behalf of BetRedge. The program concerns BetRedge subscriptions only, not wagers or transactions with bookmakers.'],
  ['2. Referral attribution', 'Use the personal code and link shown in your account. Existing codes remain valid. Attribution relies on the referral recorded at registration; browser consent, deleted storage or use of another device may prevent attribution. The first eligible purchase must occur within 60 days of registration. Attribution is then fixed for subsequent eligible renewals. Self-referrals, false accounts, internal promotional codes and fraudulent purchases do not qualify. Contact support to report an attribution error.'],
  ['3. Commission', 'The affiliate receives 20% of the first eligible paid subscription purchase and 7% of subsequent eligible renewals, including monthly renewals, without a renewal-count limit while the affiliate account remains active. The renewal rate rises with volume tiers shown in your account: 10% once five referred users have made a paid purchase, 15% from fifteen. A tier counts referred users with at least one non-refunded purchase, applies to every renewal from the moment it is reached and never lowers the base rate; the rate applied is recorded on each commission. The percentage applies to the amount actually collected in USD, less indirect taxes, processor fees and refunds. Free access, manual complimentary activations, fully discounted purchases and purchases whose amount cannot be verified do not qualify. No earnings are guaranteed. Pending figures are provisional until reconciliation against payment records; they are not an available wallet balance.'],
  ['4. Verification and reversals', 'Commissions remain pending for at least 60 days from payment and until payment amounts, fees, refunds and attribution have been verified. Refunds or disputes received within 120 days of the original payment reduce or reverse the corresponding commission proportionally. If already paid, the adjustment is offset against future commissions. A negative balance does not authorize a debit from your wallet. We notify you of material adjustments, and you may dispute them through support.'],
  ['5. Receiving payment', 'Register a public wallet address in Invite → Wallet, selecting USDT or USDC on Polygon. Never provide a private key or recovery phrase. Confirm that the address accepts the selected token on that network. Changing the address triggers a 72-hour safety hold. Payments require beneficiary and address checks, an active account and a verified payable balance of at least USD 50. Smaller balances carry forward. Payments are processed manually in monthly batches once the payout service is enabled; the account displays their status and transaction reference. During setup, transfers are disabled and saving a wallet does not mean a payment has been sent.'],
  ['6. Crypto transfer conditions', 'Amounts are accounted for in USD and transferred at a nominal one token per USD in the selected stablecoin. BetRedge pays the network fee; exchange, conversion and withdrawal charges imposed by your own provider remain yours. The future market value of a stablecoin is not guaranteed. Blockchain transfers and addresses are public and transfers generally cannot be reversed. You are responsible for the accuracy of the address and selected network. These terms do not exclude liability that cannot lawfully be excluded.'],
  ['7. Conduct and beneficiary information', 'Provide accurate legal name, country and payment information and comply with applicable tax obligations. Additional information may be requested where needed to verify eligibility or a payment. Disclose the commercial relationship clearly before a reader clicks a promotional link. Do not promise winnings or earnings, target minors, spam, impersonate BetRedge, manipulate referral attribution or promote gambling operators through this program. Follow the rules applicable to your audience.'],
  ['8. Suspension, leaving and changes', 'You may leave by contacting info@betredge.com. We may suspend enrollment or payments while investigating fraud, inaccurate beneficiary details or a legal restriction, and explain the reason where permitted. Legitimately earned amounts are not forfeited simply because you leave; their payment remains subject to verification. Future rates or program conditions may change with at least 30 days’ notice, without retroactively reducing earned commissions. These terms follow the governing-law provisions of the general Terms of Service, without limiting mandatory rights.'],
  ['9. Data and support', 'We store consent versions and timestamps, the referral code, attribution and commission records, beneficiary details, wallet history and payment transaction references. These records support administration, fraud prevention and payment verification. Affiliates see only masked referral information and must not try to identify referred users from it. Public blockchain records cannot be erased by BetRedge. See the Privacy Policy for the controller, processing, retention and your rights. For questions, corrections, complaints or closing your affiliate account contact info@betredge.com.'],
];
export default function AffiliateTermsPage() {
  return <div className="min-h-screen font-mono mc-scene-clay" style={{ background: 'var(--am-bg)', color: 'var(--am-muted)' }}>
    <ClassicChrome />
    <main className="legal-sheet max-w-2xl mx-auto my-10 px-7 py-11 space-y-8">
      <Link href="/invite" className="underline">← Invite / Invita</Link>
      <h1 className="text-xl font-bold text-[var(--am-text)]">Affiliate Program Terms</h1>
      <p className="text-xs">Version {AFFILIATE_TERMS_PUBLISHED_VERSION} · 21 October 2026 (adds volume tiers to section 3; supersedes aff-2026-10-20-v1)</p>
      {/* #INVITE-AFFILIATE-UX-1022 (M4): il testo legale resta solo in inglese (non si traduce qui: legale-compliance).
          Dichiarato in chiaro, in inglese e in italiano, quale versione vincola. */}
      <p className="text-xs border-l-2 pl-3" style={{ borderColor: 'var(--am-amber)' }}>
        <strong className="text-[var(--am-text)]">Binding version: English.</strong> These Terms are published in English only; the English text is the one that applies, whatever language the rest of the site is shown in.
        <span lang="it" className="block mt-1">Versione vincolante: inglese. I Termini sono pubblicati solo in inglese; fa fede il testo inglese, qualunque sia la lingua del resto del sito.</span>
      </p>
      <p className="text-sm">The contracting party and payer for this program is {PRIVACY_CONTROLLER.name}, {PRIVACY_CONTROLLER.address}, {PRIVACY_CONTROLLER.uid}. Contact: {LEGAL_ENTITY.contactEmail}.</p>
      <p className="text-sm">These terms supplement the <Link href="/terms" className="underline">Terms of Service</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>. For the affiliate program, these specific conditions take precedence.</p>
      {sections.map(([title, body]) => <section key={title} className="space-y-3"><h2 className="text-sm font-semibold text-[var(--am-text)]">{title}</h2><p className="text-sm leading-relaxed">{body}</p></section>)}
    </main>
    {/* #INVITE-AFFILIATE-UX-1022 (L3): il footer standard del sito (18+, gioco responsabile, Termini, Privacy),
        in inglese come il documento. */}
    <SiteFooter lang="en" />
  </div>;
}
