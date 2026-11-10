// lib/v3c/news/photo-national.test.ts (G5 finding B) — a club note never gets a national-team photo: the lead image is refused,
// Commons is searched for a picture of the person in the note's club, else null (anonymous scene). National notes are untouched.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isClubNote, isNationalPhoto, photoRef } from "./photo";

type File = { cats?: string; width?: number };
function mock(person: string, desc: string, lead: string, files: Record<string, File>, search: string[]) {
  const calls: string[] = [];
  const f = (async (url: string) => {
    const u = String(url); calls.push(u);
    const json = (o: unknown) => ({ ok: true, status: 200, json: async () => o });
    if (u.includes("en.wikipedia.org")) return json({ query: { pages: { 1: { title: person, description: desc, pageimage: lead, index: 1 } } } });
    if (u.includes("list=search")) return json({ query: { search: search.map((t) => ({ title: `File:${t}` })) } });
    if (u.includes("commons.wikimedia.org")) {
      const name = decodeURIComponent(/titles=File%3A([^&]+)/.exec(u)![1]);
      const d = files[name] ?? {};
      return json({ query: { pages: { 9: { imageinfo: [{ url: "https://u/o.jpg", thumburl: "https://u/t.jpg", width: d.width ?? 3000, height: 4000, descriptionurl: `https://commons.wikimedia.org/wiki/File:${name}`, extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, Artist: { value: "Bryan Berlin" }, LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" }, Categories: { value: d.cats ?? "" } } }] } } } });
    }
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("JPG").buffer };
  }) as unknown as typeof fetch;
  return { f, calls };
}
const dir = () => mkdtempSync(join(tmpdir(), "pn-"));

describe("isNationalPhoto / isClubNote", () => {
  it("name, categories or description say national team", () => {
    expect(isNationalPhoto("Raphinha_Brazil_V_Morocco_13_June_2026-133_(cropped).jpg")).toBe(true);
    expect(isNationalPhoto("Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg")).toBe(true);
    expect(isNationalPhoto("Serhou_Guirassy1.jpg", "Guinea national football team players|Borussia Dortmund players")).toBe(true);
    expect(isNationalPhoto("Raphinha_FC_Barcelona_2025.jpg", "FC Barcelona players")).toBe(false);
    expect(isNationalPhoto("Erling_Haaland_2023.jpg")).toBe(false);
  });
  it("club note = a club in the title/teams; a national-team note is not", () => {
    expect(isClubNote({ title: "Raphinha commits to Barcelona until 2030", body: "x" }, ["Barcelona"])).toBe(true);
    expect(isClubNote({ title: "Kovac wanted to avoid risk over Guirassy injury", body: "x" }, ["Dortmund"])).toBe(true);
    expect(isClubNote({ title: "Brazil beat Morocco in a friendly", body: "x" }, ["Brazil"])).toBe(false);
  });
});

describe("photoRef on club notes", () => {
  const raph = { title: "Raphinha commits to Barcelona until 2030", body: "Raphinha has agreed a new contract with Barcelona." };
  const NAT = "Raphinha_Brazil_V_Morocco_13_June_2026-133_(cropped).jpg";
  it("Brazil lead refused → the Commons file of the person at the club is used (search names club and surname)", async () => {
    const m = mock("Raphinha", "Brazilian footballer (born 1996)", NAT, {}, ["Raphinha_FC_Barcelona_2025.jpg", "Raphinha_Brazil_V_Morocco_13_June_2026-208.jpg"]);
    const r = await photoRef(raph, ["Barcelona"], { dir: dir(), fetch: m.f });
    expect(r?.url).toBe("https://commons.wikimedia.org/wiki/File:Raphinha_FC_Barcelona_2025.jpg");
    expect(m.calls.some((u) => u.includes("list=search") && /Barcelona/.test(decodeURIComponent(u)))).toBe(true);
  });
  it("only national pictures exist → null (anonymous scene, never a wrong kit)", async () => {
    const m = mock("Raphinha", "Brazilian footballer (born 1996)", NAT, {}, ["Raphinha_Brazil_V_Morocco_13_June_2026-208.jpg", "Raphinha_Brazil_V_Morocco_13_June_2026-100.jpg"]);
    expect(await photoRef(raph, ["Barcelona"], { dir: dir(), fetch: m.f })).toBeNull();
  });
  it("national marker in the Commons categories only (Guirassy, Dortmund) → refused; a search hit with surname but another person's name is ignored", async () => {
    const note = { title: "Kovac wanted to avoid risk over Guirassy injury", body: "Serhou Guirassy left the field." };
    const m = mock("Serhou Guirassy", "Guinean footballer", "Serhou_Guirassy1.jpg", { "Serhou_Guirassy1.jpg": { cats: "Guinea national football team players" } }, ["Random_player_Dortmund.jpg"]);
    expect(await photoRef(note, ["Dortmund"], { dir: dir(), fetch: m.f })).toBeNull();
  });
  it("a cached national photo is not reused for a club note", async () => {
    const d = dir();
    const nat = mock("Raphinha", "Brazilian footballer", "Raphinha_Barcelona_ok.jpg", {}, []);
    const first = await photoRef({ title: "Brazil beat Morocco in a friendly", body: "Raphinha scored." }, ["Brazil"], { dir: d, fetch: mock("Raphinha", "Brazilian footballer", NAT, {}, []).f });
    expect(first?.url).toContain("Brazil_V_Morocco"); // national note: the national photo is fine
    const r = await photoRef(raph, ["Barcelona"], { dir: d, fetch: nat.f });
    expect(r?.url).toContain("Raphinha_Barcelona_ok");
  });
  it("national note: the national lead image is accepted (not a club note)", async () => {
    const m = mock("Raphinha", "Brazilian footballer", NAT, {}, []);
    const r = await photoRef({ title: "Brazil beat Morocco in a friendly", body: "Raphinha scored." }, ["Brazil"], { dir: dir(), fetch: m.f });
    expect(r?.url).toContain("Brazil_V_Morocco");
  });
});
