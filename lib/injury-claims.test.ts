import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_FAQ } from "./home-faq";
import { faqJsonLd } from "@/components/seo/json-ld";

// #CLAIM-INFORTUNI-0210 — il sito non promette gli infortuni.
//
// Oggi non esiste una fonte di infortuni per la stagione in corso (ESPN torna
// elenchi vuoti; la chiave API-Football non vede la stagione). Decisione di
// Andrea del 02/10: claim onesto ora, fonte vera più avanti. Quindi nessun testo
// pubblico — FAQ e il suo JSON-LD, landing, piani, mail CRM, pagine SEO — vende
// gli infortuni come ingrediente. Dove il dato c'è davvero, lo si mostra (Weekly
// Model Case, World Cup): quelle pagine NON sono in questa lista.
//
// QUANDO SI PUÒ RIMETTERE: quando una fonte di infortuni copre la stagione in
// corso e arriva in `enrichment.injuries_*` per una quota dichiarabile delle
// partite. Allora si toglie il file dalla lista, non si allarga la whitelist.

const ROOT = join(__dirname, "..");
const ROOTS = /injur|infortun|lesion|blessur|травм/i;

/** Stesso spogliamento grezzo di landing-claims.test.ts: le note parlano del
 *  claim e non devono far scattare la guardia. */
function senzaCommenti(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((r) => {
      const i = r.indexOf("//");
      return i === -1 ? r : r.slice(0, i);
    })
    .join("\n");
}

/** Nomi tecnici (campi del payload, funzioni, glifi): non sono testo per
 *  l'utente. Lista esplicita — una parola nuova qui va giustificata. */
const TECNICI =
  /\b(injuries_home|injuries_away|injHome|injAway|injured_count|is_injured|injury_changes|GlyphInjury|fetchInjuries|ApiFootballInjuries)\b/g;

const SUPERFICI = [
  "lib/home-faq.ts",
  "app/landing-client.tsx",
  "app/app/page.tsx",
  "components/MatchDetailSheet.tsx",
  "lib/crm-content.ts",
  "lib/email.ts",
  "app/llms.txt/route.ts",
  "app/layout.tsx",
  "app/page.tsx",
  "app/plans/page.tsx",
  "app/how-it-works/page.tsx",
  "app/ai-football-predictions/page.tsx",
];

describe("superfici pubbliche: nessuna promessa di infortuni", () => {
  it.each(SUPERFICI)("%s non nomina gli infortuni", (rel) => {
    const codice = senzaCommenti(readFileSync(join(ROOT, rel), "utf8")).replace(TECNICI, "");
    const righe = codice.split("\n").filter((r) => ROOTS.test(r));
    expect(righe).toEqual([]);
  });

  it("FAQ in ogni lingua e il JSON-LD che ne deriva", () => {
    for (const [lang, items] of Object.entries(HOME_FAQ)) {
      const ld = JSON.stringify(faqJsonLd(items.map(([q, a]) => [q, a]), lang));
      expect(ld, lang).not.toMatch(ROOTS);
    }
  });
});
