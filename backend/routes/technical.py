"""
/api/technical and /api/backtest endpoints.
"""

from datetime import date, timedelta
import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, HTTPException

from config import MAGNIFICENT_7
from yahoo import _yahoo_history, _yahoo_earnings
from models.signals import _compute_signals
from models.backtest import _run_backtest

router = APIRouter()


@router.get("/api/technical")
def get_technical(
    ticker: str = Query(..., description="Single ticker"),
    start:  str = Query(..., description="Start date YYYY-MM-DD"),
    end:    str = Query(..., description="End date YYYY-MM-DD"),
):
    t = ticker.strip().upper()
    if t not in MAGNIFICENT_7:
        raise HTTPException(400, f"Invalid ticker: {t}")

    try:
        start_dt = date.fromisoformat(start)
        end_dt   = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(400, "Dates must be YYYY-MM-DD")

    buffer_start = start_dt - timedelta(days=300)
    ohlcv = _yahoo_history(t, buffer_start, end_dt)
    ohlcv.index = pd.to_datetime(ohlcv.index).normalize()
    ohlcv = ohlcv[~ohlcv.index.duplicated(keep="last")]
    price  = ohlcv["close"]
    volume = ohlcv["volume"]

    mask       = price.index >= pd.Timestamp(start_dt)
    price_win  = price.loc[mask]
    volume_win = volume.loc[mask]

    if price_win.empty:
        raise HTTPException(404, "No data in the requested date range")

    # Moving averages
    sma20  = price.rolling(20).mean().loc[mask]
    sma50  = price.rolling(50).mean().loc[mask]
    sma200 = price.rolling(200).mean().loc[mask]

    # Bollinger Bands (20, +/-2 sigma)
    bb_mid   = sma20
    bb_std   = price.rolling(20).std().loc[mask]
    bb_upper = bb_mid + 2 * bb_std
    bb_lower = bb_mid - 2 * bb_std

    # RSI(14) - Wilder's EMA
    delta    = price.diff()
    avg_gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    avg_loss = (-delta).clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    rs       = avg_gain / avg_loss.replace(0, np.nan)
    rsi      = (100 - 100 / (1 + rs)).loc[mask]

    # MACD(12, 26, 9)
    ema12       = price.ewm(span=12, adjust=False).mean()
    ema26       = price.ewm(span=26, adjust=False).mean()
    macd_line   = (ema12 - ema26).loc[mask]
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist   = macd_line - macd_signal

    def fmt(s: pd.Series) -> list:
        return [None if pd.isna(v) else round(float(v), 4) for v in s.tolist()]

    earnings = _yahoo_earnings(t, start_dt, end_dt)

    return {
        "ticker":         t,
        "name":           MAGNIFICENT_7[t]["name"],
        "color":          MAGNIFICENT_7[t]["color"],
        "dates":          [d.strftime("%Y-%m-%d") for d in price_win.index],
        "close":          fmt(price_win),
        "sma20":          fmt(sma20),
        "sma50":          fmt(sma50),
        "sma200":         fmt(sma200),
        "bb_upper":       fmt(bb_upper),
        "bb_lower":       fmt(bb_lower),
        "bb_middle":      fmt(bb_mid),
        "rsi":            fmt(rsi),
        "macd_line":      fmt(macd_line),
        "macd_signal":    fmt(macd_signal),
        "macd_hist":      fmt(macd_hist),
        "volume":         [None if pd.isna(v) else int(v) for v in volume_win.tolist()],
        "earnings_dates": earnings,
        "signals": _compute_signals(
            fmt(price_win), fmt(rsi), fmt(macd_line), fmt(macd_signal),
            fmt(sma50), fmt(sma200), fmt(bb_upper), fmt(bb_lower)
        ),
    }


@router.get("/api/backtest")
def run_backtest(
    ticker:   str = Query(...),
    strategy: str = Query("rsi"),
    start:    str = Query(...),
    end:      str = Query(...),
):
    """Run a simple long/cash backtest for a MAG7 ticker using a named strategy."""
    t = ticker.strip().upper()
    if t not in MAGNIFICENT_7:
        raise HTTPException(400, f"Invalid ticker: {t}")

    valid_strategies = {"rsi", "macd", "sma_cross", "bb"}
    if strategy not in valid_strategies:
        raise HTTPException(400, f"Invalid strategy '{strategy}'. Must be one of: {sorted(valid_strategies)}")

    try:
        start_dt = date.fromisoformat(start)
        end_dt   = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(400, "Dates must be YYYY-MM-DD")

    if start_dt >= end_dt:
        raise HTTPException(400, "start must be before end")

    # Fetch with warmup buffer for indicator computation
    buffer_start = start_dt - timedelta(days=300)
    ohlcv = _yahoo_history(t, buffer_start, end_dt)
    ohlcv.index = pd.to_datetime(ohlcv.index).normalize()
    price_full = ohlcv["close"]

    # Compute indicators on full buffered series (warmup)
    sma50_full  = price_full.rolling(50).mean()
    sma200_full = price_full.rolling(200).mean()

    bb_mid_full   = price_full.rolling(20).mean()
    bb_std_full   = price_full.rolling(20).std()
    bb_upper_full = bb_mid_full + 2 * bb_std_full
    bb_lower_full = bb_mid_full - 2 * bb_std_full

    delta_full    = price_full.diff()
    avg_gain_full = delta_full.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    avg_loss_full = (-delta_full).clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    rs_full       = avg_gain_full / avg_loss_full.replace(0, np.nan)
    rsi_full      = 100 - 100 / (1 + rs_full)

    ema12_full       = price_full.ewm(span=12, adjust=False).mean()
    ema26_full       = price_full.ewm(span=26, adjust=False).mean()
    macd_line_full   = ema12_full - ema26_full
    macd_signal_full = macd_line_full.ewm(span=9, adjust=False).mean()

    # Slice to the requested window (indicators already warmed up)
    mask = price_full.index >= pd.Timestamp(start_dt)
    if not mask.any():
        raise HTTPException(404, "No data in the requested date range")

    price_win       = price_full.loc[mask]
    rsi_win         = rsi_full.loc[mask]
    macd_line_win   = macd_line_full.loc[mask]
    macd_signal_win = macd_signal_full.loc[mask]
    sma50_win       = sma50_full.loc[mask]
    sma200_win      = sma200_full.loc[mask]
    bb_upper_win    = bb_upper_full.loc[mask]
    bb_lower_win    = bb_lower_full.loc[mask]
    bb_mid_win      = bb_mid_full.loc[mask]

    return _run_backtest(
        strategy    = strategy,
        price       = price_win,
        rsi         = rsi_win,
        macd_line   = macd_line_win,
        macd_signal = macd_signal_win,
        sma50       = sma50_win,
        sma200      = sma200_win,
        bb_upper    = bb_upper_win,
        bb_lower    = bb_lower_win,
        bb_mid      = bb_mid_win,
    )
