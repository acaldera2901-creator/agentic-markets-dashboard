"use client";
// components/classic/ClassicStyles.tsx — #CLASSIC-INT-1008
//
// I due CSS del filone «classic» (via le cornici + scheda Slab). Stanno qui e
// non in app/layout.tsx perché il layout li carica con un import DINAMICO sotto
// il flag di build: a flag spento il bundler toglie l'import e i ~100 KB non
// entrano nel build (misurato: con l'import statico ogni pagina di main portava
// un foglio in più, render-blocking, e l'HTML non era più quello di main).
import "@/app/classic.generated.css"; // generato da scripts/classic/gen-frames.mjs
import "@/app/classic.css"; // agisce SOLO sotto html[data-frames="off"]

export default function ClassicStyles() {
  return null;
}
