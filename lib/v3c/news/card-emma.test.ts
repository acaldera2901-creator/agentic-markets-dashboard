// lib/v3c/news/card-emma.test.ts — the NEWS_IMAGE_STYLE switch: legacy is the default and is byte-identical to today.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cardPrompt, cardText, pickCard } from "./card";
import { imageStyle, emmaCardPrompt, EMMA_SIZE } from "./card-emma";
import { sceneKind } from "./image";

const note = { title: "Arsenal beat Tottenham 2-1", body: "Arsenal win the derby 2-1 with a late goal." };
const spec = () => pickCard("abc123", sceneKind(note), cardText(note), "deep red", "Arsenal", []);

afterEach(() => vi.unstubAllEnvs());

describe("NEWS_IMAGE_STYLE", () => {
  it("imageStyle: only «emma» switches; anything else (unset, typo, empty) is legacy", () => {
    expect(imageStyle(undefined)).toBe("legacy");
    expect(imageStyle("")).toBe("legacy");
    expect(imageStyle("emma ")).toBe("emma");
    expect(imageStyle("EMMA")).toBe("emma");
    expect(imageStyle("emm")).toBe("legacy");
    expect(imageStyle("legacy")).toBe("legacy");
  });

  it("env unset and env=legacy give the same prompt as the explicit legacy call", () => {
    const legacy = cardPrompt(spec(), "legacy");
    vi.stubEnv("NEWS_IMAGE_STYLE", "");
    expect(cardPrompt(spec())).toBe(legacy);
    vi.stubEnv("NEWS_IMAGE_STYLE", "legacy");
    expect(cardPrompt(spec())).toBe(legacy);
  });

  it("emma: only the exact value changes the prompt; env=emma gives the vertical template, typo stays legacy", () => {
    const legacy = cardPrompt(spec(), "legacy");
    expect(cardPrompt(spec(), "emm")).toBe(legacy);
    expect(cardPrompt(spec(), "emma")).not.toBe(legacy);
    vi.stubEnv("NEWS_IMAGE_STYLE", "emma");
    expect(cardPrompt(spec())).toBe(cardPrompt(spec(), "emma"));
  });
});

describe("emmaCardPrompt (vertical 4:5)", () => {
  const full = () => emmaCardPrompt(spec(), { photo: { person: "Raphinha", kitNote: "Brazil national-team shirt" }, crests: ["FC Barcelona"], headline: ["RAPHINHA", "STAYS"], subtitle: "Barcelona deal runs to 2030", label: "NEWS" });

  it("format: 4:5 vertical 1080x1350, never 16:9", () => {
    expect(EMMA_SIZE).toEqual({ width: 1080, height: 1350 });
    const p = full();
    expect(p).toMatch(/4:5 vertical portrait/); expect(p).toContain("1080x1350"); expect(p).not.toMatch(/16:9|landscape/i);
  });
  it("content: headline, subtitle, badge, photo + crest references, marks kept, logo corner reserved", () => {
    const p = full();
    expect(p).toContain("first line RAPHINHA, second line STAYS"); expect(p).not.toContain(" / "); expect(p).toContain("Barcelona deal runs to 2030"); // M1
    expect(p).toMatch(/badge with black italic bold text: 2-1/);
    expect(p).toMatch(/Reference image 1 is a real photo of Raphinha/); expect(p).toMatch(/ALL its original marks/);
    expect(p).toMatch(/Reference image 2 is the official crest \(FC Barcelona\)/); expect(p).toMatch(/never redraw or invent a crest/);
    expect(p).toMatch(/TOP-LEFT corner[^.]*empty[^.]*BetRedge logo is added later, never draw a logo/);
    expect(p).toContain("#C8FF00");
  });
  it("no 18+ / disclaimer / age limit text asked for in the picture", () => {
    for (const p of [full(), emmaCardPrompt(spec())]) {
      expect(p).toMatch(/no age limits and no disclaimer/);
      expect(p.replace("no age limits and no disclaimer", "")).not.toMatch(/18\+|disclaimer|gambl|analysis, not/i);
    }
  });
  it("no photo / no crest: generic anonymous scene, no crest line, headline from the card text, nothing invented", () => {
    const p = emmaCardPrompt(spec());
    expect(p).toMatch(/anonymous \(no recognisable real face/); expect(p).not.toMatch(/Reference image/); expect(p).not.toMatch(/crest/i);
    expect(p).toContain("2-1");
  });
  it("two crests: reference numbering follows the photo", () => {
    const p = emmaCardPrompt(spec(), { photo: { person: "X" }, crests: ["A", "B"] });
    expect(p).toMatch(/Reference images 2-3 are the official crests \(A, B\)/);
    expect(emmaCardPrompt(spec(), { crests: ["A", "B", "C"] })).toMatch(/Reference images 1-2 /);
  });
  it("legacy stays byte-identical when the switch is off", () => {
    expect(cardPrompt(spec(), undefined)).toBe(cardPrompt(spec(), "legacy"));
    expect(cardPrompt(spec(), "legacy")).not.toMatch(/4:5/);
  });
});
