"use client";
// components/tools/Meter.tsx (#TOOLS-HUB-0805-ART)
// UNA primitiva grafica per tutti e cinque i tool: una traccia orizzontale con
// segmenti proporzionali e marcatori posizionati. Serve a far vedere a occhio
// una cosa che i numeri dicono ma non mostrano — dove cade il margine oltre il
// 100%, se la tua probabilità sta sopra o sotto il break-even, quanta parte del
// bankroll è in gioco.
//
// Regole che si porta dietro:
//  · è SEMPRE ridondante: ogni numero che rappresenta esiste già come testo nel
//    readout, quindi il grafico è aria-hidden e nessun dato vive solo qui;
//  · non sostituisce mai il readout numerico (le card prediction del prodotto
//    non hanno barre: qui la barra è un supporto alla spiegazione, non il dato);
//  · niente libreria, niente SVG generato: CSS puro sui token del sito, quindi
//    segue tema chiaro/scuro come il resto.

export type MeterSegment = {
  /** frazione della traccia, 0..1 */
  value: number;
  tone?: "fair" | "margin" | "edge" | "loss" | "muted";
};

export type MeterMarker = {
  /** posizione sulla traccia, 0..1 */
  at: number;
  label: string;
};

export function Meter({
  segments,
  markers = [],
  caption,
}: {
  segments: MeterSegment[];
  markers?: MeterMarker[];
  caption?: string;
}) {
  const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
  const total = segments.reduce((a, s) => a + (Number.isFinite(s.value) ? Math.max(0, s.value) : 0), 0);
  if (total <= 0) return null;

  return (
    <div className="tl-meter-wrap">
      <div className="tl-meter" aria-hidden="true">
        {segments.map((s, i) => (
          <span
            key={i}
            className={`tl-meter-seg is-${s.tone ?? "fair"}`}
            style={{ width: `${clamp(s.value / total) * 100}%` }}
          />
        ))}
        {markers.map((m, i) => (
          <span key={i} className="tl-meter-mark" style={{ left: `${clamp(m.at) * 100}%` }}>
            <em>{m.label}</em>
          </span>
        ))}
      </div>
      {caption ? <p className="tl-meter-cap">{caption}</p> : null}
    </div>
  );
}
