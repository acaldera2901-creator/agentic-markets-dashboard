// "Who wins the World Cup" — tournament outlook table (APPROVE Andrea
// 2026-06-07, lab michele-claude 0c2edb8). CONTENT ONLY, not a signal:
// 100k Monte Carlo runs of the real bracket (12 groups, best thirds, host
// advantage) under the lab wc-elo-logit-v2 model with anti-overconfidence
// Elo noise (σ=60). Data is a frozen artifact (data/wc2026_simulation.json),
// regenerated via scripts/lab_wc_simulator.py — zero runtime cost.
import simData from "@/data/wc2026_simulation.json";

type SimTeam = {
  team: string;
  elo: number;
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  win: number;
};

const TOP_N = 12;

const pct = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + "%";

export default function WinnerOdds() {
  const teams = (simData.teams as SimTeam[]).slice(0, TOP_N);
  const rest = (simData.teams as SimTeam[]).slice(TOP_N);
  const restWinSum = rest.reduce((s, t) => s + t.win, 0);

  return (
    <div className="glass-card wc-winner-card">
      <div className="wc-winner-head">
        <span className="eyebrow">Model view · {simData.sims.toLocaleString("en-GB")} tournament simulations</span>
      </div>
      <table className="wc-table wc-winner-table">
        <thead>
          <tr>
            <th className="wc-team-col">Team</th>
            <th>R32</th>
            <th>R16</th>
            <th>QF</th>
            <th>SF</th>
            <th>Final</th>
            <th className="wc-winner-col">🏆 Win</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => (
            <tr key={t.team} className={i < 3 ? "wc-winner-podium" : ""}>
              <td className="wc-team-col"><span className="wc-blur-name">{t.team}</span></td>
              <td>{pct(t.r32)}</td>
              <td>{pct(t.r16)}</td>
              <td>{pct(t.qf)}</td>
              <td>{pct(t.sf)}</td>
              <td>{pct(t.final)}</td>
              <td className="wc-winner-col wc-pts">{pct(t.win)}</td>
            </tr>
          ))}
          <tr className="wc-winner-rest">
            <td className="wc-team-col">Field (other {rest.length} teams)</td>
            <td colSpan={5} />
            <td className="wc-winner-col">{pct(restWinSum)}</td>
          </tr>
        </tbody>
      </table>
      <p className="wc-winner-note">
        Pure model view (Elo-rating engine, full-bracket Monte Carlo, host
        advantage included) — it is <strong>not</strong> blended with betting
        markets, which price the favourites less aggressively (antepost markets
        put Spain nearer 18%). Same favourite and podium as the major public
        supercomputer models. Updated {simData.generated_at} · for information
        only, not betting advice.
      </p>
    </div>
  );
}
