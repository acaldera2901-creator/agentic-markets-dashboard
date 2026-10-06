"use client";
// components/v3c/pages/Pricing.tsx (#REDESIGN-V3C F8-UI · filone pages) — /pricing.
// Due piani, Free e Pro. Una cosa grande: il prezzo di Pro. Una sola CTA royal
// («Go Pro»), che porta al CheckoutModal di sempre (/plans?checkout=premium):
// questa pagina non apre pagamenti suoi. I metodi elencati sono quelli che il
// checkout mostra davvero (lib/v3c/plans.ts → checkoutRails), il prezzo è quello
// di lib/commercial-plan.ts, l'annuale compare solo se il suo rail è acceso.
// Nessun countdown: la promo di lancio, se attiva, è una data.
import { useEffect } from "react";
import { FREE_SIGNUP_HREF, PRO_CHECKOUT_HREF } from "@/lib/v3c/checkout-link";
import { usd } from "@/lib/v3c/paywall";
import { usePagesCopy } from "@/lib/v3c/pages-copy.client";
import { trackEvent } from "@/lib/track-event";
import { Arrow } from "../Arrow";
import { PlanBadge } from "../PlanBadge";
import { Fascia } from "../Fascia";
import { WhyPaywall } from "../paywall/WhyPaywall";

export type PricingProps = {
  monthly: number;
  annual: number | null;
  rails: ("card" | "crypto" | "paypal" | "usdt")[];
  promoUntil: string | null;
};

function Row({ title, sub, value, muted, badge }: { title: string; sub?: string; value: string; muted?: boolean; badge?: boolean }) {
  return (
    <li>
      <span>
        {title}
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className={muted ? "v3c-pg-v v3c-pg-v-no" : "v3c-pg-v"}>{badge ? <PlanBadge plan="pro" label={value} /> : value}</span>
    </li>
  );
}

export function V3cPricing({ monthly, annual, rails, promoUntil }: PricingProps) {
  const t = usePagesCopy();
  const p = t.pricing;
  const price = usd(monthly);

  useEffect(() => {
    trackEvent("plan_view", { meta: { surface: "v3c_pricing" } });
  }, []);

  const railLines = rails.map((r) =>
    r === "card" ? p.railCard + (annual != null ? ` ${p.railCardAnnual}` : "") : r === "crypto" ? p.railCrypto : r === "paypal" ? p.railPaypal : p.railUsdt,
  );

  return (
    <main className="v3c-wrap" id="main">
      <Fascia
        tab={p.tab}
        title={p.title}
        meta={
          <>
            <b>{p.metaStrong(price)}</b>
            <span>{p.metaRest}</span>
          </>
        }
      />

      {promoUntil ? <p className="v3c-pg-promo">{p.promo(promoUntil)}</p> : null}

      <div className="v3c-pg-plans">
        <section className="v3c-pg-plan" aria-labelledby="v3c-plan-free">
          <div className="v3c-pg-ph">
            <h2 className="v3c-t-sec" id="v3c-plan-free">
              {p.freeName}
            </h2>
            <span className="v3c-n-xl">$0</span>
          </div>
          <p className="v3c-explain">{p.freeLede}</p>
          <ul>
            {p.free.map(([title, sub]) => (
              <Row key={title} title={title} sub={sub} value={p.included} />
            ))}
            <Row title={p.freeSoon[0]} sub={p.freeSoon[1]} value={p.notLive} muted />
          </ul>
          <div className="v3c-pg-act">
            <a className="v3c-btn v3c-btn-line" href={FREE_SIGNUP_HREF}>
              {p.freeCta}
            </a>
          </div>
        </section>

        <section className="v3c-pg-plan v3c-pg-plan-pro" aria-labelledby="v3c-plan-pro">
          <div className="v3c-pg-ph">
            <h2 className="v3c-t-sec" id="v3c-plan-pro">
              {p.proName}
            </h2>
            <span className="v3c-n-xl v3c-pg-cost">
              {price}
              <small>
                {p.perMonth}
                {annual != null ? ` ${p.perYear(usd(annual))}` : ""}
              </small>
            </span>
          </div>
          <p className="v3c-explain">{p.proLede}</p>
          <ul>
            {p.proItems.map(([title, sub]) => (
              <Row key={title} title={title} sub={sub} value={p.pro} badge />
            ))}
            <Row title={p.everythingFree} value={p.included} />
          </ul>
          <div className="v3c-pg-act">
            <a className="v3c-btn v3c-btn-cta" href={PRO_CHECKOUT_HREF}>
              {p.proCta} <Arrow />
            </a>
          </div>
          <ul className="v3c-pg-rails">
            {railLines.map((l) => (
              <li key={l}>{l}</li>
            ))}
            <li>{p.withdrawal}</li>
          </ul>
        </section>
      </div>

      <aside className="v3c-pg-same">
        <p className="v3c-explain">
          <b>{p.sameStrong}</b> {p.same}
        </p>
      </aside>

      <section className="v3c-sec v3c-pg-anatomy" aria-labelledby="v3c-pg-anat">
        <div className="v3c-pg-anat-l">
          <h2 className="v3c-t-sec" id="v3c-pg-anat">
            {p.anatomyTitle}
          </h2>
          <p className="v3c-explain">{p.anatomyLede}</p>
          <p className="v3c-fine">{p.anatomyNever}</p>
        </div>
        <WhyPaywall
          copy={t.paywall}
          factors={t.paywall.factorKinds.map(([label, text]) => ({ label, text }))}
          gapPp={null}
          price={price}
          href={PRO_CHECKOUT_HREF}
          example
          headingLevel="h3"
        />
      </section>

      <p className="v3c-fine v3c-pg-fine">{p.fine}</p>
    </main>
  );
}
