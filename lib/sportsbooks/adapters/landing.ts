import { joinUrl } from "../url";
import type { BookAdapter } from "../types";

// v1 best-effort: porta l'utente sulla sezione sport configurata dall'operatore.
// NON è un betslip precompilato -> prefilled resta false (onestà: Costruito != Verificato).
// Il deep-link al betslip pieno richiede il reverse-engineering del bet-code (fuori scope v1).
export const landingAdapter: BookAdapter = (sel, book) => ({
  url: joinUrl(book.baseUrl, book.sportPaths?.[sel.sport]),
  prefilled: false,
});
