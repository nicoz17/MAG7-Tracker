"""
Yahoo Finance data-fetching helpers.
"""

from datetime import date, datetime, timezone
import requests
import pandas as pd
from fastapi import HTTPException


_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
})

_YF_CRUMB: str | None = None


def _get_yf_crumb() -> str | None:
    """Obtain (and cache) a Yahoo Finance crumb required for quoteSummary calls."""
    global _YF_CRUMB
    if _YF_CRUMB:
        return _YF_CRUMB
    try:
        _SESSION.get("https://fc.yahoo.com", timeout=8)  # sets A3 cookie
        r = _SESSION.get("https://query1.finance.yahoo.com/v1/test/getcrumb", timeout=8)
        if r.ok and r.text and r.text != "":
            _YF_CRUMB = r.text.strip()
            return _YF_CRUMB
    except Exception:
        pass
    return None


def _yahoo_history(ticker: str, start: date, end: date) -> pd.DataFrame:
    """
    Fetch adjusted close prices and volume from Yahoo Finance v8 chart API.
    Returns a DataFrame with 'close' and 'volume' columns, tz-naive DatetimeIndex.
    """
    period1 = int(datetime(start.year, start.month, start.day, tzinfo=timezone.utc).timestamp())
    period2 = int(datetime(end.year, end.month, end.day, tzinfo=timezone.utc).timestamp()) + 86400

    url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}"
    params = {
        "period1": period1,
        "period2": period2,
        "interval": "1d",
        "events": "div,splits",
        "includeAdjustedClose": "true",
    }

    try:
        resp = _SESSION.get(url, params=params, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(502, f"Network error fetching {ticker}: {e}")

    data = resp.json()
    result = data.get("chart", {}).get("result")
    if not result:
        err = data.get("chart", {}).get("error") or "empty result"
        raise HTTPException(502, f"Yahoo API error for {ticker}: {err}")

    chart = result[0]
    timestamps  = chart.get("timestamp", [])
    adjclose_list = chart.get("indicators", {}).get("adjclose", [{}])
    adj_closes  = adjclose_list[0].get("adjclose", []) if adjclose_list else []
    quote_list  = chart.get("indicators", {}).get("quote", [{}])
    volumes     = quote_list[0].get("volume", []) if quote_list else []

    if not timestamps or not adj_closes:
        raise HTTPException(404, f"No price data returned for {ticker}")

    if len(volumes) < len(timestamps):
        volumes = list(volumes) + [None] * (len(timestamps) - len(volumes))

    dates = pd.to_datetime([
        datetime.fromtimestamp(ts, tz=timezone.utc).date() for ts in timestamps
    ])
    df = pd.DataFrame({"close": adj_closes, "volume": volumes}, index=dates)
    df.index = pd.to_datetime(df.index)
    df["close"]  = pd.to_numeric(df["close"],  errors="coerce")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
    df = df.dropna(subset=["close"])
    # Keep last entry per day (dedup after normalize)
    df = df[~df.index.duplicated(keep="last")]
    return df


def _fetch_close(ticker_list: list[str], start: date, end: date) -> pd.DataFrame:
    """Fetch close prices for all tickers and return as aligned DataFrame."""
    frames = {t: _yahoo_history(t, start, end) for t in ticker_list}
    close = pd.DataFrame({t: frames[t]["close"] for t in ticker_list})
    close.index = pd.to_datetime(close.index).normalize()
    return close


def _calc_peg(forward_pe, earnings_growth):
    """PEG = Forward P/E ÷ (Earnings Growth % annualized)."""
    if forward_pe and earnings_growth and earnings_growth > 0:
        eg_pct = earnings_growth * 100  # 0.25 → 25
        return round(forward_pe / eg_pct, 2) if eg_pct != 0 else None
    return None


def _get_ticker_fundamentals(ticker: str) -> dict:
    """Fetch valuation and growth fundamentals from Yahoo Finance quoteSummary."""
    crumb = _get_yf_crumb()
    url = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}"
    params: dict = {"modules": "summaryDetail,defaultKeyStatistics,financialData"}
    if crumb:
        params["crumb"] = crumb
    try:
        resp = _SESSION.get(url, params=params, timeout=12)
        if not resp.ok:
            return {}
        data = resp.json()
        result = data.get("quoteSummary", {}).get("result")
        if not result:
            return {}
        sd = result[0].get("summaryDetail",       {})
        ks = result[0].get("defaultKeyStatistics", {})
        fd = result[0].get("financialData",        {})

        def rv(d: dict, key: str):
            v = d.get(key, {})
            return v.get("raw") if isinstance(v, dict) else (v if v else None)

        rec_raw = fd.get("recommendationKey", "")
        recommendation = rec_raw if isinstance(rec_raw, str) else ""
        return {
            "trailing_pe":     rv(sd, "trailingPE"),
            "forward_pe":      rv(sd, "forwardPE"),
            "price_to_book":   rv(ks, "priceToBook"),
            "ev_to_ebitda":    rv(ks, "enterpriseToEbitda"),
            "peg_ratio":       rv(ks, "pegRatio") or _calc_peg(rv(sd, "forwardPE"), rv(fd, "earningsGrowth")),
            "market_cap":      rv(sd, "marketCap"),
            "dividend_yield":  rv(sd, "dividendYield"),
            "revenue_growth":  rv(fd, "revenueGrowth"),
            "earnings_growth": rv(fd, "earningsGrowth"),
            "profit_margin":   rv(fd, "profitMargins"),
            "roe":             rv(fd, "returnOnEquity"),
            "debt_to_equity":  rv(fd, "debtToEquity"),
            # Analyst targets
            "current_price":    rv(fd, "currentPrice"),
            "target_mean":      rv(fd, "targetMeanPrice"),
            "target_high":      rv(fd, "targetHighPrice"),
            "target_low":       rv(fd, "targetLowPrice"),
            "analyst_count":    rv(fd, "numberOfAnalystOpinions"),
            "recommendation":   recommendation,
            # DCF inputs
            "total_revenue":      rv(fd, "totalRevenue"),
            "operating_margin":   rv(fd, "operatingMargins"),
            "free_cash_flow":     rv(fd, "freeCashflow"),
            "shares_outstanding": rv(ks, "sharesOutstanding"),
            "total_debt":         rv(fd, "totalDebt"),
            "total_cash":         rv(fd, "totalCash"),
            "beta":               rv(sd, "beta"),
        }
    except Exception:
        return {}


def _yahoo_earnings(ticker: str, start: date, end: date) -> list[dict]:
    """Fetch quarterly earnings dates from Yahoo Finance quoteSummary API.

    Uses earningsHistory (past 4 quarters) + calendarEvents (next upcoming).
    Filters to events that fall within [start, end].
    """
    crumb = _get_yf_crumb()
    url = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}"
    params: dict = {"modules": "earningsHistory,calendarEvents"}
    if crumb:
        params["crumb"] = crumb

    def _rv(d: dict, k: str):
        v = d.get(k, {})
        return v.get("raw") if isinstance(v, dict) else None

    try:
        resp = _SESSION.get(url, params=params, timeout=10)
        if not resp.ok:
            return []
        data = resp.json()
        result = data.get("quoteSummary", {}).get("result")
        if not result:
            return []
        node = result[0]

        events: list[dict] = []
        seen: set[str] = set()

        # -- Past earnings (earningsHistory) --
        for item in node.get("earningsHistory", {}).get("history", []):
            raw = item.get("quarter", {}).get("raw")
            if not raw:
                continue
            dt_str = datetime.fromtimestamp(raw, tz=timezone.utc).strftime("%Y-%m-%d")
            if dt_str in seen:
                continue
            seen.add(dt_str)
            surp_raw = _rv(item, "surprisePercent")
            events.append({
                "date":         dt_str,
                "eps_estimate": _rv(item, "epsEstimate"),
                "eps_actual":   _rv(item, "epsActual"),
                "eps_surprise": round(surp_raw * 100, 2) if surp_raw is not None else None,
            })

        # -- Next upcoming earnings (calendarEvents) --
        cal = node.get("calendarEvents", {}).get("earnings", {})
        for ts_block in cal.get("earningsDate", []):
            raw = ts_block.get("raw") if isinstance(ts_block, dict) else None
            if not raw:
                continue
            dt_str = datetime.fromtimestamp(raw, tz=timezone.utc).strftime("%Y-%m-%d")
            if dt_str in seen:
                continue
            seen.add(dt_str)
            events.append({
                "date":         dt_str,
                "eps_estimate": _rv(cal, "earningsAverage"),
                "eps_actual":   None,
                "eps_surprise": None,
            })

        # Filter to window and return sorted
        start_s, end_s = start.isoformat(), end.isoformat()
        return sorted(
            [e for e in events if start_s <= e["date"] <= end_s],
            key=lambda e: e["date"],
        )
    except Exception:
        return []
