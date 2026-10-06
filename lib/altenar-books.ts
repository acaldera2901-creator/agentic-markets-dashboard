// #V3C-PARTNERS (F7) — partner il cui sportsbook gira su Altenar.
// Il widget pubblico Altenar (`/api/widget/GetEvents`) risponde senza
// autenticazione con eventi, mercati e quote decimali: lo usa lo stesso sito
// del partner per la sua pagina sport. Un partner = una `integration`.
//
// Misurato il 06/10/2026 (GET leggere, IP DE, user-agent identificabile):
//   wildz  → 200 JSON, 833 eventi calcio, 366 tennis
//   beazt  → 200 JSON, 833 eventi calcio, quote IDENTICHE a wildz (11.732 su
//            11.732): stessa rete Rootz, stesso trading. Compaiono entrambi
//            perché sono due partner con due link, ma il confronto li mostra
//            uguali — non è un errore.
//   betscore / casea / stonevegas → 400 (integration sconosciuta). Rimisurato il
//            06/10 (live): il fornitore è Kickertech/TG Lab (`*.sbx.bet`, fr=247/
//            164/180), non Altenar né Kambi; l'endpoint eventi risponde 406 a un
//            user-agent identificabile e usa parametri offuscati → nessuna entry
//            qui, niente aggiramento (restano «Odds on site», feed chiesto al partner).
//
// Nessun deep-link per evento: i link di rete atterrano sulla home del brand
// (nota #PARTNER-WILDZ-BEAZT in lib/affiliate.ts) → `landing`.
import { LANDING_PARTNERS } from "./affiliate";

export type AltenarBook = {
  key: string;
  name: string;
  /** parametro `integration` del widget Altenar (lo stesso che usa il sito) */
  integration: string;
  /** origin del widget */
  widgetBase: string;
  /** link affiliato di atterraggio (attribuzione) */
  landing: string;
};

const WIDGET = "https://sb2frontend-altenar2.biahosted.com";
const landingOf = (name: string) => LANDING_PARTNERS.find((p) => p.name === name)?.url ?? "";

export const ALTENAR_BOOKS: AltenarBook[] = [
  { key: "wildz", name: "Wildz", integration: "wildz", widgetBase: WIDGET, landing: landingOf("Wildz") },
  { key: "beazt", name: "Beazt", integration: "beazt", widgetBase: WIDGET, landing: landingOf("Beazt") },
];
