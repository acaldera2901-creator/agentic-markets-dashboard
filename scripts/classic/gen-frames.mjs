#!/usr/bin/env node
// scripts/classic/gen-frames.mjs — #CLASSIC-CARD-1008, Fase A «via le cornici».
//
// Legge i quattro CSS del sito (globals, design-system, machina, mobile), trova
// ogni regola che disegna una cornice (border*, outline*, box-shadow, clip-path a
// smusso) e scrive in app/classic.generated.css la sua controparte spenta, tutta
// sotto `html[data-frames="off"]` — l'attributo che app/layout.tsx mette SOLO
// quando il build ha NEXT_PUBLIC_CLASSIC=1. A flag spento nessuna di queste
// regole combacia con niente.
//
// Perché un generatore e non 767 regole a mano: le regole sorgente cambiano
// (altri filoni lavorano su globals.css); rigenerare è un comando, e la
// classificazione — cosa è cornice, cosa no — sta scritta QUI, una volta, con
// le sue eccezioni nominate. Il perché di ogni famiglia è in
// docs/redesign/classic-frames.md.
//
// Uso:  node scripts/classic/gen-frames.mjs          (scrive il file)
//       node scripts/classic/gen-frames.mjs --report (stampa il conteggio per classe)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const postcss = require("postcss");

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const FILES = ["app/globals.css", "app/design-system.css", "app/machina.css", "app/mobile.css"];
const OUT = path.join(ROOT, "app/classic.generated.css");
const PREFIX = 'html[data-frames="off"]';

const FRAME_PROP = /^(border(-(top|bottom|left|right|inline|block)(-(start|end))?)?(-(color|width|style))?|outline(-(color|width|style|offset))?|box-shadow|clip-path)$/;
const isNone = (v, prop = "") => {
  const t = v.trim().replace(/\s*!important$/, "");
  if (/^(0|0px|none|transparent|0 none|none 0|unset|initial|inherit|revert)$/i.test(t)) return true;
  // `border: 0 solid x` / `outline: 0 …`: larghezza zero, nessun filo. Mai per box-shadow,
  // dove «0 0 0 1px» è proprio un anello.
  if (/^(border|outline)/.test(prop) && !/color$/.test(prop) && /^0(px)?(\s|$)/.test(t)) return true;
  if (prop === "box-shadow" && /^0(px)?(\s+0(px)?)*(\s+(transparent|#0000|rgba\(0,\s*0,\s*0,\s*0\)))?$/i.test(t)) return true;
  return false;
};

// ── Classificazione. Ordine = priorità. Ogni eccezione ha un nome. ─────────
// KEEP_FOCUS  l'anello di focus non è una cornice: è un requisito di accessibilità.
// KEEP_FIELD  il bordo di un campo dice «qui si scrive»: senza, un input è testo.
// KEEP_ROW    i fili tra le righe di tabelle/elenchi sono la riga, non una cornice.
// KEEP_SHAPE  spinner, triangoli, tacche: il bordo È la forma, non il contorno.
// KEEP_MARK   barre di stato spesse (≥2px su un lato, colore semantico) e
//             indicatori di tab attivo: portano significato, non contengono.
// FRAME       tutto il resto: contorno di un contenitore, ombra, alone, smusso.
const FOCUS = /:focus|:focus-visible|:focus-within/;
const FIELD = /(^|[\s>+~(,])(input|select|textarea)\b|\.(field|input|search|textarea|form-control)[a-z0-9-]*\b|\.[a-z0-9-]*-(input|field|search|select)\b|\.am-search\b|\[type=/i;
const ROW = /(^|[\s>+~(])(table|thead|tbody|tfoot|tr|th|td)\b|tbl|[-_]row\b|__row|\brow[-_]|[-_]tr\b|[-_]li\b|[-_]item\b|\bli\b|leg\b|[-_]line\b|divider|separator|\bhr\b|rule\b/i;
const SHAPE = /spin\b|-spin|loader|caret|triangle|-chev\b|knob|thumb|meter-seg|skeleton|\.d\b|\.dots?\b|-dots?\b|acct-switch|orb::after|tab-ind/i;
const ACTIVE = /\.active\b|\.is-active|\.on\b|\.sel\b|\.selected|\[aria-selected="?true|\[aria-current|\[data-active|\[data-on|\[data-selected|:checked|\[aria-pressed="?true/i;

function sidesOf(decls) {
  const sides = new Set();
  for (const d of decls) {
    if (d.prop === "border" || /^border-(color|width|style)$/.test(d.prop)) ["top", "right", "bottom", "left"].forEach((s) => sides.add(s));
    const m = d.prop.match(/^border-(top|bottom|left|right|inline|block)/);
    if (m) {
      if (m[1] === "inline") { sides.add("left"); sides.add("right"); }
      else if (m[1] === "block") { sides.add("top"); sides.add("bottom"); }
      else sides.add(m[1]);
    }
  }
  return sides;
}

function widthPx(v) {
  const m = v.match(/(\d+(?:\.\d+)?)px/);
  return m ? Number(m[1]) : v.match(/\b(thin|medium|thick)\b/) ? 1 : null;
}

function classify(sel, frameDecls, allDecls) {
  if (FOCUS.test(sel)) return "KEEP_FOCUS";
  if (FIELD.test(sel) && !/\.br-field\b/.test(sel)) return "KEEP_FIELD"; // .br-field è una tessera «scegli il campo», non un input
  const hasShadow = frameDecls.some((d) => d.prop === "box-shadow");
  const hasClip = frameDecls.some((d) => d.prop === "clip-path");
  const borderDecls = frameDecls.filter((d) => d.prop.startsWith("border"));
  const sides = sidesOf(borderDecls);
  const animated = allDecls.some((d) => /^animation/.test(d.prop)) && allDecls.some((d) => d.prop === "border-radius" && /50%/.test(d.value));
  if (animated || SHAPE.test(sel)) return "KEEP_SHAPE";
  // clip-path che non è uno smusso a 5-6 punti (forme di tacche, inset(50%) dello sr-only)
  if (hasClip && !hasShadow && !borderDecls.length) {
    const v = frameDecls.find((d) => d.prop === "clip-path").value;
    if (!/polygon\(\s*(evenodd,)?\s*var\(--(ch|_c|_ch)/.test(v) && !/polygon\(\s*var\(--/.test(v)) return "KEEP_SHAPE";
  }
  const oneSide = sides.size > 0 && sides.size < 4 && !hasShadow;
  if (oneSide && ROW.test(sel)) return "KEEP_ROW";
  if (oneSide) {
    const w = Math.max(...borderDecls.map((d) => widthPx(d.value) ?? 1));
    if (w >= 2 || ACTIVE.test(sel)) return "KEEP_MARK";
  }
  return "FRAME";
}

// Selettori che hanno un fondo proprio da qualche parte (per sapere chi, perso il
// bordo, resterebbe un rettangolo vuoto). Base = selettore senza pseudo-classi.
const base = (s) => s.replace(/\[[^\]]*\]/g, "").replace(/::?(hover|active|focus(-visible|-within)?|visited|disabled|checked|before|after|not\([^)]*\)|is\([^)]*\)|where\([^)]*\)|has\([^)]*\))/g, "").replace(/\s+/g, " ").trim();
const hasOwnBg = new Set();

function bgIsReal(v) {
  return !/^(none|transparent|0|unset|initial|inherit)$/i.test(v.trim());
}

const report = {};
const out = [];
const borderOnly = [];

// CSS scritto dentro i componenti (template literal in un <style>): le stesse regole.
// Il primo blocco `…` dopo il marcatore; /widget e /embed restano fuori (sono
// superfici incorporate in siti terzi, dove html[data-frames] non esiste).
const EMBEDDED = [
  ["components/track-record/TrackRecordView.tsx", "const CSS = `"],
  ["components/seo/SeoProse.tsx", "const CSS = `"],
  ["app/blog/[slug]/page.tsx", "<style>{`"],
];
function embeddedCss(file, marker) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const a = src.indexOf(marker);
  if (a < 0) return "";
  const b = src.indexOf("`", a + marker.length);
  return src.slice(a + marker.length, b).replace(/\$\{[^}]*\}/g, "0");
}
const parsed = [
  ...FILES.map((f) => ({ f, css: postcss.parse(fs.readFileSync(path.join(ROOT, f), "utf8"), { from: f }) })),
  ...EMBEDDED.map(([f, m]) => ({ f, css: postcss.parse(embeddedCss(f, m), { from: f }) })),
];
for (const { css } of parsed) {
  css.walkRules((r) => {
    if (r.parent?.type === "atrule" && /keyframes/.test(r.parent.name)) return;
    for (const d of r.nodes ?? []) {
      if (d.type === "decl" && /^background(-color|-image)?$/.test(d.prop) && bgIsReal(d.value)) {
        for (const s of r.selectors) hasOwnBg.add(base(s));
      }
    }
  });
}

function wrapAtrules(rule, body) {
  // conserva @media/@supports/@container della regola sorgente
  let text = body;
  let p = rule.parent;
  while (p && p.type === "atrule") {
    if (/keyframes|font-face/.test(p.name)) return null;
    text = `@${p.name} ${p.params} {\n${text}\n}`;
    p = p.parent;
  }
  return text;
}

function scoped(sel) {
  const s = sel.trim();
  // :root… / html… → l'attributo va sull'html stesso
  if (/^:root/.test(s)) return s.replace(/^:root/, PREFIX);
  if (/^html\b/.test(s)) return s.replace(/^html/, PREFIX);
  if (/^body\b/.test(s)) return `${PREFIX} ${s}`;
  return `${PREFIX} ${s}`;
}

for (const { f, css } of parsed) {
  css.walkRules((r) => {
    if (r.parent?.type === "atrule" && /keyframes/.test(r.parent.name)) return;
    const decls = (r.nodes ?? []).filter((n) => n.type === "decl");
    const frame = decls.filter((d) => FRAME_PROP.test(d.prop) && !isNone(d.value, d.prop));
    const fe = decls.filter((d) => /^--(_fe|_pe|bcol|pred-line)$/.test(d.prop));
    if (!frame.length && !fe.length) return;
    // il tema chiaro non è più raggiungibile (app/layout.tsx scrive data-theme="dark"
    // e nessun codice lo cambia): le sue regole non si duplicano.
    const sels = r.selectors.filter((x) => !/data-theme="light"/.test(x));
    if (!sels.length) return;
    const where = `${f}:${r.source.start.line}`;
    // le variabili-filo (--_fe/--_pe/--bcol) disegnano le diagonali degli smussi:
    // si spengono ovunque, anche quando la regola non ha altre proprietà-cornice.
    const lines = [];
    let cls = frame.length ? classify(r.selector, frame, decls) : "FRAME";
    report[cls] = (report[cls] ?? 0) + 1;
    if (fe.length) for (const d of fe) lines.push(`  ${d.prop}: transparent;`);
    if (cls === "FRAME") {
      const borderDecls = frame.filter((d) => d.prop.startsWith("border"));
      const sides = sidesOf(borderDecls);
      if (borderDecls.length) {
        // larghezza zero, non solo colore trasparente: un bordo trasparente lascia
        // vedere ciò che sta sotto (lo sfondo del genitore) e disegna una cornice fantasma.
        if (sides.size === 4) lines.push("  border-color: transparent;", "  border-width: 0;");
        else for (const s of sides) lines.push(`  border-${s}-color: transparent;`, `  border-${s}-width: 0;`);
      }
      if (frame.some((d) => d.prop === "box-shadow")) lines.push("  box-shadow: none;");
      if (frame.some((d) => d.prop.startsWith("outline") && d.prop !== "outline-offset")) lines.push("  outline-color: transparent;");
      if (frame.some((d) => d.prop === "clip-path" && /polygon/.test(d.value))) lines.push("  clip-path: none;");
      // «solo bordo»: tutti e 4 i lati, nessun fondo proprio, non uno pseudo-elemento.
      if (sides.size === 4 && !/::?(before|after)/.test(r.selector)) {
        const orphan = sels.filter((s) => !hasOwnBg.has(base(s)) && !/:hover|:active/.test(s));
        if (orphan.length) borderOnly.push({ where, sel: orphan.join(", ") });
      }
    }
    if (!lines.length) return;
    // una sorgente !important batte il gemello senza: lo si eredita
    if (frame.some((d) => d.important)) for (let i = 0; i < lines.length; i++) lines[i] = lines[i].replace(/;$/, " !important;");
    const body = `/* ${where} · ${cls} */\n${sels.map(scoped).join(",\n")} {\n${lines.join("\n")}\n}`;
    const wrapped = wrapAtrules(r, body);
    if (wrapped) out.push(wrapped);
  });
}

if (process.argv.includes("--report")) {
  console.log(JSON.stringify(report, null, 1));
  console.log(`border-only (no own background): ${borderOnly.length}`);
  for (const b of borderOnly) console.log(`  ${b.where}  ${b.sel}`);
  process.exit(0);
}

const header = `/* app/classic.generated.css — GENERATO da scripts/classic/gen-frames.mjs. NON EDITARE A MANO.
   #CLASSIC-CARD-1008 · Fase A: ogni cornice del sito, spenta sotto ${PREFIX}.
   Conteggio: ${Object.entries(report).map(([k, v]) => `${k} ${v}`).join(" · ")}.
   Le eccezioni (focus, campi, righe, forme, segni di stato) e il perché: docs/redesign/classic-frames.md. */
`;
fs.writeFileSync(OUT, header + "\n" + out.join("\n\n") + "\n");
console.log(`wrote ${path.relative(ROOT, OUT)}: ${out.length} rules`, report, `border-only ${borderOnly.length}`);
