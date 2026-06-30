import assert from "node:assert/strict";
import { cleanPlayerName, canonicalPlayerKey } from "../lib/tennis-names";

// rimuove seeding, nazione, score-suffix
assert.equal(cleanPlayerName("Djokovic N. (1)"), "Djokovic N.");
assert.equal(cleanPlayerName("Carlos Alcaraz (ESP)"), "Carlos Alcaraz");
assert.equal(cleanPlayerName("Sinner J. 6-4 7-5"), "Sinner J.");
assert.equal(cleanPlayerName(null), "");

// canonical: lowercase, no diacritici, no punteggiatura, trattini→spazi
assert.equal(canonicalPlayerKey("Novak Djokovic"), "novak djokovic");
assert.equal(canonicalPlayerKey("Stefanos Tsitsipas"), "stefanos tsitsipas");
assert.equal(canonicalPlayerKey("Jean-Pierre Müller"), "jean pierre muller");
assert.equal(canonicalPlayerKey(null), "");

console.log("tennis-names OK");
