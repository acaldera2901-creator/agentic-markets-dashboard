import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchDetailSheet, type MdsData } from "@/components/MatchDetailSheet";
import { sortBooksForMenu } from "@/lib/partners";

// #BET-DROPDOWN-1: la bet-bar non impila più una CTA per book — una sola CTA
// apre il menu dei partner. Qui si verifica il comportamento del menu, non il
// layout: apertura/chiusura, link affiliati sicuri, e il gate a 0 selezioni.

const LABELS: MdsData["labels"] = {
  schedina: "La tua schedina",
  quotaComb: "quota combinata",
  quotaOne: "quota",
  touch: "tocca i mercati",
  apri: "Apri su FortunePlay",
  apriMulti: "Apri la multipla su FortunePlay",
  openBook: "Apri su {book}",
  placeBet: "Piazza la scommessa",
  disc: "disclaimer",
  side: "nota",
  selOne: "1 selezione",
  selMany: "{n} selezioni",
};

const BOOKS = [
  { name: "FortunePlay", matchUrl: "https://www.fortuneplay.com/it/sports/football/x-m-1?stag=abc" },
  { name: "YBets", matchUrl: "https://ybetspromo.io/dputempxc" },
  { name: "BetScore", matchUrl: "https://bsr.lynmonkel.com/?mid=381903_2215092" },
  { name: "FeliceBet", matchUrl: "https://go.bluewinpartners.com/visit/?bta=2961065&nci=5732" },
];

function makeData(over: Partial<MdsData> = {}): MdsData {
  return {
    league: "Serie A",
    when: "Fri 31 Jul, 13:35",
    home: "Henan",
    away: "Dalian Yingbo",
    hero: { flag: "La nostra prediction", pick: "Henan vince", read: "53% modello", confDots: 1, quotaLabel: "Quota FortunePlay", quota: "1.73", value: null },
    groups: [
      {
        key: "result",
        icon: "result",
        title: "Risultato",
        chips: [{ id: "home", mkt: "1X2", sel: "Henan", prob: "53%", q: 1.73, rec: true }],
      },
    ],
    matchUrl: "https://www.fortuneplay.com/it/sports/football/x-m-1?stag=abc",
    books: BOOKS,
    labels: LABELS,
    ...over,
  };
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /Piazza la scommessa/ }));
}

// #NO-FP-BADGE-0916 — Andrea: via il nome del book dalle righe mercato. Una
// riga con prezzo non porta più alcuna targhetta; "solo modello" (ambra) resta,
// perché spiega perché quella riga NON ha un prezzo accanto.
describe("MatchDetailSheet — nessuna targhetta col nome del book", () => {
  it("una riga quotata non mostra nessuna pill di sorgente", () => {
    const { container } = render(<MatchDetailSheet data={makeData()} />);
    expect(container.querySelector(".mds-src")).toBeNull();
    expect(container.querySelector(".mds-grph")?.textContent).not.toMatch(/fortuneplay/i);
  });

  it("la targhetta «solo modello» resta dov'era", () => {
    const { container } = render(<MatchDetailSheet data={makeData({
      groups: [{
        key: "result", icon: "result", title: "Risultato",
        src: { kind: "est", label: "solo modello" },
        chips: [{ id: "home", mkt: "1X2", sel: "Henan", prob: "53%", q: null }],
      }],
    })} />);
    const pill = container.querySelector(".mds-src");
    expect(pill?.className).toContain("est");
    expect(pill?.textContent).toBe("solo modello");
  });
});

describe("MatchDetailSheet — menu partner (#BET-DROPDOWN-1)", () => {
  it("mostra UNA sola CTA, non una per partner", () => {
    render(<MatchDetailSheet data={makeData()} />);
    expect(screen.getByRole("button", { name: /Piazza la scommessa/ })).toBeTruthy();
    // le vecchie CTA "Apri su {book}" non esistono più
    expect(screen.queryByText("Apri su YBets")).toBeNull();
    expect(screen.queryByText("Apri su BetScore")).toBeNull();
  });

  it("il menu è chiuso finché non lo si apre", () => {
    render(<MatchDetailSheet data={makeData()} />);
    expect(screen.queryByRole("menu")).toBeNull();
    openMenu();
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  // #BET-MENU-ORDER: l'ordine NON è più quello d'arrivo (era `BOOKS.map(name)`) ma
  // quello deciso da Andrea in lib/partners → il menu non dipende più da come le
  // due fonti (BetConstruct + solo-landing) impilano i book.
  it("aperto, elenca tutti i partner con link affiliato sicuro, nell'ordine deciso", () => {
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const items = screen.getAllByRole("menuitem") as HTMLAnchorElement[];
    const atteso = sortBooksForMenu(BOOKS);
    expect(items.map((a) => a.textContent?.trim())).toEqual(atteso.map((b) => b.name));
    // ...e ogni voce porta il link del SUO partner, non quello del vicino
    for (const [i, a] of items.entries()) {
      expect(a.getAttribute("href")).toBe(atteso[i].matchUrl);
      expect(a.getAttribute("target")).toBe("_blank");
      const rel = a.getAttribute("rel") || "";
      for (const token of ["nofollow", "sponsored", "noopener", "noreferrer"]) {
        expect(rel).toContain(token);
      }
    }
  });

  // Il caso che conta davvero: gli 8 partner veri, consegnati nell'ordine in cui li
  // impilano le fonti, più Casea che non è nell'ordine e deve finire in coda.
  it("cogli 8 partner reali esce l'ordine di Andrea, Casea (geo-ristretta) in coda", () => {
    const arrivo = [
      { name: "FortunePlay", matchUrl: "https://fp.example/x" },
      { name: "YBets", matchUrl: "https://ybetspromo.io/dputempxc" },
      { name: "BetScore", matchUrl: "https://bsr.lynmonkel.com/?mid=381903_2215092" },
      { name: "FeliceBet", matchUrl: "https://go.bluewinpartners.com/visit/?bta=2961065&nci=5732" },
      { name: "VeloBet", matchUrl: "https://track.velobetpartners.com/visit/?bta=42786&nci=6119" },
      { name: "GG.BET", matchUrl: "https://ggbetbestoffer.com/l/6a6ca2b84d683c219008f152?sub_id=betredge" },
      // #PARTNER-WILDZ-BEAZT: arrivano dopo GG.BET da landingPartnersFor e restano
      // in coda anche nell'ordine di render (atterrano sulla lobby, non sul prematch).
      { name: "Beazt", matchUrl: "https://go.wildzaffiliates.com/visit/?bta=1000385&nci=6056" },
      { name: "Wildz", matchUrl: "https://go.wildzaffiliates.com/visit/?bta=1000385&nci=5345&utm_campaign=betredge" },
      { name: "Casea", matchUrl: "https://csa.lynmonkel.com/?mid=383451_2222324" },
    ];
    render(<MatchDetailSheet data={makeData({ books: arrivo })} />);
    openMenu();
    const items = screen.getAllByRole("menuitem") as HTMLAnchorElement[];
    expect(items.map((a) => a.textContent?.trim()))
      .toEqual(["FortunePlay", "BetScore", "VeloBet", "FeliceBet", "GG.BET", "YBets", "Beazt", "Wildz", "Casea"]);
    // ogni voce apre il link del suo partner, non quello del vicino
    expect(items.find((a) => a.textContent?.trim() === "Wildz")?.getAttribute("href"))
      .toBe("https://go.wildzaffiliates.com/visit/?bta=1000385&nci=5345&utm_campaign=betredge");
    // e ha il suo logo (partnerLogoByName risolve per nome: un typo qui è una voce muta)
    expect(items.find((a) => a.textContent?.trim() === "Beazt")?.querySelector("img")?.getAttribute("src"))
      .toBe("/logos/beazt.svg");
  });

  it("Escape chiude il menu", () => {
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  // #BETSLIP-CTA-ON-0831 — requisito CAMBIATO su indicazione di Andrea: «quel
  // bottone deve rimanere acceso sempre». Prima la CTA era disabilitata a
  // schedina vuota e bisognava toccare un mercato per accenderla. Ora e' sempre
  // attiva: con 0 selezioni il partner apre la pagina del match e la selezione
  // la si fa la'. Questi due test sorvegliavano il gate; ora sorvegliano che il
  // gate NON torni.
  it("senza selezioni la CTA è attiva e il menu si apre", () => {
    // nessuna chip `rec` → schedina vuota all'apertura della scheda
    const data = makeData({
      groups: [
        {
          key: "result",
          icon: "result",
          title: "Risultato",
            chips: [{ id: "home", mkt: "1X2", sel: "Henan", prob: "53%", q: 1.73 }],
        },
      ],
    });
    render(<MatchDetailSheet data={data} />);
    const cta = screen.getByRole("button", { name: /Piazza la scommessa/ }) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
    expect(cta.className).not.toContain("disabled");
    fireEvent.click(cta);
    expect(screen.getByRole("menu")).toBeTruthy();
    // e i link portano comunque al match dal partner scelto
    const links = screen.getAllByRole("menuitem") as HTMLAnchorElement[];
    expect(links.length).toBe(BOOKS.length);
    expect(links[0].getAttribute("href")).toBeTruthy();
  });

  it("svuotare la schedina NON chiude il menu: zero selezioni è uno stato valido", () => {
    // Prima il menu era derivato da (stato aperto && legs > 0), quindi togliere
    // l'unica selezione lo faceva sparire. Con la CTA sempre accesa quello
    // diventerebbe un bottone che si spegne da solo sotto il dito.
    // fireEvent.click non emette mousedown → non è il click-fuori a chiuderlo.
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.click(screen.getByText("Henan").closest("button") as HTMLButtonElement);
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("con un solo partner resta il link diretto, senza menu", () => {
    render(<MatchDetailSheet data={makeData({ books: [BOOKS[0]] })} />);
    expect(screen.queryByRole("button", { name: /Piazza la scommessa/ })).toBeNull();
    const cta = screen.getByText(/Apri su FortunePlay/).closest("a") as HTMLAnchorElement;
    expect(cta.getAttribute("href")).toBe(BOOKS[0].matchUrl);
  });

  // #BET-MENU-CLIP-0916 — il menu viveva dentro la bet-bar, che sta dentro due
  // contenitori che ritagliano (`.pdm-body` overflow-y:auto, `.pdm-panel`
  // overflow:hidden): su una scheda "solo modello" si apriva verso l'alto e
  // usciva dal pannello, tagliato. Ora è in un portal su `document.body`.
  it("il menu è montato fuori dalla scheda (portal), non dentro la bet-bar", () => {
    const { container } = render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const menu = screen.getByRole("menu");
    expect(container.contains(menu)).toBe(false); // niente antenato che ritaglia
    expect(menu.closest(".mds-betbar")).toBeNull();
    expect(document.body.contains(menu)).toBe(true);
    // ...e si posiziona da sé sul rect del bottone (la regola `position:fixed`
    // sta in globals.css, che jsdom non carica: qui si verifica che il
    // componente CALCOLI davvero le coordinate, non che le disegni).
    expect(menu.style.left).not.toBe("");
    expect(menu.style.top).not.toBe("");
    expect(menu.style.maxHeight).not.toBe("");
    expect(menu.style.visibility).toBe("visible");
  });

  // Il portal sposta il menu FUORI dal ref che sorveglia il click-fuori: senza
  // il secondo controllo, il mousedown su una voce lo chiuderebbe prima del
  // click e il link affiliato non si aprirebbe più.
  it("il mousedown su una voce NON chiude il menu prima del click", () => {
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const voce = screen.getByText("FortunePlay").closest("a") as HTMLAnchorElement;
    fireEvent.mouseDown(voce);
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByText("FortunePlay")).toBeTruthy();
  });

  it("un mousedown davvero fuori chiude il menu", () => {
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("hideBookLinks (geo bloccata) nasconde CTA e menu", () => {
    render(<MatchDetailSheet data={makeData()} hideBookLinks />);
    expect(screen.queryByRole("button", { name: /Piazza la scommessa/ })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

// #BET-MENU-VV-0916 — su Safari iOS la toolbar dinamica accorcia il viewport
// VISIBILE senza toccare `window.innerHeight`. Un menu ancorato a `innerHeight`
// finisce sotto la piega e perde le ultime voci senza che nulla lo segnali.
// Qui si misura l'invariante che regge tutti i casi: il menu non esce MAI dalla
// banda visibile, qualunque cosa faccia il rect dell'ancora.
describe("MatchDetailSheet — il menu resta dentro il viewport visibile", () => {
  const MENU_H = 464;   // 13 voci: la misura reale che il giro #BET-MENU-CLIP-0916 ha visto tagliata
  const MENU_W = 194;   // min-width di .mds-bmenu
  const MARGIN = 8;     // VIEWPORT_MARGIN nel componente
  const restore: Array<() => void> = [];

  // jsdom non fa layout: rect, scrollHeight e offsetWidth valgono 0. Li si
  // fornisce qui, distinguendo ancora e menu dalla loro classe.
  function stubLayout(anchor: { top: number; height: number; right: number }) {
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (!this.classList.contains("mds-books")) return new DOMRect(0, 0, 0, 0);
        return new DOMRect(anchor.right - 160, anchor.top, 160, anchor.height);
      });
    restore.push(() => rect.mockRestore());
    for (const [prop, value] of [["scrollHeight", MENU_H], ["offsetWidth", MENU_W]] as const) {
      const prev = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        get(this: HTMLElement) { return this.classList.contains("mds-bmenu") ? value : 0; },
      });
      restore.push(() => { if (prev) Object.defineProperty(HTMLElement.prototype, prop, prev); });
    }
  }

  function stubViewport(visibleHeight: number, layoutHeight: number) {
    const vv = { height: visibleHeight, width: 390, offsetTop: 0, offsetLeft: 0,
      addEventListener: () => {}, removeEventListener: () => {} };
    const prev = Object.getOwnPropertyDescriptor(window, "visualViewport");
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    restore.push(() => { if (prev) Object.defineProperty(window, "visualViewport", prev); });
    const w = window as unknown as { innerHeight: number; innerWidth: number };
    const prevH = w.innerHeight, prevW = w.innerWidth;
    w.innerHeight = layoutHeight; w.innerWidth = 390;
    restore.push(() => { w.innerHeight = prevH; w.innerWidth = prevW; });
  }

  afterEach(() => { while (restore.length) restore.pop()!(); });

  const bounds = () => {
    const menu = screen.getByRole("menu");
    const top = parseFloat(menu.style.top);
    const maxHeight = parseFloat(menu.style.maxHeight);
    return { top, maxHeight, bottom: top + Math.min(MENU_H, maxHeight) };
  };

  // Il caso della segnalazione: toolbar mostrata, visibile 480 su un layout di
  // 844. L'ancora (bet-bar sticky) sta a 780 — dentro il layout, SOTTO la piega.
  it("con la toolbar iOS mostrata il menu non finisce sotto la piega", () => {
    stubViewport(480, 844);
    stubLayout({ top: 780, height: 44, right: 382 });
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const b = bounds();
    expect(b.top).toBeGreaterThanOrEqual(MARGIN);
    expect(b.bottom).toBeLessThanOrEqual(480 - MARGIN);
  });

  // Banda visibile corta e ancora dentro: prima il menu si ribaltava verso il
  // basso (`spaceBelow` calcolato su innerHeight = 545px di spazio inesistente)
  // e spariva del tutto. Ora resta sopra, capato, e i partner si raggiungono
  // scorrendo dentro il menu.
  it("su una banda corta il menu si cappa invece di ribaltarsi nel vuoto", () => {
    stubViewport(300, 844);
    stubLayout({ top: 240, height: 44, right: 382 });
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const b = bounds();
    expect(b.top).toBeGreaterThanOrEqual(MARGIN);
    expect(b.bottom).toBeLessThanOrEqual(300 - MARGIN);
    // capato, non troncato: l'altezza naturale è maggiore → scroll interno
    expect(b.maxHeight).toBeLessThan(MENU_H);
    expect(b.maxHeight).toBeGreaterThan(0);
  });

  // Senza `visualViewport` (browser vecchi, jsdom nudo) il fallback è
  // `innerHeight` e l'invariante deve reggere lo stesso.
  it("senza visualViewport il fallback su innerHeight tiene lo stesso vincolo", () => {
    const prev = Object.getOwnPropertyDescriptor(window, "visualViewport");
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
    restore.push(() => { if (prev) Object.defineProperty(window, "visualViewport", prev); });
    const w = window as unknown as { innerHeight: number };
    const prevH = w.innerHeight; w.innerHeight = 500;
    restore.push(() => { w.innerHeight = prevH; });
    stubLayout({ top: 430, height: 44, right: 382 });
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const b = bounds();
    expect(b.top).toBeGreaterThanOrEqual(MARGIN);
    expect(b.bottom).toBeLessThanOrEqual(500 - MARGIN);
  });
});

// #PARTNER-CLICK-TRACK-1: senza questo evento non sappiamo quale partner rende.
describe("MatchDetailSheet — tracking del partner scelto", () => {
  let calls: Array<{ url: string; body: Record<string, unknown> }>;

  beforeEach(() => {
    calls = [];
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const clickPartner = (name: string) => {
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    fireEvent.click(screen.getByText(name));
  };
  // #MIS-B: sulla stessa apertura viaggiano DUE eventi (partner_menu_open al
  // click sulla CTA, partner_click sulla voce). Il filtro e' per event_type,
  // non per URL, o le asserzioni sul click contano anche il denominatore.
  const beacons = (tipo: string) =>
    calls.filter((c) => c.url === "/api/track" && c.body.event_type === tipo);

  it("registra quale partner è stato scelto", () => {
    clickPartner("FeliceBet");
    const ev = beacons("partner_click");
    expect(ev).toHaveLength(1);
    expect(ev[0].body.event_type).toBe("partner_click");
    expect(ev[0].body.partner_id).toBe("FeliceBet");
    expect((ev[0].body.meta as Record<string, unknown>).surface).toBe("match_sheet");
  });

  it("distingue i partner fra loro", () => {
    clickPartner("YBets");
    expect(calls.at(-1)?.body.partner_id).toBe("YBets");
  });

  it("senza consenso GDPR non manda nessun session_id", () => {
    clickPartner("BetScore");
    const ev = beacons("partner_click");
    expect(ev).toHaveLength(1); // l'evento parte comunque, anonimo
    expect(ev[0].body.session_id).toBeUndefined();
    expect(sessionStorage.getItem("am_sid")).toBeNull(); // nessun id creato di nascosto
  });

  it("col consenso allega il session_id", () => {
    localStorage.setItem("gdpr_consent", "accepted");
    clickPartner("BetScore");
    const ev = beacons("partner_click");
    expect(ev).toHaveLength(1);
    expect(typeof ev[0].body.session_id).toBe("string");
  });

  it("il link resta navigabile anche se il beacon fallisce", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const link = screen.getByText("FortunePlay").closest("a") as HTMLAnchorElement;
    expect(() => fireEvent.click(link)).not.toThrow();
    expect(link.getAttribute("href")).toBe(BOOKS[0].matchUrl);
  });

  // #MIS-B — il DENOMINATORE. Senza l'apertura registrata, "zero click" non si
  // distingue da "nessuno ha aperto il menu": e' la stessa riga di dashboard.
  it("registra l'apertura del menu con quanti book erano in lista", () => {
    render(<MatchDetailSheet data={makeData()} />);
    openMenu();
    const ev = beacons("partner_menu_open");
    expect(ev).toHaveLength(1);
    expect((ev[0].body.meta as Record<string, unknown>).count).toBe(BOOKS.length);
    expect((ev[0].body.meta as Record<string, unknown>).surface).toBe("match_sheet");
  });

  it("non lo registra alla CHIUSURA: il numeratore non si gonfia da solo", () => {
    render(<MatchDetailSheet data={makeData()} />);
    openMenu(); // apre
    openMenu(); // richiude
    expect(beacons("partner_menu_open")).toHaveLength(1);
  });

  it("apertura e click restano due eventi distinti", () => {
    clickPartner("YBets");
    expect(beacons("partner_menu_open")).toHaveLength(1);
    expect(beacons("partner_click")).toHaveLength(1);
  });
});
