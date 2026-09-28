// lib/ui/quota-rule.ts — #INCLUDED-TODAY-0928
//
// Il testo della riga che, su Calcio e Tennis, separa le card che il piano ha
// già aperto oggi da quelle coperte. Due numeri VERI, contati sulla lista che
// l'utente ha davanti (dopo i filtri), non sulla quota nominale del piano: se
// oggi giocano due partite, «le tue 2 letture» è ciò che si vede, non «3».
//
// Sta fuori dal JSX per la sola ragione per cui vale la pena testarlo: il
// singolare. «Le tue 1 letture di oggi» sarebbe il primo segno che nessuno ha
// guardato la pagina con una partita sola.
import type { Lang } from "@/lib/house-banners";

export type QuotaRuleCopy = {
  /** Sinistra: ciò che è già dell'utente. */
  yours: string;
  /** Destra: quante altre ne aprirebbe il Pro (il piano senza quota). */
  more: string;
};

export function quotaRuleCopy(lang: Lang, included: number, locked: number): QuotaRuleCopy {
  const n = Math.max(0, Math.floor(included));
  const m = Math.max(0, Math.floor(locked));
  switch (lang) {
    case "it":
      return {
        yours: n === 1 ? "La tua lettura di oggi" : `Le tue ${n} letture di oggi`,
        more: m === 1 ? "Un'altra con Pro" : `Altre ${m} con Pro`,
      };
    case "es":
      return {
        yours: n === 1 ? "Tu lectura de hoy" : `Tus ${n} lecturas de hoy`,
        more: m === 1 ? "Una más con Pro" : `${m} más con Pro`,
      };
    case "fr":
      return {
        yours: n === 1 ? "Votre lecture du jour" : `Vos ${n} lectures du jour`,
        more: m === 1 ? "Une de plus avec Pro" : `${m} de plus avec Pro`,
      };
    case "ru":
      // Il russo declina per numero in tre forme: si evita il sostantivo
      // contato e si scrive la cifra dopo i due punti.
      return {
        yours: `Открыто сегодня: ${n}`,
        more: `Ещё ${m} с Pro`,
      };
    default:
      return {
        yours: n === 1 ? "Your reading today" : `Your ${n} readings today`,
        more: m === 1 ? "1 more with Pro" : `${m} more with Pro`,
      };
  }
}
