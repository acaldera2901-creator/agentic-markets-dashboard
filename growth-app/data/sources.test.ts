import { describe, expect, it } from "vitest";
import { WINDOWS } from "@/core/kpi";
import snapshotJson from "./snapshot.json";
import { normalizeDbUrl } from "./live-source";
import { assertSnapshot, snapshotSource } from "./snapshot-source";

describe("snapshot source", () => {
  it("the shipped snapshot has every window and no failed read", () => {
    const s = assertSnapshot(snapshotJson);
    for (const { key } of WINDOWS) {
      for (const [q, r] of Object.entries(s.windows[key])) expect(r.ok, `${key}.${q}`).toBe(true);
    }
  });

  it("serves normalized data tagged as snapshot with the DB time", async () => {
    const { data, meta } = await snapshotSource().load("30d");
    expect(meta.kind).toBe("snapshot");
    expect(meta.asOf).toBe(snapshotJson.dbNow);
    expect(data.window).toBe("30d");
  });

  it("rejects a malformed snapshot instead of rendering zeros", () => {
    expect(() => snapshotSource({ schema: 1, dbNow: "2026-10-05T00:00:00Z", windows: {} })).toThrow(/finestra/);
    expect(() => snapshotSource({})).toThrow(/schema/);
  });

  it("the shipped snapshot carries no personal-looking labels", () => {
    const text = JSON.stringify(snapshotJson);
    expect(text).not.toMatch(/@/); // no e-mail
    for (const { key } of WINDOWS) {
      const src = snapshotJson.windows[key].sources;
      for (const r of src.ok ? src.data : []) {
        const label = String((r as { source: string }).source);
        if (label.startsWith("referrer:")) expect(label.split(".").length, label).toBeLessThanOrEqual(3);
        if (label.startsWith("ref:")) expect(label).toBe("ref:(codice referral)");
      }
    }
  });
});

describe("live source config", () => {
  it("accepts the repo's SQLAlchemy-style URL", () => {
    expect(normalizeDbUrl("postgresql+asyncpg://u:p@h:5432/db")).toBe("postgresql://u:p@h:5432/db");
    expect(normalizeDbUrl('"postgres://u:p@h/db"')).toBe("postgres://u:p@h/db");
    expect(() => normalizeDbUrl("")).toThrow(/assente/);
    expect(() => normalizeDbUrl("mysql://x")).toThrow(/schema/);
  });
});
