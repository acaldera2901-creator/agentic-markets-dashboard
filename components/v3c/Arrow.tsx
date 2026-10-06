// components/v3c/Arrow.tsx (#REDESIGN-V3C polish) — la freccia del monogramma
// ufficiale (redesign/brand/signature/arrow-*.svg) come motivo di bottoni e link.
// È una maschera CSS: prende il colore del testo (lime dentro la CTA royal).
export function Arrow({ up = false }: { up?: boolean }) {
  return <span className={up ? "v3c-arw v3c-arw-up" : "v3c-arw"} aria-hidden="true" />;
}
