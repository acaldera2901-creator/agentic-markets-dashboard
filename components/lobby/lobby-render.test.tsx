// #RESTYLING-0921 — verifica di INTEGRAZIONE, non di unità: i moduli puri
// hanno già i loro test, qui si controlla che i pezzi montati insieme rendano
// davvero i numeri giusti. È il test che avrebbe preso l'edge sbagliato: una
// schermata che scrive «MODEL 64 · MARKET 52 · EDGE +22.9» type-checka
// benissimo. Round 4: quella riga non sta più sulla card ma nella scheda
// partita, e il test l'ha seguita là — vedi «i numeri della card arrivano
// interi alla scheda», in fondo.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LobbySection } from "./LobbySection";
import { PredictionCard } from "@/components/ui";
import { MatchDetailSheet } from "@/components/MatchDetailSheet";
import { fromDeskFootball, type DeskFootballRow } from "@/lib/ui/desk-card";
import { buildLobbySections, lobbyKey } from "@/lib/ui/lobby";
import { footballWhyReasons } from "@/lib/ui/why-reasons";

const row: DeskFootballRow = {
  match_id: "m1", league: "PL", league_name: "Premier League",
  home_team: "Arsenal", away_team: "Chelsea",
  kickoff: new Date(Date.now() + 6 * 3600_000).toISOString(),
  p_home: 0.64, p_draw: 0.2, p_away: 0.16,
  odds_home: 1.92, odds_draw: 3.6, odds_away: 5.0,
  best_selection: "HOME",
  confidence_score: 74,
  explanation: "The model rates Arsenal above the market.",
};

describe("card della lobby", () => {
  // #RESTYLING-0921 round 4 — livello 1 mostra SOLO la nostra percentuale. Che
  // l'edge sia davvero la differenza fra i due numeri resta la regola che
  // questo file esiste per difendere, e si verifica dove i due numeri stanno
  // adesso: nella scheda partita, in fondo a questo stesso file.
  it("mostra la nostra percentuale, e NON il mercato né l'edge", () => {
    const data = fromDeskFootball(row, { winLabel: "to win", kickoffLabel: "Today · 20:45" });
    render(<PredictionCard data={data} href="/predictions?match=football:m1" />);

    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("Our model")).toBeInTheDocument();
    expect(screen.queryByText("52")).not.toBeInTheDocument();
    expect(screen.queryByText("+11.9")).not.toBeInTheDocument();
    expect(screen.getByText("Arsenal to win")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View analysis/i })).toHaveAttribute(
      "href", "/predictions?match=football:m1",
    );
  });

  it("una card chiusa mostra la nostra percentuale ma non il pick", () => {
    const data = fromDeskFootball({ ...row, locked: true }, { winLabel: "to win" });
    render(<PredictionCard data={data} variant="premiumLocked" href="/x" />);
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.queryByText("Arsenal to win")).not.toBeInTheDocument();
    expect(screen.getByText("Pro pick")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Unlock full analysis/i })).toBeInTheDocument();
  });

  it("senza quota di mercato la card non promette un edge che non ha", () => {
    const data = fromDeskFootball({ ...row, odds_home: null }, { winLabel: "to win" });
    render(<PredictionCard data={data} href="/x" />);
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.queryByText("High edge")).not.toBeInTheDocument();
  });
});

describe("fascia della lobby", () => {
  it("il titolo, il conteggio e le card stanno nella stessa sezione", () => {
    const data = fromDeskFootball(row, { winLabel: "to win" });
    const secs = buildLobbySections({ football: [{ data, key: lobbyKey(data) }], tennis: [] });
    expect(secs.map((s) => s.id)).toContain("top");

    render(
      <LobbySection title="Top opportunities" hint="Where the model disagrees most." count={1}>
        <PredictionCard data={data} href="/x" />
      </LobbySection>,
    );
    // La fascia è un landmark nominato dal suo titolo: si salta di sezione in
    // sezione senza attraversare le card.
    const sec = screen.getByRole("region", { name: /Top opportunities/ });
    expect(within(sec).getByRole("heading", { name: /Top opportunities/ })).toBeInTheDocument();
    expect(within(sec).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Where the model disagrees most.")).toBeInTheDocument();
    expect(screen.getByText("Arsenal")).toBeInTheDocument();
  });
});

describe("scheda partita con la testa nuova", () => {
  const base = {
    league: "Premier League", when: "Today · 20:45",
    home: "Arsenal", away: "Chelsea",
    hero: { flag: "Our prediction", pick: "Arsenal to win", read: "", confDots: 3, quotaLabel: "Odds", quota: "1.92", value: null },
    groups: [], matchUrl: "https://example.test",
    labels: {
      schedina: "Your betslip", quotaComb: "combined", quotaOne: "odds", touch: "tap",
      apri: "Open", apriMulti: "Open acc", disc: "disclaimer", side: "side",
      selOne: "1 selection", selMany: "{n} selections",
    },
  };

  it("mette in testa squadre, pick e la riga Model/Market/Edge", () => {
    render(<MatchDetailSheet hideBookLinks data={{
      ...base,
      head: {
        sport: "football", league: "Premier League", kickoffLabel: "Today · 20:45",
        pick: "Arsenal to win", modelPct: 64, marketPct: 52, edgePct: 11.9, confidence: 74,
      },
      why: footballWhyReasons({
        home: "Arsenal", away: "Chelsea", formHome: "WWDLW", formAway: "LDWLL",
        matchesHome: 20, matchesAway: 19, modelPct: 64, marketPct: 52,
      }, "en"),
      form: { home: { name: "Arsenal", results: ["W", "W", "D", "L", "W"] }, away: { name: "Chelsea", results: ["L", "D", "W", "L", "L"] } },
    }} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Arsenal");
    // L'edge compare due volte di proposito: accanto al pick nella testa, e
    // nella riga Model | Market | Edge. Devono dire lo stesso numero.
    expect(screen.getAllByText("+11.9")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: /Why the model likes this pick/i })).toBeInTheDocument();
    expect(screen.getByText(/Last 5: Arsenal 3W-1D-1L/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Recent form/i })).toBeInTheDocument();
  });

  // #RESTYLING-0921 round 4 — il confronto si è spostato QUI, e con lui il
  // test che difendeva il numero: l'edge è la differenza fra i due numeri che
  // si vedono (64 − 52 = +11.9), non il value p·odds−1 (+22.9). I numeri
  // arrivano dalla stessa riga di board che alimenta la card, non a mano.
  it("i numeri della card arrivano interi alla scheda, e l'edge è la loro differenza", () => {
    const data = fromDeskFootball(row, { winLabel: "to win" });
    render(<MatchDetailSheet hideBookLinks data={{
      ...base,
      head: {
        sport: data.sport, league: data.league, kickoffLabel: "Today · 20:45",
        pick: data.pick, modelPct: data.modelPct, marketPct: data.marketPct, edgePct: data.edgePct,
      },
    }} />);
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getAllByText("+11.9").length).toBeGreaterThan(0);
    expect(screen.queryByText("+22.9")).not.toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Market")).toBeInTheDocument();
    expect(screen.getByText("Edge")).toBeInTheDocument();
  });

  it("senza `head` la scheda resta quella di prima (WcBoard, weekly-model-case)", () => {
    render(<MatchDetailSheet hideBookLinks data={base} />);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText("Our prediction")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Why the model/i })).not.toBeInTheDocument();
  });

  it("il blocco Pro nomina ciò che c'è dietro invece di sfocare numeri finti", () => {
    render(<MatchDetailSheet hideBookLinks data={{
      ...base,
      head: { sport: "football", league: "PL", pick: null, modelPct: 64, marketPct: 52, edgePct: 11.9, locked: true },
      teamNewsLocked: true,
    }} />);
    expect(screen.getByText(/part of Pro/i)).toBeInTheDocument();
    // niente numeri di infortuni inventati
    expect(screen.queryByText(/No reported absences/i)).not.toBeInTheDocument();
  });
});
