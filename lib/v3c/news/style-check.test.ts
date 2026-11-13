// Start-up check: NEWS_IMAGE_STYLE=emma with missing local files → legacy, with the reason (written to last-run.json by main.ts).
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveImageStyle } from "./assets";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
function assetsDir(skip: string[] = []) {
  const a = mkdtempSync(join(tmpdir(), "chk-"));
  mkdirSync(join(a, "public/logos"), { recursive: true });
  mkdirSync(join(a, "public/crests/football"), { recursive: true });
  for (const f of ["gptimg-ref.sh", "compose-logo.py", "public/logos/betredge-logo-white.png"]) if (!skip.includes(f)) writeFileSync(join(a, f), "x");
  return a;
}

describe("resolveImageStyle", () => {
  it("not emma (unset, legacy, typo) → legacy, nothing missing, no disk check", () => {
    for (const v of [undefined, "", "legacy", "emm"]) expect(resolveImageStyle(env(v === undefined ? {} : { NEWS_IMAGE_STYLE: v }), () => false)).toMatchObject({ effective: "legacy", missing: [] });
  });
  it("emma with every file present → emma", () => {
    expect(resolveImageStyle(env({ NEWS_IMAGE_STYLE: "emma", NEWS_WATCHER_ASSETS: assetsDir() }))).toEqual({ requested: "emma", effective: "emma", missing: [] });
  });
  it.each(["gptimg-ref.sh", "compose-logo.py", "public/logos/betredge-logo-white.png"])("emma with %s missing → legacy, and the missing file is named", (f) => {
    const r = resolveImageStyle(env({ NEWS_IMAGE_STYLE: "EMMA ", NEWS_WATCHER_ASSETS: assetsDir([f]) }));
    expect(r.effective).toBe("legacy"); expect(r.requested).toBe("EMMA"); expect(r.missing).toHaveLength(1); expect(r.missing[0]).toContain(f.split("/").pop()!.replace(".png", ""));
  });
  it("emma with no assets folder at all → legacy, all four missing", () => {
    const r = resolveImageStyle(env({ NEWS_IMAGE_STYLE: "emma", NEWS_WATCHER_ASSETS: join(tmpdir(), "no-such-assets") }));
    expect(r.effective).toBe("legacy"); expect(r.missing.map((m) => m.split(":")[0])).toEqual(["gptimg-ref", "compose-logo", "logo", "crests"]);
  });
});
