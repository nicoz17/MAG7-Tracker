"""
Risk and performance metrics.
"""

import numpy as np
import pandas as pd

from config import RISK_FREE


def _metrics(price: pd.Series) -> dict:
    price = price.dropna()
    n = len(price)
    if n < 2:
        return {"total_return": None, "ann_vol": None, "sharpe": None, "max_drawdown": None}
    total_ret = round(float((price.iloc[-1] / price.iloc[0] - 1) * 100), 2)
    log_ret   = np.log(price / price.shift(1)).dropna()
    ann_vol   = round(float(log_ret.std(ddof=1) * np.sqrt(252) * 100), 2)
    n_years   = n / 252
    ann_ret   = float((price.iloc[-1] / price.iloc[0]) ** (1 / n_years) - 1)
    sharpe    = round((ann_ret - RISK_FREE) / (ann_vol / 100), 2) if ann_vol > 0 else None
    dd        = (price / price.cummax() - 1) * 100
    max_dd    = round(float(dd.min()), 2)
    return {"total_return": total_ret, "ann_vol": ann_vol, "sharpe": sharpe, "max_drawdown": max_dd}


def _drawdown_list(price: pd.Series) -> list:
    dd = (price / price.cummax() - 1) * 100
    return [None if pd.isna(v) else round(float(v), 2) for v in dd.tolist()]


def _extended_metrics(price: pd.Series, beta_val: float | None, spy_ann_ret: float) -> dict:
    """Jensen's Alpha, Treynor, Calmar, Sortino ratios."""
    price = price.dropna()
    n = len(price)
    if n < 2:
        return {"alpha": None, "treynor": None, "calmar": None, "sortino": None}
    log_ret = np.log(price / price.shift(1)).dropna()
    n_years = max(n / 252, 1e-6)
    ann_ret = float((price.iloc[-1] / price.iloc[0]) ** (1 / n_years) - 1)
    # Calmar = annualized return / |max drawdown|
    max_dd_abs = abs(float((price / price.cummax() - 1).min()))
    calmar = round(ann_ret / max_dd_abs, 2) if max_dd_abs > 1e-6 else None
    # Sortino = (R_p - R_f) / downside deviation
    excess = log_ret - RISK_FREE / 252
    neg = excess[excess < 0]
    down_vol = float(neg.std(ddof=1) * np.sqrt(252)) if len(neg) > 1 else None
    sortino = round((ann_ret - RISK_FREE) / down_vol, 2) if down_vol and down_vol > 0 else None
    # Treynor = (R_p - R_f) / beta
    treynor = round((ann_ret - RISK_FREE) / beta_val, 3) if beta_val and abs(beta_val) > 1e-6 else None
    # Jensen's Alpha = R_p - R_f - beta * (R_m - R_f)  [annualized, in %]
    alpha = round((ann_ret - RISK_FREE - (beta_val or 0) * (spy_ann_ret - RISK_FREE)) * 100, 2) if beta_val is not None else None
    return {"alpha": alpha, "treynor": treynor, "calmar": calmar, "sortino": sortino}
