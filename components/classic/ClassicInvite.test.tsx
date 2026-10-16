// #CLASSIC-INVITE-1014 — la tab Invita a flag acceso: stato anonimo vero,
// claim, link, la v1 senza denaro, l'anteprima v2 marcata, il wallet inerte,
// e la parità del desk a flag spento (ReferralPanel intero).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ClassicInvite } from "./ClassicInvite";

vi.mock("@/lib/track-event", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/launch-promo-client", () => ({ launchPromoLive: () => false }));

type Resp = { status: number; body?: unknown };
function stubFetch(stats: Resp, claim?: Resp) {
  const f = vi.fn(async (url: string) => {
    const r = url.includes("/claim") ? claim ?? { status: 500 } : stats;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} } as Response;
  });
  vi.stubGlobal("fetch", f);
  return f;
}

const STATS = {
  code: "MARCO",
  signups: 4,
  paying: 1,
  inviteeBonusDays: 7,
  tiers: [
    { tier: 2, reached: false, granted_at: null, rewardDays: 29, grantsRoom: false },
    { tier: 5, reached: false, granted_at: null, rewardDays: 60, grantsRoom: false },
    { tier: 10, reached: false, granted_at: null, rewardDays: null, grantsRoom: true },
  ],
};

function mount(v2: boolean, lang = "en") {
  const onSignIn = vi.fn();
  const onRegister = vi.fn();
  const view = render(<ClassicInvite lang={lang} v2={v2} onSignIn={onSignIn} onRegister={onRegister} />);
  return { onSignIn, onRegister, view };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ClassicInvite", () => {
  it("anonimo (401): invito ad accedere con le due CTA, mai «Stats unavailable»", async () => {
    stubFetch({ status: 401 });
    const h = mount(false);
    expect(await screen.findByText("Sign in or create an account to get your link.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(h.onRegister).toHaveBeenCalledTimes(1);
    expect(h.onSignIn).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toMatch(/unavailable|can’t be read/i);
    // anonimo: niente numeri personali
    expect(screen.queryByText("Sign-ups")).toBeNull();
  });

  it("loggato senza codice (403): il form di claim; il POST è quello esistente e porta al link", async () => {
    const stats: Resp = { status: 403 };
    const f = stubFetch(stats, { status: 200, body: { code: "MARCO" } });
    mount(false);
    const input = await screen.findByLabelText("Choose your code");
    const btn = screen.getByRole("button", { name: "Claim code" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "marco" } });
    expect(btn.disabled).toBe(false);
    // dopo il claim le stats rispondono
    stats.status = 200;
    stats.body = STATS;
    fireEvent.click(btn);
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Your link" }) as HTMLInputElement).value).toMatch(/\/r\/MARCO$/));
    expect(f).toHaveBeenCalledWith("/api/referral/claim", expect.objectContaining({ method: "POST" }));
  });

  it("errore 5xx: si dice e si riprova, il claim NON viene offerto", async () => {
    stubFetch({ status: 503 });
    mount(false);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByLabelText("Choose your code")).toBeNull();
  });

  it("v1 (v2 spento) loggato con dati: link, KPI reali, premi a giorni PRO; nessun importo, nessuna moneta, nessuna anteprima", async () => {
    stubFetch({ status: 200, body: STATS });
    mount(false);
    await screen.findByText("MARCO");
    expect(screen.getByText("Whoever signs up through your link gets 7 free days of PRO.")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy(); // 1/4
    expect(screen.getByText("1 paying · 1 to the next reward")).toBeTruthy();
    expect(screen.getByText("+29 days of PRO")).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\$|USDT|Polygon|commission|wallet|Preview|Sample/i);
    expect(document.querySelector("[data-v2='0']")).toBeTruthy();
  });

  it("v2 acceso: banner «Anteprima» visibile, ogni blocco con importi marcato «Sample», wallet inerte, regole e rischi", async () => {
    stubFetch({ status: 200, body: STATS });
    mount(true);
    await screen.findByText("MARCO");
    const note = screen.getByRole("note");
    expect(note.textContent).toMatch(/Preview — program coming soon, sample data/);
    // ledger e storico portano l'etichetta; i KPI reali no
    expect(screen.getAllByText("Sample")).toHaveLength(2);
    expect(screen.getByText("$23.39")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    // KPI: iscritti e paganti reali dal codice, click non inventati
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("Counted from launch")).toBeTruthy();
    // wallet: disabilitato, senza name, fuori da qualunque form
    const w = screen.getByLabelText("Polygon address") as HTMLInputElement;
    expect(w.disabled).toBe(true);
    expect(w.readOnly).toBe(true);
    expect(w.getAttribute("name")).toBeNull();
    expect(w.closest("form")).toBeNull();
    expect((screen.getByRole("button", { name: "Save wallet" }) as HTMLButtonElement).disabled).toBe(true);
    // regole: hold, storno, nessuna garanzia, T&C segnaposto
    expect(screen.getByText(/waits 60 days before it matures, to cover/)).toBeTruthy();
    expect(screen.getByText(/within 120 days/)).toBeTruthy();
    expect(screen.getByText(/Nothing is guaranteed/)).toBeTruthy();
    expect(screen.getByText(/Program terms: being drafted/)).toBeTruthy();
    // v1 non trapela nell'anteprima
    expect(screen.queryByText(/days of PRO/)).toBeNull();
  });

  it("v2 acceso, anonimo: banner e regole sì, nessun numero personale né esempio di importi", async () => {
    stubFetch({ status: 401 });
    mount(true, "it");
    expect(await screen.findByText("Accedi o registrati per avere il tuo link.")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toMatch(/Anteprima — programma in arrivo, dati di esempio/);
    expect(screen.queryByText("Esempio")).toBeNull();
    expect(screen.queryByLabelText("Indirizzo Polygon")).toBeNull();
    expect(screen.getByText("Le regole, in breve")).toBeTruthy();
  });

  it("clipboard negata: il bottone dice di copiare a mano, il link resta selezionabile", async () => {
    stubFetch({ status: 200, body: STATS });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
    mount(false);
    await screen.findByText("MARCO");
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("button", { name: "Select the link and copy it" })).toBeTruthy();
  });
});

describe("desk: parità a flag spento", () => {
  const page = readFileSync("app/app/page.tsx", "utf8");

  it("la tab invita rende ClassicInvite SOLO nel ramo del flag classic, altrimenti ReferralPanel", () => {
    expect(page).toMatch(
      // #CLASSIC-RELEASE-1016: the `else` is main's branch (AffiliateSection under its own flag, else ReferralPanel)
      /\{tab === "invita" && \(process\.env\.NEXT_PUBLIC_CLASSIC === "1" \? \(\s*<CL\.ClassicInvite[\s\S]*?\/>\s*\) : AffiliateSection \? \([\s\S]*?\) : <ReferralPanel \/>\)\}/,
    );
    // nessun altro montaggio, nessun import statico del componente nel desk
    expect(page.match(/<CL\.ClassicInvite\b/g)?.length).toBe(1); // un solo montaggio
    expect(page).not.toMatch(/from "@\/components\/classic\/ClassicInvite"/);
  });

  it("il flag v2 si legge solo dentro il ramo classic", () => {
    const uses = page.match(/NEXT_PUBLIC_AFFILIATE_V2/g) ?? [];
    expect(uses.length).toBe(4); // commento + prop v2, più commento + lazy di AffiliateSection (main, #AFFILIATE-V2-UI-1015)
    expect(page).toMatch(/v2=\{process\.env\.NEXT_PUBLIC_AFFILIATE_V2 === "1"\}/);
  });

  it("ReferralPanel è ancora lì, con le sue API e il suo copy", () => {
    expect(page).toMatch(/function ReferralPanel\(\)/);
    expect(page).toMatch(/fetch\("\/api\/referral\/stats"/);
    expect(page).toMatch(/Stats unavailable right now\./);
  });
});
