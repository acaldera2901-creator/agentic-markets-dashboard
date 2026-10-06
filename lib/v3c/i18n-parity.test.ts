// lib/v3c/i18n-parity.test.ts (#REDESIGN-V3C F10)
// Parità delle 11 lingue su TUTTI i dizionari v3c: stesse chiavi dell'inglese,
// stessi tipi, nessuna stringa vuota, le funzioni hanno la stessa arità e
// stampano ogni argomento quante volte lo stampa l'inglese (nessun segnaposto
// perso o duplicato), stessi `{x}` nei template, niente claim vietati in più,
// ≤ 22 parole per elemento a schermo, e nessuna lingua è l'inglese travestito.
// Le deviazioni che l'italiano approvato ha già (un argomento-enum tradotto,
// es. `dir` → «più lungo/corto») valgono anche per le altre lingue.
import { describe, expect, it } from "vitest";
import { V3C_COPY, V3C_LANGS, copyFor, v3cLang, v3cLocale } from "./copy";
import { V3C_MATCH_COPY } from "./match-copy";
import { V3C_RECORD_COPY } from "./copy-record";
import { PAGES_COPY } from "./pages-copy";
import { communityCopyFor } from "./community-copy";
import { V3C_HOME_FAQ } from "./home-faq";
import { STATE_COPY } from "@/components/v3c/States";
import { V3C_TOOLS_COPY } from "@/lib/i18n/v3c-tools";

type Fn = (...a: unknown[]) => unknown;
const SAMPLE_N = [7301, 7302, 7303, 7304, 7305, 7306];
const SAMPLE_S = ["ZQa", "ZQb", "ZQc", "ZQd", "ZQe", "ZQf"];
const count = (h: string, n: string) => h.split(n).length - 1;
const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const BANNED = /guarant|garanti|gwarant|гарант|sure win|easy money|\block\b|crush|beat(ing)? the market|\bROI\b|\bCLV\b|hit.?rate/i;

function call(f: Fn, args: unknown[]): string | null {
  try {
    const r = f(...args);
    return typeof r === "string" ? r : JSON.stringify(r);
  } catch {
    return null;
  }
}
function sampleOut(en: Fn, tr: Fn): [string, string, unknown[]] | null {
  for (const s of [SAMPLE_N, SAMPLE_S]) {
    const args = s.slice(0, en.length);
    const e = call(en, args);
    if (e != null) return [e, call(tr, args) ?? "«throws»", args];
  }
  return null;
}

/** I problemi di `tr` rispetto a `en`, come «percorso: tipo». */
function diff(en: unknown, tr: unknown, path = "", out: string[] = []): string[] {
  if (typeof en === "function") {
    if (typeof tr !== "function") return out.push(`${path}: not a function`), out;
    if (tr.length !== en.length) out.push(`${path}: arity`);
    const o = sampleOut(en as Fn, tr as Fn);
    if (o) {
      const [e, t, args] = o;
      if (t === "«throws»" || !t.trim()) out.push(`${path}: throws/empty`);
      args.forEach((a, i) => count(e, String(a)) !== count(t, String(a)) && out.push(`${path}: arg ${i}`));
      if (ph(e) !== ph(t)) out.push(`${path}: placeholders`);
    }
    return out;
  }
  if (Array.isArray(en)) {
    if (!Array.isArray(tr) || tr.length !== en.length) return out.push(`${path}: array`), out;
    en.forEach((v, i) => diff(v, tr[i], `${path}[${i}]`, out));
    return out;
  }
  if (en && typeof en === "object") {
    if (!tr || typeof tr !== "object") return out.push(`${path}: not an object`), out;
    const ek = Object.keys(en);
    const tk = Object.keys(tr);
    ek.filter((k) => !tk.includes(k)).forEach((k) => out.push(`${path}.${k}: missing`));
    tk.filter((k) => !ek.includes(k)).forEach((k) => out.push(`${path}.${k}: extra`));
    ek.filter((k) => tk.includes(k)).forEach((k) => diff((en as Record<string, unknown>)[k], (tr as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out));
    return out;
  }
  if (typeof en === "string") {
    if (typeof tr !== "string") out.push(`${path}: not a string`);
    else {
      if (en.trim() && !tr.trim()) out.push(`${path}: empty`);
      if (ph(en) !== ph(tr)) out.push(`${path}: placeholders`);
    }
    return out;
  }
  if (tr !== en) out.push(`${path}: value`);
  return out;
}

/** Ogni stringa che arriva a schermo (le funzioni chiamate coi campioni). */
function strings(o: unknown, path = ""): { path: string; s: string }[] {
  if (typeof o === "string") return [{ path, s: o }];
  if (typeof o === "function") {
    const r = call(o as Fn, SAMPLE_N.slice(0, o.length)) ?? call(o as Fn, SAMPLE_S.slice(0, o.length));
    return r ? [{ path, s: r }] : [];
  }
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

const LANGS = V3C_LANGS.filter((l) => l !== "en");
const DICTS: { name: string; of: (l: string) => unknown; maxWords: number | null }[] = [
  { name: "copy", of: (l) => V3C_COPY[l as never], maxWords: 22 },
  { name: "match", of: (l) => V3C_MATCH_COPY[l as never], maxWords: 22 },
  { name: "record", of: (l) => V3C_RECORD_COPY[l as never], maxWords: 22 },
  { name: "pages", of: (l) => PAGES_COPY[l as never], maxWords: 22 },
  { name: "community", of: (l) => communityCopyFor(l), maxWords: 22 },
  { name: "home-faq", of: (l) => V3C_HOME_FAQ[l as never], maxWords: null },
  { name: "states", of: (l) => STATE_COPY[l as never], maxWords: 22 },
  { name: "tools", of: (l) => V3C_TOOLS_COPY[l as never], maxWords: 22 },
];

describe("F10 · le 11 lingue del redesign", () => {
  it("v3cLang/v3cLocale: le 11 lingue, varianti regionali, sconosciute → en", () => {
    expect(V3C_LANGS).toHaveLength(11);
    expect(v3cLang("de-AT")).toBe("de");
    expect(v3cLang("PT")).toBe("pt");
    expect(v3cLang("ja")).toBe("en");
    expect(v3cLang(null)).toBe("en");
    expect(v3cLocale("ru")).toBe("ru-RU");
    expect(copyFor("tr")).toBe(V3C_COPY.tr);
  });

  for (const d of DICTS) {
    const en = d.of("en");
    const itProblems = new Set(diff(en, d.of("it")));
    const enStrings = new Map(strings(en).map((x) => [x.path, x.s]));
    const itStrings = new Map(strings(d.of("it")).map((x) => [x.path, x.s]));
    for (const lang of LANGS) {
      describe(`${d.name} · ${lang}`, () => {
        const tr = d.of(lang);
        it("ha un dizionario suo, non l'inglese", () => {
          expect(tr).toBeTruthy();
          expect(tr).not.toBe(en);
        });
        it("stesse chiavi, tipi, arità, argomenti e segnaposto dell'inglese; nessuna stringa vuota", () => {
          expect(diff(en, tr).filter((p) => !itProblems.has(p))).toEqual([]);
        });
        it("niente claim vietati in più; ≤ 22 parole a schermo", () => {
          const bad = strings(tr).filter(({ path, s }) => {
            const e = enStrings.get(path) ?? "";
            const tooLong = d.maxWords != null && words(s) > d.maxWords && words(s) > Math.max(words(e), words(itStrings.get(path) ?? ""));
            return tooLong || (BANNED.test(s) && !BANNED.test(e));
          });
          expect(bad).toEqual([]);
        });
        it("tradotto davvero: la maggior parte delle frasi differisce dall'inglese", () => {
          const multi = strings(tr).filter(({ path, s }) => words(s) >= 3 && enStrings.has(path));
          const same = multi.filter(({ path, s }) => enStrings.get(path) === s);
          expect(same.length).toBeLessThanOrEqual(Math.floor(multi.length * 0.1));
        });
      });
    }
  }
});
