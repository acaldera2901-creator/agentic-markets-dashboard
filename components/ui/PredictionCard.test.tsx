import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PredictionCard } from "./PredictionCard";
import type { PredictionCardData } from "@/lib/ui/prediction-card";

const data: PredictionCardData = {
  id: "p1", sport: "football", league: "Premier League", home: "Arsenal", away: "Chelsea",
  startsAt: "2026-09-21T19:45:00Z", kickoffLabel: "Today · 20:45", isLive: false,
  pick: "Arsenal to win", modelPct: 64, marketPct: 52, edgePct: 12, confidence: 0.74,
  explanation: "Arsenal's xG trend is stronger than the line implies.",
};

describe("PredictionCard", () => {
  it("compact: teaser completo, badge High edge derivato, CTA come link", () => {
    render(<PredictionCard data={data} href="/predictions/p1" />);
    const card = screen.getByRole("article");
    expect(card).toHaveAttribute("data-variant", "compact");
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Arsenal");
    expect(screen.getByText("Arsenal to win")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByText(/\+12\.0/)).toHaveAttribute("data-tone", "pos");
    expect(screen.getByText("High edge")).toHaveAttribute("data-kind", "high-edge");
    const cta = screen.getByRole("link", { name: /view analysis/i });
    expect(cta).toHaveAttribute("href", "/predictions/p1");
    expect(cta).toHaveAttribute("data-tone", "link");
    expect(screen.queryByText(/why the model disagrees/i)).toBeNull();
  });
  it("featured: CTA verde piena e teaser del perché", () => {
    render(<PredictionCard data={data} variant="featured" href="/p/1" />);
    expect(screen.getByRole("link", { name: /view analysis/i })).toHaveAttribute("data-tone", "primary");
    expect(screen.getByText(/why the model disagrees/i)).toBeInTheDocument();
    expect(screen.getByText("Featured")).toHaveAttribute("data-kind", "featured");
  });
  it("featured: lo slot media compare solo se passato, e solo nella featured", () => {
    const { unmount } = render(<PredictionCard data={data} variant="featured" href="/p/1" media={<img alt="" src="/x.jpg" />} />);
    expect(screen.getByTestId("card-media")).toBeInTheDocument();
    unmount();
    render(<PredictionCard data={data} href="/p/1" media={<img alt="" src="/x.jpg" />} />);
    expect(screen.queryByTestId("card-media")).toBeNull();
  });
  it("live: badge live col minuto al posto del kickoff", () => {
    render(<PredictionCard data={{ ...data, isLive: true, liveMinute: 58 }} variant="live" href="/p/1" />);
    expect(screen.getByRole("status")).toHaveTextContent("Live");
    expect(screen.queryByText("Today · 20:45")).toBeNull();
  });
  // #RESTYLING-0921 round 2 — il free tier vede i NUMERI, paga per il LATO.
  // Prima il lucchetto copriva anche l'edge: la card diceva «MODEL 64 · MARKET
  // 52» e poi nascondeva il 12, che il lettore calcola in testa. E senza il
  // numero il badge «High edge» non poteva comparire, quindi la fascia High
  // Edge della Home restava muta per chi non aveva un account.
  it("premiumLocked: Model/Market/Edge veri e badge, solo la Pick chiusa", () => {
    render(<PredictionCard data={data} variant="premiumLocked" href="/plans" />);
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByText(/\+12\.0/)).toHaveAttribute("data-tone", "pos");
    expect(screen.getByText("High edge")).toHaveAttribute("data-kind", "high-edge");
    expect(screen.getByText("Pro pick")).toBeInTheDocument();
    expect(screen.queryByText("Arsenal to win")).toBeNull();
    expect(screen.getByRole("link", { name: /unlock full analysis/i })).toHaveAttribute("data-tone", "unlock");
  });
  it("senza mercato: nota «model estimate», nessun edge, nessun badge", () => {
    render(<PredictionCard data={{ ...data, marketPct: null, edgePct: null }} href="/p/1" />);
    expect(screen.getByText(/model estimate/i)).toBeInTheDocument();
    expect(screen.queryByText("High edge")).toBeNull();
  });
  it("badge esplicito e watchlist controllata", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    render(<PredictionCard data={data} href="/p/1" badge={{ kind: "starting-soon", label: "Starts in 40 min" }} saved onToggleWatchlist={onToggle} onOpen={onOpen} />);
    expect(screen.getByText("Starts in 40 min")).toHaveAttribute("data-kind", "starting-soon");
    const watch = screen.getByRole("button", { name: /remove from watchlist/i });
    fireEvent.click(watch);
    expect(onToggle).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("link", { name: /view analysis/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
