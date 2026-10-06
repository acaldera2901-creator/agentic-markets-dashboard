// components/v3c/Monogramma.tsx (#REDESIGN-V3C F1)
// Il cartellino squadra e, con la stessa grammatica, il cartellino tool.
// Sigla su supporto neutro; i colori del club SOLO nella banda da 4 px,
// dichiarati «da verificare». Tennis: iniziali + nazione, nessuna banda
// colorata. Tool: la sigla della formula, banda royal (= azione dell'utente).
// MAI stemmi reali o generati: è una regola, non un segnaposto.
import { monogramFor, type TeamIdentity } from "@/lib/v3c/monogram";

type Size = "sm" | "lg";

type TeamProps = { team: TeamIdentity; size?: Size; className?: string };

export function Monogramma({ team, size = "sm", className }: TeamProps) {
  const m = monogramFor(team);
  const cls = ["v3c-mg", size === "lg" ? "v3c-mg-lg" : null, className].filter(Boolean).join(" ");
  let band: React.ReactNode;
  if (m.band.kind === "colours") {
    band = <i style={{ "--c1": m.band.c1, "--c2": m.band.c2 } as React.CSSProperties} data-verified={m.band.verified ? "true" : "false"} />;
  } else if (m.band.kind === "nation") {
    band = <i className="v3c-tn">{m.band.label}</i>;
  } else {
    band = <i className="v3c-neutral" />;
  }
  return (
    <span className={cls} title={m.title} role="img" aria-label={m.title}>
      <b aria-hidden="true">{m.code}</b>
      {band}
    </span>
  );
}

/** Due cartellini affiancati: casa, trasferta. */
export function Monogrammi({ home, away, size = "sm" }: { home: TeamIdentity; away: TeamIdentity; size?: Size }) {
  return (
    <span className="v3c-mgs">
      <Monogramma team={home} size={size} />
      <Monogramma team={away} size={size} />
    </span>
  );
}

type ToolProps = { sigla: string; name: string; size?: Size; className?: string; slug?: string };

/** polish: le 11 icone tool del kit (redesign/brand/icons/svg, svgo), al posto della sigla scritta. */
export const TOOL_ICON: Readonly<Record<string, string>> = {
  "odds-converter": "tool-odds-converter",
  "margin-calculator": "tool-margin",
  "ev-calculator": "tool-ev",
  "kelly-criterion": "tool-kelly",
  "probability-calculator": "tool-probability",
  "arbitrage-calculator": "tool-arbitrage",
  "parlay-calculator": "tool-parlay",
  "roi-calculator": "tool-roi",
  "yield-calculator": "tool-yield",
  "stake-calculator": "tool-stake",
  "bankroll-calculator": "tool-bankroll",
};

/** Un'icona del kit come maschera CSS: prende il colore del testo. */
export function KitIcon({ name, className }: { name: string; className?: string }) {
  return <i className={["v3c-ico", className].filter(Boolean).join(" ")} style={{ "--ico": `url(/brand/v3c/icons/${name}.svg)` } as React.CSSProperties} aria-hidden="true" />;
}

/** Il cartellino tool: l'icona del kit (o, senza icona, la sigla della formula), banda royal. */
export function ToolMark({ sigla, name, size = "sm", className, slug }: ToolProps) {
  const icon = slug ? TOOL_ICON[slug] : undefined;
  const cls = ["v3c-mg", "v3c-mg-tool", icon ? "v3c-mg-ico" : null, size === "lg" ? "v3c-mg-lg" : null, className].filter(Boolean).join(" ");
  return (
    <span className={cls} title={name} aria-hidden="true">
      {icon ? <KitIcon name={icon} /> : <b>{sigla}</b>}
      <i />
    </span>
  );
}
