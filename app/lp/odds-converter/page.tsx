// app/lp/odds-converter/page.tsx — #CH01-LP-CLEAN-0819
//
// Landing a pagamento per il gruppo annunci B di CH-01 (`odds converter`,
// `implied probability calculator`). È il "Pacchetto 2" della decisione P0 (b):
// una pagina PULITA PER COSTRUZIONE, non una pulizia geo-condizionale.
//
// Perché non geo-condizionale: il crawler e il revisore di Google non arrivano da
// un IP svizzero. Nascondere elementi ai soli visitatori CH non cambia nulla di
// ciò che Google esamina — quella strada serve l'esposizione legale svizzera
// (chiusa dal hard-block, branch michele/ch-geo-hardblock-0818), non la review.
//
// Perché una rotta nuova invece di ripulire /tools/odds-converter: `SiteFooter` è
// montato PER PAGINA e non in un layout condiviso, quindi una rotta nuova
// semplicemente non lo monta. Nessun file condiviso toccato ⇒ il 18+ e i link di
// gioco responsabile restano intatti dove servono. Era il vincolo di Andrea
// ("CH-specifica, mai uno strip globale") e qui è soddisfatto strutturalmente.
//
// COSA QUESTA PAGINA NON HA, di proposito: SiteFooter (18+, GamCare,
// BeGambleAware, riga loghi partner, link /partners), SiteTopbar (naviga nel
// prodotto), le parole bookmaker/betting/bet/wager/bonus/stake, ogni riferimento
// a una quota come prezzo da battere. Il test qui accanto le vieta tutte.
//
// ⚠️ NON aggiungere `/lp/` a un Disallow in robots.txt: il noindex qui sotto basta
// a tenerla fuori dall'indice, mentre un Disallow impedirebbe a Google di leggere
// la pagina per la review dell'annuncio — cioè romperebbe lo scopo.
import type { Metadata } from "next";
import Link from "next/link";
import { OddsConverter } from "@/components/tools/OddsConverter";
import { getToolsCopy } from "@/lib/tools/copy";
import type { ToolCopy } from "@/lib/tools/copy";
import { impressumLine } from "@/lib/legal-entity";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Odds Converter and Implied Probability Calculator | BetRedge",
  description:
    "Convert a price between decimal, fractional, American, Hong Kong, Malay and Indonesian, and read the implied probability behind it. Free, no account needed.",
  // Lander a pagamento: fuori dall'indice per non competere con /tools, ma
  // `follow` resta true perché i link interni puntano a pagine già indicizzate.
  robots: { index: false, follow: true },
};

/**
 * Il calcolatore usa SOLO `copy.labels`, ma è tipizzato sull'intero `ToolCopy` —
 * e passare l'oggetto intero a un componente client lo fa **serializzare nel
 * payload RSC**, cioè finisce dentro l'HTML servito. Con la copy vera del tool
 * dentro c'erano "bookmaker" e "stake" (dal metaDescription, dall'explainer e
 * dalle FAQ): invisibili a un test in jsdom, ben visibili a chiunque legga il
 * sorgente della pagina, revisore Google compreso. Trovato guardando l'HTML
 * prerenderizzato dopo il build, non il DOM.
 *
 * Quindi si tiene solo ciò che serve al render e si azzera il resto. Non è un
 * "per sicurezza": è la differenza fra una pagina pulita e una che sembra pulita.
 */
export function landerToolCopy(): ToolCopy {
  const t = getToolsCopy("en").tools["odds-converter"];
  return {
    ...t,
    labels: t.labels,
    metaTitle: "",
    metaDescription: "",
    h1: "",
    lede: "",
    takeaway: "",
    example: { title: "", rows: [], note: "" },
    explainerTitle: "",
    explainer: [],
    faq: [],
  };
}

/** Testi della pagina. Esportati perché il test li verifica come dati. */
export const LP_COPY = {
  h1: "Odds converter and implied probability calculator",
  lede:
    "Type a price in any format — decimal, fractional, American, Hong Kong, Malay or Indonesian — and read the same price everywhere, with the implied probability behind it.",
  arithmetic:
    "Implied probability is arithmetic, not a forecast: one divided by the decimal price. A price of 2.50 implies 40%. It tells you what the price says, nothing more.",
  ctaTitle: "The same arithmetic, applied continuously",
  ctaBody:
    "BetRedge runs calibrated probability models on football and tennis matches and shows where a model probability and a market price disagree. A free account shows the current numbers.",
  ctaButton: "Create a free account",
  ctaHref: "/app?auth=register",
} as const;

export default function OddsConverterLander() {
  // Etichette del calcolatore dalla stessa fonte di /tools (una copia sola): sono
  // già neutre — "Your price", "Format", "Implied probability" — quindi il
  // componente si riusa senza portarsi dietro la prosa editoriale del tool.
  const toolCopy = landerToolCopy();
  const dash = getToolsCopy("en").common.invalid;

  return (
    <div className="portal-root tl-root">
      <main className="tl-page">
        <header className="tl-head">
          <div className="tl-head-txt">
            <div className="tl-eyebrow">
              <span className="tl-free">Free</span>
              <span>BetRedge</span>
            </div>
            <h1>{LP_COPY.h1}</h1>
            <p className="tl-lede">{LP_COPY.lede}</p>
          </div>
        </header>

        <OddsConverter copy={toolCopy} dash={dash} />

        <p className="tl-takeaway">{LP_COPY.arithmetic}</p>

        <section className="tl-section">
          <h2>{LP_COPY.ctaTitle}</h2>
          <p>{LP_COPY.ctaBody}</p>
          <p style={{ marginTop: 16 }}>
            <Link href={LP_COPY.ctaHref} className="v-btn v-btn--utility">
              {LP_COPY.ctaButton}
            </Link>
          </p>
        </section>

        {/* Footer minimo: identità dell'operatore e i due documenti legali, niente
            altro. L'impressum viene da lib/legal-entity — stessa entità del sito e
            delle email, così le tre superfici non divergono. */}
        <footer className="tl-section" style={{ fontSize: 12, opacity: 0.75 }}>
          <p>{impressumLine()}</p>
          <p style={{ marginTop: 8, display: "flex", gap: 14 }}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
