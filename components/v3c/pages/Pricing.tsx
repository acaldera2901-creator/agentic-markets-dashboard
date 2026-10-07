"use client";
// components/v3c/pages/Pricing.tsx (#REDESIGN-V3C F8-UI · filone pages → fixui Fase 0)
// /pricing in Fase 0 (DECISIONI-FREE-PRO §f e §7, decisione di Andrea 07/10: Pro NON
// è in vendita al lancio): «Free e Pro anteprima». Una tabella Free vs Pro dalla
// matrice finale (§2), SOLO con ciò che esiste davvero; ciò che non esiste in nessuna
// pagina partita (il «perché» fattore per fattore) è detto al futuro, «planned».
// Il prezzo di Pro ($29,99 da lib/commercial-plan.ts) è mostrato «coming»: testo,
// mai un link. Nessun bottone d'acquisto, nessun «Create a free account», nessun
// checkout, nessun metodo di pagamento né recesso (indirizzo, IVA e recesso li
// decide il legale). L'etichetta P9 sta in cima. Il paywall del «perché» resta
// visibile solo come bozza dichiarata, senza bottone (WhyPaywall draft).
import { Banner } from "../Banner";
import "../fidelity.css";
import { useEffect } from "react";
import { usd } from "@/lib/v3c/paywall";
import { usePagesCopy } from "@/lib/v3c/pages-copy.client";
import { trackEvent } from "@/lib/track-event";
import { PlanBadge } from "../PlanBadge";
import { Fascia } from "../Fascia";
import { WhyPaywall } from "../paywall/WhyPaywall";
import { ColourBanner } from "@/components/v3c/banners/ColourBanner";

export type PricingProps = {
  /** il prezzo mensile di Pro (lib/commercial-plan.ts), mostrato «coming», mai cliccabile */
  monthly: number;
};

/** Il tipo di ogni riga della matrice, nello stesso ordine di `pricing.rows`. */
const ROW_KIND = ["both", "both", "both", "both", "preview", "preview", "planned"] as const;

export function V3cPricing({ monthly }: PricingProps) {
  const t = usePagesCopy();
  const p = t.pricing;
  const price = usd(monthly);

  useEffect(() => {
    trackEvent("plan_view", { meta: { surface: "v3c_pricing", phase: "preview" } });
  }, []);

  return (
    <main className="v3c-wrap" id="main">
      <Fascia
        tab={p.tab}
        title={p.title}
        meta={
          <>
            <b>{p.metaStrong}</b>
            <span>{p.metaRest}</span>
          </>
        }
        art={<Banner name="hero-football" priority />}
      />

      <p className="v3c-pv-flag" role="note">
        <PlanBadge plan="pro" label={p.proName} />
        <span>{p.preview}</span>
      </p>

      <div className="v3c-pv-wrap">
        <table className="v3c-pv">
          <caption className="v3c-sr">{p.title}</caption>
          <thead>
            <tr>
              <th scope="col" className="v3c-lab">
                {p.colWhat}
              </th>
              <th scope="col">
                <span className="v3c-pv-plan">{p.freeName}</span>
                <span className="v3c-pv-cost v3c-num">$0</span>
              </th>
              <th scope="col">
                <span className="v3c-pv-plan">{p.proName}</span>
                {/* fixui B3/A4: il prezzo è un fatto annunciato, non un'offerta: niente link, niente CTA */}
                <span className="v3c-pv-cost v3c-num">
                  {price}
                  <small>
                    {" "}
                    {p.perMonth} · {p.proSoon}
                  </small>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map(([title, sub, free, pro], i) => {
              const kind = ROW_KIND[i] ?? "both";
              return (
                <tr key={title} className={`v3c-pv-${kind}`}>
                  <th scope="row">
                    {title}
                    <small>{sub}</small>
                  </th>
                  <td className={free === "—" ? "v3c-pv-no" : undefined}>{free}</td>
                  <td className={kind === "planned" ? "v3c-pv-no" : undefined}>
                    {pro}
                    {kind === "preview" ? <small className="v3c-pv-tag">{p.previewTag}</small> : null}
                    {kind === "planned" ? <small className="v3c-pv-tag">{p.plannedTag}</small> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <aside className="v3c-pg-same">
        <p className="v3c-explain">
          <b>{p.notice}</b> {p.t4}
        </p>
      </aside>

      <section className="v3c-sec v3c-pg-anatomy v3c-pv-draft" aria-labelledby="v3c-pg-anat">
        <div className="v3c-pg-anat-l">
          <h2 className="v3c-t-sec" id="v3c-pg-anat">
            {p.draftTitle}
          </h2>
          <p className="v3c-explain">{p.draftLede}</p>
        </div>
        <WhyPaywall copy={t.paywall} factors={t.paywall.factorKinds.map(([label, text]) => ({ label, text }))} gapPp={null} price={price} example draft headingLevel="h3" />
      </section>

      {/* final3: banner colore (README §3b) — mai Pro qui; lo stacco porta al Metodo */}
      <ColourBanner theme="learn" />
      <p className="v3c-fine v3c-pg-fine">{p.fine}</p>
    </main>
  );
}
