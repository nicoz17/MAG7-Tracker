"""
Shared constants for the Mag7 Tracker backend.
"""

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
    "GLD": {"name": "Gold (SPDR)",  "color": "#fbbf24"},
    "TLT": {"name": "Treasury 20Y+","color": "#38bdf8"},
    "LQD": {"name": "IG Corp Bonds","color": "#2dd4bf"},
    "XLE": {"name": "Energy",       "color": "#f97316"},
    "XLF": {"name": "Financials",   "color": "#22d3ee"},
}

MACRO_TICKERS = {
    "^VIX":     {"name": "VIX",  "label": "Volatilidad", "color": "#f87171"},
    "DX-Y.NYB": {"name": "DXY",  "label": "Dólar Index", "color": "#60a5fa"},
    "^TNX":     {"name": "US10Y", "label": "Bono 10Y",    "color": "#a78bfa"},
    "SPY":      {"name": "SPY",  "label": "S&P 500",     "color": "#4ade80"},
}

RISK_FREE = 0.045
