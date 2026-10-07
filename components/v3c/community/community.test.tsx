// #REDESIGN-V3C pages · leaderboard / invite / community / legali in v3c.
import { render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { V3cLeaderboard, toRows } from "./Leaderboard";
import { V3cInvite } from "./Invite";
import { V3cCommunity } from "./Community";
import { communityCopyFor } from "@/lib/v3c/community-copy";

vi.mock("@/components/v3c/pages/Frame", () => ({ V3cFrame: ({ children }: { children: React.ReactNode }) => <div data-frame="v3c">{children}</div> }));
vi.mock("../app/page", () => ({ default: function Dashboard() { return null; } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const api = [
  { rank: 1, name: "Ada", points: 120, bets_won: 12, bets_total: 20, hit_rate: 60, sport: "football" },
  { rank: 2, name: "Bo", points: 90, bets_won: 9, bets_total: 30, hit_rate: 30, sport: "tennis" },
];

describe("leaderboard v3c", () => {
  it("rango, punti, vinte/totali — nessuna percentuale di vittoria nel DOM", () => {
    const { container } = render(<V3cLeaderboard initial={{ rows: toRows(api) }} />);
    expect(screen.getAllByText("Ada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12 / 20").length).toBeGreaterThan(0);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/hit.?rate/i);
    expect(text).not.toMatch(/60%|30%/);
    // il campo non entra nemmeno nello stato
    expect(Object.keys(toRows(api)[0])).not.toContain("hit_rate");
  });

  it("stato vuoto e errore scritti", () => {
    render(<V3cLeaderboard initial={{ rows: [] }} />);
    expect(screen.getByText(communityCopyFor("en").lb.emptyTitle)).toBeInTheDocument();
  });
  it("errore con riprova", () => {
    render(<V3cLeaderboard initial="error" />);
    expect(screen.getByRole("alert")).toHaveTextContent(communityCopyFor("en").lb.error);
  });
});

describe("invite v3c", () => {
  // fixui3 B3: in Fase 0 no link to the old sign-in (/plans?auth=login sells Base on the old site)
  it("401 → «Account: coming with Pro», senza link all'accesso di oggi", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const { container } = render(<V3cInvite />);
    await waitFor(() => expect(screen.getByText("Account: coming with Pro.")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(container.innerHTML).not.toMatch(/\/plans\?/);
  });

  it("403 → claim del codice (stesso stato del pannello di sempre)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    render(<V3cInvite />);
    await waitFor(() => expect(screen.getByText("Choose your creator code")).toBeInTheDocument());
  });

  it("200 → codice, link /r/CODE e premi dall'API", async () => {
    const body = { code: "ADA", signups: 2, paying: 1, inviteeBonusDays: 7, tiers: [{ tier: 2, reached: false, granted_at: null, rewardDays: 29, grantsRoom: false }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    render(<V3cInvite />);
    await waitFor(() => expect(screen.getByText("ADA")).toBeInTheDocument());
    expect(screen.getByText(/\/r\/ADA$/)).toBeInTheDocument();
    expect(screen.getByText("Anyone who signs up with your link gets 7 free days of Pro.")).toBeInTheDocument();
  });
});

describe("community v3c", () => {
  it("schedina chiusa: partite visibili, niente blur né probabilità; aperta: link con mb e ref", () => {
    const slips = [
      { id: "1", creator_code: "ADA", mb_param: "x1", created_at: "2026-10-01T10:00:00Z", locked: true, combined_prob: 0.2, selections: [{ label: "Genoa — Fiorentina", sport: "football", when: "", market: null, prob: null }] },
      { id: "2", creator_code: "BO", mb_param: "y2", created_at: "2026-10-01T10:00:00Z", locked: false, combined_prob: 0.31, selections: [{ label: "Inter — Roma", sport: "football", when: "", market: "Home", prob: 0.55 }] },
    ];
    const { container } = render(<V3cCommunity initial={{ slips, access: "partial" }} />);
    expect(screen.getByText("Genoa — Fiorentina")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/blur/);
    expect(container.textContent).not.toContain("20%");
    expect(screen.getByRole("link", { name: /Open slip/ })).toHaveAttribute("href", "/probability-view?mb=y2&ref=BO");
    expect(container.textContent).not.toMatch(/Base/);
  });
});

describe("legali: stesso testo nelle due cornici", () => {
  for (const [name, today, v3c, phrase] of [
    ["privacy", () => import("@/app/privacy/page"), () => import("@/app/v3c/privacy/page"), "Purpose."],
    ["terms", () => import("@/app/terms/page"), () => import("@/app/v3c/terms/page"), "Questions about these Terms?"],
  ] as const) {
    it(`${name}: la pagina di oggi ha la cornice di sempre, /v3c quella nuova, testo identico`, async () => {
      const Today = (await today()).default;
      const V3c = (await v3c()).default;
      vi.stubEnv("NEXT_PUBLIC_REDESIGN", "");
      const off = renderToStaticMarkup(Today());
      await expect(V3c()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
      vi.stubEnv("NEXT_PUBLIC_REDESIGN", "1");
      const on = renderToStaticMarkup(await V3c());
      expect(off).toContain("mc-scene-clay");
      expect(off).not.toContain('data-frame="v3c"');
      expect(on).toContain('data-frame="v3c"');
      expect(off).toContain(phrase);
      // il corpo legale (dal legal-sheet in poi) è byte per byte lo stesso
      const sheet = (h: string) => h.slice(h.indexOf('<div class="legal-sheet'), h.lastIndexOf("Return to BetRedge"));
      expect(sheet(on)).toBe(sheet(off));
      expect(sheet(off).length).toBeGreaterThan(2000);
    });
  }
});
