"""
/api/prices and /api/forecast endpoints.
"""

from datetime import date, timedelta
import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, HTTPException

from config import MAGNIFICENT_7
from yahoo import _fetch_close
from models.montecarlo import _pct_dict, _simulate_gbm, _simulate_garch, _simulate_merton

router = APIRouter()


@router.get("/api/prices")
def get_prices(
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

    if start_dt >= end_dt:
        raise HTTPException(400, "start must be before end")

    buffer_start = start_dt - timedelta(days=60)
    close_full   = _fetch_close(ticker_list, buffer_start, end_dt)

    mask         = close_full.index >= pd.Timestamp(start_dt)
    close_window = close_full.loc[mask].copy()

    if close_window.empty:
        raise HTTPException(404, "No data in the requested date range")

    first_valid  = close_window.iloc[0]
    base100      = (close_window / first_valid) * 100

    log_ret      = np.log(close_full / close_full.shift(1))
    log_ret_win  = log_ret.loc[mask]
    exp_vol      = log_ret_win.expanding(min_periods=2).std() * np.sqrt(252)
    exp_vol.replace(0, np.nan, inplace=True)

    vol_adj_raw  = base100 / exp_vol
    fv_va        = vol_adj_raw.apply(lambda s: s.dropna().iloc[0] if s.dropna().shape[0] else np.nan)
    vol_adjusted = (vol_adj_raw / fv_va) * 100

    dates  = [d.strftime("%Y-%m-%d") for d in close_window.index]
    series = {
        t: {
            "name":         MAGNIFICENT_7[t]["name"],
            "color":        MAGNIFICENT_7[t]["color"],
            "base100":      [None if pd.isna(v) else round(v, 2) for v in base100[t].tolist()],
            "vol_adjusted": [None if pd.isna(v) else round(v, 2) for v in vol_adjusted[t].tolist()],
        }
        for t in ticker_list
    }
    return {"dates": dates, "series": series}


@router.get("/api/forecast")
def get_forecast(
    tickers:    str = Query(..., description="Comma-separated tickers"),
    start:      str = Query(..., description="Start date YYYY-MM-DD"),
    end:        str = Query(..., description="End date YYYY-MM-DD"),
    days:       int = Query(30,  ge=5,  le=90),
    simulations:int = Query(500, ge=100, le=2000),
    band_pct:   int = Query(80,  ge=50, le=95, description="CI band % (80 -> p10/p90, 90 -> p5/p95)"),
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

    buffer_start = start_dt - timedelta(days=60)
    close        = _fetch_close(ticker_list, buffer_start, end_dt)
    mask         = close.index >= pd.Timestamp(start_dt)
    close_window = close.loc[mask].copy()

    if close_window.empty:
        raise HTTPException(404, "No data in the requested date range")

    log_ret     = np.log(close_window / close_window.shift(1)).dropna()
    last_date   = close_window.index[-1]
    fc_dates    = pd.bdate_range(start=last_date + timedelta(days=1), periods=days)
    first_valid = close_window.iloc[0]

    lo_pct = (100 - band_pct) / 2
    hi_pct = 100 - lo_pct

    # Compute vol-adjusted scaling factors (same formula as /api/prices)
    log_ret_full  = np.log(close_window / close_window.shift(1))
    exp_vol       = log_ret_full.expanding(min_periods=2).std() * np.sqrt(252)
    exp_vol.replace(0, np.nan, inplace=True)
    base100_hist  = (close_window / first_valid) * 100
    va_raw        = base100_hist / exp_vol
    fv_va         = va_raw.apply(lambda s: s.dropna().iloc[0] if s.dropna().shape[0] else np.nan)

    rng    = np.random.default_rng(42)
    series = {}

    for t in ticker_list:
        ret = log_ret[t].dropna().values
        if len(ret) < 5:
            continue

        last_price  = float(close_window[t].iloc[-1])
        first_price = float(first_valid[t])
        last_b100   = round((last_price / first_price) * 100, 2)

        # Vol-adjusted factor: va_value = base100_value * va_factor
        last_vol = float(exp_vol[t].dropna().iloc[-1]) if exp_vol[t].dropna().shape[0] else 1.0
        va_norm  = float(fv_va[t]) if not np.isnan(fv_va[t]) else 1.0
        va_factor = 100.0 / (last_vol * va_norm) if (last_vol * va_norm) != 0 else 1.0

        gbm_paths    = _simulate_gbm(ret, last_price, first_price, simulations, days, rng)
        garch_paths  = _simulate_garch(ret, last_price, first_price, simulations, days, rng)
        merton_paths = _simulate_merton(ret, last_price, first_price, simulations, days, rng)

        series[t] = {
            "last_historical": last_b100,
            "last_historical_va": round(last_b100 * va_factor, 2),
            "va_factor": round(va_factor, 8),
            "gbm":    _pct_dict(gbm_paths, lo_pct, hi_pct),
            "garch":  _pct_dict(garch_paths  if garch_paths  is not None else gbm_paths, lo_pct, hi_pct),
            "merton": _pct_dict(merton_paths if merton_paths is not None else gbm_paths, lo_pct, hi_pct),
        }

    return {
        "forecast_dates": [d.strftime("%Y-%m-%d") for d in fc_dates],
        "band_pct":       band_pct,
        "series":         series,
    }
