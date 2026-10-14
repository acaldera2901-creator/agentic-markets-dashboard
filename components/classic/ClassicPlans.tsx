"use client";
// components/classic/ClassicPlans.tsx — #CLASSIC-PLANS-1014 · la pagina piani a flag acceso.
//
// Due piani, Free e Pro (Andrea, 14/10): un messaggio solo in testa, il Pro
// come unico punto focale con la sua CTA lime, il Free come alternativa quieta
// a fianco (sotto, sul telefono). Il confronto sta DENTRO le righe del Pro:
// ogni riga dice cosa apre Pro e, in piccolo, cosa fa Free sulla stessa cosa —
// niente tabella a parte, niente terza colonna. Il piano Base non si vende più
// da qui: chi lo ha già lo vede nominato (onBase) con l'upgrade a Pro.
//
// Solo display: i prezzi vengono da lib/commercial-plan (mensile) e dallo
// specchio dichiarato di PAYGATE_PRICES (annuale, lib/classic/plans-copy);
// i gestori di pagamento/attivazione sono quelli del desk (submitCryptoPayment,
// activateFreePlan), identici a PlansTab. Il periodo mensile/annuale si sceglie
// nel CheckoutModal, come prima: qui lo si dichiara, non lo si imposta.
import type { ReactNode } from "react";
import { ClassicIcon } from "@/components/classic/ClassicIcon";
import { planAmountUsdt, type PublicPlanKey } from "@/lib/commercial-plan";
import { PRO_ANNUAL_USD, fillPlans, plansCopy } from "@/lib/classic/plans-copy";
import "./classic-plans.css";

export type ClassicPlansProfile = { plan: string; planExpiresAt?: string | null } | null;

export type ClassicPlansProps = {
  profile: ClassicPlansProfile;
  lang: string;
  onPaymentSubmit: (plan: PublicPlanKey) => void;
  onActivateFree: () => void;
  onOpenDesk: () => void;
  /** la riga di chiusura del desk (t.plans_footnote): 18+, non consulenza, niente denaro */
  footnote: string;
  /** il banner di lancio del desk, quando la sua env lo accende (altrimenti null) */
  promo?: ReactNode;
};

const LOCALE: Record<string, string> = { en: "en-GB", it: "it-IT", es: "es-ES", fr: "fr-FR", ru: "ru-RU" };

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function Check() {
  return (
    <svg className="clp-check" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M4.5 10.5l3.4 3.4L15.5 6.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClassicPlans({ profile, lang, onPaymentSubmit, onActivateFree, onOpenDesk, footnote, promo }: ClassicPlansProps) {
  const c = plansCopy(lang);
  const plan = profile?.plan ?? null;
  const isPro = plan === "premium" || plan === "admin_full";
  const isBase = plan === "base";
  const isPending = plan === "pending_payment";
  const monthly = usd(planAmountUsdt("premium"));
  const monthlyLine = `${monthly} ${c.perMonth}`;

  let until: string | null = null;
  if (isPro && profile?.planExpiresAt) {
    const d = new Date(profile.planExpiresAt);
    if (!Number.isNaN(d.getTime())) {
      until = d.toLocaleDateString(LOCALE[lang] ?? "en-GB", { day: "numeric", month: "long", year: "numeric" });
    }
  }

  const proCta = isPending ? c.ctaReview : isBase ? c.ctaUpgrade : plan ? c.ctaActivate : c.ctaStart;

  return (
    <div className="clp" id="client-plans">
      <header className="clp-head">
        <h2 className="clp-headline">{c.headline}</h2>
        <p className="clp-lede">{c.lede}</p>
      </header>

      {promo}

      <div className="clp-grid">
        <section className="clp-pro" aria-labelledby="clp-pro-name">
          <div className="clp-pro__top">
            <ClassicIcon name="menu-plans" size={44} className="clp-pro__ico" />
            <div>
              <p className="clp-tag">{c.proTag}</p>
              <h3 id="clp-pro-name" className="clp-name">{c.proName}</h3>
            </div>
          </div>

          <p className="clp-price">
            <span className="clp-price__n">{monthly}</span>
            <span className="clp-price__per">{c.perMonth}</span>
          </p>
          <p className="clp-annual">{fillPlans(c.annualLine, { y: usd(PRO_ANNUAL_USD) })}</p>

          <ul className="clp-rows">
            {([["r1", "f1"], ["r2", "f2"], ["r3", "f3"], ["r4", "f4"]] as const).map(([r, f]) => (
              <li key={r}>
                <Check />
                <strong>{c[r]}</strong>
                <span>{c[f]}</span>
              </li>
            ))}
          </ul>

          {isPro ? (
            <p className="clp-state" role="status">
              <strong>{c.proActive}</strong>
              {until && <> {fillPlans(c.accessUntil, { d: until })}</>}
              {" "}{c.manage}
            </p>
          ) : (
            <div className="clp-buy">
              {isBase && <p className="clp-note">{c.onBase}</p>}
              <button type="button" className="clp-cta" disabled={isPending} onClick={() => onPaymentSubmit("premium")}>
                {proCta}
                <span className="clp-cta__price">· {monthlyLine}</span>
              </button>
              {!plan && <p className="clp-next">{c.nextStep}</p>}
              <p className="clp-billing">{c.billing}</p>
            </div>
          )}

          <p className="clp-shared">{c.shared}</p>
        </section>

        <section className="clp-free" aria-labelledby="clp-free-name">
          <div className="clp-free__top">
            <h3 id="clp-free-name" className="clp-name">{c.freeName}</h3>
            <p className="clp-free__price">
              <span>{c.freePrice}</span> {c.freeForever}
            </p>
          </div>
          <p className="clp-free__desc">{c.freeDesc}</p>
          {isPro || isBase ? (
            <p className="clp-free__included">{c.freeIncluded}</p>
          ) : (
            <button type="button" className="clp-cta clp-cta--ghost" disabled={plan === "free"} onClick={onActivateFree}>
              {plan === "free" ? c.freeActive : c.freeStart}
            </button>
          )}
        </section>
      </div>

      <p className="clp-foot">{footnote}</p>
      <button type="button" className="clp-board" onClick={onOpenDesk}>
        {c.seeBoard} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
