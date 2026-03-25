"""
/api/macro endpoint.
"""

from datetime import date, datetime, timedelta, timezone
import pandas as pd
from fastapi import APIRouter

from config import MACRO_TICKERS
from yahoo import _yahoo_history

router = APIRouter()

_MACRO_CACHE: dict = {}
_MACRO_CACHE_TTL = 300  # 5 min


@router.get("/api/macro")
def get_macro():
    now = datetime.now(timezone.utc).timestamp()
    if _MACRO_CACHE.get("ts") and now - _MACRO_CACHE["ts"] < _MACRO_CACHE_TTL:
        return _MACRO_CACHE["data"]

    end_dt   = date.today()
    start_dt = end_dt - timedelta(days=40)
    result: dict = {}

    for yf_ticker, info in MACRO_TICKERS.items():
        try:
            ohlcv = _yahoo_history(yf_ticker, start_dt, end_dt)
            ohlcv.index = pd.to_datetime(ohlcv.index).normalize()
            ohlcv = ohlcv[~ohlcv.index.duplicated(keep="last")]
            price = ohlcv["close"].dropna()
            if len(price) < 2:
                continue
            latest = float(price.iloc[-1])
            is_rate = info["name"] == "US10Y"
            def chg(ref, _latest=latest, _is_rate=is_rate):
                ref_val = float(ref)
                if _is_rate:
                    return round((_latest - ref_val) * 100, 0) if ref_val else None  # bps
                return round((_latest / ref_val - 1) * 100, 2) if ref_val > 0 else None
            result[info["name"]] = {
                "label":  info["label"],
                "color":  info["color"],
                "price":  round(latest, 2),
                "chg_1d": chg(price.iloc[-2]) if len(price) >= 2 else None,
                "chg_1w": chg(price.iloc[-6]) if len(price) >= 6 else None,
                "chg_1m": chg(price.iloc[0]),
            }
        except Exception:
            pass

    _MACRO_CACHE["ts"]   = now
    _MACRO_CACHE["data"] = result
    return result
