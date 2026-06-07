// "Who wins the World Cup" — tournament outlook table (APPROVE Andrea
// 2026-06-07, lab michele-claude 0c2edb8). CONTENT ONLY, not a signal:
// 100k Monte Carlo runs of the real bracket (12 groups, best thirds, host
// advantage) under the lab wc-elo-logit-v2 model with anti-overconfidence
// Elo noise (σ=60). Data is a frozen artifact (data/wc2026_simulation.json),
// regenerated via scripts/lab_wc_simulator.py — zero runtime cost.
import simData from "@/data/wc2026_simulation.json";
import { WC_T, type WcLang } from "@/lib/world-cup-i18n";

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

export default function WinnerOdds({ lang = "it" }: { lang?: WcLang }) {
  const teams = (simData.teams as SimTeam[]).slice(0, TOP_N);
  const rest = (simData.teams as SimTeam[]).slice(TOP_N);
  const restWinSum = rest.reduce((s, tm) => s + tm.win, 0);
  const t = WC_T[lang];

  return (
    <div className="glass-card wc-winner-card">
      <div className="wc-winner-head">
        <span className="eyebrow">{t.winnerModelView} · {simData.sims.toLocaleString("en-GB")} {t.winnerTournamentSims}</span>
      </div>
      <table className="wc-table wc-winner-table">
        <thead>
          <tr>
            <th className="wc-team-col">{t.winnerColTeam}</th>
            <th>R32</th>
            <th>R16</th>
            <th>QF</th>
            <th>SF</th>
            <th>{t.stageFinal}</th>
            <th className="wc-winner-col">{t.winnerColWin}</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((tm, i) => (
            <tr key={tm.team} className={i < 3 ? "wc-winner-podium" : ""}>
              <td className="wc-team-col">{tm.team}</td>
              <td>{pct(tm.r32)}</td>
              <td>{pct(tm.r16)}</td>
              <td>{pct(tm.qf)}</td>
              <td>{pct(tm.sf)}</td>
              <td>{pct(tm.final)}</td>
              <td className="wc-winner-col wc-pts">{pct(tm.win)}</td>
            </tr>
          ))}
          <tr className="wc-winner-rest">
            <td className="wc-team-col">{t.winnerField} {rest.length} {t.winnerFieldTeams}</td>
            <td colSpan={5} />
            <td className="wc-winner-col">{pct(restWinSum)}</td>
          </tr>
        </tbody>
      </table>
      <p className="wc-winner-note">
        {t.winnerNote} <strong>{t.winnerNot}</strong> {t.winnerNoteSuffix}{" "}
        {simData.generated_at} {t.winnerDisclaimer}
      </p>
    </div>
  );
}
