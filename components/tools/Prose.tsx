// components/tools/Prose.tsx (#TOOLS-HUB-0805-ART)
// Rende i paragrafi della spiegazione con due appigli per l'occhio: il primo
// paragrafo più grande (attacco, come lo standfirst di un articolo) e le frasi
// chiave marcate `**così**` in grassetto. Niente markdown completo: un solo
// segno, gestito con uno split, perché serve solo questo.

function withBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

export function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className={i === 0 ? "tl-prose-lead" : undefined}>
          {withBold(p)}
        </p>
      ))}
    </>
  );
}
