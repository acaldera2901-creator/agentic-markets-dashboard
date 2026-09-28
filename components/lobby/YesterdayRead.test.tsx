// #HOOK-A-LITE-0928 — la card di ieri mostra la lettura INTERA (pick, numero,
// perché, esito, punteggio) senza lucchetto né CTA di sblocco; il riquadro non
// esiste senza letture; la CTA porta alla registrazione.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YesterdayRead, YesterdayReadCard } from "./YesterdayRead";
import type { YesterdayRead as Row } from "@/lib/yesterday-read";

const football: Row = {
  id: "f1", sport: "football", competition: "Premier League", league: "PL",
  home: "Arsenal", away: "Chelsea", market: "1X2", pick: "HOME",
  model_pct: 64, fair_odds: 1.56, odds: 1.9,
  explanation: "The model rates Arsenal above the market.",
  result: "lost", final_score: "1-2", starts_at: "2026-09-27T19:00:00Z",
  day: "2026-09-27", is_yesterday: true,
};
const tennis: Row = {
  ...football, id: "t1", sport: "tennis", competition: "ATP Tokyo", league: "ATP Tokyo",
  home: "Sinner", away: "Fritz", market: "ML", pick: "Sinner", model_pct: 71,
  explanation: null, result: "won", final_score: "6-4 7-6",
};

describe("YesterdayReadCard", () => {
  it("mostra pick, numero, perché, esito e punteggio — niente lucchetto, niente «Unlock»", () => {
    render(<YesterdayReadCard read={football} lang="it" tz="Europe/Rome" />);
    expect(screen.getByText("Arsenal vince")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText(/rates Arsenal above the market/)).toBeInTheDocument();
    expect(screen.getByTestId("yesterday-result")).toHaveTextContent("Persa");
    expect(screen.getByTestId("final-home")).toHaveTextContent("1");
    expect(screen.getByTestId("final-away")).toHaveTextContent("2");
    expect(screen.getByTestId("yesterday-tab")).toHaveTextContent("Lettura completa");
    expect(screen.queryByText(/Pro pick/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("tennis: il pick è il nome, un set per colonna, senza perché non c'è il piede", () => {
    render(<YesterdayReadCard read={tennis} lang="en" tz="Europe/Rome" />);
    expect(screen.getByText("Sinner to win")).toBeInTheDocument();
    expect(screen.getByTestId("yesterday-result")).toHaveTextContent("Won");
    expect(screen.getByTestId("final-home").querySelectorAll("span")).toHaveLength(2);
    expect(screen.queryByText(/Why\./)).not.toBeInTheDocument();
  });
});

describe("YesterdayRead", () => {
  it("con zero letture non rende nulla", () => {
    const { container } = render(<YesterdayRead lang="it" tz="Europe/Rome" onRegister={() => {}} reads={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("una card per sport, l'occhiello dice «ieri» e la CTA apre la registrazione", () => {
    const onRegister = vi.fn();
    render(<YesterdayRead lang="it" tz="Europe/Rome" onRegister={onRegister} reads={[football, tennis]} />);
    expect(screen.getAllByTestId("yesterday-card")).toHaveLength(2);
    expect(screen.getByRole("region", { name: /Ecco come ha letto il modello/ })).toBeInTheDocument();
    expect(screen.getByText(/^Ieri ·/)).toBeInTheDocument();
    expect(screen.getByText(/fino a 3 nuove al giorno/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("yesterday-cta"));
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it("se la lettura non è di ieri, l'occhiello dice il giorno, non «ieri»", () => {
    render(<YesterdayRead lang="en" tz="UTC" onRegister={() => {}} reads={[{ ...football, is_yesterday: false, day: "2026-09-25", starts_at: "2026-09-25T19:00:00Z" }]} />);
    expect(screen.queryByText(/^Yesterday ·/)).not.toBeInTheDocument();
    expect(screen.getByText(/25 Sept? ·/)).toBeInTheDocument();
  });
});
