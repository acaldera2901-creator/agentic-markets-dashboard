// components/v3c/Fascia.tsx (#REDESIGN-V3C F1)
// La fascia: il lower-third da regia che apre ogni pagina. Bordo LED lime in
// alto, taglio del lockup a destra, tab royal con il contesto, titolo in Big
// Shoulders, riga meta con i fatti (n partite, ora dei prezzi, sigillo).
import type { ReactNode } from "react";

type Props = {
  /** Il contesto, nella tab royal: «Board · football & tennis». */
  tab: string;
  /** Il titolo. Se è una stringa va in maiuscolo da cartellone (t-page);
   *  per un titolo partita passare un nodo con la classe v3c-t-match. */
  title: ReactNode;
  /** Livello del titolo: h1 su una pagina, h2 dentro una sezione. */
  as?: "h1" | "h2";
  /** La riga dei fatti sotto il titolo. */
  meta?: ReactNode;
  id?: string;
  className?: string;
};

export function Fascia({ tab, title, as: Tag = "h1", meta, id, className }: Props) {
  const headingId = id ?? "v3c-fascia-h";
  return (
    <section className={["v3c-fascia", className].filter(Boolean).join(" ")} aria-labelledby={headingId}>
      <span className="v3c-fascia-tab">{tab}</span>
      {typeof title === "string" ? (
        <Tag className="v3c-t-page" id={headingId}>
          {title}
        </Tag>
      ) : (
        <Tag className="v3c-t-match" id={headingId}>
          {title}
        </Tag>
      )}
      {meta ? <p className="v3c-fascia-meta">{meta}</p> : null}
    </section>
  );
}
