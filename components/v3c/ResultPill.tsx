// components/v3c/ResultPill.tsx (#REDESIGN-V3C ui2)
// L'esito di una partita sigillata, accanto alla riga: W (vinta) · L (persa) ·
// V (void/annullata) · «in attesa». Colore E segno E lettera (mai solo colore),
// la parola intera per chi legge con uno screen reader. W e L hanno lo STESSO
// peso: stessa misura, stesso pieno, stessa tipografia — cambia solo il colore
// (lime pieno / inchiostro pieno) e il segno. Void e attesa non sono esiti:
// contorno, non pieno. W/L/V sono la sigla internazionale e restano tali in
// ogni lingua; la parola viene dalla copy della pagina.
import "./ui2.css";

export type ResultKind = "won" | "lost" | "void" | "pending";

const MARK: Record<ResultKind, { glyph: string; letter: string | null }> = {
  won: { glyph: "✓", letter: "W" },
  lost: { glyph: "✕", letter: "L" },
  void: { glyph: "–", letter: "V" },
  pending: { glyph: "…", letter: null },
};

/** Dalle due forme del contratto (ricevute: verdict; ieri: result) alla pill. */
export function resultKindOf(v: string): ResultKind {
  if (v === "won" || v === "in_favour") return "won";
  if (v === "lost" || v === "against") return "lost";
  if (v === "void") return "void";
  return "pending";
}

/** «2-1» → «2–1», «6-4 6-3» → «6–4 6–3»: lineetta tipografica fra le cifre. */
export function scoreText(s: string | null | undefined): string | null {
  if (!s || !s.trim()) return null;
  return s.trim().replace(/(\d)\s*[-:]\s*(\d)/g, "$1–$2");
}

export function ResultPill({ kind, word }: { kind: ResultKind; word: string }) {
  const m = MARK[kind];
  return (
    <span className={`v3c-rp v3c-rp-${kind}`} title={word}>
      <span aria-hidden="true" className="v3c-rp-g">
        {m.glyph}
      </span>
      {m.letter ? (
        <>
          <span aria-hidden="true">{m.letter}</span>
          <span className="v3c-sr">{word}</span>
        </>
      ) : (
        <span>{word}</span>
      )}
    </span>
  );
}
