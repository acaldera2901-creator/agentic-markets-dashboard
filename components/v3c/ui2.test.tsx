// components/v3c/ui2.test.tsx (#REDESIGN-V3C ui2) — esiti W/L/V e loghi dei partner.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PARTNERS } from "@/lib/partners";
import { ResultPill, resultKindOf, scoreText } from "./ResultPill";
import { PartnerLogo, needsName, partnerLogoOf } from "./PartnerLogo";

describe("ResultPill", () => {
  it("mappa le due forme del contratto (ricevute e ieri)", () => {
    expect(resultKindOf("in_favour")).toBe("won");
    expect(resultKindOf("won")).toBe("won");
    expect(resultKindOf("against")).toBe("lost");
    expect(resultKindOf("lost")).toBe("lost");
    expect(resultKindOf("void")).toBe("void");
    expect(resultKindOf("unresolved")).toBe("pending");
  });
  it("risultato con lineetta tipografica, null se vuoto", () => {
    expect(scoreText("2-1")).toBe("2–1");
    expect(scoreText("6-4 6-3")).toBe("6–4 6–3");
    expect(scoreText(" ")).toBeNull();
    expect(scoreText(null)).toBeNull();
  });
  it("W e L: lettera + segno + parola per lo screen reader, stessa struttura", () => {
    const w = renderToStaticMarkup(<ResultPill kind="won" word="Won" />);
    const l = renderToStaticMarkup(<ResultPill kind="lost" word="Lost" />);
    expect(w).toContain(">W<");
    expect(w).toContain("v3c-sr\">Won");
    expect(l).toContain(">L<");
    expect(w.replace(/won|Won|W|✓/g, "")).toBe(l.replace(/lost|Lost|L|✕/g, ""));
    expect(renderToStaticMarkup(<ResultPill kind="pending" word="Pending" />)).toContain("<span>Pending</span>");
  });
});

describe("PartnerLogo", () => {
  it("ogni partner del catalogo ha un file logo che esiste in public/", () => {
    for (const p of PARTNERS) {
      expect(p.logo, p.id).toBeTruthy();
      expect(existsSync(join(process.cwd(), "public", p.logo)), p.logo).toBe(true);
    }
  });
  it("trova il partner per chiave del book o per nome", () => {
    expect(partnerLogoOf("fortuneplay", "x").logo).toBe("/logos/fortuneplay.svg");
    expect(partnerLogoOf("??", "YBets").logo).toBe("/logos/ybets.svg");
  });
  it("senza logo: il NOME in testo, mai le iniziali", () => {
    const html = renderToStaticMarkup(<PartnerLogo id="newbook" name="New Book" size="chip" />);
    expect(html).toContain(">New Book<");
    expect(html).not.toContain("<img");
    expect(needsName("newbook", "New Book")).toBe(true);
  });
  it("alt = nome, vuoto quando il nome è già scritto accanto", () => {
    expect(renderToStaticMarkup(<PartnerLogo id="ybets" name="YBets" />)).toContain('alt="YBets"');
    expect(renderToStaticMarkup(<PartnerLogo id="ybets" name="YBets" decorative />)).toContain('alt=""');
  });
  it("i marchi senza nome scritto chiedono il nome accanto", () => {
    expect(needsName("fortuneplay", "FortunePlay")).toBe(true);
    expect(needsName("ybets", "YBets")).toBe(false);
  });
});
