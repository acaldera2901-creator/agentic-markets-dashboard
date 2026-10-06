"use client";
// components/v3c/StatesCopy.tsx (#REDESIGN-V3C polish) — l'etichetta dell'azione
// degli stati nella lingua salvata (le pagine 404/500 sono rese senza contesto di lingua).
import { useStateCopy } from "./States";

export function BackToBoard({ kind }: { kind: "404" | "500" | "empty" }) {
  return <>{useStateCopy()[kind].action}</>;
}
