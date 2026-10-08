import { describe, expect, it, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { ClassicLobby } from "./ClassicLobby";
import type { LobbyItem } from "@/lib/ui/lobby";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

const NOW = Date.parse("2026-10-10T10:00:00Z");
const h = (n: number) => new Date(NOW + n * 3600_000).toISOString();
let seq = 0;
function item(p: Partial<LobbyItem["data"]> & { league: string }): LobbyItem {
  const id = String(++seq);
  const data = { id, sport: "football", home: `Home ${id}`, away: `Away ${id}`, startsAt: h(5), isLive: false, pick: null, modelPct: 50, marketPct: 50, edgePct: 0, ...p } as LobbyItem["data"];
  return { data, key: `${data.sport}:${id}` };
}

const football = [
  item({ league: "Serie A", home: "Genoa CFC", away: "ACF Fiorentina", startsAt: h(3) }),
  item({ league: "Serie A", startsAt: h(1), modelPct: 52, marketPct: 51, edgePct: 1 }),
  item({ league: "Premier League", startsAt: h(-0.5), isLive: true }),
  item({ league: "League Two", startsAt: h(2) }),
  item({ league: "Championship", startsAt: h(26) }),
  item({ league: "Bundesliga", startsAt: h(4) }),
  item({ league: "La Liga", startsAt: h(6) }),
];
const tennis = [item({ sport: "tennis", league: "ATP Tokyo", startsAt: h(0.5) })];

function setup(extra: Partial<React.ComponentProps<typeof ClassicLobby>> = {}) {
  const renderCard = vi.fn((it: LobbyItem, section: string) => <article data-section={section}>{it.data.home} – {it.data.away}</article>);
  render(
    <ClassicLobby
      lang="en" tz="Europe/Rome" football={football} tennis={tennis} now={NOW} renderCard={renderCard}
      banners={{ board: { href: "/predictions?sport=football" }, live: { href: "/predictions?view=live" }, record: { href: "/history" } }}
      tail={<p>FAQ tail</p>}
      {...extra}
    />,
  );
  return { renderCard };
}

describe("ClassicLobby", () => {
  it("renders the Roobet skeleton in order: banners, tabs + search, sports strip, featured, differs, leagues, tail", () => {
    setup();
    const nav = screen.getByRole("navigation", { name: "Where to start" });
    expect(within(nav).getAllByRole("listitem")).toHaveLength(3);
    expect(within(nav).getByRole("link", { name: /see the record/i })).toHaveAttribute("href", "/history");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Featured", "In-Play", "Starting Soon", "All Sports"]);
    expect(screen.getByRole("searchbox", { name: "Search matches" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sports" })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((x) => x.textContent);
    expect(headings.slice(3)).toEqual(["Featured matches", "Where our estimate differs most", "Matches by league"]);
    expect(screen.getByText("FAQ tail")).toBeInTheDocument();
  });

  it("groups by sport → league, top leagues first, with collapsible headers", () => {
    setup();
    // «Popular»: le leghe top; League Two (tier 3) resta fuori e lo si dice.
    const names = Array.from(document.querySelectorAll(".brc-group__name")).map((n) => n.textContent);
    expect(names).toEqual(["Premier League", "Serie A", "Bundesliga", "La Liga", "Championship", "ATP Tokyo"]);
    // Aperti i primi tre per sport, il quarto è un'intestazione ripiegata.
    const laLiga = screen.getAllByRole("button").find((b) => b.querySelector(".brc-group__name")?.textContent === "La Liga")!;
    expect(laLiga).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/1 more in other leagues/)).toBeInTheDocument();
    const serieA = screen.getAllByRole("button").find((b) => b.querySelector(".brc-group__name")?.textContent === "Serie A")!;
    expect(serieA).toHaveAttribute("aria-expanded", "true");
    expect(serieA.textContent).toContain("Italy");
    fireEvent.click(serieA);
    expect(serieA).toHaveAttribute("aria-expanded", "false");
  });

  it("In-Play shows only live matches; Starting Soon passes the soon section to the card", () => {
    const { renderCard } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "In-Play" }));
    expect(screen.getByRole("tab", { name: "In-Play" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Featured matches")).toBeNull();
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByRole("article")).toHaveLength(1);
    renderCard.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: "Starting Soon" }));
    expect(renderCard.mock.calls.every(([, s]) => s === "soon")).toBe(true);
  });

  it("search filters every block and says so when nothing matches", () => {
    setup();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "fiorentina" } });
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByText(/ACF Fiorentina/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("No match for “zzz”.");
  });

  it("date chips: Tomorrow keeps only tomorrow's matches", () => {
    setup();
    fireEvent.click(screen.getByRole("tab", { name: "All Sports" }));
    fireEvent.click(screen.getByRole("button", { name: /Tomorrow/ }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByRole("article").map((a) => a.textContent)).toEqual([`Home 5 – Away 5`]);
  });

  it("arrow keys move between tabs", () => {
    setup();
    const first = screen.getByRole("tab", { name: "Featured" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "In-Play" })).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "In-Play" }));
  });

  it("while loading it says so instead of «no matches»", () => {
    setup({ football: [], tennis: [], loading: true });
    expect(screen.getByRole("status")).toHaveTextContent("Loading today’s board…");
  });

  it("speaks the user's language (Italian)", () => {
    setup({ lang: "it" });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["In evidenza", "In gioco", "A breve", "Tutti gli sport"]);
    expect(screen.getByRole("heading", { name: "Dove la nostra stima si discosta di più" })).toBeInTheDocument();
  });
});
