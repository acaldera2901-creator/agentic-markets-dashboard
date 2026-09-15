import { describe, it, expect } from "vitest";
import {
  planActivatedEmail,
  welcomeEmail,
  weeklyPickReceiptEmail,
  cancellationEmail,
  winBackEmail,
  activationEmail,
} from "./email";
import { sourceFromSearch } from "./attribution";

// #ATTRIB-EVERYWHERE-0915 — le CTA delle email del ciclo di vita mandavano a
// `/app`, `/plans` e `/weekly-pick` senza alcun marcatore. Chi tornava e si
// riattivava era indistinguibile da chi aveva digitato l'indirizzo, e l'email
// win-back — che esiste SOLO per riportare indietro chi e' scaduto — non poteva
// dimostrare di funzionare.

const searchOf = (url: string) => new URL(url).search;
const firstLink = (html: string): string => {
  const m = html.match(/href="(https?:\/\/[^"]*\/(?:app|plans|weekly-pick)[^"]*)"/);
  if (!m) throw new Error("nessuna CTA verso il sito trovata");
  return m[1];
};

const CASES: { nome: string; build: () => { html: string; text: string }; tag: string; path: string }[] = [
  { nome: "attivazione piano", build: () => planActivatedEmail(null, "it"), tag: "mail-activated", path: "/app" },
  { nome: "benvenuto", build: () => welcomeEmail("it"), tag: "mail-welcome", path: "/app" },
  { nome: "ricevuta weekly pick", build: () => weeklyPickReceiptEmail(500, "eur", "2026-09-15", "it"), tag: "mail-wp-receipt", path: "/weekly-pick" },
  { nome: "disdetta", build: () => cancellationEmail("it"), tag: "mail-cancel", path: "/plans" },
  { nome: "win-back", build: () => winBackEmail("it"), tag: "mail-winback", path: "/plans" },
];

describe("le CTA delle email dicono da quale email arrivano", () => {
  for (const c of CASES) {
    it(`${c.nome} → src=${c.tag}`, () => {
      const { html, text } = c.build();
      const url = firstLink(html);
      expect(new URL(url).pathname).toBe(c.path);
      expect(sourceFromSearch(searchOf(url))).toEqual({ src: c.tag });
      // Il link della versione testo deve portare lo stesso tag: molti client
      // mostrano quella, e un canale misurato a meta' e' peggio di uno non misurato.
      expect(text).toContain(`src=${c.tag}`);
    });
  }

  it("ogni email ha un tag diverso: servono a distinguersi, non a contarsi insieme", () => {
    const tags = CASES.map((c) => c.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  // I tag passano dalla stessa sanificazione dei parametri in arrivo: se un tag
  // contenesse un carattere che sourceFromSearch scarta, arriverebbe mutilato.
  it("i tag sopravvivono interi alla sanificazione all'atterraggio", () => {
    for (const c of CASES) expect(sourceFromSearch(`?src=${c.tag}`).src).toBe(c.tag);
  });

  // I link con token sono one-shot e non sono un canale: si lasciano intatti,
  // anche perche' un parametro in piu' su un link di sicurezza e' rumore.
  it("il link di attivazione con token NON viene marcato", () => {
    const { html } = activationEmail("https://betredge.com/api/auth/activate?t=TOKEN123", "it");
    expect(html).toContain("t=TOKEN123");
    expect(html).not.toContain("src=mail-");
  });
});
