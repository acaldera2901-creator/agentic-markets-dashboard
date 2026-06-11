import { landingAdapter } from "./landing";
import type { BookAdapter } from "../types";

// Stake v1 = landing adapter. Futuro: sostituire con un builder di deep-link al
// betslip quando la route bet-code/share-link di Stake sarà verificata (allora
// prefilled potrà diventare true). Il seam vive qui, isolato dagli altri book.
export const stakeAdapter: BookAdapter = landingAdapter;
