"""
/api/sectors endpoint.
"""

from datetime import date
import pandas as pd
from fastapi import APIRouter, Query, HTTPException

from config import SECTOR_ETFS
from yahoo import _fetch_close
from models.metrics import _metrics

router = APIRouter()


@router.get("/api/sectors")
def get_sectors(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end:   str = Query(..., description="End date YYYY-MM-DD"),
):
    """Compare major market ETFs on a base-100 basis."""
    try:
        start_dt = date.fromisoformat(start)
        end_dt   = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(400, "Dates must be YYYY-MM-DD")

    etf_list = list(SECTOR_ETFS.keys())
    close = _fetch_close(etf_list, start_dt, end_dt)
    cw    = close.loc[close.index >= pd.Timestamp(start_dt)].copy()
    if cw.empty:
        raise HTTPException(404, "No data in requested range")

    dates  = [d.strftime("%Y-%m-%d") for d in cw.index]
    series = {}
    for t in etf_list:
        p0 = float(cw[t].iloc[0])
        series[t] = {
            **SECTOR_ETFS[t],
            "base100": [None if pd.isna(v) else round(float(v / p0 * 100), 2) for v in cw[t].tolist()],
            "metrics": _metrics(cw[t]),
        }

    return {"dates": dates, "series": series}
