// Compact "who wins" for the hub sidebar (option C). Reads the same frozen
// simulation artifact as WinnerOdds and shows just the top teams + win%, with
// a link to the full bracket-probability table rendered full-width below.
import simData from "@/data/wc2026_simulation.json";

type SimTeam = { team: string; win: number };

const pct = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + "%";

export default function WinnerOddsCompact() {
  const teams = (simData.teams as SimTeam[]).slice(0, 6);
  const max = teams[0]?.win || 1;
  return (
    <div className="wc-aside-card">
      <div className="wc-aside-title">Who wins?</div>
      <ul className="wc-winner-mini">
        {teams.map((t, i) => (
          <li key={t.team}>
            <span className="wc-winner-mini-rank">{i + 1}</span>
            <span className="wc-winner-mini-team wc-blur-name">{t.team}</span>
            <span className="wc-winner-mini-bar"><span style={{ width: `${(t.win / max) * 100}%` }} /></span>
            <span className="wc-winner-mini-pct">{pct(t.win)}</span>
          </li>
        ))}
      </ul>
      <a href="#outlook" className="wc-aside-link">Full outlook →</a>
    </div>
  );
}
