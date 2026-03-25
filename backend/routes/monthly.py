"""
/api/monthly_returns endpoint.
"""

from datetime import date
import pandas as pd
from fastapi import APIRouter, Query, HTTPException

from config import MAGNIFICENT_7
from yahoo import _yahoo_history

router = APIRouter()


@router.get("/api/monthly_returns")
def get_monthly_returns(
    ticker: str = Query(..., description="MAG7 ticker"),
    years:  int = Query(5,   description="How many years back"),
):
    t = ticker.strip().upper()
    if t not in MAGNIFICENT_7:
        raise HTTPException(400, f"Invalid ticker: {t}")

    end_dt   = date.today()
    start_dt = end_dt.replace(year=end_dt.year - years, month=1, day=1)

    ohlcv = _yahoo_history(t, start_dt, end_dt)
    ohlcv.index = pd.to_datetime(ohlcv.index).normalize()
    ohlcv = ohlcv[~ohlcv.index.duplicated(keep="last")]
    price = ohlcv["close"].dropna()

    monthly     = price.resample("ME").last()
    monthly_ret = monthly.pct_change().dropna()

    returns: dict = {}
    for ts, ret in monthly_ret.items():
        y, m = int(ts.year), int(ts.month)
        if y not in returns:
            returns[y] = {}
        returns[y][m] = round(float(ret) * 100, 2)

    return {"ticker": t, "returns": returns}
