import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelatedTools, RELATED_TOOLS } from "./RelatedTools";
import { TOOL_SLUGS } from "@/lib/tools/registry";

describe("RelatedTools", () => {
  it("rende un link crawlabile per ogni calcolatore chiave e per l'hub", () => {
    render(<RelatedTools />);
    for (const [href, label] of RELATED_TOOLS) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("link", { name: /all 11 calculators/i })).toHaveAttribute("href", "/tools");
  });

  it("punta solo a tool che esistono nel registry", () => {
    for (const [href] of RELATED_TOOLS) {
      expect((TOOL_SLUGS as readonly string[]).includes(href.replace("/tools/", ""))).toBe(true);
    }
  });
});
