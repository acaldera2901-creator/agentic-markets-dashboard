// components/lobby/PageHeadline.tsx — #RESTYLING-0921 round 8
//
// Il titolo tipografico che apre la Home: occhiello piccolo, una riga enorme
// in Anton con l'ultima parola in lime, e un blocco di spalla a destra.
//
// PERCHÉ ESISTE. È l'elemento più riconoscibile del riferimento di Andrea
// (betredge-studio-0922, `<section class="page-heading">`) e da noi mancava
// del tutto: la Home apriva direttamente sul rail hero+card, cioè sullo
// stesso impianto di prima del restyling. qa-andrea ha misurato «Home vs
// riferimento ~70%, non ancora un clone» e ha indicato questa assenza come
// la prima causa: senza la riga grande la pagina *sembra non cambiata*,
// perché il font nuovo non si vede mai a una misura in cui si legga come
// scelta tipografica.
//
// MISURE DEL RIFERIMENTO (computate sul suo CSS a 1512px, 22/09):
// h1 Anton 84px / lh 1.08 / ls 0.005em / uppercase / #F4F3EE, con la parola
// accento in gradiente lime ritagliato sul testo; occhiello Manrope 12px/700
// ls 0.08em #81D9FF; nota di spalla Manrope 14px/500 lh 1.5 allineata a
// destra. Qui i colori passano dai token (--am-sky, --am-text, --am-lime)
// così la sezione regge anche in chiaro, dove il lime scende di valore.
//
// IL TITOLO NON È UN ARRAY DI RIGHE. HeroPortrait prende `lines: string[]`
// perché lì la card è stretta e le tre righe sono una scelta di disegno. Qui
// il riferimento usa testo inline che va a capo da sé (`IL TUO <em>MATCHDAY.
// </em>`): a 1512px sta su una riga, sotto i 900 ne prende due, e in russo o
// francese la spezzatura è diversa. Righe fisse avrebbero prodotto una vedova
// in almeno una delle cinque lingue.
//
// Tutto il testo arriva dal chiamante: il componente non conosce la lingua.
export type PageHeadlineProps = {
  /** L'occhiello sopra il titolo. Es. "CALCIO. TENNIS. IL TUO EDGE." */
  eyebrow: string;
  /** La parte neutra del titolo. Es. "Il tuo" */
  lead: string;
  /** La parola in lime che chiude il titolo. Es. "matchday." */
  accent: string;
  /** Il blocco di spalla, una riga per elemento. Omesso → niente spalla. */
  note?: string[];
  /** La riga piccola sotto la spalla (nota di rischio). Omessa → niente. */
  hint?: string;
  className?: string;
};

export function PageHeadline({ eyebrow, lead, accent, note, hint, className }: PageHeadlineProps) {
  return (
    <section className={["br-headline", className].filter(Boolean).join(" ")}>
      <div className="br-headline__main">
        <span className="br-headline__eyebrow">{eyebrow}</span>
        <h1 className="br-headline__title">
          {lead} <em className="br-headline__accent">{accent}</em>
        </h1>
      </div>
      {(note?.length || hint) && (
        <div className="br-headline__note">
          {note?.length ? (
            <p className="br-headline__lines">
              {note.map((line, i) => (
                // Le righe sono una frase sola spezzata dal disegno, non un
                // elenco: <br> e non <p> separati, o uno screen reader ci
                // mette una pausa di paragrafo in mezzo a un periodo.
                <span key={line}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </p>
          ) : null}
          {hint && <span className="br-headline__hint">{hint}</span>}
        </div>
      )}
    </section>
  );
}
