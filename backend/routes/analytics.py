"""
/api/analytics and /api/fundamentals endpoints.
"""

from datetime import date
import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, HTTPException

from config import MAGNIFICENT_7
from yahoo import _fetch_close, _get_ticker_fundamentals
from models.metrics import _metrics, _drawdown_list, _extended_metrics

router = APIRouter()


@router.get("/api/analytics")
def get_analytics(
    tickers: str = Query(..., description="Comma-separated tickers"),
    start:   str = Query(..., description="Start date YYYY-MM-DD"),
    end:     str = Query(..., description="End date YYYY-MM-DD"),
):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    invalid = [t for t in ticker_list if t not in MAGNIFICENT_7]
    if invalid:
        raise HTTPException(400, f"Invalid tickers: {invalid}")

    try:
        start_dt = date.fromisoformat(start)
        end_dt   = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(400, "Dates must be YYYY-MM-DD")

    close = _fetch_close(ticker_list + ["SPY"], start_dt, end_dt)
    mask  = close.index >= pd.Timestamp(start_dt)
    cw    = close.loc[mask].copy()
    if cw.empty:
        raise HTTPException(404, "No data in requested range")

    dates    = [d.strftime("%Y-%m-%d") for d in cw.index]
    metrics  = {t: _metrics(cw[t]) for t in ticker_list}
    drawdown = {t: _drawdown_list(cw[t]) for t in ticker_list}

    # Correlation matrix
    log_ret = np.log(cw[ticker_list] / cw[ticker_list].shift(1)).dropna()
    corr    = log_ret.corr()
    correlation = {
        t: {t2: round(float(corr.loc[t, t2]), 4) for t2 in ticker_list}
        for t in ticker_list
    }

    # Beta vs SPY
    spy_ret = np.log(cw["SPY"] / cw["SPY"].shift(1)).dropna()
    var_spy = float(spy_ret.var())
    beta: dict[str, float | None] = {}
    for t in ticker_list:
        t_ret  = np.log(cw[t] / cw[t].shift(1)).dropna()
        common = t_ret.index.intersection(spy_ret.index)
        if len(common) > 10 and var_spy > 0:
            cov_ts = float(np.cov(t_ret.loc[common], spy_ret.loc[common])[0, 1])
            beta[t] = round(cov_ts / var_spy, 2)
        else:
            beta[t] = None

    # Extended risk metrics (alpha, Treynor, Calmar, Sortino)
    spy_n       = len(cw["SPY"].dropna())
    spy_ann_ret = float((cw["SPY"].iloc[-1] / cw["SPY"].iloc[0]) ** (252 / max(spy_n, 1)) - 1)
    extended    = {t: _extended_metrics(cw[t], beta.get(t), spy_ann_ret) for t in ticker_list}

    # 21-day rolling annualized volatility
    def roll_vol_list(series: pd.Series) -> list:
        rv = np.log(series / series.shift(1)).rolling(21).std() * np.sqrt(252) * 100
        rv = rv.loc[mask]
        return [None if pd.isna(v) else round(float(v), 2) for v in rv.tolist()]

    rolling_vol: dict = {t: roll_vol_list(cw[t]) for t in ticker_list}
    rolling_vol["SPY"] = roll_vol_list(cw["SPY"])

    spy = cw["SPY"]
    s0  = float(spy.iloc[0])
    return {
        "dates":       dates,
        "metrics":     metrics,
        "correlation": correlation,
        "drawdown":    drawdown,
        "beta":             beta,
        "extended_metrics": extended,
        "rolling_vol":      rolling_vol,
        "benchmark": {
            "ticker":   "SPY",
            "name":     "S&P 500 (SPY)",
            "color":    "#94a3b8",
            "base100":  [None if pd.isna(v) else round(float(v / s0 * 100), 2) for v in spy.tolist()],
            "metrics":  _metrics(spy),
            "drawdown": _drawdown_list(spy),
            "beta":     1.0,
        },
    }


@router.get("/api/fundamentals")
def get_fundamentals(
    tickers: str = Query(..., description="Comma-separated tickers"),
):
    """Fetch valuation and growth fundamentals for the requested MAG7 tickers."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    invalid = [t for t in ticker_list if t not in MAGNIFICENT_7]
    if invalid:
        raise HTTPException(400, f"Invalid tickers: {invalid}")
    return {t: _get_ticker_fundamentals(t) for t in ticker_list}
