import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { UpcomingMatches } from "./UpcomingMatches";

const startsAt = "2026-11-25T16:00:00.000Z";

it("puts public fixtures and guide links under the correct sport headings", () => {
  const { container } = render(<UpcomingMatches matches={[
    { id: "1", sport: "tennis", home: "Player One", away: "Player Two", competition: "ATP", startsAt },
    { id: "2", sport: "football", home: "Club One", away: "Club Two", competition: "League", startsAt },
  ]} />);

  const football = screen.getByRole("region", { name: "Football fixtures" });
  const tennis = screen.getByRole("region", { name: "Tennis fixtures" });
  expect(within(football).getByText("Club One vs Club Two")).toBeTruthy();
  expect(within(tennis).getByText("Player One vs Player Two")).toBeTruthy();
  expect(within(football).getByRole("link", { name: "How football predictions work" }).getAttribute("href")).toBe("/ai-football-predictions");
  expect(within(tennis).getByRole("link", { name: "How tennis predictions work" }).getAttribute("href")).toBe("/ai-tennis-predictions");
  expect(JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!).numberOfItems).toBe(2);
});

it("omits the section and jump link for a sport with no fixtures", () => {
  render(<UpcomingMatches matches={[
    { id: "1", sport: "tennis", home: "Player One", away: "Player Two", competition: "ATP", startsAt },
  ]} />);
  expect(screen.queryByRole("region", { name: "Football fixtures" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Football fixtures" })).toBeNull();
  expect(screen.getByRole("link", { name: "Tennis fixtures" }).getAttribute("href")).toBe("#tennis-fixtures");
});
