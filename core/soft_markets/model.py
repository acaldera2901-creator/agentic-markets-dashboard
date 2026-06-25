import math
from scipy.stats import poisson

MARKET_LINES = {
    "corners": [8.5, 9.5, 10.5, 11.5],
    "cards":   [3.5, 4.5, 5.5],
    "fouls":   [20.5, 22.5, 24.5],
}
MAIN_LINE = {"corners": 9.5, "cards": 4.5, "fouls": 22.5}
IS_GENERIC = {"corners": True, "cards": False, "fouls": False}  # corner: no skill validata

def team_rate(history, glob_mean, k=5.0):
    """Media shrinked verso la media globale, normalizzata (mean/glob)."""
    if not glob_mean:
        return 1.0
    s, n = sum(history), len(history)
    mean = (s + k * glob_mean) / (n + k)
    return mean / glob_mean

def predict_lambda(market, attack_h, defence_h, attack_a, defence_a, glob_mean):
    """lambda totale = glob*(a_h*d_a + a_a*d_h). Per 'corners' i tassi arrivano
    gia' neutralizzati (=1.0) dal chiamante (stima generica calibrata)."""
    return glob_mean * (attack_h * defence_a + attack_a * defence_h)

def p_over(lam, line):
    return float(1.0 - poisson.cdf(int(math.floor(line)), lam))
