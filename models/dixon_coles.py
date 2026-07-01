import numpy as np
from scipy.optimize import minimize
from scipy.stats import poisson
from datetime import date
from typing import List, Dict, Tuple


def decay_weights(
    dates: List[date | None], half_life_days: float, ref: date | None = None
) -> List[float]:
    """Dixon-Coles time weighting: a match `half_life_days` old counts half as much.

    weight = 0.5 ** (age_days / half_life_days), age measured from the most recent
    match (or `ref`). Matches with an unknown date get weight 1.0 (no down-weighting).
    """
    if half_life_days <= 0:
        return [1.0] * len(dates)
    known = [d for d in dates if d is not None]
    if not known:
        return [1.0] * len(dates)
    anchor = ref or max(known)
    out: List[float] = []
    for d in dates:
        if d is None:
            out.append(1.0)
        else:
            age = (anchor - d).days
            out.append(0.5 ** (age / half_life_days))
    return out


def _tau(x: int, y: int, lam: float, mu: float, rho: float) -> float:
    if x == 0 and y == 0:
        return 1 - lam * mu * rho
    if x == 0 and y == 1:
        return 1 + lam * rho
    if x == 1 and y == 0:
        return 1 + mu * rho
    if x == 1 and y == 1:
        return 1 - rho
    return 1.0


def _neg_log_likelihood(params: np.ndarray, matches: List[Dict], n_teams: int) -> float:
    attack = params[:n_teams]
    defence = params[n_teams : 2 * n_teams]
    home_adv = params[-2]
    rho = params[-1]
    log_lik = 0.0
    for m in matches:
        i, j = m["_hi"], m["_ai"]
        hg, ag = m["home_goals"], m["away_goals"]
        lam = np.exp(attack[i] + defence[j] + home_adv)
        mu = np.exp(attack[j] + defence[i])
        t = _tau(hg, ag, lam, mu, rho)
        if t <= 0:
            return 1e10
        w = m.get("_w", 1.0)
        log_lik += w * (np.log(t) + poisson.logpmf(hg, lam) + poisson.logpmf(ag, mu))
    return -log_lik


class DixonColesModel:
    def __init__(self):
        self.teams: List[str] = []
        self._team_idx: Dict[str, int] = {}
        self.params: np.ndarray | None = None
        self.fitted: bool = False

    def fit(
        self,
        matches: List[Dict],
        warm_start: "DixonColesModel | None" = None,
        half_life_days: float = 0.0,
    ) -> None:
        """Fit the model. half_life_days > 0 enables Dixon-Coles time weighting
        (recent matches count more); 0 keeps every match equally weighted.
        Matches should carry an ISO 'date' string for weighting to apply."""
        teams = sorted({m["home_team"] for m in matches} | {m["away_team"] for m in matches})
        self.teams = teams
        self._team_idx = {t: i for i, t in enumerate(teams)}
        n = len(teams)

        if half_life_days and half_life_days > 0:
            parsed = [date.fromisoformat(m["date"]) if m.get("date") else None for m in matches]
            weights = decay_weights(parsed, half_life_days)
        else:
            weights = [1.0] * len(matches)

        prepared = []
        for m, w in zip(matches, weights):
            prepared.append({
                **m,
                "_hi": self._team_idx[m["home_team"]],
                "_ai": self._team_idx[m["away_team"]],
                "_w": w,
            })

        x0 = np.concatenate([np.zeros(2 * n), [0.1, -0.1]])
        # Warm-start from a previous fit (same league, slightly fewer teams): reuse
        # per-team params by name so re-optimization converges in far fewer steps.
        if warm_start is not None and warm_start.fitted and warm_start.params is not None:
            pn = len(warm_start.teams)
            for t, i in self._team_idx.items():
                wi = warm_start._team_idx.get(t)
                if wi is not None:
                    x0[i] = warm_start.params[wi]
                    x0[n + i] = warm_start.params[pn + wi]
            x0[-2] = warm_start.params[-2]
            x0[-1] = warm_start.params[-1]

        bounds = [(-3.0, 3.0)] * (2 * n) + [(0.0, 1.0), (-1.0, 0.0)]

        result = minimize(_neg_log_likelihood, x0, args=(prepared, n), method="L-BFGS-B", bounds=bounds)
        self.params = result.x
        self.fitted = True

    def predict(self, home_team: str, away_team: str, max_goals: int = 8) -> Tuple[float, float, float]:
        if not self.fitted:
            raise ValueError("Model not fitted — call fit() first")
        n = len(self.teams)
        i = self._team_idx[home_team]
        j = self._team_idx[away_team]
        attack, defence = self.params[:n], self.params[n : 2 * n]
        home_adv, rho = self.params[-2], self.params[-1]
        lam = np.exp(attack[i] + defence[j] + home_adv)
        mu = np.exp(attack[j] + defence[i])

        home_win = draw = away_win = 0.0
        for hg in range(max_goals + 1):
            for ag in range(max_goals + 1):
                p = _tau(hg, ag, lam, mu, rho) * poisson.pmf(hg, lam) * poisson.pmf(ag, mu)
                if hg > ag:
                    home_win += p
                elif hg == ag:
                    draw += p
                else:
                    away_win += p

        total = home_win + draw + away_win
        return home_win / total, draw / total, away_win / total

    def over_prob(self, home_team: str, away_team: str, line: float = 2.5, max_goals: int = 10) -> float:
        """P(total goals > line) from the same Dixon-Coles scoreline (tau low-score
        correction included). Used for Over/Under markets."""
        if not self.fitted:
            raise ValueError("Model not fitted — call fit() first")
        n = len(self.teams)
        i = self._team_idx[home_team]
        j = self._team_idx[away_team]
        attack, defence = self.params[:n], self.params[n : 2 * n]
        home_adv, rho = self.params[-2], self.params[-1]
        lam = np.exp(attack[i] + defence[j] + home_adv)
        mu = np.exp(attack[j] + defence[i])

        over = total = 0.0
        for hg in range(max_goals + 1):
            for ag in range(max_goals + 1):
                p = _tau(hg, ag, lam, mu, rho) * poisson.pmf(hg, lam) * poisson.pmf(ag, mu)
                total += p
                if hg + ag > line:
                    over += p
        return over / total if total > 0 else float("nan")
