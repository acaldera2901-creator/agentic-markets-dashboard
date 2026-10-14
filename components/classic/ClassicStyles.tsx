"use client";
// components/classic/ClassicStyles.tsx — #CLASSIC-INT-1008 · #CLASSIC-ROOBET-1013
//
// I due CSS del filone «classic» (via le cornici + scheda Slab). Stanno qui e
// non in app/layout.tsx perché il layout li carica con un import DINAMICO sotto
// il flag di build: a flag spento il bundler toglie l'import e i ~100 KB non
// entrano nel build (misurato: con l'import statico ogni pagina di main portava
// un foglio in più, render-blocking, e l'HTML non era più quello di main).
//
// #CLASSIC-ROOBET-1013 — I FONT DEL PDF (Design Review 12/10, opzione C):
// Fira Sans Condensed per hero e titoli, IBM Plex Sans per navigazione, testo,
// controlli e scheda. Si caricano QUI, non nel layout, per la stessa ragione dei
// CSS: `next/font` va chiamato a livello di modulo, e un modulo che il layout
// importa solo a flag acceso tiene i font fuori dal build di main. Il layout non
// può mettere la classe sull'<html> (non conosce questo modulo), quindi il nome
// della famiglia passa per due variabili scritte su :root — le stesse che
// app/classic.css legge per sovrascrivere --am-font-ui / --am-font-display.
//
// Il numero grande della probabilità usa Mona Sans 900 a larghezza 112 (OFL 1.1,
// asse wdth) AL POSTO di ZT Nature Black, che non è in repo e non ha diritti
// webfont confermati (check pre-release del PDF). Se arriva la licenza di ZT
// Nature, si rimette in testa a --cl-font-prob in app/classic.css.
import { Fira_Sans_Condensed, IBM_Plex_Sans, Mona_Sans } from "next/font/google";
import "@/app/classic.generated.css"; // generato da scripts/classic/gen-frames.mjs
import "@/app/classic.css"; // agisce SOLO sotto html[data-frames="off"]

const fira = Fira_Sans_Condensed({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["500", "600", "700"], display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400", "500", "600", "700"], display: "swap" });
const mona = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], display: "swap" });

export default function ClassicStyles() {
  return (
    <style data-classic-fonts="">{`html[data-frames="off"]{--cl-font-head:${fira.style.fontFamily};--cl-font-ui:${plex.style.fontFamily};--cl-font-prob-face:${mona.style.fontFamily};}`}</style>
  );
}
