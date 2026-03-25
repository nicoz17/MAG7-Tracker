"""
Simple long/cash backtesting engine.
"""

import numpy as np
import pandas as pd

from config import RISK_FREE


def _run_backtest(
    strategy: str,
    price: "pd.Series",
    rsi: "pd.Series",
    macd_line: "pd.Series",
    macd_signal: "pd.Series",
    sma50: "pd.Series",
    sma200: "pd.Series",
    bb_upper: "pd.Series",
    bb_lower: "pd.Series",
    bb_mid: "pd.Series",
) -> dict:
    """Run a simple long/cash backtest for the given strategy on windowed data."""
    n = len(price)
    if n < 2:
        return {
            "strategy": strategy,
            "dates": [],
            "equity": [],
            "bah_equity": [],
            "trades": [],
            "metrics": {},
        }

    price_arr       = price.values.astype(float)
    rsi_arr         = rsi.reindex(price.index).values.astype(float)
    macd_line_arr   = macd_line.reindex(price.index).values.astype(float)
    macd_signal_arr = macd_signal.reindex(price.index).values.astype(float)
    sma50_arr       = sma50.reindex(price.index).values.astype(float)
    sma200_arr      = sma200.reindex(price.index).values.astype(float)
    bb_upper_arr    = bb_upper.reindex(price.index).values.astype(float)
    bb_lower_arr    = bb_lower.reindex(price.index).values.astype(float)
    bb_mid_arr      = bb_mid.reindex(price.index).values.astype(float)

    position = np.zeros(n, dtype=int)

    if strategy == "rsi":
        in_pos = False
        for i in range(n):
            rv = rsi_arr[i]
            if np.isnan(rv):
                position[i] = int(in_pos)
                continue
            if not in_pos and rv < 30:
                in_pos = True
            elif in_pos and rv > 70:
                in_pos = False
            position[i] = int(in_pos)

    elif strategy == "macd":
        for i in range(n):
            ml = macd_line_arr[i]
            ms = macd_signal_arr[i]
            if np.isnan(ml) or np.isnan(ms):
                position[i] = 0
            else:
                position[i] = 1 if ml > ms else 0

    elif strategy == "sma_cross":
        for i in range(n):
            s50 = sma50_arr[i]
            s200 = sma200_arr[i]
            if np.isnan(s50) or np.isnan(s200):
                position[i] = 0
            else:
                position[i] = 1 if s50 > s200 else 0

    elif strategy == "bb":
        in_pos = False
        for i in range(n):
            cl = price_arr[i]
            bl = bb_lower_arr[i]
            bm = bb_mid_arr[i]
            if np.isnan(bl) or np.isnan(bm):
                position[i] = int(in_pos)
                continue
            if not in_pos and cl < bl:
                in_pos = True
            elif in_pos and cl > bm:
                in_pos = False
            position[i] = int(in_pos)

    # -- Equity computation --
    equity = np.full(n, 100.0)
    bah    = np.full(n, 100.0)
    for i in range(1, n):
        daily_ret = price_arr[i] / price_arr[i - 1] - 1
        equity[i] = equity[i - 1] * (1 + daily_ret) if position[i - 1] == 1 else equity[i - 1]
        bah[i]    = bah[i - 1] * (1 + daily_ret)

    # -- Trades --
    trades: list[dict] = []
    entry_idx: int | None = None
    for i in range(n):
        if entry_idx is None and position[i] == 1:
            entry_idx = i
        elif entry_idx is not None and position[i] == 0:
            ep = float(price_arr[entry_idx])
            xp = float(price_arr[i - 1])
            ret_pct = (xp / ep - 1) * 100 if ep != 0 else 0.0
            dur = (i - 1) - entry_idx
            trades.append({
                "entry_date":    price.index[entry_idx].strftime("%Y-%m-%d"),
                "exit_date":     price.index[i - 1].strftime("%Y-%m-%d"),
                "entry_price":   round(ep, 4),
                "exit_price":    round(xp, 4),
                "return_pct":    round(ret_pct, 2),
                "duration_days": dur,
                "win":           ret_pct > 0,
            })
            entry_idx = None

    # Open trade at end
    if entry_idx is not None:
        ep = float(price_arr[entry_idx])
        xp = float(price_arr[-1])
        ret_pct = (xp / ep - 1) * 100 if ep != 0 else 0.0
        trades.append({
            "entry_date":    price.index[entry_idx].strftime("%Y-%m-%d"),
            "exit_date":     None,
            "entry_price":   round(ep, 4),
            "exit_price":    round(xp, 4),
            "return_pct":    round(ret_pct, 2),
            "duration_days": (n - 1) - entry_idx,
            "win":           ret_pct > 0,
        })

    # -- Metrics --
    strategy_return = round((equity[-1] / 100 - 1) * 100, 2)
    bah_return      = round((bah[-1] / 100 - 1) * 100, 2)
    excess_return   = round(strategy_return - bah_return, 2)

    daily_rets = np.diff(equity) / equity[:-1]
    std_d = float(np.std(daily_rets, ddof=1)) if len(daily_rets) > 1 else 0.0
    if std_d > 0:
        ann_ret_d = float(np.mean(daily_rets)) * 252
        sharpe = round((ann_ret_d - RISK_FREE) / (std_d * np.sqrt(252)), 2)
    else:
        sharpe = None

    cum_max = np.maximum.accumulate(equity)
    drawdowns = (equity / cum_max - 1) * 100
    max_drawdown = round(float(drawdowns.min()), 2)

    n_trades   = len(trades)
    closed_trades = [tr for tr in trades if tr["exit_date"] is not None]
    win_rate   = round(sum(1 for tr in closed_trades if tr["win"]) / len(closed_trades) * 100, 1) if closed_trades else None
    days_in    = int(np.sum(position))
    time_in_market = round(days_in / n * 100, 1)

    metrics = {
        "strategy_return": strategy_return,
        "bah_return":      bah_return,
        "excess_return":   excess_return,
        "sharpe":          sharpe,
        "max_drawdown":    max_drawdown,
        "n_trades":        n_trades,
        "win_rate":        win_rate,
        "time_in_market":  time_in_market,
    }

    dates_str = [d.strftime("%Y-%m-%d") for d in price.index]
    return {
        "strategy":   strategy,
        "dates":      dates_str,
        "equity":     [round(float(v), 4) for v in equity.tolist()],
        "bah_equity": [round(float(v), 4) for v in bah.tolist()],
        "trades":     trades,
        "metrics":    metrics,
    }
