// components/v3c/fonts.ts (#REDESIGN-V3C F1)
// I tre font del design system via next/font: self-hosted a build, zero
// richieste a Google dal browser (il prototipo li hotlinkava; qui no).
//
// - Big Shoulders: su Google Fonts «Big Shoulders Display» non esiste più come
//   famiglia separata — è confluita nella variabile «Big Shoulders» con l'asse
//   ottico opsz 10–72. Il taglio Display del prototipo è opsz 72, che il CSS
//   fissa con font-variation-settings. Solo titoli: NON ha cifre tabulari.
// - Archivo variabile con l'asse wdth (62–125): testo a larghezza 100, numeri
//   a wdth 75 / 800 — condensati come un tabellone e tabulari (misurato in v3b).
// - JetBrains Mono 500: solo l'hash del sigillo.
import { Archivo, Big_Shoulders, JetBrains_Mono } from "next/font/google";

export const v3cDisplay = Big_Shoulders({
  variable: "--v3c-font-display",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  // next/font non ha le metriche di Big Shoulders per il fallback calcolato
  // («Failed to find font override values»): lo si dice esplicitamente invece
  // di lasciare un avviso a ogni build. Il fallback è Arial Narrow/Impact nel
  // CSS; il titolo è sopra la piega e in swap, quindi un piccolo CLS sul
  // titolo è il costo noto. Da rimisurare in F11 (CLS < 0,1).
  adjustFontFallback: false,
});

export const v3cText = Archivo({
  variable: "--v3c-font-text",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const v3cMono = JetBrains_Mono({
  variable: "--v3c-font-mono",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

/** Le tre variabili insieme, da mettere sul contenitore [data-theme="v3c"]. */
export const v3cFontClass = `${v3cDisplay.variable} ${v3cText.variable} ${v3cMono.variable}`;
