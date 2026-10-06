// lib/i18n/v3c-tools/copy.test.ts (#REDESIGN-V3C F5)
// Il dizionario nuovo: l'italiano ha le stesse chiavi dell'inglese, nessuna
// stringa vuota, gli stessi segnaposto, ≤ 22 parole per stringa; le lingue in
// fallback sono dichiarate, non scoperte a runtime.
import { describe, expect, it } from "vitest";
import { TOOL_LOCALES, TOOL_SLUGS } from "@/lib/tools/registry";
import { TOOLS } from "@/lib/v3c/tools";
import { FALLBACK_TO_EN, V3C_TOOLS_COPY, fmt, getV3cToolsCopy, isFallbackLocale } from "./index";

type Leaf = { path: string; value: string };
function leaves(obj: unknown, path = ""): Leaf[] {
  if (typeof obj === "string") return [{ path, value: obj }];
  if (obj && typeof obj === "object") return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const en = V3C_TOOLS_COPY.en;
const itDict = V3C_TOOLS_COPY.it!;

describe("inglese e italiano", () => {
  it("hanno le stesse chiavi, foglia per foglia", () => {
    expect(leaves(itDict).map((l) => l.path)).toEqual(leaves(en).map((l) => l.path));
  });

  it("nessuna stringa vuota, stessi segnaposto, ≤ 22 parole", () => {
    const itByPath = new Map(leaves(itDict).map((l) => [l.path, l.value]));
    for (const l of leaves(en)) {
      expect(l.value.trim(), l.path).not.toBe("");
      const itv = itByPath.get(l.path)!;
      expect(itv.trim(), l.path).not.toBe("");
      expect(placeholders(itv), l.path).toEqual(placeholders(l.value));
      expect(words(l.value), `${l.path} (en): ${l.value}`).toBeLessThanOrEqual(22);
      expect(words(itv), `${l.path} (it): ${itv}`).toBeLessThanOrEqual(22);
    }
  });

  it("l'italiano non è l'oggetto inglese", () => {
    expect(itDict).not.toBe(en);
    expect(itDict.hub.title).not.toBe(en.hub.title);
  });

  it("ogni tool del motore ha nome, riga, etichette per OGNI input e OGNI risultato", () => {
    for (const t of TOOLS) {
      for (const c of [en, itDict]) {
        const tc = c.tools[t.slug];
        expect(tc.name, t.slug).toBeTruthy();
        for (const i of t.inputs) expect(tc.inputs[i.key], `${t.slug}.inputs.${i.key}`).toBeTruthy();
        // tutte le chiavi di risultato che il motore può emettere (coi default e nei casi limite)
        const keys = new Set<string>();
        t.compute(Object.fromEntries(t.inputs.map((i) => [i.key, i.default]))).forEach((r) => keys.add(r.key));
        if (t.slug === "kelly-criterion") keys.add("none");
        if (t.slug === "arbitrage-calculator") keys.add("profit");
        for (const k of keys) expect(tc.results[k], `${t.slug}.results.${k}`).toBeTruthy();
        expect(!!tc.column, t.slug).toBe(!!t.column);
      }
    }
    expect(Object.keys(en.tools).sort()).toEqual([...TOOL_SLUGS].sort());
  });
});

describe("fallback dichiarato", () => {
  it("dopo F10 nessuna lingua è senza dizionario: FALLBACK_TO_EN è vuoto e coincide con le mancanti", () => {
    expect(FALLBACK_TO_EN).toEqual([]);
    const missing = TOOL_LOCALES.filter((l) => V3C_TOOLS_COPY[l] == null);
    expect([...missing].sort()).toEqual([...FALLBACK_TO_EN].sort());
    for (const l of FALLBACK_TO_EN) {
      expect(isFallbackLocale(l)).toBe(true);
      expect(getV3cToolsCopy(l)).toBe(en);
    }
    expect(isFallbackLocale("it")).toBe(false);
    expect(getV3cToolsCopy("it")).toBe(itDict);
  });
});

describe("fmt", () => {
  it("riempie i segnaposto e lascia visibile quello che manca", () => {
    expect(fmt("{n} of {total} tools match “{q}”", { n: 2, total: 11, q: "kelly" })).toBe("2 of 11 tools match “kelly”");
    expect(fmt("Fair price at {prob}%", {})).toBe("Fair price at {prob}%");
  });
});
