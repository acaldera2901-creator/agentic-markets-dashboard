import assert from "node:assert/strict";
import { teamPairKey } from "../lib/team-pair-key";

// calcio: nomi normalizzati (FC strippato), ordinati, prefisso data
assert.equal(
  teamPairKey("soccer", "FC Internazionale", "AC Milan", "2026-07-01T18:00:00Z"),
  "2026-07-01:internazionale|milan"
);
// ordine indipendente dall'input
assert.equal(
  teamPairKey("soccer", "AC Milan", "FC Internazionale", "2026-07-01T18:00:00Z"),
  "2026-07-01:internazionale|milan"
);
// tennis: canonical key
assert.equal(
  teamPairKey("tennis", "Novak Djokovic", "Carlos Alcaraz (ESP)", "2026-07-01T12:00:00Z"),
  "2026-07-01:carlos alcaraz|novak djokovic"
);
// data mancante → null
assert.equal(teamPairKey("soccer", "A", "B", null), null);

console.log("team-pair-key OK");
