// lib/v3c/mode.ts (#REDESIGN-V3C F1) — il modo chiaro/scuro, puro (server e client).
export type V3cMode = "light" | "dark";

/** `?mode=dark` → scuro; tutto il resto → carta, che è il default del sistema. */
export function parseMode(raw: string | string[] | undefined): V3cMode {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "dark" ? "dark" : "light";
}
