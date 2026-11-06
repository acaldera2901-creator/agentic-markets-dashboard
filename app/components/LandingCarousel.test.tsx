// #PERF-CAROUSEL-1106 — only the first slide may be fetched eagerly/preloaded; the rest must be lazy.
// (Before: slides 3+ were loading="eager", slide 2 preloaded: ~1.9 MB of creatives against the LCP image.)
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import LandingCarousel from "./LandingCarousel";

describe("LandingCarousel image loading", () => {
  it("first image is priority (not lazy); every other slide image is lazy", () => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    const { container } = render(<LandingCarousel lang="en" />);
    const imgs = [...container.querySelectorAll<HTMLImageElement>(".lp-carousel-slide img")];
    expect(imgs.length).toBeGreaterThan(2);
    expect(imgs[0].getAttribute("loading")).not.toBe("lazy");
    for (const img of imgs.slice(1)) expect(img.getAttribute("loading")).toBe("lazy");
  });
});
