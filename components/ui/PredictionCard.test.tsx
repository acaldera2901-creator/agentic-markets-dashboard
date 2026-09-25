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
  // #LIVE-SCORE-CARD-0925 — Andrea, 25/09: «i risultati devono vedersi e
  // devono essere live come prima del restyle». Il dato (liveScoreLabel)
  // c'era già in HomeLobby (dal ticker orfano), non arrivava mai alla card.
  // #CARD-LAYOUT-0925 — Andrea ha bocciato il punteggio al posto del «vs»
  // (appeso al nome di casa). Ora sta in colonna: un valore per riga, accanto
  // alla squadra a cui appartiene, come su un tabellone.
  it("live con punteggio noto: un valore per riga squadra, e la frase intera per chi ascolta", () => {
    render(<PredictionCard data={{ ...data, isLive: true, liveMinute: 58, liveScoreLabel: "2-1" }} variant="live" href="/p/1" />);
    const home = screen.getByTestId("score-home");
    const away = screen.getByTestId("score-away");
    expect(home).toHaveTextContent("2");
    expect(away).toHaveTextContent("1");
    expect(home).toHaveAttribute("data-live", "true");
    expect(home.closest(".br-card__team")).toHaveTextContent("Arsenal");
    expect(away.closest(".br-card__team")).toHaveTextContent("Chelsea");
    // Le cifre sono aria-hidden: per chi ascolta il punteggio è una frase.
    expect(screen.getByRole("heading", { level: 3 })).toHaveAccessibleName(/vs Chelsea.*Live score 2-1$/);
  });
  it("tennis live: un set per colonna, nell'ordine in cui si giocano", () => {
    render(<PredictionCard data={{ ...data, sport: "tennis", home: "Alcaraz", away: "Sinner", isLive: true, liveScoreLabel: "6-4 3-6 2-1" }} variant="live" href="/p/1" />);
    expect([...screen.getByTestId("score-home").children].map((c) => c.textContent)).toEqual(["6", "3", "2"]);
    expect([...screen.getByTestId("score-away").children].map((c) => c.textContent)).toEqual(["4", "6", "1"]);
  });
  it("punteggio in una forma sconosciuta: si mostra intero accanto a LIVE, non in una colonna sbagliata", () => {
    render(<PredictionCard data={{ ...data, isLive: true, liveScoreLabel: "HT" }} variant="live" href="/p/1" />);
    expect(screen.queryByTestId("score-home")).toBeNull();
    expect(screen.getByText("HT")).toHaveClass("br-card__scoreraw");
  });
  it("live ma punteggio non ancora noto: nessuna colonna, nessun trattino a caso", () => {
    render(<PredictionCard data={{ ...data, isLive: true, liveMinute: 3 }} variant="live" href="/p/1" />);
    expect(screen.queryByTestId("score-home")).toBeNull();
    expect(screen.queryByText(/live score/i)).toBeNull();
  });
  it("non live: il punteggio non si mostra anche se per qualche motivo è valorizzato", () => {
    render(<PredictionCard data={{ ...data, isLive: false, liveScoreLabel: "2-1" }} href="/p/1" />);
    expect(screen.queryByTestId("score-home")).toBeNull();
    expect(screen.queryByText("2-1")).toBeNull();
    expect(screen.queryByText(/live score/i)).toBeNull();
  });
  // #CARD-LAYOUT-0925 — l'header è due righe assegnate; la watchlist sta nel
  // piede accanto alla CTA, non più fra i chip.
  it("la watchlist vive nel piede, accanto alla CTA; l'header ha solo informazione", () => {
    render(<PredictionCard data={data} href="/p/1" saved={false} onToggleWatchlist={() => {}} />);
    const watch = screen.getByRole("button", { name: /watchlist/i });
    expect(watch.closest("footer")).not.toBeNull();
    expect(watch.closest("header")).toBeNull();
    expect(screen.getByText("High edge").closest(".br-card__status")).not.toBeNull();
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
});
