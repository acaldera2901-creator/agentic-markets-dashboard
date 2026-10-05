// lib/v3c/monogram.ts (#REDESIGN-V3C F1)
// Il cartellino squadra: una sigla su supporto neutro, i colori del club SOLO
// nella banda in basso, e dichiarati «da verificare» finché legale-compliance
// non si pronuncia. MAI stemmi reali o generati (DIRECTION-v3b, piano §Pareri
// legali). Tennis: iniziali del giocatore + nazione, nessuna banda colorata.
import { crestInitials } from "@/lib/ui/crest-initials";

export type TeamIdentity = {
  name: string;
  /** Sigla scelta a mano (es. «GEN»); se manca la ricaviamo dal nome. */
  code?: string;
  /** Due colori del club, SOLO per la banda. Finché `coloursVerified` è false
   *  il tooltip lo dice. */
  colours?: readonly [string, string] | null;
  coloursVerified?: boolean;
  /** Tennis: codice nazione a tre lettere (ESP, ITA…). */
  nation?: string | null;
};

export type MonogramBand =
  | { kind: "colours"; c1: string; c2: string; verified: boolean }
  | { kind: "nation"; label: string }
  | { kind: "neutral" };

export type Monogram = {
  code: string;
  band: MonogramBand;
  /** Testo per il tooltip/aria: nome, e la nota sui colori quando serve. */
  title: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Una sigla da 1 a 3 lettere: la mano, altrimenti il nome. Mai vuota. */
export function monogramCode(team: Pick<TeamIdentity, "name" | "code">): string {
  const hand = team.code?.trim().toUpperCase();
  if (hand && hand.length >= 1 && hand.length <= 3) return hand;
  const auto = crestInitials(team.name);
  return auto || "—";
}

export function monogramFor(team: TeamIdentity): Monogram {
  const code = monogramCode(team);
  if (team.nation) {
    const label = team.nation.trim().toUpperCase().slice(0, 3);
    return { code, band: { kind: "nation", label }, title: `${team.name} · ${label}` };
  }
  const c = team.colours;
  if (c && HEX.test(c[0]) && HEX.test(c[1])) {
    const verified = team.coloursVerified === true;
    return {
      code,
      band: { kind: "colours", c1: c[0], c2: c[1], verified },
      title: verified ? team.name : `${team.name} · club colours, to verify`,
    };
  }
  return { code, band: { kind: "neutral" }, title: team.name };
}
