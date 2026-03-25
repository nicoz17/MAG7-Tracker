"""
Magnificent 7 Stock Tracker - Backend API
Fetches adjusted close prices + volume directly from Yahoo Finance v8 API.
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import date, timedelta, datetime, timezone
import requests
import numpy as np
import pandas as pd
from arch import arch_model
from scipy.optimize import minimize

app = FastAPI(title="Mag7 Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAGNIFICENT_7 = {
    "AAPL": {"name": "Apple",     "color": "#A2AAAD"},
    "MSFT": {"name": "Microsoft", "color": "#7FBA00"},
    "GOOGL": {"name": "Alphabet", "color": "#4285F4"},
    "AMZN": {"name": "Amazon",    "color": "#FF9900"},
    "NVDA": {"name": "NVIDIA",    "color": "#76B900"},
    "META": {"name": "Meta",      "color": "#0668E1"},
    "TSLA": {"name": "Tesla",     "color": "#CC0000"},
}

SECTOR_ETFS = {
    "SPY": {"name": "S&P 500",      "color": "#94a3b8"},
    "QQQ": {"name": "Nasdaq 100",   "color": "#6366f1"},
    "XLK": {"name": "Tech (XLK)",   "color": "#8b5cf6"},
    "VGT": {"name": "Vanguard IT",  "color": "#a78bfa"},
    "IWM": {"name": "Russell 2000", "color": "#ec4899"},
}

RISK_FREE = 0.045

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


# ── Data fetching ──────────────────────────────────────────────────────────

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


# ── Monte Carlo helpers ────────────────────────────────────────────────────

def _pct_dict(paths: np.ndarray, lo: float, hi: float) -> dict:
    """Percentile dict {median, p_lo, p_hi} from (simulations × days) array."""
    return {
        "median": [round(float(v), 2) for v in np.percentile(paths, 50, axis=0)],
        "p_lo":   [round(float(v), 2) for v in np.percentile(paths, lo,  axis=0)],
        "p_hi":   [round(float(v), 2) for v in np.percentile(paths, hi,  axis=0)],
    }


def _simulate_gbm(
    ret: np.ndarray,
    last_price: float,
    first_price: float,
    simulations: int,
    days: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """Geometric Brownian Motion. Returns (simulations × days) base-100 paths."""
    mu    = float(ret.mean())
    sigma = float(ret.std(ddof=1))
    Z     = rng.standard_normal((simulations, days))
    cum   = np.cumsum((mu - 0.5 * sigma ** 2) + sigma * Z, axis=1)
    return (last_price * np.exp(cum)) / first_price * 100


def _simulate_garch(
    ret: np.ndarray,
    last_price: float,
    first_price: float,
    simulations: int,
    days: int,
    rng: np.random.Generator,
) -> np.ndarray | None:
    """GARCH(1,1). Returns (simulations × days) base-100 paths or None on failure."""
    ret_pct = ret * 100
    model = arch_model(ret_pct, vol="Garch", p=1, q=1, mean="Constant", dist="Normal")
    try:
        res = model.fit(disp="off", show_warning=False, options={"maxiter": 300})
    except Exception:
        return None

    mu_pct   = float(res.params["mu"])
    omega    = float(res.params["omega"])
    alpha    = float(res.params["alpha[1]"])
    beta_p   = float(res.params["beta[1]"])
    last_var = float(res.conditional_volatility[-1]) ** 2

    Z         = rng.standard_normal((simulations, days))
    ret_paths = np.zeros((simulations, days))
    prev_var  = np.full(simulations, last_var)
    prev_eps2 = np.zeros(simulations)

    for d in range(days):
        cur_var       = np.maximum(omega + alpha * prev_eps2 + beta_p * prev_var, 1e-8)
        eps           = np.sqrt(cur_var) * Z[:, d]
        ret_paths[:, d] = (mu_pct + eps) / 100
        prev_eps2     = eps ** 2
        prev_var      = cur_var

    return (last_price * np.exp(np.cumsum(ret_paths, axis=1))) / first_price * 100


def _simulate_merton(
    ret: np.ndarray,
    last_price: float,
    first_price: float,
    simulations: int,
    days: int,
    rng: np.random.Generator,
) -> np.ndarray | None:
    """
    Merton Jump-Diffusion: splits returns into diffusion (|r| ≤ 2.5σ) and
    rare jumps (|r| > 2.5σ). Returns (simulations × days) base-100 paths or None.
    """
    if len(ret) < 20:
        return None

    sigma   = float(ret.std(ddof=1))
    thresh  = 2.5 * sigma
    is_jump = np.abs(ret - float(ret.mean())) > thresh
    j_ret   = ret[is_jump]
    d_ret   = ret[~is_jump]

    lam   = max(float(len(j_ret)) / len(ret), 1e-6)   # daily jump probability
    mu_J  = float(j_ret.mean())             if len(j_ret) > 0 else 0.0
    sig_J = float(j_ret.std(ddof=1))        if len(j_ret) > 1 else sigma * 0.5
    mu_d  = float(d_ret.mean())             if len(d_ret) > 1 else float(ret.mean())
    sig_d = float(d_ret.std(ddof=1))        if len(d_ret) > 2 else sigma

    # Compensate drift for expected jump impact E[e^J] − 1
    kappa = np.exp(mu_J + 0.5 * sig_J ** 2) - 1
    drift = mu_d - lam * kappa - 0.5 * sig_d ** 2

    Z = rng.standard_normal((simulations, days))
    N = rng.poisson(lam, (simulations, days))
    J = rng.normal(mu_J, max(sig_J, 1e-8), (simulations, days))

    log_r = drift + sig_d * Z + N * J
    return (last_price * np.exp(np.cumsum(log_r, axis=1))) / first_price * 100


# ── Risk metrics ───────────────────────────────────────────────────────────

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
            "peg_ratio":       rv(ks, "pegRatio"),
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

        # ── Past earnings (earningsHistory) ───────────────────────────
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

        # ── Next upcoming earnings (calendarEvents) ────────────────────
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


# ── API endpoints ──────────────────────────────────────────────────────────

@app.get("/api/companies")
def get_companies():
    return {
        ticker: {"name": info["name"], "color": info["color"]}
        for ticker, info in MAGNIFICENT_7.items()
    }


@app.get("/api/prices")
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


@app.get("/api/forecast")
def get_forecast(
    tickers:    str = Query(..., description="Comma-separated tickers"),
    start:      str = Query(..., description="Start date YYYY-MM-DD"),
    end:        str = Query(..., description="End date YYYY-MM-DD"),
    days:       int = Query(30,  ge=5,  le=90),
    simulations:int = Query(500, ge=100, le=2000),
    band_pct:   int = Query(80,  ge=50, le=95, description="CI band % (80 → p10/p90, 90 → p5/p95)"),
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


def _compute_signals(
    close_list: list,
    rsi_list: list,
    macd_line_list: list,
    macd_signal_list: list,
    sma50_list: list,
    sma200_list: list,
    bb_upper_list: list,
    bb_lower_list: list,
) -> list[dict]:
    """Derive automatic technical signals from pre-computed indicator lists."""

    def lv(lst: list):
        """Return last non-None value in list, or None if all are None."""
        for v in reversed(lst):
            if v is not None:
                return v
        return None

    signals: list[dict] = []

    # ── 1. RSI ──────────────────────────────────────────────────────────────
    rsi_val = lv(rsi_list)
    if rsi_val is not None:
        if rsi_val < 30:
            signals.append({
                "indicator": "RSI",
                "type": "bullish",
                "strength": "strong",
                "icon": "📈",
                "title": "RSI Sobreventa",
                "detail": f"RSI en {rsi_val:.1f} — zona de sobreventa extrema (<30)",
            })
        elif rsi_val < 40:
            signals.append({
                "indicator": "RSI",
                "type": "bullish",
                "strength": "weak",
                "icon": "📈",
                "title": "RSI Zona Baja",
                "detail": f"RSI en {rsi_val:.1f} — zona baja (30-40)",
            })
        elif rsi_val > 70:
            signals.append({
                "indicator": "RSI",
                "type": "bearish",
                "strength": "strong",
                "icon": "📉",
                "title": "RSI Sobrecompra",
                "detail": f"RSI en {rsi_val:.1f} — zona de sobrecompra extrema (>70)",
            })
        elif rsi_val > 60:
            signals.append({
                "indicator": "RSI",
                "type": "bearish",
                "strength": "weak",
                "icon": "📉",
                "title": "RSI Zona Alta",
                "detail": f"RSI en {rsi_val:.1f} — zona alta (60-70)",
            })
        else:
            signals.append({
                "indicator": "RSI",
                "type": "neutral",
                "strength": "neutral",
                "icon": "➡️",
                "title": "RSI Neutral",
                "detail": f"RSI en {rsi_val:.1f} — zona neutra (40-60)",
            })

    # ── 2. MACD crossover ───────────────────────────────────────────────────
    # Collect last 2 valid (macd, signal) pairs
    macd_pairs: list[tuple[float, float]] = []
    for m, s in zip(reversed(macd_line_list), reversed(macd_signal_list)):
        if m is not None and s is not None:
            macd_pairs.append((m, s))
            if len(macd_pairs) == 2:
                break
    if len(macd_pairs) == 2:
        curr_diff = macd_pairs[0][0] - macd_pairs[0][1]
        prev_diff = macd_pairs[1][0] - macd_pairs[1][1]
        if prev_diff <= 0 and curr_diff > 0:
            signals.append({
                "indicator": "MACD",
                "type": "bullish",
                "strength": "strong",
                "icon": "📈",
                "title": "MACD Cruce Alcista",
                "detail": "La línea MACD cruzó por encima de la señal (cruce alcista)",
            })
        elif prev_diff >= 0 and curr_diff < 0:
            signals.append({
                "indicator": "MACD",
                "type": "bearish",
                "strength": "strong",
                "icon": "📉",
                "title": "MACD Cruce Bajista",
                "detail": "La línea MACD cruzó por debajo de la señal (cruce bajista)",
            })
        elif curr_diff > 0:
            signals.append({
                "indicator": "MACD",
                "type": "bullish",
                "strength": "weak",
                "icon": "📈",
                "title": "MACD Positivo",
                "detail": f"MACD por encima de la señal (+{curr_diff:.4f})",
            })
        else:
            signals.append({
                "indicator": "MACD",
                "type": "bearish",
                "strength": "weak",
                "icon": "📉",
                "title": "MACD Negativo",
                "detail": f"MACD por debajo de la señal ({curr_diff:.4f})",
            })

    # ── 3. SMA50/200 cross ──────────────────────────────────────────────────
    # Collect last 15 valid (sma50, sma200) pairs with index position
    sma_pairs: list[tuple[int, float, float]] = []
    for i in range(len(sma50_list) - 1, -1, -1):
        s50 = sma50_list[i]
        s200 = sma200_list[i]
        if s50 is not None and s200 is not None:
            sma_pairs.append((i, s50, s200))
            if len(sma_pairs) == 15:
                break

    if len(sma_pairs) >= 2:
        # Most recent pair is sma_pairs[0]
        curr_above = sma_pairs[0][1] > sma_pairs[0][2]
        golden_cross_days: int | None = None
        death_cross_days: int | None = None
        for k in range(1, len(sma_pairs)):
            prev_above = sma_pairs[k][1] > sma_pairs[k][2]
            if not prev_above and curr_above:
                # Golden cross occurred between sma_pairs[k] and sma_pairs[k-1]
                golden_cross_days = sma_pairs[0][0] - sma_pairs[k][0]
                break
            elif prev_above and not curr_above:
                # Death cross occurred between sma_pairs[k] and sma_pairs[k-1]
                death_cross_days = sma_pairs[0][0] - sma_pairs[k][0]
                break
            curr_above = prev_above  # keep iterating backward

        curr_s50 = sma_pairs[0][1]
        curr_s200 = sma_pairs[0][2]
        pct_diff = (curr_s50 / curr_s200 - 1) * 100

        if golden_cross_days is not None:
            signals.append({
                "indicator": "SMA",
                "type": "bullish",
                "strength": "strong",
                "icon": "⭐",
                "title": f"Golden Cross (hace {golden_cross_days}d)",
                "detail": f"SMA50 cruzó por encima de SMA200 hace {golden_cross_days} días",
            })
        elif death_cross_days is not None:
            signals.append({
                "indicator": "SMA",
                "type": "bearish",
                "strength": "strong",
                "icon": "💀",
                "title": f"Death Cross (hace {death_cross_days}d)",
                "detail": f"SMA50 cruzó por debajo de SMA200 hace {death_cross_days} días",
            })
        elif curr_s50 > curr_s200:
            signals.append({
                "indicator": "SMA",
                "type": "bullish",
                "strength": "weak",
                "icon": "📈",
                "title": f"SMA50 > SMA200 (+{pct_diff:.1f}%)",
                "detail": f"SMA50 ({curr_s50:.2f}) está {pct_diff:.1f}% por encima de SMA200 ({curr_s200:.2f})",
            })
        else:
            signals.append({
                "indicator": "SMA",
                "type": "bearish",
                "strength": "weak",
                "icon": "📉",
                "title": f"SMA50 < SMA200 ({pct_diff:.1f}%)",
                "detail": f"SMA50 ({curr_s50:.2f}) está {abs(pct_diff):.1f}% por debajo de SMA200 ({curr_s200:.2f})",
            })

    # ── 4. Bollinger Bands ──────────────────────────────────────────────────
    close_val = lv(close_list)
    bb_upper_val = lv(bb_upper_list)
    bb_lower_val = lv(bb_lower_list)
    if close_val is not None and bb_upper_val is not None and bb_lower_val is not None:
        band_width = bb_upper_val - bb_lower_val
        if band_width > 0:
            bb_pct = (close_val - bb_lower_val) / band_width
            if bb_pct > 0.95:
                signals.append({
                    "indicator": "BB",
                    "type": "bearish",
                    "strength": "strong",
                    "icon": "📉",
                    "title": "Precio en Banda Superior BB",
                    "detail": f"Precio ({close_val:.2f}) cerca de la banda superior de Bollinger ({bb_upper_val:.2f})",
                })
            elif bb_pct < 0.05:
                signals.append({
                    "indicator": "BB",
                    "type": "bullish",
                    "strength": "strong",
                    "icon": "📈",
                    "title": "Precio en Banda Inferior BB",
                    "detail": f"Precio ({close_val:.2f}) cerca de la banda inferior de Bollinger ({bb_lower_val:.2f})",
                })

    # ── 5. Trend vs SMA200 ──────────────────────────────────────────────────
    sma200_val = lv(sma200_list)
    if close_val is not None and sma200_val is not None and sma200_val > 0:
        pct_vs_sma200 = (close_val / sma200_val - 1) * 100
        if pct_vs_sma200 < -10:
            signals.append({
                "indicator": "Trend",
                "type": "bearish",
                "strength": "strong",
                "icon": "📉",
                "title": f"Precio {abs(pct_vs_sma200):.1f}% bajo SMA200",
                "detail": f"Precio ({close_val:.2f}) está {abs(pct_vs_sma200):.1f}% por debajo de SMA200 ({sma200_val:.2f})",
            })
        elif pct_vs_sma200 > 25:
            signals.append({
                "indicator": "Trend",
                "type": "bearish",
                "strength": "weak",
                "icon": "⚠️",
                "title": f"Precio {pct_vs_sma200:.1f}% sobre SMA200",
                "detail": f"Precio ({close_val:.2f}) está {pct_vs_sma200:.1f}% por encima de SMA200 ({sma200_val:.2f}) — posible sobreextensión",
            })

    return signals


@app.get("/api/technical")
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

    # Bollinger Bands (20, ±2σ)
    bb_mid   = sma20
    bb_std   = price.rolling(20).std().loc[mask]
    bb_upper = bb_mid + 2 * bb_std
    bb_lower = bb_mid - 2 * bb_std

    # RSI(14) — Wilder's EMA
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


@app.get("/api/analytics")
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


@app.get("/api/portfolio")
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


@app.get("/api/fundamentals")
def get_fundamentals(
    tickers: str = Query(..., description="Comma-separated tickers"),
):
    """Fetch valuation and growth fundamentals for the requested MAG7 tickers."""
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    invalid = [t for t in ticker_list if t not in MAGNIFICENT_7]
    if invalid:
        raise HTTPException(400, f"Invalid tickers: {invalid}")
    return {t: _get_ticker_fundamentals(t) for t in ticker_list}


@app.get("/api/sectors")
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


# ── Backtesting ────────────────────────────────────────────────────────────

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

    # ── Equity computation ───────────────────────────────────────────────────
    equity = np.full(n, 100.0)
    bah    = np.full(n, 100.0)
    for i in range(1, n):
        daily_ret = price_arr[i] / price_arr[i - 1] - 1
        equity[i] = equity[i - 1] * (1 + daily_ret) if position[i - 1] == 1 else equity[i - 1]
        bah[i]    = bah[i - 1] * (1 + daily_ret)

    # ── Trades ───────────────────────────────────────────────────────────────
    trades: list[dict] = []
    entry_idx: int | None = None
    for i in range(n):
        if entry_idx is None and position[i] == 1:
            entry_idx = i
        elif entry_idx is not None and position[i] == 0:
            # Exit
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

    # ── Metrics ──────────────────────────────────────────────────────────────
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


@app.get("/api/backtest")
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


# ── News & Sentiment ───────────────────────────────────────────────────────

_NEWS_CACHE: dict[str, dict] = {}
_NEWS_CACHE_TTL = 1800  # 30 minutes


def _fetch_yahoo_news(ticker: str) -> list[dict]:
    """Fetch latest news headlines from Yahoo Finance search API."""
    url = "https://query1.finance.yahoo.com/v1/finance/search"
    params = {"q": ticker, "newsCount": 8, "quotesCount": 0, "enableFuzzyQuery": "false"}
    try:
        resp = _SESSION.get(url, params=params, timeout=10)
        if not resp.ok:
            return []
        items = resp.json().get("news", [])
        articles = []
        for item in items:
            ts = item.get("providerPublishTime", 0)
            articles.append({
                "title":        item.get("title", ""),
                "publisher":    item.get("publisher", ""),
                "published_at": ts,
                "url":          item.get("link", ""),
                "thumbnail":    (item.get("thumbnail", {}).get("resolutions") or [{}])[0].get("url", ""),
            })
        return articles
    except Exception:
        return []


def _analyze_news_sentiment(articles: list[dict], ticker: str, company: str) -> dict | None:
    """Use Claude to classify sentiment of news articles about a stock."""
    import os, json, re
    try:
        import anthropic
    except ImportError:
        return None

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or not articles:
        return None

    client = anthropic.Anthropic(api_key=api_key)
    headlines = "\n".join(
        f"{i+1}. [{a['publisher']}] {a['title']}"
        for i, a in enumerate(articles)
    )

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                f"Analiza estas {len(articles)} noticias recientes sobre {ticker} ({company}) "
                f"desde la perspectiva de un inversor. Responde SOLO con JSON válido, sin texto extra:\n\n"
                f"{{\n"
                f'  "sentiment": "Bullish|Neutral|Bearish",\n'
                f'  "score": <entero de -10 a +10>,\n'
                f'  "themes": ["tema corto 1", "tema corto 2", "tema corto 3"],\n'
                f'  "analysis": "<2-3 oraciones en español: qué implica este flujo de noticias para el inversor>",\n'
                f'  "article_scores": [<un entero -1, 0 o 1 por cada noticia en orden>]\n'
                f"}}\n\n"
                f"Noticias:\n{headlines}"
            ),
        }],
    )

    text = next((b.text for b in message.content if b.type == "text"), "")
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return None


@app.get("/api/news")
def get_news(ticker: str = Query(..., description="Single ticker symbol")):
    """Fetch latest news + Claude sentiment analysis for a MAG7 stock."""
    ticker = ticker.strip().upper()
    if ticker not in MAGNIFICENT_7:
        raise HTTPException(400, f"Invalid ticker: {ticker}")

    # Cache check
    cached = _NEWS_CACHE.get(ticker)
    if cached and (datetime.now(timezone.utc).timestamp() - cached["ts"] < _NEWS_CACHE_TTL):
        return cached["data"]

    articles = _fetch_yahoo_news(ticker)
    company   = MAGNIFICENT_7[ticker]["name"]

    result = {
        "ticker":    ticker,
        "company":   company,
        "articles":  articles,
        "sentiment": None,
    }
    _NEWS_CACHE[ticker] = {"ts": datetime.now(timezone.utc).timestamp(), "data": result}
    return result


# ── Macro context ──────────────────────────────────────────────────────────

MACRO_TICKERS = {
    "^VIX":     {"name": "VIX",  "label": "Volatilidad", "color": "#f87171"},
    "DX-Y.NYB": {"name": "DXY",  "label": "Dólar Index", "color": "#60a5fa"},
    "^TNX":     {"name": "US10Y", "label": "Bono 10Y",    "color": "#a78bfa"},
    "SPY":      {"name": "SPY",  "label": "S&P 500",     "color": "#4ade80"},
}

_MACRO_CACHE: dict = {}
_MACRO_CACHE_TTL = 300  # 5 min


@app.get("/api/macro")
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
            def chg(ref):
                ref_val = float(ref)
                if is_rate:
                    return round((latest - ref_val) * 100, 0) if ref_val else None  # bps
                return round((latest / ref_val - 1) * 100, 2) if ref_val > 0 else None
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


# ── Monthly returns ─────────────────────────────────────────────────────────

@app.get("/api/monthly_returns")
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


# ── AI Summary ───────────────────────────────────────────────────────────────

_AI_SUMMARY_CACHE: dict = {}
_AI_SUMMARY_CACHE_TTL = 300  # 5 min


@app.get("/api/ai_summary")
def get_ai_summary(
    ticker: str = Query(..., description="MAG7 ticker"),
    start:  str = Query(..., description="Chart start date YYYY-MM-DD"),
    end:    str = Query(..., description="Chart end date YYYY-MM-DD"),
):
    """Generate a 3-4 line AI analysis combining price, technicals and fundamentals."""
    import os, json as _json

    t = ticker.strip().upper()
    if t not in MAGNIFICENT_7:
        raise HTTPException(400, f"Invalid ticker: {t}")

    try:
        start_dt = date.fromisoformat(start)
        end_dt   = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(400, "Dates must be YYYY-MM-DD")

    # Check cache
    cache_key = f"{t}:{start}:{end}"
    cached = _AI_SUMMARY_CACHE.get(cache_key)
    if cached and (datetime.now(timezone.utc).timestamp() - cached["ts"] < _AI_SUMMARY_CACHE_TTL):
        return cached["data"]

    # ── Gather data ───────────────────────────────────────────────────────────
    # Last 90 days of price data for technicals (plus buffer)
    buffer = start_dt - timedelta(days=250)
    try:
        ohlcv = _yahoo_history(t, buffer, end_dt)
    except HTTPException:
        raise HTTPException(502, "No se pudo obtener datos de precio")

    ohlcv.index = pd.to_datetime(ohlcv.index).normalize()
    ohlcv = ohlcv[~ohlcv.index.duplicated(keep="last")]
    price = ohlcv["close"].dropna()
    mask  = price.index >= pd.Timestamp(start_dt)
    price_win = price.loc[mask]

    if len(price_win) < 5:
        raise HTTPException(404, "Datos insuficientes para el rango seleccionado")

    current_price = float(price_win.iloc[-1])
    first_price   = float(price_win.iloc[0])
    period_return = round((current_price / first_price - 1) * 100, 1)

    # RSI(14)
    delta    = price.diff()
    avg_gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    avg_loss = (-delta).clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    rs       = avg_gain / avg_loss.replace(0, np.nan)
    rsi_ser  = (100 - 100 / (1 + rs)).loc[mask]
    rsi_val  = float(rsi_ser.dropna().iloc[-1]) if not rsi_ser.dropna().empty else None

    # MACD(12,26,9)
    ema12        = price.ewm(span=12, adjust=False).mean()
    ema26        = price.ewm(span=26, adjust=False).mean()
    macd_line    = (ema12 - ema26).loc[mask]
    macd_signal  = macd_line.ewm(span=9, adjust=False).mean()
    macd_diff    = (macd_line - macd_signal).dropna()
    macd_val     = float(macd_diff.iloc[-1]) if not macd_diff.empty else None

    # SMA50 / SMA200 vs price
    sma50_ser  = price.rolling(50).mean().loc[mask]
    sma200_ser = price.rolling(200).mean().loc[mask]
    sma50_last  = float(sma50_ser.dropna().iloc[-1]) if not sma50_ser.dropna().empty else None
    sma200_last = float(sma200_ser.dropna().iloc[-1]) if not sma200_ser.dropna().empty else None

    # Bollinger Bands(20, 2)
    sma20    = price.rolling(20).mean().loc[mask]
    bb_std   = price.rolling(20).std().loc[mask]
    bb_upper = sma20 + 2 * bb_std
    bb_lower = sma20 - 2 * bb_std
    bb_pct   = None
    if not bb_upper.dropna().empty and not bb_lower.dropna().empty:
        u = float(bb_upper.dropna().iloc[-1])
        l = float(bb_lower.dropna().iloc[-1])
        if u > l:
            bb_pct = round((current_price - l) / (u - l) * 100, 0)

    # Fundamentals
    fund = _get_ticker_fundamentals(t)

    # Last earnings surprise
    earn = _yahoo_earnings(t, start_dt - timedelta(days=365), end_dt)
    last_earn_surprise = None
    for e in reversed(earn):
        if e.get("eps_surprise") is not None:
            last_earn_surprise = e["eps_surprise"]
            break

    # ── Build rule-based summary (no external API) ───────────────────────────
    company = MAGNIFICENT_7[t]["name"]

    # --- Sentence 1: Technical trend & momentum ---
    trend_parts = []

    if period_return > 15:
        trend_parts.append(f"{t} acumula una ganancia de {period_return:+.1f}% en el período, mostrando una tendencia alcista sólida")
    elif period_return > 0:
        trend_parts.append(f"{t} registra un avance de {period_return:+.1f}% en el período con momentum moderadamente positivo")
    elif period_return > -15:
        trend_parts.append(f"{t} cede {period_return:.1f}% en el período, mostrando presión vendedora")
    else:
        trend_parts.append(f"{t} retrocede {period_return:.1f}% en el período en una corrección significativa")

    if sma200_last:
        if current_price > sma200_last * 1.05:
            trend_parts.append(f"el precio cotiza un {((current_price/sma200_last)-1)*100:.1f}% por encima de la SMA200 confirmando tendencia de largo plazo alcista")
        elif current_price > sma200_last:
            trend_parts.append("el precio se mantiene sobre la SMA200, preservando la tendencia de largo plazo")
        else:
            trend_parts.append(f"el precio ha perforado la SMA200 ({sma200_last:.2f}), señal de alerta para la tendencia de largo plazo")

    if rsi_val is not None:
        if rsi_val > 70:
            trend_parts.append(f"el RSI en {rsi_val:.0f} indica sobrecompra, sugiriendo posible consolidación a corto plazo")
        elif rsi_val < 30:
            trend_parts.append(f"el RSI en {rsi_val:.0f} señala sobreventa, lo que puede generar un rebote técnico")
        elif rsi_val > 60:
            trend_parts.append(f"el RSI en {rsi_val:.0f} refleja momentum positivo sin sobrecompra extrema")
        elif rsi_val < 40:
            trend_parts.append(f"el RSI en {rsi_val:.0f} muestra momentum débil")

    if macd_val is not None:
        if macd_val > 0:
            trend_parts.append("el MACD permanece en terreno positivo apoyando el sesgo alcista")
        else:
            trend_parts.append("el MACD en negativo añade presión bajista al momentum")

    sent1 = "; ".join(trend_parts[:3]) + "." if trend_parts else ""

    # --- Sentence 2: Valuation & fundamentals ---
    fund_parts = []
    tpe = fund.get("trailing_pe")
    fpe = fund.get("forward_pe")
    rev_g = fund.get("revenue_growth")
    margin = fund.get("profit_margin")
    roe_v  = fund.get("roe")

    if tpe and fpe:
        if fpe < tpe * 0.85:
            fund_parts.append(f"la valuación mejora visiblemente (P/E trailing {tpe:.0f}x → forward {fpe:.0f}x), reflejando expectativas de crecimiento de utilidades")
        elif fpe > tpe * 1.1:
            fund_parts.append(f"el mercado descuenta cierta compresión de ganancias (P/E trailing {tpe:.0f}x vs. forward {fpe:.0f}x)")
        else:
            fund_parts.append(f"la valuación se mantiene estable con P/E trailing {tpe:.0f}x y forward {fpe:.0f}x")
    elif tpe:
        mag = "elevado" if tpe > 35 else ("moderado" if tpe > 20 else "atractivo")
        fund_parts.append(f"cotiza a un P/E de {tpe:.0f}x, nivel {mag} para el sector tecnológico")

    if rev_g is not None:
        pct = rev_g * 100
        if pct > 15:
            fund_parts.append(f"el crecimiento de ingresos del {pct:.0f}% anual justifica parcialmente la prima de valuación")
        elif pct > 0:
            fund_parts.append(f"los ingresos crecen a un ritmo moderado del {pct:.0f}%")
        else:
            fund_parts.append(f"los ingresos muestran contracción del {pct:.0f}%, factor de riesgo a monitorear")

    if margin is not None:
        pct = margin * 100
        if pct > 25:
            fund_parts.append(f"el margen neto del {pct:.0f}% destaca como uno de los más altos del sector")
        elif pct > 10:
            fund_parts.append(f"margen neto del {pct:.0f}%")

    if roe_v is not None:
        pct = roe_v * 100
        if pct > 30:
            fund_parts.append(f"ROE del {pct:.0f}% refleja alta eficiencia en el uso del capital")

    if last_earn_surprise is not None:
        if last_earn_surprise > 5:
            fund_parts.append(f"el último reporte de resultados superó las estimaciones en un {last_earn_surprise:.1f}%")
        elif last_earn_surprise < -5:
            fund_parts.append(f"el último reporte decepcionó las expectativas en un {abs(last_earn_surprise):.1f}%")

    sent2 = ("En términos fundamentales, " + "; ".join(fund_parts[:3]) + ".") if fund_parts else ""

    # --- Sentence 3: Risks / catalysts ---
    risk_parts = []

    if bb_pct is not None:
        if bb_pct > 85:
            risk_parts.append("el precio se encuentra en la banda superior de Bollinger, zona de posible resistencia o toma de ganancias")
        elif bb_pct < 15:
            risk_parts.append("el precio toca la banda inferior de Bollinger, nivel técnico de soporte clave")

    if sma50_last and sma200_last:
        gap = (sma50_last / sma200_last - 1) * 100
        if sma50_last > sma200_last and gap < 2:
            risk_parts.append("la SMA50 apenas supera la SMA200 (golden cross reciente o inminente), señal positiva pero aún frágil")
        elif sma50_last < sma200_last and gap > -2:
            risk_parts.append("la SMA50 por debajo de la SMA200 (death cross) genera cautela en el mediano plazo")

    if fund.get("debt_to_equity") and fund["debt_to_equity"] > 150:
        risk_parts.append(f"el apalancamiento financiero (D/E {fund['debt_to_equity']:.0f}%) es un factor de riesgo en un entorno de tasas altas")

    if not risk_parts:
        if period_return > 20:
            risk_parts.append("la fuerte suba acumulada eleva el riesgo de corrección si los resultados no confirman las expectativas del mercado")
        elif period_return < -15:
            risk_parts.append("la corrección abre una ventana de acumulación para inversores de largo plazo, aunque la incertidumbre de corto plazo persiste")
        else:
            risk_parts.append("el seguimiento de resultados trimestrales y los datos macro (tasas, inflación) serán los principales catalizadores en el corto plazo")

    sent3 = "A vigilar: " + "; ".join(risk_parts[:2]) + "."

    # --- Sentence 4: Overall bias ---
    bull_score = 0
    bear_score = 0
    if period_return > 5:   bull_score += 1
    if period_return < -5:  bear_score += 1
    if rsi_val is not None:
        if rsi_val < 50:    bear_score += 1
        if rsi_val > 50:    bull_score += 1
    if macd_val is not None:
        if macd_val > 0:    bull_score += 1
        else:               bear_score += 1
    if sma200_last and current_price > sma200_last: bull_score += 1
    if sma200_last and current_price < sma200_last: bear_score += 1
    if last_earn_surprise is not None:
        if last_earn_surprise > 3:  bull_score += 1
        if last_earn_surprise < -3: bear_score += 1

    if bull_score > bear_score + 1:
        bias = "alcista con convicción moderada"
        bias_emoji = "▲"
    elif bull_score > bear_score:
        bias = "ligeramente alcista"
        bias_emoji = "▲"
    elif bear_score > bull_score + 1:
        bias = "bajista con convicción moderada"
        bias_emoji = "▼"
    elif bear_score > bull_score:
        bias = "ligeramente bajista"
        bias_emoji = "▼"
    else:
        bias = "neutral"
        bias_emoji = "→"

    sent4 = f"Sesgo general {bias_emoji} {bias} ({bull_score} señales alcistas vs. {bear_score} bajistas sobre los indicadores analizados)."

    summary_text = " ".join(s for s in [sent1, sent2, sent3, sent4] if s)

    result = {
        "ticker":      t,
        "company":     company,
        "summary":     summary_text.strip(),
        "price":       current_price,
        "period_return": period_return,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    _AI_SUMMARY_CACHE[cache_key] = {
        "ts":   datetime.now(timezone.utc).timestamp(),
        "data": result,
    }
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
