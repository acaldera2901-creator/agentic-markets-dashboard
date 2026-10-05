// components/v3c/ChipPartner.tsx (#REDESIGN-V3C F1)
// Il chip partner: marchio del book · quota. Link commerciale, quindi
// rel="nofollow sponsored" sempre, e un aria-label che dice cos'è. Una quota
// si mostra SOLO se il book ha un feed; chi non ce l'ha non passa di qui.
// Nel design system i book sono SAMPLE (nomi inventati, href="#").

export type PartnerBook = { code: string; name: string; colour: string };

type MarkProps = { book: PartnerBook; size?: "sm" | "lg" };

/** Il marchio: due lettere su un quadratino nel colore del book. */
export function BookMark({ book, size = "sm" }: MarkProps) {
  return (
    <span className={["v3c-bk", size === "lg" ? "v3c-bk-lg" : null].filter(Boolean).join(" ")} style={{ "--bk": book.colour } as React.CSSProperties} aria-hidden="true">
      {book.code}
    </span>
  );
}

type Props = {
  book: PartnerBook;
  price: number;
  href: string;
  /** Dati d'esempio: lo dice nell'aria-label, così non passa per vero. */
  sample?: boolean;
  className?: string;
};

export function ChipPartner({ book, price, href, sample = false, className }: Props) {
  const shown = price.toFixed(2);
  // Il nome accessibile nasce dal contenuto (il prezzo visibile + il nome del
  // book e la natura del link in sr-only), non da un aria-label che lo
  // sostituirebbe: WCAG 2.5.3, il testo visibile deve stare nel nome.
  return (
    <a className={["v3c-bchip", className].filter(Boolean).join(" ")} href={href} rel="nofollow sponsored" data-partner={book.code}>
      <BookMark book={book} />
      <b>{shown}</b>
      <span className="v3c-sr">
        {book.name}, affiliate link{sample ? ", sample" : ""}
      </span>
    </a>
  );
}
