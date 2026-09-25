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

// #RESTYLING-0921 round 4 — la card di livello 1 mostra UN SOLO numero, il
// nostro. Market ed Edge non spariscono dal prodotto: stanno nella scheda
// partita, dove components/lobby/lobby-render.test.tsx li verifica.
describe("PredictionCard", () => {
  it("compact: un solo numero (il nostro), badge High edge derivato, CTA come link", () => {
    render(<PredictionCard data={data} href="/predictions/p1" />);
    const card = screen.getByRole("article");
    expect(card).toHaveAttribute("data-variant", "compact");
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Arsenal");
    expect(screen.getByText("Arsenal to win")).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("Our model")).toBeInTheDocument();
    // Il mercato e l'edge NON si vedono qui, e neppure le loro etichette.
    expect(screen.queryByText("52")).toBeNull();
    expect(screen.queryByText(/\+12\.0/)).toBeNull();
    expect(screen.queryByText("Market")).toBeNull();
    expect(screen.queryByText("Edge")).toBeNull();
    // Il badge resta: è una parola, non un quarto numero da confrontare.
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
  // #RESTYLING-0921 round 2 — il free tier vede il NUMERO, paga per il LATO.
  // Il lucchetto sta sulla pick: nascondere anche la probabilità toglierebbe
  // alla Home di un anonimo l'unica cosa che spiega il prodotto, e il badge
  // «High edge» non potrebbe più comparire.
  it("premiumLocked: la nostra percentuale vera e il badge, solo la Pick chiusa", () => {
    render(<PredictionCard data={data} variant="premiumLocked" href="/plans" />);
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.queryByText("52")).toBeNull();
    expect(screen.getByText("High edge")).toHaveAttribute("data-kind", "high-edge");
    expect(screen.getByText("Pro pick")).toBeInTheDocument();
    expect(screen.queryByText("Arsenal to win")).toBeNull();
    expect(screen.getByRole("link", { name: /unlock full analysis/i })).toHaveAttribute("data-tone", "unlock");
  });
  // Round 4: senza prezzo di mercato la card non aveva più niente da dire in
  // proposito — la nota «no market price yet» parlava di un numero che non è
  // più a schermo. La nostra percentuale c'è lo stesso; il badge no, perché
  // senza mercato non c'è edge.
  it("senza mercato: resta la nostra percentuale, nessun badge", () => {
    render(<PredictionCard data={{ ...data, marketPct: null, edgePct: null }} href="/p/1" />);
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.queryByText(/no market price/i)).toBeNull();
    expect(screen.queryByText("High edge")).toBeNull();
  });
  it("senza probabilità del modello il numero è un trattino, non uno zero", () => {
    render(<PredictionCard data={{ ...data, modelPct: null, marketPct: null, edgePct: null }} href="/p/1" />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
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
  // #I18N-CTA-0924 — unico testo della card rimasto fisso in inglese su tutte
  // le lingue del desk: nessun chiamante passava `lang`.
  it("CTA tradotta quando lang è passato, inglese di default", () => {
    const { unmount } = render(<PredictionCard data={data} href="/p/1" lang="it" />);
    expect(screen.getByRole("link", { name: /vedi l.analisi/i })).toBeInTheDocument();
    unmount();
    render(<PredictionCard data={data} variant="premiumLocked" href="/plans" lang="it" />);
    expect(screen.getByRole("link", { name: /sblocca l.analisi completa/i })).toBeInTheDocument();
  });

  // #TRE-LIVELLI-0925 — il terzo stato visivo del calcio.
  describe("tier «reading»: la direzione si vede, ma non e' una pick", () => {
    const reading: PredictionCardData = { ...data, tier: "reading" };

    it("porta il badge «Model read» al posto di «High edge»", () => {
      render(<PredictionCard data={reading} href="/p/1" />);
      expect(screen.getByText("Model read")).toHaveAttribute("data-kind", "model-read");
      // ESSENZIALE: una riga sotto il floor della sua lega non puo' indossare
      // un badge che la raccomanda, anche se il suo edge di mercato e' alto.
      expect(screen.queryByText("High edge")).toBeNull();
    });

    it("«Model read» batte anche «Featured»", () => {
      render(<PredictionCard data={reading} variant="featured" href="/p/1" />);
      expect(screen.getByText("Model read")).toBeInTheDocument();
      expect(screen.queryByText("Featured")).toBeNull();
    });

    it("la card resta completa: squadre, pick e la nostra percentuale", () => {
      // Nessuna riga sparisce e nessun dato viene tolto: cambia il badge, non
      // il contenuto.
      render(<PredictionCard data={reading} href="/p/1" />);
      expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Arsenal");
      expect(screen.getByText("Arsenal to win")).toBeInTheDocument();
      expect(screen.getByText("64")).toBeInTheDocument();
    });

    it("un badge esplicito del chiamante ha comunque la precedenza", () => {
      render(<PredictionCard data={reading} href="/p/1" badge={{ kind: "starting-soon", label: "Starts in 40 min" }} />);
      expect(screen.getByText("Starts in 40 min")).toBeInTheDocument();
      expect(screen.queryByText("Model read")).toBeNull();
    });

    it("tier «pick» e tier assente non cambiano nulla rispetto a prima", () => {
      const { unmount } = render(<PredictionCard data={{ ...data, tier: "pick" }} href="/p/1" />);
      expect(screen.getByText("High edge")).toBeInTheDocument();
      unmount();
      render(<PredictionCard data={data} href="/p/1" />);
      expect(screen.getByText("High edge")).toBeInTheDocument();
    });
  });
});
