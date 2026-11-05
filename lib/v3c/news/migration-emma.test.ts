// lib/v3c/news/migration-emma.test.ts (G4) — the migration for emma cards, checked on its own text (no DB):
// the CHECK regex is lifted LITERALLY from the migration and must accept -e and legacy names, nothing else;
// the bucket must allow json. Also: the names storagePublisher really uploads pass the CHECK.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { storagePublisher } from "./image-gen";

const ROOT = join(__dirname, "../../..");
const SQL = readFileSync(join(ROOT, "supabase/migrations/20261105120000_news_images_emma.sql"), "utf8");
const OLD = readFileSync(join(ROOT, "supabase/migrations/20261029220000_news_images.sql"), "utf8");
const ROLLBACK = readFileSync(join(ROOT, "supabase/rollbacks/20261105120000_news_images_emma.rollback.sql"), "utf8");

// Postgres «~» is POSIX ERE; this pattern uses only constructs with the same meaning in JS.
const pg = (sql: string): RegExp => new RegExp(/image_url ~ '([^']+)'/.exec(sql)![1].replace(/\\\./g, "\\."));
const CHECK = pg(SQL);
const P = "https://abc123.supabase.co/storage/v1/object/public/news-images/";

describe("migration 20261105120000_news_images_emma", () => {
  it("CHECK (literal regex from the migration): -e and legacy pass, the rest does not", () => {
    expect(CHECK.test(`${P}news-0123456789ab-e.webp`)).toBe(true);
    expect(CHECK.test(`${P}news-0123456789ab.webp`)).toBe(true);
    expect(CHECK.test(`${P}news-0123456789ab-e.credit.json`)).toBe(false);
    expect(CHECK.test(`${P}news-0123456789ab-x.webp`)).toBe(false);
    expect(CHECK.test(`${P}news-0123456789ab-e-e.webp`)).toBe(false);
    expect(CHECK.test(`${P}../news-0123456789ab-e.webp`)).toBe(false);
    expect(CHECK.test(`https://evil.example/storage/v1/object/public/news-images/news-0123456789ab-e.webp`)).toBe(false);
  });
  it("the old CHECK refuses -e (the reason for the migration), the new one is a superset on legacy names", () => {
    const old = pg(OLD);
    expect(old.test(`${P}news-0123456789ab-e.webp`)).toBe(false);
    expect(old.test(`${P}news-0123456789ab.webp`)).toBe(true);
  });
  it("same constraint name dropped and re-added (Postgres default name of the inline CHECK)", () => {
    expect(SQL).toMatch(/drop constraint if exists news_items_image_url_check/);
    expect(SQL).toMatch(/add constraint news_items_image_url_check/);
  });
  it("the bucket allows webp and json", () => {
    const m = /allowed_mime_types = array\[([^\]]+)\]/.exec(SQL)!;
    const types = m[1].split(",").map((s) => s.trim().replace(/'/g, ""));
    expect(types).toEqual(["image/webp", "application/json"]);
  });
  it("rollback is fully commented and restores the old regex and MIME list", () => {
    expect(ROLLBACK.split("\n").every((l) => l.trim() === "" || l.startsWith("--"))).toBe(true);
    expect(ROLLBACK).toContain("array['image/webp']");
    expect(ROLLBACK).toContain("news-[0-9a-f]{12}\\.webp$");
    expect(ROLLBACK).toMatch(/set image_url = null where image_url like '%-e\.webp'/);
  });
  it("the URL storagePublisher returns for an emma card passes the CHECK; the credit upload is application/json", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-emma-"));
    const webp = join(dir, "news-0123456789ab.webp");
    writeFileSync(webp, "RIFF");
    writeFileSync(join(dir, "news-0123456789ab.credit.json"), "{}");
    const types: string[] = [];
    const f = vi.fn(async (_u: string, o: { headers: Record<string, string> }) => { types.push(o.headers["content-type"]); return { ok: true, text: async () => "" }; });
    vi.stubEnv("NEWS_IMAGE_STYLE", "emma");
    const url = await storagePublisher("https://abc123.supabase.co", "svc", "news-images", f as unknown as typeof fetch)({ base: "news-0123456789ab" }, { png: "", webp, webpBytes: 4 });
    vi.unstubAllEnvs();
    expect(CHECK.test(url)).toBe(true);
    expect(types).toEqual(["application/json", "image/webp"]);
  });
});
