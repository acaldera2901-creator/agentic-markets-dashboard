// lib/classic/build-flag.d.ts — #CLASSIC-PARITY-1008
//
// `__CLASSIC_BUILD__` è il flag del filone «classic» (NEXT_PUBLIC_CLASSIC=1)
// sostituito a build time: next.config.ts → compiler.define, vitest.config.ts
// → define. Lo usano i moduli CONDIVISI col sito di main al posto di
// `process.env.NEXT_PUBLIC_CLASSIC`, che in un modulo client porta con sé
// l'import del polyfill di `process` e a flag spento cambiava il chunk.
declare const __CLASSIC_BUILD__: boolean;
