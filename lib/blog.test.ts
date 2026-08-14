// lib/blog.test.ts (#BLOG-SSR-0814)
// Il pezzo che DEVE essere provato rompendolo è il sanitizer: il corpo HTML
// arriva dal feed Soro (fornitore esterno) e va in dangerouslySetInnerHTML —
// ogni caso qui sotto è un payload che, passando, diventerebbe XSS servito
// su una pagina pubblica indicizzata.
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  dbQuery: vi.fn(async () => []),
}));

import { sanitizeBlogHtml, metaTitleOf, formatPostDate } from "./blog";

describe("sanitizeBlogHtml", () => {
  it("rimuove <script> con tutto il contenuto", () => {
    const out = sanitizeBlogHtml('<p>ok</p><script>alert("x")</script><p>fine</p>');
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>ok</p>");
    expect(out).toContain("<p>fine</p>");
  });

  it("rimuove script con attributi e case misto", () => {
    const out = sanitizeBlogHtml('<ScRiPt src="https://evil.example/x.js"></ScRiPt>');
    expect(out.toLowerCase()).not.toContain("script");
    expect(out).not.toContain("evil.example");
  });

  it("rimuove iframe/object/embed/form/style/svg", () => {
    for (const tag of ["iframe", "object", "embed", "form", "style", "svg"]) {
      const out = sanitizeBlogHtml(`<p>a</p><${tag} attr="x">payload</${tag}><p>b</p>`);
      expect(out.toLowerCase(), tag).not.toContain(`<${tag}`);
      expect(out, tag).toContain("<p>a</p>");
    }
  });

  it("rimuove i tag orfani senza chiusura (uno <script> mai chiuso)", () => {
    const out = sanitizeBlogHtml('<p>a</p><script src="https://evil.example/x.js">');
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("rimuove gli handler inline in tutte le forme di quoting", () => {
    const out = sanitizeBlogHtml(
      `<img src="https://x.example/a.png" onerror="alert(1)"><a href="/x" onclick='steal()'>l</a><div onmouseover=hack()>d</div>`
    );
    expect(out).not.toMatch(/on[a-z]+\s*=/i);
    expect(out).toContain('src="https://x.example/a.png"');
    expect(out).toContain('href="/x"');
  });

  it("neutralizza javascript: e data: in href/src", () => {
    const out = sanitizeBlogHtml(
      `<a href="javascript:alert(1)">a</a><a href='JAVASCRIPT:x()'>b</a><img src="data:text/html;base64,PHNjcmlwdD4=">`
    );
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("JAVASCRIPT:");
    expect(out).not.toContain("data:text/html");
  });

  it("rimuove link/meta/base (redirezioni e riscritture di base URL)", () => {
    const out = sanitizeBlogHtml('<meta http-equiv="refresh" content="0;url=https://evil.example"><base href="https://evil.example/">');
    expect(out).not.toContain("<meta");
    expect(out).not.toContain("<base");
  });

  it("lascia intatto l'HTML editoriale normale", () => {
    const html =
      '<h2>Implied probability</h2><p>Divide 1 by the <strong>decimal odds</strong>.</p>' +
      '<ul><li>2.00 = 50%</li></ul><img src="https://xyz.supabase.co/storage/v1/object/public/blog-images/g/f.webp" alt="chart">' +
      '<a href="https://www.betredge.com/predictions">board</a><blockquote>q</blockquote>';
    expect(sanitizeBlogHtml(html)).toBe(html);
  });
});

describe("metaTitleOf", () => {
  it("normalizza le em-dash del titolo Soro nel metaTitle (regola #SEO-PACK-0810)", () => {
    expect(metaTitleOf("Betting Odds — A Guide")).toBe("Betting Odds: A Guide");
    expect(metaTitleOf("Plain Title")).toBe("Plain Title");
  });
});

describe("formatPostDate", () => {
  it("formatta en-GB e regge null/garbage senza lanciare", () => {
    expect(formatPostDate("2026-08-13T09:52:04.000Z")).toBe("13 August 2026");
    expect(formatPostDate(null)).toBe("");
    expect(formatPostDate("not-a-date")).toBe("");
  });
});
