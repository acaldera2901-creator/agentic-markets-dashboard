// lib/v3c/news/facts.test.ts (#REDESIGN-V3C newswatch) — the fact barriers on the
// 5 notes the watcher wrote on 07/10 (originals as FotMob published them), on
// false positives, and the second reading through a fake `claude` binary.
// No network, no model, no database.
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFacts, italianArticleError } from "./facts";
import { claudeArgs, rewriteWithClaude, VERIFY_MODEL } from "./claude-cli";
import { readVerdict, VERIFY_PROMPT, VERIFY_SCHEMA, verifyPrompt } from "./verify";
import { readModelOutput, RewriteError, SYSTEM_PROMPT } from "./rewrite";
import type { FeedItem } from "./feed";

const src = (guid: string, title: string, text: string): FeedItem => ({ guid, title, text, url: `https://www.fotmob.com/news/${guid}`, t: Date.parse("2026-10-07T10:00:00Z"), source: "FotMob" });

// the originals of the 5 notes (fotmob.com/it/news, read 07/10)
const MESSI = src("35150u6icz251sd7qww98gnfj", "Lionel Messi 'at peace and proud' after Argentina farewell on 'saddest day of my career'", "Argentina legend Lionel Messi thanked supporters in Buenos Aires after he represented his country for the 208th and final time.");
const VANCOUVER = src("ytydk7h0jkgl1eo2hegxbatq0", "Sorensen accepts blame as Vancouver suffer defeat at Chicago", "Vancouver Whitecaps were beaten 3-1 by Chicago Fire as they failed to extend their advantage at the top of the Western Conference.");
const USA = src("k7cdstdphgy112tmp47ayc9yx", "United States 1-0 Canada: Ellis caps perfect window for Pochettino's side", "Mauricio Pochettino's United States kept their momentum going with a scrappy win over neighbours Canada in Minnesota.");
const BENIN = src("ucy500g1nn0a1kegqf89x29vk", "Argentina 3-0 Benin: Emotional Messi bows out in style in farewell match", "Argentina saw off Benin at Estadio Monumental in Lionel Messi's 208th and final international match.");
const KANE = src("9fi8n2wqtiui1t126zgsdc2h5", "Tuchel lauds England 'legend' Kane following double against Czechia", "Harry Kane marked his record-equalling England appearance with two goals against Czechia, much to the delight of Thomas Tuchel.");

// the notes as the watcher wrote them (prompt v3)
const NOTES = {
  messi: { en: { title: "Messi plays final Argentina match in Buenos Aires", body: "Lionel Messi represented Argentina for the 208th time in what was his final appearance for the national team. He thanked supporters following the match." }, it: { title: "Messi gioca l'ultima partita con l'Argentina a Buenos Aires", body: "Lionel Messi ha giocato per l'Argentina per la 208ª volta in quella che è stata la sua ultima apparizione con la nazionale. Ha ringraziato i tifosi dopo la partita." } },
  vancouver: { en: { title: "Vancouver fall to Chicago as Sorensen takes responsibility", body: "Vancouver Whitecaps lost 3-1 to Chicago Fire. Sorensen accepted blame for the defeat." }, it: { title: "Vancouver cede il passo a Chicago, Sorensen si assume le responsabilità", body: "Vancouver Whitecaps ha perso 3-1 contro Chicago Fire. Sorensen ha accettato la colpa della sconfitta." } },
  ellis: { en: { title: "United States beat Canada 1-0 in Minnesota", body: "Ellis scored the goal for the United States. Pochettino's side secured the victory in the match." }, it: { title: "Stati Uniti battono il Canada 1-0 in Minnesota", body: "Ellis ha segnato il gol per gli Stati Uniti. La squadra di Pochettino ha conquistato la vittoria." } },
  benin: { en: { title: "Argentina defeats Benin 3-0 in Messi's final match", body: "Argentina beat Benin 3-0 at Estadio Monumental. The match was Lionel Messi's 208th and last for Argentina." }, it: { title: "L'Argentina batte la Benin 3-0 nell'ultima partita di Messi", body: "L'Argentina ha sconfitto la Benin 3-0 allo Stadio Monumental. È stata la 208ª e ultima partita internazionale di Lionel Messi." } },
  kane: { en: { title: "Kane scores twice in England match against Czechia", body: "Harry Kane scored two goals in an England fixture against Czechia. The appearance matched Kane's record for England caps." }, it: { title: "Kane segna due gol nella partita dell'Inghilterra contro la Repubblica Ceca", body: "Harry Kane ha segnato due gol in una partita dell'Inghilterra contro la Repubblica Ceca. La presenza ha eguagliato il record di Kane per le presenze con l'Inghilterra." } },
};

// faithful versions: what the tighter prompt should give
const FAITHFUL = {
  messi: { en: { title: "Messi thanks Argentina supporters in Buenos Aires", body: "Lionel Messi has played his 208th and last match for Argentina." }, it: { title: "Messi ringrazia i tifosi dell'Argentina a Buenos Aires", body: "Lionel Messi ha giocato la sua 208ª e ultima partita con l'Argentina." } },
  benin: { en: { title: "Argentina beat Benin 3-0 in Messi's farewell", body: "The win at Estadio Monumental was Lionel Messi's 208th and last international match." }, it: { title: "L'Argentina batte il Benin 3-0 nell'addio di Messi", body: "La vittoria allo Stadio Monumental è stata la 208ª e ultima partita internazionale di Lionel Messi." } },
  ellis: { en: { title: "United States edge Canada 1-0 in Minnesota", body: "Pochettino's side extended their momentum against their neighbours." }, it: { title: "Gli Stati Uniti superano il Canada 1-0 in Minnesota", body: "La squadra di Pochettino prolunga il buon momento contro i vicini." } },
};

describe("facts · the 5 notes of 07/10 against their originals", () => {
  it("Ellis: «scored the goal» is refused — the headline says «Ellis caps», not who scored", () => {
    const r = checkFacts(NOTES.ellis, USA);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toEqual(expect.arrayContaining(["en: goal/scorer not in the original", "it: goal/scorer not in the original"]));
  });
  it("Argentina–Benin: «la Benin» is refused; the corrected Italian passes (Estadio ↔ Stadio, 208th ↔ 208ª)", () => {
    expect(checkFacts(NOTES.benin, BENIN)).toEqual({ ok: false, unsupported: ["it: article «la benin»"] });
    expect(checkFacts(FAITHFUL.benin, BENIN)).toEqual({ ok: true, unsupported: [] });
  });
  it("Vancouver, Messi (faithful) and the faithful USA note pass: Chicago Fire, Whitecaps, Buenos Aires, 3-1, 208th are all in the original", () => {
    expect(checkFacts(NOTES.vancouver, VANCOUVER)).toEqual({ ok: true, unsupported: [] });
    expect(checkFacts(FAITHFUL.messi, MESSI)).toEqual({ ok: true, unsupported: [] });
    expect(checkFacts(FAITHFUL.ellis, USA)).toEqual({ ok: true, unsupported: [] });
  });
  it("Kane and Messi-in-Buenos-Aires distort without a new word: the mechanical check lets them through (the second reading is what stops them, below)", () => {
    expect(checkFacts(NOTES.kane, KANE).ok).toBe(true);
    expect(checkFacts(NOTES.messi, MESSI).ok).toBe(true);
  });
});

describe("facts · invented facts are refused", () => {
  const base = { en: { title: "Vancouver lose at Chicago", body: "Chicago Fire beat Vancouver Whitecaps 3-1." }, it: { title: "Vancouver perde a Chicago", body: "Il Chicago Fire batte i Vancouver Whitecaps 3-1." } };
  const en = (body: string) => ({ ...base, en: { ...base.en, body } });
  const it_ = (body: string) => ({ ...base, it: { ...base.it, body } });
  it.each([
    ["a score the original does not give", en("Chicago Fire beat Vancouver Whitecaps 3-0."), /score 3-0/],
    ["a number", en("Chicago Fire won for the 5th time in a row."), /number 5/],
    ["a number word", en("Chicago Fire scored four goals."), /number 4/],
    ["a name", en("Sorensen and Müller were beaten at Soldier Field."), /name «muller»|name «soldier»/],
    ["a time", en("The match started at 19:30."), /time 19:30/],
    ["a weekday (EN)", en("Chicago Fire won on Saturday."), /date «saturday»/],
    ["a weekday (IT, lower case)", it_("Il Chicago Fire ha vinto sabato."), /it: date «saturday»/],
    ["a quote", en("Sorensen said «we were poor»."), /quote not in the original/],
    ["a cause", en("Vancouver lost because of a red card."), /cause not in the original/],
    ["home/away", en("Vancouver lost away from home."), /home\/away not in the original/],
    ["an injury", en("Vancouver lost with an injured goalkeeper."), /injury not in the original/],
    ["a transfer", en("Chicago Fire signed a new forward."), /transfer not in the original/],
  ])("%s", (_l, note, reason) => {
    const r = checkFacts(note, VANCOUVER);
    expect(r.ok).toBe(false);
    expect(r.unsupported.join(" | ")).toMatch(reason);
  });
});

describe("facts · false positives it must NOT produce", () => {
  it("diacritics either side: Bilić / Bilic, Mbappé / Mbappe, Müller / Muller", () => {
    const s = src("x", "Bilić and Müller praise Mbappe", "Slaven Bilic said Mbappé was the difference.");
    const n = { en: { title: "Bilic and Muller on Mbappé", body: "Slaven Bilić said Mbappe made the difference." }, it: { title: "Bilić e Müller su Mbappé", body: "Slaven Bilić ha detto che Mbappé ha fatto la differenza." } };
    expect(checkFacts(n, s)).toEqual({ ok: true, unsupported: [] });
  });
  it("ordinals and numbers: 208th / 208 / 208ª / 208° / 208esima; 1,000 / 1.000; «two goals» / «double»", () => {
    const s = src("x", "Kane's double on his 208th cap", "A crowd of 1,000 saw it.");
    for (const body of ["Kane scored two goals on cap 208.", "Kane scored 2 goals on cap 208."]) expect(checkFacts({ en: { title: "Kane on cap 208", body }, it: { title: "Kane alla presenza 208ª", body: "Doppietta di Kane alla 208esima presenza davanti a 1.000 persone." } }, s).ok).toBe(true);
    expect(checkFacts({ en: { title: "Kane", body: "Kane reached 208° caps." }, it: { title: "Kane", body: "Kane alla 208ª." } }, s).ok).toBe(true);
  });
  it("names in Italian and English: Stati Uniti / United States / USMNT, Repubblica Ceca / Czechia, Inghilterra / England, l'Argentina", () => {
    const s = src("x", "England 3-0 Czechia", "The USMNT watched as Argentina rested.");
    const n = { en: { title: "England beat Czechia 3-0", body: "The United States and Argentina were not involved." }, it: { title: "L'Inghilterra batte la Repubblica Ceca 3-0", body: "Gli Stati Uniti e l'Argentina non erano coinvolti." } };
    expect(checkFacts(n, s)).toEqual({ ok: true, unsupported: [] });
  });
  it("sentence-initial function words are not names (The, La, È, Ha, Il, Gli, After, Both)", () => {
    const n = { en: { title: "The defeat for Vancouver", body: "After the match, both sides went home quietly." }, it: { title: "La sconfitta del Vancouver", body: "È la sconfitta. Ha perso il Vancouver. Gli ospiti hanno vinto." } };
    const r = checkFacts(n, VANCOUVER);
    expect(r.unsupported.filter((x) => /name/.test(x))).toEqual([]);
  });
  it("a reversed score (loser first) is the same result; the body of the article counts when the source gives it", () => {
    expect(checkFacts({ en: { title: "Vancouver lose 1-3", body: "Vancouver Whitecaps lost to Chicago Fire." }, it: { title: "Vancouver perde 1-3", body: "I Vancouver Whitecaps perdono contro il Chicago Fire." } }, VANCOUVER).ok).toBe(true);
    const withBody = { title: USA.title, text: USA.text, body: "Ellis scored the only goal after 20 minutes." };
    expect(checkFacts({ en: { title: "Ellis scores in United States win", body: "The goal came after 20 minutes." }, it: { title: "Ellis segna per gli Stati Uniti", body: "Il gol dopo 20 minuti." } }, withBody).ok).toBe(true);
  });
});

describe("facts · Italian articles with countries", () => {
  it.each([
    ["la Benin", false],
    ["della Benin", false],
    ["il Argentina", false],
    ["la Stati Uniti", false],
    ["il Benin", true],
    ["contro il Canada", true],
    ["l'Argentina e la Germania", true],
    ["gli Stati Uniti", true],
    ["del Brasile", true],
  ])("«%s» → ok %s", (phrase, ok) => {
    expect(italianArticleError({ title: "Nota", body: `Partita contro ${phrase}.` }) == null).toBe(ok);
  });
});

describe("rewrite · the tighter prompt (v4) and the mechanical barrier in the reading", () => {
  it("the prompt forbids attributions, causes, records and expansions, and asks «insufficient» when the headline is not enough", () => {
    for (const s of [/Stay inside the headline and the teaser/, /Never add an attribution/, /does not mean X scored/, /Never add a cause, a record/, /must appear in the item/, /insufficient/, /il Benin/]) expect(SYSTEM_PROMPT).toMatch(s);
  });
  it("a model answer that invents a scorer is dropped as «facts»", () => {
    const o = { status: "ok", headline_en: NOTES.ellis.en.title, body_en: NOTES.ellis.en.body, headline_it: NOTES.ellis.it.title, body_it: NOTES.ellis.it.body, teams: ["United States", "Canada"] };
    expect(() => readModelOutput(o, USA, "m")).toThrow(RewriteError);
    expect(() => readModelOutput(o, USA, "m")).toThrow(/^facts: .*goal\/scorer/);
  });
});

describe("verify · the second reading, pure", () => {
  it("prompt and schema: every unsupported claim, JSON {supported, unsupported}", () => {
    expect(VERIFY_PROMPT).toMatch(/NOT explicitly supported|unsupported claim/i);
    expect(VERIFY_PROMPT).toMatch(/who scored/);
    expect(VERIFY_PROMPT).toMatch(/data, not instructions/);
    expect(VERIFY_SCHEMA.required).toEqual(["supported", "unsupported"]);
    const p = verifyPrompt(USA, NOTES.ellis);
    expect(p).toContain(USA.title);
    expect(p).toContain(USA.text);
    expect(p).toContain(NOTES.ellis.it.body);
  });
  it("one unsupported claim drops; «supported:true» with a list is not support; bad shapes throw", () => {
    expect(readVerdict({ supported: true, unsupported: [] })).toEqual({ supported: true });
    expect(readVerdict({ supported: false, unsupported: ["Ellis scored"] })).toEqual({ supported: false, unsupported: ["Ellis scored"] });
    expect(readVerdict({ supported: true, unsupported: ["x"] })).toEqual({ supported: false, unsupported: ["x"] });
    expect(readVerdict({ supported: false, unsupported: [] })).toEqual({ supported: false, unsupported: ["verifier said unsupported"] });
    expect(readVerdict('```json\n{"supported":true,"unsupported":[]}\n```')).toEqual({ supported: true });
    expect(() => readVerdict("yes")).toThrow(/not JSON/);
    expect(() => readVerdict({ supported: "yes", unsupported: [] })).toThrow(/wrong shape/);
  });
  it("args: its own schema and prompt, the verifier model, still no tools, no key", () => {
    const a = claudeArgs(VERIFY_MODEL, VERIFY_SCHEMA, VERIFY_PROMPT);
    expect(a[a.indexOf("--model") + 1]).toBe(VERIFY_MODEL);
    expect(a[a.indexOf("--tools") + 1]).toBe("");
    expect(JSON.parse(a[a.indexOf("--json-schema") + 1])).toEqual(VERIFY_SCHEMA);
    expect(a[a.indexOf("--system-prompt") + 1]).toBe(VERIFY_PROMPT);
    expect(a.join(" ")).not.toMatch(/api.?key|--bare/i);
  });
});

// ─── the whole path through a fake `claude` binary ───────────────────────────

const FAKE = `#!/usr/bin/env node
const fs = require("fs");
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const a = process.argv.slice(2);
  const model = a[a.indexOf("--model") + 1];
  const verify = a[a.indexOf("--json-schema") + 1].includes("supported");
  fs.appendFileSync(process.env.FAKE_CLAUDE_LOG, (verify ? "verify " : "rewrite ") + model + " key=" + (process.env.ANTHROPIC_API_KEY ? "yes" : "no") + "\\n");
  const answers = JSON.parse(fs.readFileSync(process.env.FAKE_CLAUDE_ANSWERS, "utf8"))[verify ? "verify" : "rewrite"];
  const key = Object.keys(answers).find((k) => input.includes(k));
  const ans = key ? answers[key] : null;
  if (ans === "limit") { process.stdout.write(JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, result: "You've hit your weekly limit" })); process.exit(1); }
  if (ans === "garbage") { process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "I think it is fine", modelUsage: { ["claude-" + model]: {} } })); return; }
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(ans), structured_output: ans, total_cost_usd: 0.002, usage: { input_tokens: 900, output_tokens: 80 }, modelUsage: { ["claude-" + model]: {} } }));
});
`;

const asAnswer = (n: { en: { title: string; body: string }; it: { title: string; body: string } }, teams: string[]) => ({ status: "ok", headline_en: n.en.title, body_en: n.en.body, headline_it: n.it.title, body_it: n.it.body, teams });

describe("claude-cli · rewrite → mechanical checks → second reading, with a fake `claude`", () => {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-"));
  const bin = join(dir, "claude");
  writeFileSync(bin, FAKE);
  chmodSync(bin, 0o755);
  const log = join(dir, "calls.log");
  const answers = join(dir, "answers.json");
  writeFileSync(
    answers,
    JSON.stringify({
      rewrite: {
        "Ellis caps": asAnswer(NOTES.ellis, ["United States", "Canada"]),
        "Tuchel lauds": asAnswer(NOTES.kane, ["England", "Czechia"]),
        "Sorensen accepts": asAnswer(NOTES.vancouver, ["Vancouver Whitecaps", "Chicago Fire"]),
        "saddest day": asAnswer(FAITHFUL.messi, ["Argentina"]),
        "bows out": asAnswer(FAITHFUL.benin, ["Argentina", "Benin"]),
        "LIMITCASE": asAnswer(NOTES.vancouver, []),
        "GARBAGECASE": asAnswer(NOTES.vancouver, []),
      },
      verify: {
        // the second reading, as the real one answered on 07/10 for Kane
        "Kane's record": { supported: false, unsupported: ["The appearance matched Kane's record for England caps — the original says only «record-equalling England appearance»"] },
        "Sorensen accepted blame": { supported: true, unsupported: [] },
        "208th and last match": { supported: true, unsupported: [] },
        "Estadio Monumental was": { supported: true, unsupported: [] },
      },
    }),
  );
  const env = { ...process.env, FAKE_CLAUDE_LOG: log, FAKE_CLAUDE_ANSWERS: answers, ANTHROPIC_API_KEY: "must-not-reach-the-cli" };
  const run = (item: FeedItem) => rewriteWithClaude(item, { bin, cwd: dir, env });
  const calls = () => {
    try {
      return readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  };

  it("Ellis: dropped by the mechanical check — the verifier is never called", async () => {
    const before = calls().length;
    const o = await run(USA);
    expect(o).toMatchObject({ kind: "final", reason: expect.stringMatching(/^facts: .*goal\/scorer/) });
    expect(calls().slice(before)).toEqual(["rewrite haiku key=no"]);
  });
  it("Kane: passes the mechanical check, dropped by the second reading (sonnet)", async () => {
    const before = calls().length;
    const o = await run(KANE);
    expect(o).toMatchObject({ kind: "final", reason: expect.stringMatching(/^verifier: .*Kane's record/) });
    expect(calls().slice(before)).toEqual(["rewrite haiku key=no", `verify ${VERIFY_MODEL} key=no`]);
  });
  it("Vancouver, Messi and Argentina–Benin (faithful): ok, usage of both calls summed, model says «verified»", async () => {
    for (const item of [VANCOUVER, MESSI, BENIN]) {
      const o = await run(item);
      expect(o.kind).toBe("ok");
      if (o.kind !== "ok") return;
      expect(o.rewritten.note.model).toMatch(/^claude-haiku · prompt v4 · verified claude-sonnet$/);
      expect(o.usage).toMatchObject({ costUsd: 0.004, inTokens: 1800, outTokens: 160 });
    }
  });
  it("a usage limit on the second reading keeps the item queued; an unreadable verdict is retried later, never published", async () => {
    const limitItem = { ...VANCOUVER, guid: "l", title: `${VANCOUVER.title} LIMITCASE` };
    const garbageItem = { ...VANCOUVER, guid: "g", title: `${VANCOUVER.title} GARBAGECASE` };
    const ans = JSON.parse(readFileSync(answers, "utf8"));
    ans.verify = { LIMITCASE: "limit", GARBAGECASE: "garbage" };
    writeFileSync(answers, JSON.stringify(ans));
    expect((await run(limitItem)).kind).toBe("limit");
    expect(await run(garbageItem)).toMatchObject({ kind: "transient", reason: expect.stringMatching(/verifier: not JSON/) });
  });
});
