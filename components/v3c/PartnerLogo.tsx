// components/v3c/PartnerLogo.tsx (#REDESIGN-V3C ui2)
// Il logo del partner al posto del monogramma a due lettere. Fonte unica: il
// catalogo lib/partners.ts (i file ufficiali in public/logos, già usati dalla
// vetrina di sempre) — niente loghi generati o ridisegnati. Tutti i file sono
// pensati per fondo scuro (scritte bianche/gialle), quindi stanno su una placca
// navy fissa: leggibile sia sulla carta chiara sia in scuro. Contenitore di
// dimensione fissa + object-fit: contain, width/height espliciti → nessun salto
// di layout. Partner senza logo nel catalogo: il NOME in testo (mai le
// iniziali in un cerchio); l'elenco sta in docs/redesign/partner-logos-missing.md.
// Le SQUADRE restano coi loro monogrammi (Monogramma.tsx): questo è solo per i book.
import { PARTNERS } from "@/lib/partners";
import "./ui2.css";

export type PartnerLogoSize = "chip" | "row" | "lg" | "card";

/** Box del contenitore (px), uguale a ui2.css .v3c-plogo-*: la placca non cambia mai misura, il logo ci sta dentro. */
const BOX: Record<PartnerLogoSize, [number, number]> = {
  chip: [56, 22],
  row: [72, 28],
  lg: [112, 44],
  card: [168, 64],
};

/**
 * Marchi senza il nome scritto dentro (un leone, una X-O, delle carte, «N1»):
 * da soli non dicono chi è il book, quindi accanto va sempre il nome in testo.
 */
const WORDLESS = new Set(["fortuneplay", "rollxo", "hollywin", "n1bet"]);

type Found = { id: string; name: string; logo: string | null };

/** Il partner del catalogo per chiave del book (le chiavi coincidono con gli id) o per nome. */
export function partnerLogoOf(key: string, name: string): Found {
  const k = key.trim().toLowerCase();
  const n = name.trim().toLowerCase();
  const p = PARTNERS.find((x) => x.id === k) ?? PARTNERS.find((x) => x.name.toLowerCase() === n);
  return p ? { id: p.id, name: p.name, logo: p.logo || null } : { id: k || n, name, logo: null };
}

/** true se il logo non porta il nome: chi lo usa deve scrivere il nome accanto. */
export function needsName(key: string, name: string): boolean {
  const f = partnerLogoOf(key, name);
  return !f.logo || WORDLESS.has(f.id);
}

type Props = {
  /** chiave del book (fortuneplay, ybets, …) o id del partner */
  id: string;
  name: string;
  size?: PartnerLogoSize;
  /** il nome è già scritto accanto in testo: alt vuoto, niente doppia lettura */
  decorative?: boolean;
  className?: string;
};

export function PartnerLogo({ id, name, size = "row", decorative = false, className }: Props) {
  const f = partnerLogoOf(id, name);
  // un marchio senza nome nel chip: placca quadrata, il nome lo scrive chi lo usa (needsName)
  const square = size === "chip" && f.logo != null && WORDLESS.has(f.id);
  const [w, h] = square ? [22, 22] : BOX[size];
  const cls = ["v3c-plogo", `v3c-plogo-${size}`, square ? "v3c-plogo-sq" : null, f.logo ? null : "v3c-plogo-txt", className].filter(Boolean).join(" ");
  if (!f.logo) {
    // fallback dichiarato: il nome del partner, non le iniziali
    return (
      <span className={cls} aria-hidden={decorative || undefined}>
        {f.name}
      </span>
    );
  }
  return (
    <span className={cls} data-partner-logo={f.id}>
      {/* eslint-disable-next-line @next/next/no-img-element -- loghi statici in /public (SVG/PNG piccoli), dimensioni fisse */}
      <img src={f.logo} alt={decorative ? "" : f.name} width={w} height={h} loading="lazy" decoding="async" />
    </span>
  );
}
