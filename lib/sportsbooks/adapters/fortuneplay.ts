import { landingAdapter } from "./landing";
import type { BookAdapter } from "../types";

// FortunePlay (deal rooster.bet / piattaforma BetConstruct). Il referral è uno
// short-link (mediaroosters.com) che reindirizza alla landing dell'operatore:
// è una landing, non un betslip precompilato -> landing adapter (prefilled=false).
export const fortuneplayAdapter: BookAdapter = landingAdapter;
