// components/v3c/BenchTool.tsx (#REDESIGN-V3C F1)
// La riga/tessera di un tool nel banco: cartellino · nome + riga d'uso ·
// esempio «input → risultato». Lo stesso componente sta nel banco di home
// (tessera, variant="bench") e nell'hub (riga, variant="hub"). Il tool parla la
// lingua della board: l'esempio è calcolato sui numeri di una partita vera.
import { ToolMark } from "./Monogramma";

export type BenchExample = {
  input: string;
  output: string;
  /** Risultato «in linea»/nullo: si spegne (grigio), non si colora. */
  flat?: boolean;
  /** Il risultato È una probabilità di mercato: sky. */
  market?: boolean;
};

type Props = {
  sigla: string;
  name: string;
  line: string;
  href: string;
  example: BenchExample;
  variant?: "bench" | "hub";
  slug?: string;
};

export function BenchTool({ sigla, name, line, href, example, variant = "bench", slug }: Props) {
  const cls = ["v3c-bench-t", variant === "hub" ? "v3c-hub-t" : null].filter(Boolean).join(" ");
  const out = ["v3c-out", "v3c-num", example.flat ? "v3c-g-flat" : null, example.market ? "v3c-m" : null].filter(Boolean).join(" ");
  return (
    <a className={cls} href={href} data-tool={slug}>
      <ToolMark sigla={sigla} name={name} slug={slug} />
      <span className="v3c-tr-t">
        <b className="v3c-t-row">{name}</b>
        <span className="v3c-tr-l">{line}</span>
      </span>
      <span className="v3c-tr-ex">
        <span className="v3c-in">{example.input}</span>
        <span className="v3c-arr" aria-hidden="true">
          →
        </span>
        <span className={out}>{example.output}</span>
      </span>
      <i className="v3c-chev" aria-hidden="true">
        ›
      </i>
    </a>
  );
}
