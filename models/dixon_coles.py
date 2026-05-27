import numpy as np
from scipy.optimize import minimize
from scipy.stats import poisson
from typing import List, Dict, Tuple


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
        log_lik += np.log(t) + poisson.logpmf(hg, lam) + poisson.logpmf(ag, mu)
    return -log_lik


class DixonColesModel:
    def __init__(self):
        self.teams: List[str] = []
        self._team_idx: Dict[str, int] = {}
        self.params: np.ndarray | None = None
        self.fitted: bool = False

    def fit(self, matches: List[Dict]) -> None:
        teams = sorted({m["home_team"] for m in matches} | {m["away_team"] for m in matches})
        self.teams = teams
        self._team_idx = {t: i for i, t in enumerate(teams)}
        n = len(teams)

        prepared = []
        for m in matches:
            prepared.append({**m, "_hi": self._team_idx[m["home_team"]], "_ai": self._team_idx[m["away_team"]]})

        x0 = np.concatenate([np.zeros(2 * n), [0.1, -0.1]])
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
