// #COERENZA-1001 (d) — Andrea, 01/10: le righe tennis `partner-market-v1` si
// etichettano per quello che sono — quota di mercato de-viggata, non modello —
// su card, scheda, widget. I numeri NON cambiano.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PredictionCard } from "./PredictionCard";
import { fromDeskTennis } from "@/lib/ui/desk-card";
import { fromUnifiedPrediction } from "@/lib/ui/prediction-card";
import { renderEmbedHtml } from "@/app/embed/embed-html";
import { displayTournament, probabilitySourceOf, PARTNER_MARKET_MODEL } from "@/lib/partner-market";
import type { UnifiedPrediction } from "@/lib/unified-adapter";

const partnerRow = {
  id: "tennis:partner:1", player1: "Bellucci", player2: "Peliwo", tournament: "Partner feed",
  scheduled: "2026-09-28T10:00:00Z", p1: 0.8, p2: 0.2, odds_p1: 1.2, odds_p2: 4.2,
  best_selection: "P1" as const, model: PARTNER_MARKET_MODEL,
};

describe("etichetta partner-market", () => {
  it("helper: partner = mercato, il resto = modello; «Partner feed» non è un torneo", () => {
    expect(probabilitySourceOf(PARTNER_MARKET_MODEL)).toBe("market");
    expect(probabilitySourceOf("elo_surface_v2")).toBe("model");
    expect(probabilitySourceOf(null)).toBe("model");
    expect(displayTournament("Partner feed")).toBeNull();
    expect(displayTournament("ATP Tokyo")).toBe("ATP Tokyo");
  });

  it("card del desk: stesso numero, etichetta «quota di mercato», niente torneo finto", () => {
    const d = fromDeskTennis(partnerRow);
    const model = fromDeskTennis({ ...partnerRow, model: "elo_surface_v2", tournament: "ATP Tokyo" });
    expect(d.modelPct).toBe(model.modelPct); // il numero non cambia
    expect(d.probabilitySource).toBe("market");
    expect(d.league).toBeNull();
    render(<PredictionCard data={d} href="/x" lang="it" />);
    expect(screen.getByText("Quota di mercato, senza margine")).toBeInTheDocument();
    expect(screen.queryByText("Our model")).toBeNull();
    expect(screen.queryByText("Partner feed")).toBeNull();
  });

  it("card da riga unified: stessa regola", () => {
    const p = {
      id: "u1", sport: "tennis", player_one: "Monnet", player_two: "Buyukakcay",
      competition: "Partner feed", league: "Partner feed", starts_at: "2026-09-28T10:00:00Z",
      is_live: false, pick: "Monnet", market: "ML", odds: 1.4, fair_odds: 1.5,
      confidence_score: 67, explanation: null, model_version: PARTNER_MARKET_MODEL,
    } as unknown as UnifiedPrediction;
    const d = fromUnifiedPrediction(p);
    expect(d.probabilitySource).toBe("market");
    expect(d.league).toBeNull();
  });

  it("widget: la percentuale del partner dice «mercato», non «modello»", () => {
    const html = renderEmbedHtml({
      rows: [{
        id: "t1", sport: "tennis", competition: "", homeTeam: "Bellucci", awayTeam: "Peliwo",
        startsAt: "2026-09-28T10:00:00Z", decision: "Vince Bellucci", confidence: 80,
        probabilitySource: "market", locked: false, topPick: true,
      }],
      ref: null, lang: "it", theme: "auto", host: null, mode: "open",
    });
    expect(html).toContain("<b>80%</b> mercato");
    expect(html).not.toContain("<b>80%</b> modello");
  });
});
