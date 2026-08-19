// app/lp/odds-converter/page.test.tsx — #CH01-LP-CLEAN-0819
//
// Questo test difende l'unica proprietà per cui la pagina esiste: essere pulita.
// Non è un test di stile — è il gate della decisione P0 (b). Se domani qualcuno
// monta `SiteFooter` "per coerenza col resto del sito", la pagina torna a mostrare
// 18+, GamCare/BeGambleAware e i loghi partner, e la landing non regge più il
// framing con cui è stata comprata la campagna. Meglio scoprirlo qui che da una
// sospensione dell'account ads.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// next/link fuori da un router App non si monta: lo sostituiamo con un <a>, così
// l'asserzione sull'href resta vera e verificabile.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import Page, { metadata, LP_COPY, landerToolCopy } from "./page";

// Vocabolario vietato su QUESTA pagina. Non è una lista di parole brutte: è
// l'elenco di ciò che dichiara "questa superficie è gambling". `\b` serve perché
// il brand stesso contiene "bet" — "BetRedge" deve restare lecito.
const FORBIDDEN: Array<[string, RegExp]> = [
  ["bookmaker", /bookmaker/i],
  ["betting", /\bbetting\b/i],
  ["bet / bets", /\bbets?\b/i],
  ["wager", /\bwager/i],
  ["gambling", /gambl/i],
  ["casino", /casino/i],
  ["bonus", /\bbonus/i],
  ["stake", /\bstake/i],
  ["18+", /18\+/],
  ["GamCare", /gamcare/i],
  ["BeGambleAware", /begambleaware/i],
  ["responsible gaming", /responsible/i],
];

describe("landing /lp/odds-converter — pulita per costruzione", () => {
  it("è fuori dall'indice ma resta seguibile", () => {
    // noindex: non deve competere con /tools. follow: i link interni puntano a
    // pagine già indicizzate. Un Disallow in robots.txt sarebbe invece un errore
    // (Google non potrebbe leggere la pagina per la review dell'annuncio).
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it.each(FORBIDDEN)("il markup renderizzato non contiene %s", (_label, re) => {
    const { container } = render(<Page />);
    expect(container.innerHTML).not.toMatch(re);
  });

  it.each(FORBIDDEN)("title e description non contengono %s", (_label, re) => {
    expect(String(metadata.title)).not.toMatch(re);
    expect(String(metadata.description)).not.toMatch(re);
  });

  it("non linka /partners e non monta il footer del sito", () => {
    const { container } = render(<Page />);
    expect(container.querySelector('a[href="/partners"]')).toBeNull();
    expect(container.querySelector(".site-footer-partners")).toBeNull();
    // Struttura: il modo più probabile di regredire è un import "di coerenza".
    // Si cercano import e JSX, non la parola: i commenti della pagina NOMINANO
    // SiteFooter proprio per spiegare perché non c'è.
    const src = readFileSync(join(process.cwd(), "app/lp/odds-converter/page.tsx"), "utf8");
    expect(src).not.toMatch(/import[^;]*Site(Footer|Topbar)/);
    expect(src).not.toMatch(/<Site(Footer|Topbar)/);
  });

  it("la CTA porta al form di registrazione già strumentato", () => {
    // Deep-link ?auth=register gestito dal desk (app/app/page.tsx): si riusa il
    // funnel esistente invece di costruire un secondo form di signup, che
    // divergerebbe dagli eventi con cui si misura il CPA dell'esperimento.
    render(<Page />);
    const cta = screen.getByRole("link", { name: LP_COPY.ctaButton });
    expect(cta).toHaveAttribute("href", "/app?auth=register");
  });

  it("il calcolatore c'è e converte davvero", async () => {
    // Senza questo, "pulita" sarebbe soddisfatta anche da una pagina vuota.
    render(<Page />);
    const input = screen.getByLabelText("Odds");
    await userEvent.clear(input);
    await userEvent.type(input, "2.50");
    // 1 / 2.50 = 40%. Stessi testId del test dei calcolatori: se cambiano lì,
    // questo si rompe insieme, che è il comportamento giusto.
    expect(screen.getByTestId("out-implied").textContent).toBe("40.00%");
    expect(screen.getByTestId("out-american").textContent).toBe("+150");
  });
});

// Il buco che jsdom non vedeva: `OddsConverter` è tipizzato sull'intero ToolCopy e
// passargli l'oggetto vero lo serializza nel payload RSC, quindi dentro l'HTML.
// Con la copy del tool ci finivano "bookmaker" e "stake" (metaDescription,
// explainer, FAQ). Qui si verifica l'OGGETTO, che è ciò che viene serializzato.
describe("l'oggetto passato al calcolatore non porta prosa nel payload", () => {
  it.each(FORBIDDEN)("nessun valore serializzato contiene %s", (_label, re) => {
    expect(JSON.stringify(landerToolCopy())).not.toMatch(re);
  });

  it("le etichette che servono al render ci sono ancora", () => {
    const c = landerToolCopy();
    expect(c.labels.oddsInput).toBe("Odds");
    expect(c.labels.impliedProbability).toBe("Implied probability");
    expect(c.labels.decimal).toBe("Decimal");
    // e la prosa è davvero vuota, non "accorciata"
    expect(c.explainer).toEqual([]);
    expect(c.faq).toEqual([]);
    expect(c.metaDescription).toBe("");
  });
});
