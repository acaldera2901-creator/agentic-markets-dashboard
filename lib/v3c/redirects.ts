// lib/v3c/redirects.ts (#REDESIGN-V3C F8-UI · filone pages) — i redirect del redesign, puri.
// Flag acceso: /plans → /pricing, /history e /risultati → /record (F6), permanente (Next risponde 308, come gli altri
// redirect del sito). Flag spento: lista vuota, /plans resta la tab Piani di sempre.
//
// /plans NON sparisce del tutto: il checkout vive ancora nel CheckoutModal della
// Dashboard (app/app/page.tsx, non toccato da questo filone). Con `?checkout=` o
// `?auth=` /plans resta la Dashboard, così il bottone «Go Pro» e «Create a free
// account» di /pricing arrivano al checkout e al signup che esistono oggi. Senza
// quei parametri (link vecchi, sitemap, bookmark) si atterra su /pricing.
// Le query passano intatte al redirect (?ref=, ?crm=, utm_* …).
import { envFlagOn } from "../redesign-flag";

type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
  missing?: { type: "query"; key: string }[];
};

export function v3cRedirects(flag: string | undefined | null): Redirect[] {
  if (!envFlagOn(flag)) return [];
  return [
    {
      source: "/plans",
      destination: "/pricing",
      permanent: true,
      missing: [
        { type: "query", key: "checkout" },
        { type: "query", key: "auth" },
      ],
    },
    // F6: il registro vecchio (/history, che leggeva unified_predictions) e la tab
    // /risultati portano su /record. SEO: /history aveva 0 impressioni (audit 15/09).
    { source: "/history", destination: "/record", permanent: true },
    { source: "/risultati", destination: "/record", permanent: true },
  ];
}
