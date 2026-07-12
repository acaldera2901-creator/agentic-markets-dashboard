import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrackRecordView } from "./TrackRecordView";
import { useTrackRecord } from "./use-track-record";
import type { TrackRow, TrackStats } from "./use-track-record";

vi.mock("./use-track-record", () => ({ useTrackRecord: vi.fn() }));

const mockedUseTrackRecord = vi.mocked(useTrackRecord);

const wonRow: TrackRow = {
  id: "1", sport: "football", competition: "Serie A",
  homeTeam: "Inter", awayTeam: "Verona", kickoff: "2026-07-10T18:45:00Z",
  finalScore: "2-1", result: "won", locked: false, decision: "Vince l'Inter",
};

const lockedRow: TrackRow = {
  id: "2", sport: "tennis", competition: "ATP",
  homeTeam: "Sinner", awayTeam: "Alcaraz", kickoff: "2026-07-11T14:00:00Z",
  finalScore: "6-4 3-6 4-6", result: "lost", locked: true,
  // decision popolata per verificare che la view la nasconda comunque quando locked,
  // anche se (nell'hook reale) locked→decision è sempre null.
  decision: "Vince Alcaraz",
};

function mock(overrides: {
  history?: TrackRow[]; stats?: TrackStats | null; loading?: boolean; error?: string | null;
}) {
  mockedUseTrackRecord.mockReturnValue({
    history: overrides.history ?? [],
    stats: overrides.stats ?? null,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
  });
}

beforeEach(() => { vi.restoreAllMocks(); });

describe("TrackRecordView", () => {
  it("mostra l'hit-rate e i conteggi dalle stats", () => {
    mock({ stats: { total: 10, won: 7, lost: 3, void: 0, pending: 0, winRate: "70.0%" }, history: [wonRow] });
    render(<TrackRecordView />);
    expect(screen.getByText("70.0%")).toBeInTheDocument();
    expect(screen.getByText(/10 pick conclusi/)).toBeInTheDocument();
    expect(screen.getByText(/7 corretti/)).toBeInTheDocument();
  });

  it("una riga vinta e sbloccata mostra punteggio, esito e decisione", () => {
    mock({ stats: { total: 1, won: 1, lost: 0, void: 0, pending: 0, winRate: "100.0%" }, history: [wonRow] });
    render(<TrackRecordView />);
    expect(screen.getByText("2-1")).toBeInTheDocument();
    expect(screen.getByText("Vince l'Inter")).toBeInTheDocument();
    const badge = document.querySelector('[data-outcome="won"]');
    expect(badge).not.toBeNull();
  });

  it("una riga locked mostra punteggio ed esito ma NON la decisione", () => {
    mock({ stats: { total: 1, won: 0, lost: 1, void: 0, pending: 0, winRate: "0.0%" }, history: [lockedRow] });
    render(<TrackRecordView />);
    expect(screen.getByText("6-4 3-6 4-6")).toBeInTheDocument();
    const badge = document.querySelector('[data-outcome="lost"]');
    expect(badge).not.toBeNull();
    expect(screen.queryByText("Vince Alcaraz")).toBeNull();
    // hint di sblocco presente invece della decisione
    expect(screen.getByText(/Sblocca/i)).toBeInTheDocument();
  });

  it("winRate null mostra un messaggio neutro, nessuna percentuale inventata", () => {
    mock({ stats: { total: 2, won: 0, lost: 0, void: 0, pending: 2, winRate: null }, history: [] });
    render(<TrackRecordView />);
    expect(screen.getByText(/Ancora pochi risultati/i)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("stato loading", () => {
    mock({ loading: true });
    render(<TrackRecordView />);
    expect(screen.getByText(/Caricamento/i)).toBeInTheDocument();
  });

  it("stato empty", () => {
    mock({ stats: { total: 0, won: 0, lost: 0, void: 0, pending: 0, winRate: null }, history: [] });
    render(<TrackRecordView />);
    expect(screen.getByText(/Nessun risultato ancora/i)).toBeInTheDocument();
  });

  it("stato error mostra messaggio di errore e retry", () => {
    mock({ loading: false, error: "boom" });
    render(<TrackRecordView />);
    expect(screen.getByText(/Qualcosa è andato storto/i)).toBeInTheDocument();
    expect(screen.getByText(/Riprova/i)).toBeInTheDocument();
  });
});
