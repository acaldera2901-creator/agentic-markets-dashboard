// components/classic/desk.ts — #CLASSIC-PARITY-1008
//
// Tutto ciò che il desk (app/app/page.tsx) usa del filone classic, in un modulo
// solo: il desk lo carica con UN `require` dentro il ramo del flag di build, e
// a flag spento questo file (e quello che importa) non entra nel build.
export { ClassicPricesScope } from "@/components/classic/ClassicContext";
export { ClassicTzNote } from "@/components/classic/ClassicTzNote";
export { ClassicPlans } from "@/components/classic/ClassicPlans"; // #CLASSIC-PLANS-1014
export { classicCopy } from "@/lib/classic/copy";
export { differsBy, sheetValueAllowed } from "@/lib/classic/card-view";
export { buildClassicLobbySections } from "@/lib/classic/lobby-sections";
// #CLASSIC-PAGES-1014 — le pagine sport (Calcio, Tennis…) per lega, con le schede dentro
export { ClassicLeagueGroups } from "@/components/classic/ClassicLeagueGroups";
