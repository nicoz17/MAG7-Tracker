"""
/api/portfolio endpoint.
"""

from datetime import date
import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, HTTPException
from scipy.optimize import minimize

from config import MAGNIFICENT_7, RISK_FREE
from yahoo import _fetch_close
from models.metrics import _metrics

router = APIRouter()


def _tangent_portfolio(close_df: pd.DataFrame, tickers: list[str]) -> dict | None:
    """Maximum Sharpe ratio portfolio via SLSQP (long-only, fully invested)."""
    log_ret = np.log(close_df[tickers] / close_df[tickers].shift(1)).dropna()
    if len(log_ret) < 20 or len(tickers) < 2:
        return None
    mu  = log_ret.mean().values * 252
    cov = log_ret.cov().values  * 252
    n   = len(tickers)

    def neg_sharpe(w: np.ndarray) -> float:
        r = float(w @ mu)
        v = float(np.sqrt(max(float(w @ cov @ w), 1e-10)))
        return -(r - RISK_FREE) / v

    res = minimize(
        neg_sharpe,
        x0=np.ones(n) / n,
        method="SLSQP",
        bounds=[(0.0, 1.0)] * n,
        constraints=[{"type": "eq", "fun": lambda w: w.sum() - 1.0}],
        options={"ftol": 1e-9, "maxiter": 1000},
    )
    if not res.success:
        return None

    w       = res.x
    ann_ret = float(w @ mu)
    ann_vol = float(np.sqrt(max(float(w @ cov @ w), 1e-10)))
    return {
        "weights":         {t: round(float(w[i]), 4) for i, t in enumerate(tickers)},
        "expected_return": round(ann_ret * 100, 2),
        "expected_vol":    round(ann_vol * 100, 2),
        "sharpe":          round((ann_ret - RISK_FREE) / ann_vol, 2) if ann_vol > 0 else None,
    }


@router.get("/api/portfolio")
def get_portfolio(
    tickers: str = Query(..., description="Comma-separated tickers"),
    weights: str = Query(..., description="Comma-separated weights (will be normalized)"),
    start:   str = Query(..., description="Start date YYYY-MM-DD"),
    end:     str = Query(..., description="End date YYYY-MM-DD"),
):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    invalid = [t for t in ticker_list if t not in MAGNIFICENT_7]
    if invalid:
        raise HTTPException(400, f"Invalid tickers: {invalid}")

    try:
        weight_list = [float(w) for w in weights.split(",") if w.strip()]
    except ValueError:
        raise HTTPException(400, "Weights must be numeric")

    if len(weight_list) != len(ticker_list):
        raise HTTPException(400, "Number of weights must match number of tickers")

    total_w = sum(abs(w) for w in weight_list)
    if total_w <= 0:
        raise HTTPException(400, "At least one weight must be positive")
    norm = {t: abs(w) / total_w for t, w in zip(ticker_list, weight_list)}

    try:
        start_dt = date.fromisoformat(start)
        end_dt   = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(400, "Dates must be YYYY-MM-DD")

    close = _fetch_close(ticker_list + ["SPY"], start_dt, end_dt)
    cw    = close.loc[close.index >= pd.Timestamp(start_dt)].copy()
    if cw.empty:
        raise HTTPException(404, "No data in requested range")

    dates = [d.strftime("%Y-%m-%d") for d in cw.index]

    def fmt(s: pd.Series) -> list:
        return [None if pd.isna(v) else round(float(v), 2) for v in s.tolist()]

    portfolio_b100 = pd.Series(0.0, index=cw.index)
    per_ticker: dict = {}
    for t in ticker_list:
        p0   = float(cw[t].iloc[0])
        b100 = cw[t] / p0 * 100
        portfolio_b100 += norm[t] * b100
        per_ticker[t] = {
            "name":    MAGNIFICENT_7[t]["name"],
            "color":   MAGNIFICENT_7[t]["color"],
            "weight":  round(norm[t] * 100, 2),
            "base100": fmt(b100),
        }

    # Tangent portfolio (max Sharpe, long-only)
    tangent = _tangent_portfolio(cw, ticker_list)

    # Also compute tangent portfolio performance series if found
    tangent_b100: list | None = None
    if tangent is not None:
        tw = tangent["weights"]
        t_series = pd.Series(0.0, index=cw.index)
        for t in ticker_list:
            p0 = float(cw[t].iloc[0])
            t_series += tw.get(t, 0.0) * (cw[t] / p0 * 100)
        tangent_b100 = fmt(t_series)
        tangent["base100"]  = tangent_b100
        tangent["metrics"]  = _metrics(t_series)

    spy = cw["SPY"]
    return {
        "dates":     dates,
        "portfolio": {
            "base100":  fmt(portfolio_b100),
            "metrics":  _metrics(portfolio_b100),
        },
        "tickers":   per_ticker,
        "tangent":   tangent,
        "benchmark": {
            "ticker":  "SPY",
            "name":    "S&P 500 (SPY)",
            "color":   "#94a3b8",
            "base100": fmt(spy / float(spy.iloc[0]) * 100),
            "metrics": _metrics(spy),
        },
    }
