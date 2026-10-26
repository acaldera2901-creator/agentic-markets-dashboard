import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// #SHOPIFY-NO-BILLER-0911 — il checkout non promette un rinnovo che nessuno esegue.
//
// LA PREMESSA, MISURATA. Su Shopify un subscription contract NON si addebita da
// solo: la piattaforma lo crea al checkout e poi si ferma. Il ciclo successivo
// parte solo se un'app chiama `subscriptionBillingAttemptCreate` sul contratto.
// Nel repo quella chiamata NON esiste (zero occorrenze, asserito qui sotto), e i
// selling plan 692497973585/692498071889 appartengono a un'app custom che ha
// solo `read_products,write_products`. Quindi a rail carta l'accesso scade e
// basta, esattamente come un one-off.
//
// IL DANNO GIA' AVVENUTO. Ordine #1002 del 25/07/2026 ($14.99, carta): mai
// riaddebitato il 24/08, decaduto in silenzio dopo tre email che gli dicevano
// che il piano si rinnovava da solo. PR #397 ha corretto la copy CRM
// (`lib/crm-content.ts`); questa guardia copre la superficie a monte, cioe' la
// PAGINA DI VENDITA, dove la stessa promessa e' quella che incassa i soldi.
//
// QUANDO SI PUO' RIMETTERE. Solo dopo che un biller reale (app nativa Shopify
// Subscriptions o equivalente) possiede i selling plan ED e' stato verificato un
// secondo ciclo addebitato davvero. Non prima, e non "quando l'app e' installata":
// installata non e' addebitante. A quel punto questa guardia va aggiornata
// insieme a `renewalClause()` in `lib/crm-content.ts`, che dipende dalla stessa
// premessa.

const ROOT = join(__dirname, "..");

/** Il sorgente senza commenti: le note come QUESTA parlano della promessa, e non
 *  devono far scattare la guardia che cerca la promessa. Lo spogliamento e'
 *  grezzo (puo' troncare un "https://" dentro una stringa) e va benissimo:
 *  serve a cercare delle frasi di copy, non a ricompilare il file. */
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

// Le superfici che portano la copy di checkout/prezzi vista dal cliente.
// `app/terms/page.tsx` NON e' in lista di proposito: e' il testo legale, si
// cambia con il legale e non con un fix di copy.
const SUPERFICI = ["app/app/page.tsx"];

// La promessa, in tutte e cinque le lingue del prodotto. Sono le stringhe
// affermative: "non si rinnova" / "no auto-renewal" restano legittime e infatti
// non contengono nessuna di queste.
const PROMESSE: Array<[string, RegExp]> = [
  ["it", /si rinnova automaticamente|rinnovo automatico(?!\s*[.:]?\s*$)/i],
  ["en", /renews? automatically|auto-renewing/i],
  ["es", /se renueva autom|renovación automática/i],
  ["fr", /renouvellement automatique|se renouvelle automatiquement/i],
  ["ru", /продлевается автоматически|автопродление/i],
];

// Le negazioni legittime: la guardia non deve vietare di DIRE che non si
// rinnova. Si toglie la negazione dal testo prima di cercare l'affermazione.
// NB niente `\b` sulle forme cirilliche: in JS `\b` e' definito su `\w` ASCII,
// quindi davanti a "не" non c'e' nessun confine e la regola non scatterebbe mai.
function senzaNegazioni(src: string): string {
  return src
    .replace(/(?:non|senza|nessun[oa]?)\s+(?:c'è\s+)?(?:un\s+)?rinnovo automatico/gi, "")
    .replace(/(?:non|nessuno dei due)\s+si rinnova(?:no)? automaticamente/gi, "")
    .replace(/n(?:o|ot|either is) auto-renewing/gi, "")
    .replace(/no auto-renewal/gi, "")
    .replace(/(?:sin|no se) renovación automática/gi, "")
    .replace(/(?:ninguno de los dos|no) se renueva autom\w*/gi, "")
    .replace(/(?:sans|aucun) renouvellement automatique/gi, "")
    .replace(/ne se renouvelle automatiquement/gi, "")
    .replace(/без автопродления/gi, "")
    .replace(/не продлевается автоматически/gi, "");
}

describe("#SHOPIFY-NO-BILLER-0911 la premessa che regge la copy", () => {
  it("nessuno chiama subscriptionBillingAttemptCreate: il rinnovo non esiste", () => {
    // Se questo test inizia a fallire, un biller e' comparso: NON silenziarlo.
    // Vai a rileggere il blocco "QUANDO SI PUO' RIMETTERE" in cima al file e
    // rimetti la copy di rinnovo, qui e in lib/crm-content.ts, insieme.
    const sorgenti: string[] = [];
    const scendi = (dir: string) => {
      for (const voce of readdirSync(dir)) {
        if (voce === "node_modules" || voce === ".next" || voce === ".git" || voce === "venv") continue;
        const p = join(dir, voce);
        if (statSync(p).isDirectory()) scendi(p);
        else if (/\.(ts|tsx|js|mjs)$/.test(voce) && p !== __filename) sorgenti.push(p);
      }
    };
    scendi(ROOT);
    // Senza commenti: le note che SPIEGANO perche' la chiamata manca (ce n'e'
    // una in app/app/page.tsx) nominano la funzione, e non sono un biller.
    const colpevoli = sorgenti.filter((p) =>
      senzaCommenti(readFileSync(p, "utf8")).includes("subscriptionBillingAttemptCreate")
    );
    expect(colpevoli, "un biller e' comparso: rileggi l'intestazione di questo file").toEqual([]);
  });
});

describe("#SHOPIFY-NO-BILLER-0911 la pagina di vendita non promette il rinnovo", () => {
  it.each(SUPERFICI)("%s: nessuna promessa di rinnovo automatico, in nessuna lingua", (rel) => {
    const codice = senzaNegazioni(senzaCommenti(readFileSync(join(ROOT, rel), "utf8")));
    for (const [lang, promessa] of PROMESSE) {
      expect(promessa.test(codice), `${rel} promette il rinnovo automatico in ${lang}`).toBe(false);
    }
  });

  it("il rail carta dichiara al cliente che alla scadenza rinnova lui", () => {
    // Non basta togliere la bugia: chi paga con carta deve sapere che l'accesso
    // finisce. Il silenzio produrrebbe la stessa decadenza muta dell'ordine #1002.
    const src = readFileSync(join(ROOT, "app/app/page.tsx"), "utf8");
    expect(src).toMatch(/nessun addebito automatico/i);
    expect(src).toMatch(/no automatic charge/i);
  });

  it("il pannello profilo non dice 'rinnovo mensile' sopra un bottone manuale", () => {
    // E' il punto dove il cliente vede il conto alla rovescia: una riga che
    // suggerisce l'automatismo proprio li' e' quella che gli fa NON premere il
    // bottone "Rinnova" che ha di fianco.
    const src = senzaCommenti(readFileSync(join(ROOT, "app/app/page.tsx"), "utf8"));
    for (const bugia of ["rinnovo mensile", "monthly renewal", "renovación mensual", "renouvellement mensuel", "ежемесячное продление"]) {
      expect(src, `il pannello profilo promette ancora: ${bugia}`).not.toContain(bugia);
    }
  });

  it("la copy crypto resta quella vera: pagamento singolo che non si rinnova", () => {
    const src = readFileSync(join(ROOT, "app/app/page.tsx"), "utf8");
    expect(src).toContain("Crypto: pagamento singolo da 30 giorni, non si rinnova.");
  });
});
