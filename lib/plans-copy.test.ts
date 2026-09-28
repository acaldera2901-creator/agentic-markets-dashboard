// lib/plans-copy.test.ts — #EDGE-COPY-0928
//
// La descrizione del piano Base prometteva «full edge». Dal round 14 del
// restyling nessuna scheda mostra un numero di edge, per nessun piano: la
// promessa non corrispondeva a niente di visibile. Questa guardia impedisce
// che torni nella descrizione del piano, in nessuna delle cinque lingue.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(REPO_ROOT, "app/app/page.tsx"), "utf8");

describe("descrizione del piano Base", () => {
  const start = src.indexOf('en: "Up to 7 predictions per sport a day');
  const block = start >= 0 ? src.slice(src.lastIndexOf("pick5(lang, {", start), src.indexOf("})", start)) : "";

  it("esiste (la guardia non è vuota)", () => {
    expect(block).toMatch(/it: "Fino a 7 prediction per sport al giorno/);
    expect(block).toMatch(/ru: "/);
  });

  it("non promette edge in nessuna lingua", () => {
    expect(block).not.toMatch(/edge/i);
  });

  it("promette ancora le spiegazioni, che Base vede davvero", () => {
    expect(block).toMatch(/full explanations/);
  });
});
