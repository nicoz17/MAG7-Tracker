"""
Monte Carlo simulation helpers: GBM, GARCH(1,1), Merton Jump-Diffusion.
"""

import numpy as np
from arch import arch_model


def _pct_dict(paths: np.ndarray, lo: float, hi: float) -> dict:
    """Percentile dict {median, p_lo, p_hi} from (simulations x days) array."""
    return {
        "median": [round(float(v), 2) for v in np.percentile(paths, 50, axis=0)],
        "p_lo":   [round(float(v), 2) for v in np.percentile(paths, lo,  axis=0)],
        "p_hi":   [round(float(v), 2) for v in np.percentile(paths, hi,  axis=0)],
    }


def _simulate_gbm(
    ret: np.ndarray,
    last_price: float,
    first_price: float,
    simulations: int,
    days: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """Geometric Brownian Motion. Returns (simulations x days) base-100 paths."""
    mu    = float(ret.mean())
    sigma = float(ret.std(ddof=1))
    Z     = rng.standard_normal((simulations, days))
    cum   = np.cumsum((mu - 0.5 * sigma ** 2) + sigma * Z, axis=1)
    return (last_price * np.exp(cum)) / first_price * 100


def _simulate_garch(
    ret: np.ndarray,
    last_price: float,
    first_price: float,
    simulations: int,
    days: int,
    rng: np.random.Generator,
) -> np.ndarray | None:
    """GARCH(1,1). Returns (simulations x days) base-100 paths or None on failure."""
    ret_pct = ret * 100
    model = arch_model(ret_pct, vol="Garch", p=1, q=1, mean="Constant", dist="Normal")
    try:
        res = model.fit(disp="off", show_warning=False, options={"maxiter": 300})
    except Exception:
        return None

    mu_pct   = float(res.params["mu"])
    omega    = float(res.params["omega"])
    alpha    = float(res.params["alpha[1]"])
    beta_p   = float(res.params["beta[1]"])
    last_var = float(res.conditional_volatility[-1]) ** 2

    Z         = rng.standard_normal((simulations, days))
    ret_paths = np.zeros((simulations, days))
    prev_var  = np.full(simulations, last_var)
    prev_eps2 = np.zeros(simulations)

    for d in range(days):
        cur_var       = np.maximum(omega + alpha * prev_eps2 + beta_p * prev_var, 1e-8)
        eps           = np.sqrt(cur_var) * Z[:, d]
        ret_paths[:, d] = (mu_pct + eps) / 100
        prev_eps2     = eps ** 2
        prev_var      = cur_var

    return (last_price * np.exp(np.cumsum(ret_paths, axis=1))) / first_price * 100


def _simulate_merton(
    ret: np.ndarray,
    last_price: float,
    first_price: float,
    simulations: int,
    days: int,
    rng: np.random.Generator,
) -> np.ndarray | None:
    """
    Merton Jump-Diffusion: splits returns into diffusion (|r| <= 2.5 sigma) and
    rare jumps (|r| > 2.5 sigma). Returns (simulations x days) base-100 paths or None.
    """
    if len(ret) < 20:
        return None

    sigma   = float(ret.std(ddof=1))
    thresh  = 2.5 * sigma
    is_jump = np.abs(ret - float(ret.mean())) > thresh
    j_ret   = ret[is_jump]
    d_ret   = ret[~is_jump]

    lam   = max(float(len(j_ret)) / len(ret), 1e-6)   # daily jump probability
    mu_J  = float(j_ret.mean())             if len(j_ret) > 0 else 0.0
    sig_J = float(j_ret.std(ddof=1))        if len(j_ret) > 1 else sigma * 0.5
    mu_d  = float(d_ret.mean())             if len(d_ret) > 1 else float(ret.mean())
    sig_d = float(d_ret.std(ddof=1))        if len(d_ret) > 2 else sigma

    # Compensate drift for expected jump impact E[e^J] - 1
    kappa = np.exp(mu_J + 0.5 * sig_J ** 2) - 1
    drift = mu_d - lam * kappa - 0.5 * sig_d ** 2

    Z = rng.standard_normal((simulations, days))
    N = rng.poisson(lam, (simulations, days))
    J = rng.normal(mu_J, max(sig_J, 1e-8), (simulations, days))

    log_r = drift + sig_d * Z + N * J
    return (last_price * np.exp(np.cumsum(log_r, axis=1))) / first_price * 100
