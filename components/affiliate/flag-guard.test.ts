// components/affiliate/flag-guard.test.ts — #AFFILIATE-V2-UI-1015
// Test guardia: con NEXT_PUBLIC_AFFILIATE_V2 spento il comportamento attuale non
// cambia di un pixel. Si verifica sul sorgente che (1) i componenti v2 entrano solo
// via `lazy` sotto il confronto per esteso (così a flag spento il bundler toglie
// import e CSS), (2) ReferralPanel resta il ramo di default, (3) l'admin a flag
// spento ha le stesse quattro sezioni, (4) nessun altro file importa i componenti.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("flag NEXT_PUBLIC_AFFILIATE_V2", () => {
  const desk = read("app/app/page.tsx");
  const admin = read("app/admin/page.tsx");

  it("desk: lazy sotto il confronto per esteso, nessun import statico", () => {
    expect(desk).toMatch(/process\.env\.NEXT_PUBLIC_AFFILIATE_V2 === "1"\s*\n?\s*\? lazy\(\(\) => import\("@\/components\/affiliate\/AffiliateSection"\)/);
    expect(desk).not.toMatch(/^import .* from "@\/components\/affiliate/m);
    // #CLASSIC-RELEASE-1016: the second read is the `v2` prop of ClassicInvite, inside the classic branch only
    expect((desk.match(/NEXT_PUBLIC_AFFILIATE_V2 === "1"/g) ?? []).length).toBe(2);
  });

  it("desk: a flag spento il ramo è ReferralPanel, identico a prima", () => {
    // #CLASSIC-RELEASE-1016: same branch, now the `else` of the classic build flag
    expect(desk).toMatch(/\{tab === "invita" && \(process\.env\.NEXT_PUBLIC_CLASSIC === "1" \? \([\s\S]*?\) : AffiliateSection \? \(\s*<Suspense fallback=\{null\}><AffiliateSection lang=\{uiLanguage\} \/><\/Suspense>\s*\) : <ReferralPanel \/>\)\}/);
  });

  it("admin: lazy sotto il confronto per esteso; a flag spento le sezioni sono le 4 di prima", () => {
    expect(admin).toMatch(/process\.env\.NEXT_PUBLIC_AFFILIATE_V2 === "1"\s*\n?\s*\? lazy\(\(\) => import\("@\/components\/affiliate\/AdminPayouts"\)/);
    expect(admin).not.toMatch(/^import .* from "@\/components\/affiliate/m);
    expect(admin).toMatch(/\.\.\.\(AdminPayouts \? \(\["payouts"\] as const\) : \[\]\)/);
    expect(admin).toMatch(/\(\["overview", "profiles", "events", "notifications"\] as const\)/);
    // unico ritocco alla nav esistente (approvato): scorrimento orizzontale, nessun overflow di pagina
    expect(admin).toMatch(/<nav className="border-b border-gray-800 px-6 flex gap-1 overflow-x-auto">/);
  });

  it("nessun altro modulo importa i componenti affiliate (a parte i loro test)", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const n of readdirSync(join(root, dir))) {
        if (n === "node_modules" || n === ".next" || n.startsWith(".")) continue;
        const rel = join(dir, n);
        const st = statSync(join(root, rel));
        if (st.isDirectory()) { if (["app", "components", "lib", "features"].includes(dir.split("/")[0]) || dir === "") walk(rel); }
        else if (/\.(tsx?|css)$/.test(n) && !rel.startsWith("components/affiliate/") && /@\/components\/affiliate/.test(readFileSync(join(root, rel), "utf8"))) hits.push(rel);
      }
    };
    for (const d of ["app", "components", "lib", "features"]) walk(d);
    expect(hits.sort()).toEqual(["app/admin/page.tsx", "app/app/page.tsx"]);
  });

  it("il foglio affiliate non tocca selettori fuori dal proprio prefisso", () => {
    const css = read("components/affiliate/affiliate.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = css.split("}").map((blk) => blk.split("{")[0].trim()).filter((x) => x && !x.startsWith("@") && !/^(from|to|\d+%)/.test(x));
    const bad = rules.filter((sel) => !sel.includes(".aff-"));
    expect(bad).toEqual([]);
  });

  it("solo token --am-*: nessun colore letterale nel foglio", () => {
    const css = read("components/affiliate/affiliate.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/rgba?\(/);
  });
});
