// components/ui/glyphs.tsx — #UI-MACHINA-0802
//
// I glifi dell'interfaccia sono DISEGNI, non emoji. Le emoji come risorsa
// grafica sono vietate (regola standing anti-slop): cambiano forma con il
// sistema operativo, non ereditano peso e colore del testo, e su una superficie
// di prodotto si vedono per quello che sono. Questi ereditano `currentColor` e
// hanno tutti lo stesso peso di tratto, quindi stanno accanto al mono maiuscolo
// senza stonare.
//
// NON sostituiscono le icone raster custom (public/icons/menu-*.png,
// banners/sport-*.png): quelle sono un set approvato e si aggiungono, non si
// toglono. Questi coprono i posti dove c'era un'emoji o una parola al posto di
// un segno.

type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, "aria-hidden": true,
  style: { display: "inline-block", verticalAlign: "-0.15em", flex: "none" },
});

export function GlyphLock({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="10.5" width="16" height="10.5" rx="1.2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function GlyphCheck({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M4 12.6l5.2 5.2L20 6.6" />
    </svg>
  );
}

/** registro / scontrino: il log delle pick concluse */
export function GlyphLedger({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9.5 8h5M9.5 12h5" />
    </svg>
  );
}

/** andamento: il track record nel tempo */
export function GlyphTrend({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M3 17l5.5-5.5 3.5 3.5L21 6" />
      <path d="M21 11V6h-5" />
    </svg>
  );
}

/** barre: la ripartizione per segmento */
export function GlyphBars({ size = 18, className }: P) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 20V11M12 20V4M19 20v-6" />
    </svg>
  );
}

/** Posizione sul podio: 1, 2, 3.
 *
 * Non usa oro/argento/bronzo: tre colori nuovi andrebbero rivalidati contro le
 * due superfici, e il tetto misurato della palette e' 3 sport + il verde
 * (il quarto colore falliva sempre). Il rango si legge dal PESO — riempimento
 * pieno, mezzo, vuoto — e il segno resta monocromo, quindi eredita il colore
 * del testo e funziona in entrambi i temi senza rischio di contrasto.
 *
 * La smussatura in alto a sinistra ripete quella delle schede prediction: il
 * segno appartiene alla casa invece di sembrare preso da un set generico.
 */
export function GlyphRank({ rank, size = 22, className }: { rank: 1 | 2 | 3 } & P) {
  const fill = rank === 1 ? 0.26 : rank === 2 ? 0.12 : 0;
  const stroke = rank === 3 ? 1.4 : 2;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}
      aria-hidden="true" style={{ display: "inline-block", verticalAlign: "-0.22em", flex: "none" }}>
      <path d="M8 2.5h13.5v19H2.5V8z" fill="currentColor" fillOpacity={fill}
        stroke="currentColor" strokeWidth={stroke} strokeLinejoin="miter" />
      <text x="12.2" y="16.4" textAnchor="middle" fill="currentColor"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="10.5" fontWeight="700" letterSpacing="0.02em">{rank}</text>
    </svg>
  );
}
