// Block 3: expected text (M2/M5), the emma checker prompt, cardJob (what the watcher passes), Higgsfield 4:5, bundle (M4).
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cardText, expectedText, pickCard, type CardSpec } from "./card";
import { emmaCardPrompt, emmaText } from "./card-emma";
import { cardJob } from "./card-job";
import { IMAGE_CHECK_PROMPT, IMAGE_CHECK_PROMPT_EMMA, readImageVerdict } from "./image";
import { sceneKind } from "./image";

const REPO = resolve(__dirname, "../../..");
const mk = (note: { title: string; body: string }): CardSpec => pickCard("abc123", sceneKind(note), cardText(note), "deep red", "Arsenal", []);
const score = { title: "Arsenal beat Tottenham 2-1", body: "Arsenal win the derby 2-1 with a late goal." };
const word = { title: "Arsenal suffer a defeat at home", body: "Arsenal lost at home again, a defeat for the manager." };
const none = { title: "Arsenal prepare for the weekend", body: "The squad trained on Thursday morning." };

describe("emmaText — what the card shows (M2, M5)", () => {
  it("M2: a score headline gets NO duplicate badge", () => {
    const c = mk(score);
    expect(c.text.type).toBe("score");
    const t = emmaText(c);
    expect(t.headline).toEqual(["2-1"]); expect(t.badge).toBeNull();
    expect(t.expected).toBe("NEWS 2-1");
    expect((emmaCardPrompt(c).match(/2-1/g) ?? []).length).toBe(1);
  });
  it("a given headline plus the score → badge shown once", () => {
    const t = emmaText(mk(score), { headline: ["ARSENAL", "WIN DERBY"] });
    expect(t.badge).toBe("2-1"); expect(t.expected).toBe("NEWS ARSENAL WIN DERBY 2-1");
  });
  it("caption card: headline is the caption, no badge", () => {
    const c = mk(word);
    const t = emmaText(c);
    if (c.text.type === "word") { expect(t.headline).toEqual([c.text.words!.toUpperCase() === c.text.words ? c.text.words : c.text.words]); expect(t.badge).toBeNull(); }
  });
  it("M5: no text on the card → label only, no headline, no empty badge", () => {
    const c = mk(none);
    expect(c.text.type).toBe("none");
    const t = emmaText(c);
    expect(t.headline).toEqual([]); expect(t.badge).toBeNull(); expect(t.expected).toBe("NEWS");
    const p = emmaCardPrompt(c);
    expect(p).not.toMatch(/badge with black italic bold text/); expect(p).not.toMatch(/headline/); expect(p).toMatch(/text: NEWS/);
  });
});

describe("IMAGE_CHECK_PROMPT_EMMA", () => {
  it("allows faces, kit marks, crests, badge; forbids 18+/disclaimer/extra text/cut heads; legacy untouched", () => {
    const p = IMAGE_CHECK_PROMPT_EMMA;
    expect(p).toMatch(/Allowed, NOT a problem: a real person's face/); expect(p).toMatch(/club badges and sponsors on a kit/); expect(p).toMatch(/official club crests/); expect(p).toMatch(/lime #C8FF00 label and badge/);
    expect(p).toMatch(/18\+, or any disclaimer/); expect(p).toMatch(/any other text/); expect(p).toMatch(/head cut off/); expect(p).toMatch(/stray slash/); expect(p).toMatch(/not exactly the expected text/);
    expect(p).not.toMatch(/a face or facial features of any kind/);
    expect(IMAGE_CHECK_PROMPT).toMatch(/a face or facial features of any kind/); expect(IMAGE_CHECK_PROMPT).toMatch(/a club crest, a sponsor/);
  });
  it("the text check is mechanical: expected «NEWS 2-1» passes only with exactly that text", () => {
    const ok = { ok: true, text_seen: "NEWS 2-1", problems: [] };
    expect(readImageVerdict(ok, "NEWS 2-1").ok).toBe(true);
    expect(readImageVerdict({ ...ok, text_seen: "NEWS 2-1 18+" }, "NEWS 2-1").ok).toBe(false);
    expect(readImageVerdict({ ...ok, text_seen: "NEWS 2-0" }, "NEWS 2-1").ok).toBe(false);
    expect(readImageVerdict({ ...ok, text_seen: "NEWS" }, "NEWS 2-1").ok).toBe(false);
  });
});

describe("cardJob — the only thing the watcher passes", () => {
  const publicDir = join(REPO, "public");
  it("legacy / unset: prompt and expected are exactly today's, no refs", () => {
    const c = mk(score);
    for (const env of [{}, { NEWS_IMAGE_STYLE: "legacy" }, { NEWS_IMAGE_STYLE: "emm" }]) {
      const j = cardJob(c, score, ["Arsenal"], env as unknown as NodeJS.ProcessEnv);
      expect(j.expected).toBe(expectedText(c.text)); expect(j.refs).toBeUndefined(); expect(j.prompt).not.toMatch(/4:5/);
    }
  });
  it("emma: 4:5 prompt, expected from the emma card, crest files as refs, Higgsfield prompt without references", () => {
    const note = { title: "Barcelona win 2-1", body: "FC Barcelona beat Real Madrid 2-1." };
    const j = cardJob(mk(note), note, ["FC Barcelona"], { NEWS_IMAGE_STYLE: "emma", NEWS_WATCHER_PUBLIC_DIR: publicDir } as unknown as NodeJS.ProcessEnv);
    expect(j.prompt).toMatch(/4:5 vertical/); expect(j.expected).toBe("NEWS 2-1");
    expect(j.refs?.length).toBeGreaterThan(0); expect(j.refs![0]).toMatch(/crests\/football\/.+\.webp$/);
    expect(j.prompt).toMatch(/official crest/); expect(j.hfPrompt).not.toMatch(/Reference image/);
  });
  it("emma without a crest dir → no refs, no crest line", () => {
    const j = cardJob(mk(score), score, ["Arsenal"], { NEWS_IMAGE_STYLE: "emma", NEWS_WATCHER_PUBLIC_DIR: join(tmpdir(), "nope") } as unknown as NodeJS.ProcessEnv);
    expect(j.refs).toBeUndefined(); expect(j.prompt).not.toMatch(/Reference image/);
  });
});

describe("M4 — the bundled code reads the env at run time, not at build time", () => {
  it("esbuild bundle of card-job: env emma → 4:5, env unset → legacy", () => {
    const out = execFileSync(join(REPO, "node_modules/.bin/esbuild"), [join(__dirname, "card-job.ts"), "--bundle", "--platform=node", "--format=esm", "--log-level=error"]).toString();
    const d = mkdtempSync(join(tmpdir(), "bundle-"));
    const f = join(d, "cj.mjs");
    writeFileSync(f, `${out}\nconst c={format:"split",block:"right",dominant:"figure",tint:null,club:null,text:{type:"score",big:"2-1"},figure:"a footballer",object:"ball",kind:"win",mood:"joyful"};\nconsole.log(cardJob(c,{title:"x",body:"y"},[]).prompt.includes("4:5 vertical")?"EMMA":"LEGACY");`);
    const run = (v?: string) => {
      const env = { PATH: process.env.PATH } as unknown as NodeJS.ProcessEnv;
      if (v) env.NEWS_IMAGE_STYLE = v;
      return execFileSync("node", [f], { env }).toString().trim();
    };
    expect(run()).toBe("LEGACY"); expect(run("emma")).toBe("EMMA"); expect(run("legacy")).toBe("LEGACY");
  });
});
