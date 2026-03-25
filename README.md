# MAG 7 Tracker

Full-stack financial analytics dashboard for the Magnificent Seven stocks (AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA).

**Live:** [nicoz17.github.io/MAG7-Tracker](https://nicoz17.github.io/MAG7-Tracker/)

## Features

### Comparison
- Base 100 and volatility-adjusted price charts
- 30-day Monte Carlo forecast with 3 models (GBM, GARCH, Merton Jump-Diffusion)
- Configurable confidence intervals (50%-90%)
- CSV export

### Technical Analysis
- Single-stock deep dive with SMA (20/50/200), Bollinger Bands, RSI (14), MACD (12/26/9)
- Earnings date markers with EPS surprise data
- Automated technical signals (RSI, MACD crossovers, golden/death cross, BB extremes)
- Rule-based quantitative summary in Spanish
- Strategy backtesting engine (RSI, MACD, SMA Cross, Bollinger)
- News headlines with AI-powered sentiment analysis

### Analytics
- Analyst consensus price targets with upside/downside visualization
- Interactive DCF valuation model with adjustable assumptions (growth, WACC, terminal rate)
- Quantitative investment score (0-100) based on Sharpe, Alpha, Calmar, Sortino, Beta, Max DD
- Fundamental metrics comparison (P/E, P/B, PEG, EV/EBITDA, margins, ROE, debt)
- Valuation radar chart (6-axis normalized comparison)
- Drawdown from peak and rolling 21-day volatility charts
- Correlation heatmap
- Monthly returns heatmap (5 years)

### Portfolio
- Custom weight allocation with interactive sliders
- Tangent portfolio optimization (max Sharpe ratio via scipy SLSQP)
- Performance comparison: your portfolio vs optimal vs S&P 500
- Key metrics side-by-side (return, volatility, Sharpe, max drawdown)

### Sectors & Asset Classes
- 10 ETF benchmarks across equities, fixed income, commodities, and sectors
- SPY, QQQ, XLK, VGT, IWM, GLD, IEF, LQD, XLE, XLF
- Base 100 comparison chart with metrics table

### Global
- Real-time macro strip: VIX, DXY, US 10Y yield, S&P 500
- Dark theme with monospace typography

## Architecture

```
backend/                 Python 3.11 + FastAPI
  ├── main.py            App entry point + static file serving
  ├── config.py          Constants (tickers, colors, risk-free rate)
  ├── yahoo.py           Yahoo Finance API client + fundamentals
  ├── models/
  │   ├── montecarlo.py  GBM, GARCH(1,1), Merton Jump-Diffusion
  │   ├── metrics.py     Risk metrics (Sharpe, Alpha, Sortino, Calmar)
  │   ├── signals.py     Technical signal generation
  │   └── backtest.py    Strategy backtesting engine
  └── routes/
      ├── prices.py      /api/prices, /api/forecast
      ├── technical.py   /api/technical, /api/backtest
      ├── analytics.py   /api/analytics, /api/fundamentals
      ├── portfolio.py   /api/portfolio
      ├── sectors.py     /api/sectors
      ├── macro.py       /api/macro
      ├── news.py        /api/news, /api/ai_summary
      └── monthly.py     /api/monthly_returns

frontend/                React 18 + TypeScript + Vite + Recharts
  ├── src/
  │   ├── App.tsx        State management + tab routing
  │   ├── tabs/          5 tab components
  │   ├── components/    18 reusable components
  │   ├── types/         TypeScript interfaces
  │   ├── constants/     App constants
  │   ├── styles/        Inline style system
  │   └── utils/         Helper functions
  └── vite.config.ts     Dev proxy + build config
```

## Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Deployment
- **Frontend:** GitHub Pages (auto-deploy via GitHub Actions)
- **Backend:** Vercel serverless functions

## Data Sources
- **Yahoo Finance API** (v8 chart + v10 quoteSummary) for all price, fundamental, and earnings data
- **Anthropic Claude API** (optional) for news sentiment analysis

## Key Technical Concepts
- **Vol-Adjusted returns:** Base 100 / expanding annualized volatility — a pseudo-Sharpe normalization
- **Monte Carlo models:** GBM (constant vol), GARCH (vol clustering), Merton (jump-diffusion)
- **Tangent portfolio:** Long-only max Sharpe via constrained optimization (scipy SLSQP)
- **DCF:** 2-stage free cash flow model with 5Y high-growth + 5Y fade + terminal value
- **PEG fallback:** Calculated from Forward P/E / EPS Growth when Yahoo returns empty
