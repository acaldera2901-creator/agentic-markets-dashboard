// lib/v3c/news/image.test.ts (#NEWSWATCH-2) — the picture of one note, pure part,
// checked against the four notes art direction did by hand on 29/10
// (preview-news-prod/2026-10-29/img-per-news/README.md).
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { clubHex, colourName, IMAGE_CHECK_SCHEMA, IMAGE_STYLE, fotmobIdOf, imageBase, imagePrompt, protagonistTint, readImageVerdict, sceneKind } from "./image";
import { storagePublisher } from "./image-gen";

const BAYERN = { title: "Bayern reach DFB-Pokal last 16; Brown praises unity", body: "Bayern Munich advanced in the DFB-Pokal on Wednesday, reaching the last 16. Nathaniel Brown praised the squad's unity during difficult times." };
const MIAMI = { title: "Inter Miami and FC Cincinnati draw 2-2", body: "Riquelme Fillipi scored a late equaliser after Inter Miami had given up a one-goal lead. The match ended 2-2 after a frantic finish." };
const CHIVU = { title: "Chivu concedes Inter lacked conviction in win", body: "Inter beat Venezia 2-0 but Chivu acknowledged the side played without conviction." };
const CHELSEA = { title: "Alonso stresses league focus after EFL Cup exit", body: "Chelsea lost on penalties to Liverpool in the last 16 of the EFL Cup; Alonso called the Premier League his main focus." };

describe("image · scene from the note (art direction's table of signals)", () => {
  it("the four notes of 29/10 get the scene art direction chose by hand", () => {
    expect(sceneKind(BAYERN)).toBe("unity");
    expect(sceneKind(MIAMI)).toBe("late");
    expect(sceneKind(CHIVU)).toBe("coach");
    expect(sceneKind(CHELSEA)).toBe("exit");
  });
  it("injury, transfer, line-up, award, plain win, other", () => {
    expect(sceneKind({ title: "Saka ruled out with hamstring injury", body: "" })).toBe("injury");
    expect(sceneKind({ title: "Napoli complete loan move for striker", body: "" })).toBe("transfer");
    expect(sceneKind({ title: "Spalletti names squad for qualifiers", body: "" })).toBe("lineup");
    expect(sceneKind({ title: "Yamal wins Golden Boy award", body: "" })).toBe("award");
    expect(sceneKind({ title: "Arsenal beat Spurs 3-1", body: "" })).toBe("win");
    expect(sceneKind({ title: "Stadium works start in March", body: "" })).toBe("other");
  });
});

describe("image · one club colour, never a pair, never a name", () => {
  it("colours read as one word the model understands", () => {
    expect(colourName("#DC052D")).toBe("red");
    expect(colourName("#F7B5CD")).toBe("pale pink");
    expect(colourName("#010E80")).toBe("deep blue");
    expect(colourName("#034694")).toBe("royal blue");
    expect(colourName("#000000")).toBe("black");
    expect(colourName("#FFFFFF")).toBe("white");
  });
  it("the protagonist is the club written first; a club without a verified colour gives no tint", () => {
    expect(clubHex("Inter")).toBe("#010E80");
    expect(protagonistTint(MIAMI, ["FC Cincinnati", "Inter Miami"])).toBe(colourName(clubHex("Inter Miami")!));
    expect(protagonistTint(BAYERN, ["Bayern Munich"])).toBe(colourName(clubHex("Bayern Munich")!));
    expect(protagonistTint({ title: "Nowhere FC win", body: "" }, ["Nowhere FC"])).toBeNull();
  });
  it("the prompt: scene + tint + the fixed style; no club, player or league named; no colour pair", () => {
    const p = imagePrompt(CHIVU, ["Inter", "Venezia"]);
    expect(p.endsWith(IMAGE_STYLE)).toBe(true);
    expect(p).toContain("deep blue");
    for (const name of ["Inter", "Venezia", "Chivu", "Serie A"]) expect(p).not.toContain(name);
    expect(p).not.toMatch(/blue and black|black and blue/i);
    expect(p).toMatch(/no stripes/);
    const noTeam = imagePrompt({ title: "Stadium works start", body: "" }, []);
    expect(noTeam).toContain("No club colour");
  });
});

describe("image · file name news-<sha256(source id)[:12]>: the site's convention (5c35bc31), nothing leads back to the source", () => {
  it("same names as the site's noteImageName for the four hand-made pictures; no slug, no id; null without a source id", () => {
    expect(fotmobIdOf("https://www.fotmob.com/it/topnews/30206-some-title")).toBe("30206");
    // expected values copied from the site's lib/news/per-note.test.ts
    expect(imageBase("https://www.fotmob.com/news/34p7x1w2mryx1d30uxb50a7qb-chivu-admits")).toBe("news-85469d0dd84e");
    expect(imageBase("https://www.fotmob.com/it/news/1h64s2rd5exkn16klbwyxxlsns-were-winning")).toBe("news-3ad88e639192");
    expect(imageBase("https://www.fotmob.com/news/4jikbwtyvot1ka7zjol4z8ww-x")).toBe("news-d92d970f9936");
    expect(imageBase("https://www.fotmob.com/news/mb6zakc8ytax1tip7i9m9dlsx-x")).toBe("news-39567f5fa699");
    expect(imageBase("https://example.com/news/abc-x")).toBeNull();
  });
});

describe("image · the visual check's answer", () => {
  it("ok only with an empty list; problems listed; bad shapes throw", () => {
    expect(IMAGE_CHECK_SCHEMA.required).toEqual(["ok", "problems"]);
    expect(readImageVerdict({ ok: true, problems: [] })).toEqual({ ok: true });
    expect(readImageVerdict({ ok: true, problems: ["swoosh on a boot"] })).toEqual({ ok: false, problems: ["swoosh on a boot"] });
    expect(readImageVerdict({ ok: false, problems: [] })).toEqual({ ok: false, problems: ["checker said no"] });
    expect(() => readImageVerdict("fine")).toThrow(/not JSON/);
    expect(() => readImageVerdict({ ok: "yes", problems: [] })).toThrow(/wrong shape/);
  });
});

describe("image · option A publisher (Storage), with a fake fetch — never run against the real project", () => {
  it("one POST of the webp to the bucket, upsert, service role; returns the public URL", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pub-"));
    const webp = join(dir, "news-x-slug.webp");
    writeFileSync(webp, "RIFF");
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const url = await storagePublisher("https://p.supabase.co/", "svc", "news-images", f as unknown as typeof fetch)({ base: "news-x-slug" }, { png: join(dir, "x.png"), webp, webpBytes: 4 });
    expect(url).toBe("https://p.supabase.co/storage/v1/object/public/news-images/news-x-slug.webp");
    expect(f).toHaveBeenCalledTimes(1);
    const [u, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(u).toBe("https://p.supabase.co/storage/v1/object/news-images/news-x-slug.webp");
    expect(new Headers(init.headers).get("x-upsert")).toBe("true");
    expect(new Headers(init.headers).get("content-type")).toBe("image/webp");
    const bad = vi.fn(async () => new Response("nope", { status: 403 }));
    await expect(storagePublisher("https://p.supabase.co", "svc", "b", bad as unknown as typeof fetch)({ base: "news-x-slug" }, { png: "", webp, webpBytes: 4 })).rejects.toThrow(/http 403/);
  });
});
