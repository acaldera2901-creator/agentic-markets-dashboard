// #UPCOMING-GATE-0924 — «Prossimi match» rispetta il piano, come le card.
//
// Il bug: la lista del calendario rendeva ogni riga identica — percentuale e
// freccia uguali per anonimo, free e Pro — mentre la stessa partita, in card,
// portava «Pro pick» col lucchetto. Una sezione intera fuori dal gate.
//
// Questo test monta la catena VERA: la vetrina del piano (showcaseRanking +
// isUnlocked, gli stessi di app/api/predictions/route.ts), l'adapter del desk
// (fromDeskFootball) e il componente. Un test che passasse righe `locked` già
// cotte a mano non avrebbe preso il bug: il bug era proprio che nessuno
// trasportava `locked` fin qui.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpcomingList, type UpcomingRow } from "./UpcomingList";
import { fromDeskFootball, type DeskFootballRow } from "@/lib/ui/desk-card";
import { showcaseRanking, isUnlocked, utcDay } from "@/lib/access-projection";
import type { AccessState } from "@/lib/auth";
import "@testing-library/jest-dom/vitest";

const DAY = "2026-09-25";

// Sei partite nello stesso giorno, confidenza decrescente: l'ordine della
// vetrina è deterministico e il rank 0..5 è quello atteso.
const RAW = Array.from({ length: 6 }, (_, n) => ({
  match_id: `m${n}`,
  league: "PL",
  league_name: "Premier League",
  home_team: `Home ${n}`,
  away_team: `Away ${n}`,
  kickoff: `${DAY}T18:0${n}:00Z`,
  p_home: 0.7 - n * 0.05,
  p_draw: 0.2,
  p_away: 0.1 + n * 0.05,
  odds_home: 1.6,
  odds_draw: 4.0,
  odds_away: 5.0,
  best_selection: "HOME" as const,
  confidence_score: 0.7 - n * 0.05,
}));

/** La proiezione del server, in piccolo: su riga chiusa escono SOLO i due
 *  numeri dell'esito di punta (lockedHeadline), mai la tripla né la pick. */
function project(state: AccessState): DeskFootballRow[] {
  const rank = showcaseRanking(
    RAW.map((r) => ({ id: r.match_id, surfaced: true, conf: r.p_home, edge: null, startsAt: r.kickoff })),
    { scopeDay: utcDay(RAW[0].kickoff)! },
  );
  return RAW.map((r) => {
    if (isUnlocked(state, rank.get(r.match_id)!)) return { ...r, locked: false };
    return {
      match_id: r.match_id,
      league: r.league,
      league_name: r.league_name,
      home_team: r.home_team,
      away_team: r.away_team,
      kickoff: r.kickoff,
      locked: true,
      model_prob: r.p_home,
      market_odds: r.odds_home,
    };
  });
}

function rowsFor(state: AccessState): UpcomingRow[] {
  return project(state).map((r) => {
    const data = fromDeskFootball(r, { winLabel: "to win", drawLabel: "Draw" });
    return {
      key: r.match_id,
      day: "25 SET",
      time: "18:00",
      home: data.home,
      away: data.away,
      league: data.league ?? "",
      modelPct: data.modelPct,
      locked: data.locked === true,
      href: "/app/bets",
    };
  });
}

function renderFor(state: AccessState) {
  const { container } = render(
    <UpcomingList rows={rowsFor(state)} vsLabel="vs" modelLabel="model" lockedLabel="Pro pick" />,
  );
  return {
    locked: container.querySelectorAll('.br-row[data-locked="true"]').length,
    open: container.querySelectorAll(".br-row:not([data-locked])").length,
  };
}

describe("«Prossimi match» — il gate di piano", () => {
  it("anonimo: nessuna riga aperta, tutte col lucchetto", () => {
    expect(renderFor("anonymous")).toEqual({ locked: 6, open: 0 });
    expect(screen.getAllByText("Pro pick")).toHaveLength(6);
    expect(screen.queryByText("model")).toBeNull();
  });

  it("free con account: 3 righe aperte (la quota giornaliera), 3 chiuse", () => {
    expect(renderFor("free")).toEqual({ locked: 3, open: 3 });
    expect(screen.getAllByText("model")).toHaveLength(3);
    expect(screen.getAllByText("Pro pick")).toHaveLength(3);
  });

  it("Pro: tutte aperte, nessun lucchetto", () => {
    expect(renderFor("premium")).toEqual({ locked: 0, open: 6 });
    expect(screen.getAllByText("model")).toHaveLength(6);
    expect(screen.queryByText("Pro pick")).toBeNull();
  });

  it("base: 6 di quota, quindi qui tutte aperte", () => {
    expect(renderFor("base")).toEqual({ locked: 0, open: 6 });
  });

  it("le righe chiuse tengono la PERCENTUALE (regola della card, round 2: il lucchetto copre la pick, non il numero)", () => {
    renderFor("anonymous");
    // 70% è l'esito di punta della prima riga: il server lo manda apposta
    // anche da chiusa, ed è il valore che la vetrina gratuita dimostra.
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getAllByText(/%$/)).toHaveLength(6);
  });

  it("la riga chiusa non nomina il lato: nessun «Home 0 to win» in pagina", () => {
    renderFor("anonymous");
    expect(screen.queryByText(/to win/)).toBeNull();
  });
});
