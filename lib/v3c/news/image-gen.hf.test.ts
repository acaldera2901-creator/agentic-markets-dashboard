// #NEWSWATCH-HF: the Higgsfield fallback with mocked CLIs (gptimg, higgsfield, claude are shell scripts).
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeImage, type HfOpts } from "./image-gen";

const dir = () => mkdtempSync(join(tmpdir(), "hf-"));
function bin(d: string, name: string, body: string): string {
  const p = join(d, name);
  writeFileSync(p, `#!/bin/sh\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}
function png(d: string): Buffer {
  const p = join(d, "src.png");
  // a 1344×752 PNG like the one Higgsfield returns
  execFileSync("/usr/bin/sips", ["-s", "format", "png", "-z", "752", "1344", "/System/Library/Desktop Pictures/.thumbnails/Big Sur Coastline.heic", "--out", p], { stdio: "ignore" });
  return readFileSync(p);
}
const OUT_OF_CREDITS = `echo "ERROR: Your workspace is out of credits." >&2; exit 1`;
const HF_OK = `echo '[{"min_result_url":"https://cdn.x/a_min.webp","result_url":"https://cdn.x/a.png"}]'; echo call >> "$(dirname "$0")/hf-calls"`;
const CHECK_OK = `cat >/dev/null; echo '{"result":"","structured_output":{"ok":true,"problems":[],"text_seen":""}}'`;
const CHECK_NO = `cat >/dev/null; echo '{"result":"","structured_output":{"ok":false,"problems":["blank face"],"text_seen":""}}'`;

function setup(o: { gptimg?: string; hf?: string; check?: string; daily?: number; total?: number }) {
  const d = dir();
  const logs: string[] = [];
  const img = png(d);
  const hf: HfOpts = {
    bin: bin(d, "higgsfield", o.hf ?? HF_OK),
    dailyMax: o.daily ?? 6,
    totalMax: o.total ?? 60,
    log: (m) => logs.push(m),
    fetch: (async () => new Response(new Uint8Array(img))) as unknown as typeof fetch,
    now: () => new Date("2026-10-30T12:00:00Z"),
  };
  const opts = { dir: join(d, "img"), gptimg: bin(d, "gptimg", o.gptimg ?? OUT_OF_CREDITS), cwebp: "/opt/homebrew/bin/cwebp", claudeBin: bin(d, "claude", o.check ?? CHECK_OK), hf };
  const calls = () => (existsSync(join(d, "hf-calls")) ? readFileSync(join(d, "hf-calls"), "utf8").trim().split("\n").length : 0);
  return { d, logs, opts, calls };
}
const job = (n = 0) => ({ base: `news-t${n}`, prompt: "CUT-OUT card", attempts: 0, expected: "" });

describe("image-gen · Higgsfield fallback", () => {
  it("gptimg out of credits → one Higgsfield call, card ok, marked final, logged with credits and counters", async () => {
    const s = setup({});
    const a = await makeImage(job(), s.opts);
    expect(a.kind).toBe("ok");
    expect(a.kind === "ok" && a.final).toBe(true);
    expect(s.calls()).toBe(1);
    expect(s.logs.join("\n")).toMatch(/~0\.5 credits · day 1\/6 · total 1\/60/);
  });
  it("without hf opts the limit stays a pause (old behaviour)", async () => {
    const s = setup({});
    const a = await makeImage(job(), { ...s.opts, hf: undefined });
    expect(a.kind).toBe("limit");
    expect(s.calls()).toBe(0);
  });
  it("gptimg failing for another reason never calls Higgsfield", async () => {
    const s = setup({ gptimg: `echo "nessun PNG trovato" >&2; exit 1` });
    const a = await makeImage(job(), s.opts);
    expect(a.kind).toBe("bad");
    expect(a.kind === "bad" && a.final).toBeFalsy();
    expect(s.calls()).toBe(0);
  });
  it("Higgsfield error → bad + final (no retry)", async () => {
    const s = setup({ hf: `echo "insufficient credits" >&2; exit 1` });
    const a = await makeImage(job(), s.opts);
    expect(a.kind === "bad" && a.final).toBe(true);
  });
  it("visual check refuses the Higgsfield card → bad + final", async () => {
    const s = setup({ check: CHECK_NO });
    const a = await makeImage(job(), s.opts);
    expect(a.kind === "bad" && a.final).toBe(true);
    expect(s.calls()).toBe(1);
  });
  it("daily cap: the 3rd call with HF_DAILY_MAX=2 is not made", async () => {
    const s = setup({ daily: 2 });
    await makeImage(job(1), s.opts);
    await makeImage(job(2), s.opts);
    const a = await makeImage(job(3), s.opts);
    expect(s.calls()).toBe(2);
    expect(a.kind === "bad" && a.final && a.reason).toMatch(/cap reached/);
    expect(s.logs.at(-1)).toMatch(/cap reached \(day 2\/2 · total 2\/60\)/);
  });
  it("0 = no cap: calls go on, the counters still log", async () => {
    const s = setup({ daily: 0, total: 0 });
    for (const n of [1, 2, 3]) await makeImage(job(n), s.opts);
    expect(s.calls()).toBe(3);
    expect(s.logs.at(-1)).toMatch(/day 3\/∞ · total 3\/∞/);
  });
  it("total cap holds across days", async () => {
    const s = setup({ total: 1 });
    await makeImage(job(1), s.opts);
    s.opts.hf.now = () => new Date("2026-10-31T12:00:00Z");
    await makeImage(job(2), s.opts);
    expect(s.calls()).toBe(1);
    expect(JSON.parse(readFileSync(join(s.opts.dir, "hf-budget.json"), "utf8"))).toMatchObject({ total: 1 });
  });
});
