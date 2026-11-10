import { describe, expect, it } from "vitest";
import { buildRow, baseFor, duplicateOf, guidExists, guidFor, validate, type EmmaManifest } from "./emma-import";
import { cardFromRow } from "./table";

const good = (): EmmaManifest => ({
  id: "2026-11-06-news-12", account: "betr.edge", slot: "12", tipo: "post", image: "post.png", fonte: "BetRedge news",
  checks: { logo: true, persone_reali: true, loghi_autentici: true, no_18_in_immagine: true },
  qa_orchestratore: { stato: "ok", data: "2026-11-06", nota: "visto" },
  blog: { pubblica: true, en: { title: "Bournemouth come from behind to beat Sparta Prague", body: "Bournemouth won 3-1 in Prague." }, it: { title: "Il Bournemouth rimonta lo Sparta Praga", body: "Il Bournemouth ha vinto 3-1 a Praga." }, teams: ["AFC Bournemouth"], fonte_url: "https://www.betredge.com/blog", credito: { person: "Marco Rose", author: "Steffen Prößdorf", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", url: "https://commons.wikimedia.org/wiki/File:x.jpg" } },
});
const errs = (m: EmmaManifest) => validate(m).join(" | ");

describe("validate — a card goes to the blog ONLY when everything is true", () => {
  it("good manifest → no errors", () => expect(validate(good())).toEqual([]));
  it("no qa_orchestratore ok → refused (also without date/note)", () => {
    const a = good(); delete a.qa_orchestratore; expect(errs(a)).toMatch(/qa_orchestratore/);
    expect(errs({ ...good(), qa_orchestratore: { stato: "ok" } })).toMatch(/data e nota/);
    expect(errs({ ...good(), qa_orchestratore: "pending" })).toMatch(/qa_orchestratore/);
  });
  it("incomplete credit → refused, one message per missing field", () => {
    for (const k of ["person", "author", "license", "url"]) { const m = good(); (m.blog!.credito as Record<string, string>)[k] = ""; expect(errs(m)).toMatch(new RegExp(`credito.${k}`)); }
    const n = good(); delete n.blog!.credito; expect(errs(n)).toMatch(/credito.person/);
  });
  it("blog.pubblica missing/false → refused (Emma opts in per card)", () => {
    const m = good(); delete m.blog!.pubblica; expect(errs(m)).toMatch(/blog\.pubblica/);
    const n = good(); delete n.blog; expect(errs(n)).toMatch(/blog\.pubblica/);
  });
  it("wrong account, reel, flags false → refused", () => {
    expect(errs({ ...good(), account: "x" })).toMatch(/account/);
    expect(errs({ ...good(), tipo: "reel" })).toMatch(/reel/);
    for (const k of ["logo", "persone_reali", "loghi_autentici", "no_18_in_immagine"]) expect(errs({ ...good(), checks: { ...good().checks, [k]: false } })).toMatch(new RegExp(k));
  });
  it("forbidden claims in EN or IT text, empty texts, bad source URL → refused", () => {
    const m = good(); m.blog!.en!.body = "A lock for tonight, guaranteed."; expect(errs(m)).toMatch(/claim vietato in blog\.en/);
    const n = good(); n.blog!.it!.body = "le migliori quote"; expect(errs(n)).toMatch(/claim vietato in blog\.it/);
    const o = good(); o.blog!.it!.title = ""; expect(errs(o)).toMatch(/blog\.it/);
    const p = good(); p.blog!.fonte_url = "ftp://x"; expect(errs(p)).toMatch(/fonte_url/);
  });
});

describe("idempotence — never twice, never next to the watcher's own story", () => {
  const g = guidFor("2026-11-06-news-12");
  it("same manifest id → same guid/base (stable); other id → other", () => {
    expect(guidFor("2026-11-06-news-12")).toBe(g); expect(guidFor("other")).not.toBe(g);
    expect(baseFor(g)).toMatch(/^news-[0-9a-f]{12}$/);
  });
  it("already imported (same guid) → duplicate", () => expect(duplicateOf([{ guid_hash: g }], g, "https://x", "T")).toMatch(/già importata/));
  it("same source URL as a watcher row → duplicate; the generic blog URL does NOT count as a source", () => {
    expect(duplicateOf([{ guid_hash: "a".repeat(64), source_url: "https://www.fotmob.com/n/1" }], g, "https://www.fotmob.com/n/1", "T")).toMatch(/stessa fonte/);
    expect(duplicateOf([{ guid_hash: "a".repeat(64), source_url: "https://www.betredge.com/blog" }], g, "https://www.betredge.com/blog", "Other title")).toBeNull();
  });
  it("same title (case/punctuation-insensitive) as a watcher row → duplicate", () =>
    expect(duplicateOf([{ guid_hash: "b".repeat(64), source_url: "https://y", rewritten_en: { title: "Bournemouth come from behind, to beat Sparta Prague!" } }], g, "https://z", "Bournemouth come from behind to beat Sparta Prague")).toMatch(/stesso titolo/));
  it("nothing similar → free", () => expect(duplicateOf([{ guid_hash: "c".repeat(64), source_url: "https://y", rewritten_en: { title: "Something else" } }], g, "https://z", "Bournemouth win")).toBeNull());
});

describe("guidExists — exact guid, no time window, before any upload", () => {
  const g = guidFor("old-manifest");
  const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  it("a row with that guid exists (even if imported weeks ago) → true: the CLI skips, nothing is uploaded", async () => {
    let asked = "";
    const f = (async (u: string) => { asked = u; return new Response(JSON.stringify([{ guid_hash: g }])); }) as unknown as typeof fetch;
    expect(await guidExists("https://p/rest/v1/news_items", {}, g, f)).toBe(true);
    expect(asked).toContain(`guid_hash=eq.${g}`); expect(asked).not.toMatch(/published_at/);
  });
  it("no row → false (free to upload)", async () => expect(await guidExists("https://p/r", {}, g, reply(200, []))).toBe(false));
  it("read error → throws (fail closed: never upload without knowing)", async () => {
    await expect(guidExists("https://p/r", {}, g, reply(500, {}))).rejects.toThrow(/http 500/);
  });
});

describe("buildRow", () => {
  it("the row is a valid feed card (cardFromRow accepts it), not in the future, source BetRedge", () => {
    const now = Date.parse("2026-11-06T10:00:00Z");
    const m = good(); m.blog!.published_at = "2026-11-06T23:00:00Z"; // future → clamped to now
    const row = buildRow(m, now);
    expect(row.published_at).toBe("2026-11-06T10:00:00.000Z");
    const card = cardFromRow(row as never);
    expect(card).toMatchObject({ source: "BetRedge", teams: ["AFC Bournemouth"] });
    expect(card?.note.en.title).toMatch(/Bournemouth/);
    expect(row.guid_hash).toBe(guidFor(m.id!));
  });
});
