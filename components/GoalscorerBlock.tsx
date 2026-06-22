// #PLAYER-GOALSCORER — blocco Marcatori condiviso. Usato dalla scheda World Cup
// (components/world-cup/WcBoard.tsx). La board home (app/app/page.tsx) ha una
// copia inline equivalente: unificare lì quando il monolite verrà rifattorizzato.
// CSS in app/globals.css (.gs-block e figli) — già condiviso tra le due board.
import { type GoalscorerMarket } from "@/lib/goalscorer-model";

type GsLang = "it" | "en" | "es" | "fr" | "ru";

function p5<T>(lang: GsLang, v: { it: T; en: T; es: T; fr: T; ru: T }): T {
  return v[lang];
}
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function GoalscorerBlock({
  markets,
  homeTeam,
  awayTeam,
  lang,
}: {
  markets: GoalscorerMarket[];
  homeTeam: string;
  awayTeam: string;
  lang: GsLang;
}) {
  // Split per lato, ordina per P modello (già ordinato a monte, ma difensivo).
  const home = markets.filter((m) => m.side === "home").sort((a, b) => b.pScores - a.pScores);
  const away = markets.filter((m) => m.side === "away").sort((a, b) => b.pScores - a.pScores);
  if (home.length === 0 && away.length === 0) return null;
  // Edge mostrato SOLO quando esiste una quota (book US). Mai numeri inventati.
  const hasAnyOdds = markets.some((m) => m.edge != null);
  const edgeTxt = (m: GoalscorerMarket) =>
    m.edge == null ? "–" : m.edge > 0 ? `+${(m.edge * 100).toFixed(1)}%` : p5(lang, { it: "in linea", en: "in line", es: "en línea", fr: "en ligne", ru: "в линии" });

  const renderSide = (rows: GoalscorerMarket[], team: string) => {
    if (rows.length === 0) return null;
    return (
      <div className="gs-side">
        <div className="gs-team">{team}</div>
        <ul className="gs-list">
          {rows.map((m, i) => (
            <li key={m.playerId ?? `${m.side}-${m.name}-${i}`} className="gs-row">
              <span className="gs-name" title={m.name}>
                {m.name}
                {m.confidence === "alta" && <span className="gs-tier" title={p5(lang, { it: "Titolare / alta confidenza", en: "Starter / high confidence", es: "Titular / confianza alta", fr: "Titulaire / confiance élevée", ru: "Основной / высокая уверенность" })} />}
              </span>
              <span className="gs-model" title={p5(lang, { it: "Probabilità modello che segni", en: "Model probability to score", es: "Probabilidad del modelo de marcar", fr: "Probabilité du modèle de marquer", ru: "Вероятность гола по модели" })}>{pct(m.pScores)}</span>
              <span className="gs-market">{m.marketImplied != null ? pct(m.marketImplied) : "–"}</span>
              <span className={`gs-edge${m.edge != null && m.edge > 0 ? " pos" : ""}`}>{edgeTxt(m)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="gs-block">
      <div className="gs-head">
        <span className="gs-title">
          {p5(lang, { it: "Marcatori", en: "Goalscorers", es: "Goleadores", fr: "Buteurs", ru: "Бомбардиры" })}
        </span>
        <span className="gs-cols" aria-hidden="true">
          <span>{p5(lang, { it: "Modello", en: "Model", es: "Modelo", fr: "Modèle", ru: "Модель" })}</span>
          <span>{p5(lang, { it: "Mercato", en: "Market", es: "Mercado", fr: "Marché", ru: "Рынок" })}</span>
          <span>Edge</span>
        </span>
      </div>
      <div className="gs-sides">
        {renderSide(home, homeTeam)}
        {renderSide(away, awayTeam)}
      </div>
      <p className="gs-note">
        {hasAnyOdds
          ? p5(lang, {
              it: "Probabilità che il giocatore segni almeno un gol. Edge = modello − quota (book US).",
              en: "Probability the player scores at least once. Edge = model − price (US books).",
              es: "Probabilidad de que el jugador marque al menos una vez. Edge = modelo − cuota (books US).",
              fr: "Probabilité que le joueur marque au moins une fois. Edge = modèle − cote (books US).",
              ru: "Вероятность, что игрок забьёт хотя бы раз. Edge = модель − котировка (US-буки).",
            })
          : p5(lang, {
              it: "Probabilità che il giocatore segni almeno un gol. Nessuna quota disponibile: Edge non calcolabile.",
              en: "Probability the player scores at least once. No price available: edge not computable.",
              es: "Probabilidad de que el jugador marque al menos una vez. Sin cuota: edge no calculable.",
              fr: "Probabilité que le joueur marque au moins une fois. Pas de cote : edge non calculable.",
              ru: "Вероятность, что игрок забьёт хотя бы раз. Котировки нет: edge не рассчитывается.",
            })}
      </p>
    </div>
  );
}
