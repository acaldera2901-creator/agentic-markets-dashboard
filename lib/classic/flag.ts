// lib/classic/flag.ts — #CLASSIC-CARD-1008
//
// Il redesign «classic» (decisioni di Andrea, 08/10: REGOLE-CLASSIC.md) vive
// dietro un flag di BUILD, non di runtime: `NEXT_PUBLIC_CLASSIC=1` al momento
// di `next build`. Next sostituisce `process.env.NEXT_PUBLIC_*` con il valore
// letterale, quindi a flag spento ogni ramo `if (CLASSIC)` è codice morto che
// il minificatore toglie, e il sito resta quello di main.
//
// Una sola costante per tutto il filone: niente letture sparse di process.env.
export const CLASSIC = process.env.NEXT_PUBLIC_CLASSIC === "1";
