import { describe, expect, it, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { ClassicLobby } from "./ClassicLobby";
import { ClassicPricesProvider } from "./ClassicContext";
import { trackEvent } from "@/lib/track-event";
import type { LobbyItem } from "@/lib/ui/lobby";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

vi.mock("@/lib/track-event", () => ({ trackEvent: vi.fn() }));

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

function setup(extra: Partial<React.ComponentProps<typeof ClassicLobby>> = {}, freePlan = false) {
  const renderCard = vi.fn((it: LobbyItem, section: string) => <article data-section={section}>{it.data.home} – {it.data.away}</article>);
  render(
    <ClassicPricesProvider freePlan={freePlan} fpOdds={{}} booksBlocked geoCountry="" tz="UTC" tennisComputedAt={null}><ClassicLobby
      lang="en" tz="Europe/Rome" football={football} tennis={tennis} now={NOW} renderCard={renderCard}
      banners={{ board: { href: "/predictions?sport=football" }, live: { href: "/predictions?view=live" }, record: { href: "/history" } }}
      tail={<p>FAQ tail</p>}
      {...extra}
    /></ClassicPricesProvider>,
  );
  return { renderCard };
}

describe("ClassicLobby", () => {
  it.each([true, false])("mixed discovery for Free=%s preserves sport filters and plan-specific copy", (freePlan) => {
    const f = Array.from({ length: 6 }, (_, i) => item({ league: "Serie A", home: `Football ${i}`, locked: freePlan && i >= 3 }));
    const t = Array.from({ length: 6 }, (_, i) => item({ sport: "tennis", league: "ATP Tokyo", home: `Tennis ${["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"][i]}`, locked: freePlan && i >= 3 }));
    setup({ football: f, tennis: t }, freePlan);
    const rail = screen.getByTestId("classic-featured");
    const cards = within(rail).getAllByRole("article");
    expect(cards.slice(0, 3).map(c => c.textContent?.split(" – ")[0])).toEqual(["Tennis Alpha", "Tennis Beta", "Football 0"]);
    if (freePlan) {
      expect(screen.getByText(/Up to 3 tennis and 3 football/)).toBeInTheDocument();
      expect(cards.slice(0, 6).map(c => c.textContent?.split(" – ")[0]).sort()).toEqual(["Football 0", "Football 1", "Football 2", "Tennis Alpha", "Tennis Beta", "Tennis Gamma"]);
    } else {
      expect(screen.queryByText(/Up to 3 tennis and 3 football/)).toBeNull();
      expect(cards).toHaveLength(10);
    }
    fireEvent.click(within(screen.getByRole("group", { name: "Sports" })).getByRole("button", { name: /Football/i }));
    expect(within(screen.getByTestId("classic-featured")).getAllByRole("article").every(c => c.textContent?.startsWith("Football"))).toBe(true);
  });
  it("tracks tab and sport choices while keeping their selection behavior", () => {
    vi.mocked(trackEvent).mockClear();
    setup();
    const tab = screen.getByRole("tab", { name: "In-Play" });
    fireEvent.click(tab);
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(trackEvent).toHaveBeenCalledWith("nav_click", { meta: { surface: "classic-lobby", view: "inplay" } });
    const sport = within(screen.getByRole("group", { name: "Sports" })).getByRole("button", { name: /tennis/i });
    fireEvent.click(sport);
    expect(sport).toHaveAttribute("aria-pressed", "true");
    expect(trackEvent).toHaveBeenCalledWith("tab_click", { meta: { surface: "classic-lobby", sport: "tennis" } });
  });
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
    // #CLASSIC-ROOBET-1013 — per lega si rendono RIGHE (ClassicRow), non schede
    expect(within(panel).getAllByTestId("classic-row")).toHaveLength(1);
    expect(within(panel).getByTestId("classic-row")).toHaveAttribute("data-live", "true");
    renderCard.mockClear();
    fireEvent.click(screen.getByRole("tab", { name: "Starting Soon" }));
    // la fascia «soon» non ha caroselli: nessuna scheda, solo righe
    expect(renderCard).not.toHaveBeenCalled();
    expect(within(screen.getByRole("tabpanel")).getAllByTestId("classic-row").length).toBeGreaterThan(0);
  });

  it("#CLASSIC-ROOBET-1013: league chips filter the list; «See all» opens the rows beyond five", () => {
    const many = Array.from({ length: 7 }, (_, i) => item({ league: "Serie A", startsAt: h(2 + i) }));
    setup({ football: [...football, ...many] });
    const chips = screen.getByTestId("classic-league-chips");
    expect(within(chips).getAllByRole("button").map((b) => b.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^All/), expect.stringMatching(/Serie A$/), expect.stringMatching(/Premier League$/)]),
    );
    const serieAGroup = () => document.getElementById("brc-g-football-Serie-A")!;
    expect(within(serieAGroup()).getAllByTestId("classic-row")).toHaveLength(5);
    fireEvent.click(within(serieAGroup()).getByRole("button", { name: /See all 9/ }));
    expect(within(serieAGroup()).getAllByTestId("classic-row")).toHaveLength(9);
    fireEvent.click(within(chips).getByRole("button", { name: /Serie A/ }));
    expect(Array.from(document.querySelectorAll(".brc-group__name")).map((n) => n.textContent)).toEqual(["Serie A"]);
    fireEvent.click(within(chips).getByRole("button", { name: /^All/ }));
    expect(document.querySelectorAll(".brc-group__name").length).toBeGreaterThan(1);
  });

  it("#CLASSIC-ROOBET-1013: the left rail lists sections and sports, and the row links where the desk says", () => {
    const rowLink = vi.fn(() => ({ href: "/x", locked: true }));
    setup({ rowLink });
    const side = screen.getByRole("navigation", { name: "Sections" });
    expect(within(side).getAllByRole("button").map((b) => b.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Featured/), expect.stringMatching(/^In-Play/), expect.stringMatching(/^Football/), expect.stringMatching(/^Tennis/)]),
    );
    expect(within(side).getByRole("link", { name: /Track record/ })).toHaveAttribute("href", "/history");
    const row = screen.getAllByTestId("classic-row")[0];
    expect(row).toHaveAttribute("data-locked", "true");
    expect(within(row).getByRole("link", { name: /Open match/ })).toHaveAttribute("href", "/x");
    // senza quote partner la colonna non inventa un prezzo (la prima riga è live: «prices removed»)
    expect(within(row).getByText("Prices removed at the start")).toBeInTheDocument();
    // senza provider la geo non è nota: nessun «No partner price» falso (round 3)
    expect(screen.queryAllByText("No partner price")).toHaveLength(0);
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
    expect(within(panel).getAllByTestId("classic-row").map((r) => r.querySelectorAll(".brc-row__name")[0].textContent)).toEqual([`Home 5`]);
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

 it('expands mobile featured matches and keeps the league selection scoped to the league list',()=>{
 setup();
 const featured=screen.getByTestId('classic-featured');
 const more=within(featured).getByRole('button',{name:/See all/});
 expect(more).toHaveAttribute('aria-expanded','false');
 fireEvent.click(more);
 expect(within(featured).getByRole('button',{name:/Show less/})).toHaveAttribute('aria-expanded','true');
 const select=screen.getByRole('combobox',{name:'Leagues'});
 fireEvent.change(select,{target:{value:'football:Serie A'}});
 expect(screen.getByRole('heading',{name:/Serie A/})).toBeInTheDocument();
 expect(within(featured).getAllByRole('article').length).toBeGreaterThan(3);
 });
