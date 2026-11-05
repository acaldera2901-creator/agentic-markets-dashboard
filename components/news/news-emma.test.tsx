// components/news/news-emma.test.tsx (G4) — emma cards on the page: recognised by «-e» in the file name
// (no migration), 4:5 containers only for them, no crests drawn over them, photo credit under the card.
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NewsArt } from "./NewsArt";
import { NewsCredit } from "./NewsCredit";
import { emmaCreditUrl, isEmmaSrc, parseCredit } from "@/lib/news/per-note";
import { uploadedImage } from "@/lib/news/per-note.server";
import { storagePublisher, storageRemover } from "@/lib/v3c/news/image-gen";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const ORIGIN = "https://p.supabase.co";
const EMMA = `${ORIGIN}/storage/v1/object/public/news-images/news-0123456789ab-e.webp`;
const LEGACY = `${ORIGIN}/storage/v1/object/public/news-images/news-0123456789ab.webp`;
const badges = [{ name: "Inter", crest: "/crests/inter.png", colors: ["#0b2a6b", "#000000"] as [string, string] }];

describe("recognition without migration", () => {
  it("«-e» before .webp = emma; legacy, neutral and bundled names are not", () => {
    expect(isEmmaSrc(EMMA)).toBe(true);
    expect(isEmmaSrc(`${EMMA}?v=2`)).toBe(true);
    expect(isEmmaSrc(LEGACY)).toBe(false);
    expect(isEmmaSrc("/images/news/news-3ad88e639192.webp")).toBe(false);
    expect(isEmmaSrc(`${ORIGIN}/x/news-00000000000a.webp`)).toBe(false);
  });
  it("credit URL = same name, .credit.json; none for legacy", () => {
    expect(emmaCreditUrl(EMMA)).toBe(EMMA.replace(".webp", ".credit.json"));
    expect(emmaCreditUrl(LEGACY)).toBeNull();
  });
  it("the page size of an uploaded emma card is 1080x1350, legacy 1200x675", () => {
    expect(uploadedImage(EMMA, ORIGIN)).toMatchObject({ width: 1080, height: 1350 });
    expect(uploadedImage(LEGACY, ORIGIN)).toMatchObject({ width: 1200, height: 675 });
  });
  it("parseCredit keeps https links only and needs author + licence", () => {
    expect(parseCredit({ author: "Bryan Berlin", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", url: "javascript:alert(1)" })).toMatchObject({ licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0", url: null });
    expect(parseCredit({ author: "", license: "x" })).toBeNull();
    expect(parseCredit(null)).toBeNull();
  });
});

describe("NewsArt", () => {
  it("emma: data-emma, no crest over the picture; legacy own card keeps its crest", () => {
    const { container, rerender } = render(<NewsArt image={{ own: true, src: EMMA, width: 1080, height: 1350 }} badges={badges} variant="thumb" sizes="168px" />);
    expect(container.querySelector(".nwa[data-emma]")).not.toBeNull();
    expect(container.querySelector(".nwa-badge")).toBeNull();
    expect(container.querySelector(".nwa-tint")).toBeNull();
    rerender(<NewsArt image={{ own: true, src: LEGACY, width: 1200, height: 675 }} badges={badges} variant="thumb" sizes="168px" />);
    expect(container.querySelector(".nwa[data-emma]")).toBeNull();
    expect(container.querySelector(".nwa-badge")).not.toBeNull();
  });
});

describe("NewsCredit", () => {
  it("shows author + licence as links when credit.json exists", async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ person: "Erling Haaland", author: "Bryan Berlin", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:X.jpg" }) }));
    vi.stubGlobal("fetch", f);
    render(<NewsCredit src={EMMA} label="Foto" />);
    await waitFor(() => expect(screen.getByText("Bryan Berlin")).toBeTruthy());
    expect(f).toHaveBeenCalledWith(EMMA.replace(".webp", ".credit.json"));
    expect(screen.getByText("CC BY-SA 4.0").getAttribute("href")).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
    expect(screen.getByText("Bryan Berlin").getAttribute("href")).toContain("commons.wikimedia.org");
  });
  it("nothing when the file is missing or the card is legacy (no fetch at all)", async () => {
    const f = vi.fn(async () => ({ ok: false, json: async () => null }));
    vi.stubGlobal("fetch", f);
    const { container } = render(<><NewsCredit src={EMMA} /><NewsCredit src={LEGACY} /></>);
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(container.querySelector(".nw-credit")).toBeNull();
  });
});

describe("storagePublisher / storageRemover with emma", () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), "emma-pub-"));
    const webp = join(dir, "news-0123456789ab.webp");
    writeFileSync(webp, "RIFF");
    return { dir, webp };
  };
  it("emma: uploads news-…-e.webp and its credit.json; legacy: plain name, no credit", async () => {
    const { dir, webp } = setup();
    writeFileSync(join(dir, "news-0123456789ab.credit.json"), JSON.stringify({ author: "A", license: "CC0" }));
    const calls: string[] = [];
    const f = vi.fn(async (u: string) => { calls.push(u); return { ok: true, text: async () => "" }; });
    vi.stubEnv("NEWS_IMAGE_STYLE", "emma");
    const url = await storagePublisher(ORIGIN, "svc", "news-images", f as unknown as typeof fetch)({ base: "news-0123456789ab" }, { png: "", webp, webpBytes: 4 });
    expect(url).toBe(EMMA);
    expect(calls).toEqual([`${ORIGIN}/storage/v1/object/news-images/news-0123456789ab-e.credit.json`, `${ORIGIN}/storage/v1/object/news-images/news-0123456789ab-e.webp`]);
    calls.length = 0;
    vi.stubEnv("NEWS_IMAGE_STYLE", "legacy");
    expect(await storagePublisher(ORIGIN, "svc", "news-images", f as unknown as typeof fetch)({ base: "news-0123456789ab" }, { png: "", webp, webpBytes: 4 })).toBe(LEGACY);
    expect(calls).toHaveLength(1);
    expect(readFileSync(join(dir, "news-0123456789ab.credit.json"), "utf8")).toContain("CC0");
  });
  it("retention removes an emma card together with its credit.json", async () => {
    let body = "";
    const f = vi.fn(async (_u: string, o: { body: string }) => { body = o.body; return { ok: true, text: async () => "" }; });
    await storageRemover(ORIGIN, "svc", "news-images", f as unknown as typeof fetch)([EMMA, LEGACY]);
    expect(JSON.parse(body).prefixes).toEqual(["news-0123456789ab-e.webp", "news-0123456789ab-e.credit.json", "news-0123456789ab.webp"]);
  });
});
