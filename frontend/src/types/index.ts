export interface CompanyInfo { name: string; color: string }
export interface SeriesData {
  name: string; color: string;
  base100: (number | null)[]; vol_adjusted: (number | null)[];
}
export interface ApiResponse { dates: string[]; series: Record<string, SeriesData> }
export interface ForecastBand { median: number[]; p_lo: number[]; p_hi: number[] }
export interface ForecastSeriesData {
  last_historical: number;
  last_historical_va: number;
  va_factor: number;
  gbm: ForecastBand; garch: ForecastBand; merton: ForecastBand;
}
export interface ForecastResponse {
  forecast_dates: string[]; band_pct: number;
  series: Record<string, ForecastSeriesData>;
}
export interface EarningsEvent {
  date: string;
  eps_estimate: number | null;
  eps_actual: number | null;
  eps_surprise: number | null;
}
export interface TechnicalSignal {
  indicator: string; type: "bullish" | "bearish" | "neutral";
  strength: "strong" | "weak" | "neutral"; icon: string; title: string; detail: string;
}
export interface TechnicalData {
  ticker: string; name: string; color: string; dates: string[];
  close: (number|null)[]; sma20: (number|null)[]; sma50: (number|null)[]; sma200: (number|null)[];
  bb_upper: (number|null)[]; bb_lower: (number|null)[]; bb_middle: (number|null)[];
  rsi: (number|null)[]; macd_line: (number|null)[]; macd_signal: (number|null)[]; macd_hist: (number|null)[];
  volume: (number|null)[]; earnings_dates: EarningsEvent[];
  signals: TechnicalSignal[];
}
export interface BacktestTrade {
  entry_date: string; exit_date: string; entry_price: number; exit_price: number;
  return_pct: number; duration_days: number; win: boolean; open?: boolean;
}
export interface BacktestMetrics {
  strategy_return: number; bah_return: number; excess_return: number;
  sharpe: number | null; max_drawdown: number; n_trades: number;
  win_rate: number | null; time_in_market: number;
}
export interface BacktestData {
  strategy: string; dates: string[];
  equity: number[]; bah_equity: number[];
  trades: BacktestTrade[]; metrics: BacktestMetrics;
}
export interface TickerMetrics {
  total_return: number | null; ann_vol: number | null;
  sharpe: number | null; max_drawdown: number | null;
}
export interface ExtendedMetrics {
  alpha: number | null; treynor: number | null;
  calmar: number | null; sortino: number | null;
}
export interface FundamentalsData {
  trailing_pe: number | null; forward_pe: number | null;
  price_to_book: number | null; ev_to_ebitda: number | null;
  peg_ratio: number | null; market_cap: number | null;
  dividend_yield: number | null; revenue_growth: number | null;
  earnings_growth: number | null; profit_margin: number | null;
  roe: number | null; debt_to_equity: number | null;
  current_price: number | null; target_mean: number | null;
  target_high: number | null; target_low: number | null;
  analyst_count: number | null; recommendation: string | null;
  // DCF fields
  total_revenue: number | null; operating_margin: number | null;
  free_cash_flow: number | null; shares_outstanding: number | null;
  total_debt: number | null; total_cash: number | null;
  beta: number | null;
}
export interface DCFInputs {
  fcf: number; g1: number; g2: number;
  gTerminal: number; wacc: number;
  netDebt: number; shares: number;
}
export interface AnalyticsData {
  dates: string[];
  metrics: Record<string, TickerMetrics>;
  extended_metrics: Record<string, ExtendedMetrics>;
  correlation: Record<string, Record<string, number>>;
  drawdown: Record<string, (number|null)[]>;
  beta: Record<string, number | null>;
  rolling_vol: Record<string, (number|null)[]>;
  benchmark: {
    ticker: string; name: string; color: string;
    base100: (number|null)[]; metrics: TickerMetrics; drawdown: (number|null)[];
    beta: number;
  };
}
export interface PortfolioData {
  dates: string[];
  portfolio: { base100: (number|null)[]; metrics: TickerMetrics };
  tickers: Record<string, { name: string; color: string; weight: number; base100: (number|null)[] }>;
  tangent: {
    weights: Record<string, number>; expected_return: number;
    expected_vol: number; sharpe: number | null;
    base100: (number|null)[]; metrics: TickerMetrics;
  } | null;
  benchmark: { ticker: string; name: string; color: string; base100: (number|null)[]; metrics: TickerMetrics };
}
export interface SectorData {
  dates: string[];
  series: Record<string, { name: string; color: string; base100: (number|null)[]; metrics: TickerMetrics }>;
}
export interface NewsArticle {
  title: string; publisher: string; published_at: string | number; url: string; thumbnail: string | null;
}
export interface NewsSentiment {
  sentiment: "bullish" | "bearish" | "neutral" | "Bullish" | "Bearish" | "Neutral";
  score: number;
  themes: string[];
  analysis: string;
  article_scores: number[];
}
export interface NewsData {
  ticker: string; company: string;
  articles: NewsArticle[];
  sentiment: NewsSentiment | null;
}

export interface MacroItem {
  label: string; color: string; price: number;
  chg_1d: number | null; chg_1w: number | null; chg_1m: number | null;
}
export type MacroData = Record<string, MacroItem>;

export interface MonthlyReturnsData {
  ticker: string;
  returns: Record<number, Record<number, number>>; // year -> month(1-12) -> %
}
export interface AiSummaryData {
  ticker: string; company: string; summary: string;
  price: number; period_return: number; generated_at: string;
}

export type ViewMode  = "base100" | "vol_adjusted";
export type AppMode   = "comparison" | "technical" | "analytics" | "portfolio" | "sectors";
export type FcstModel = "gbm" | "garch" | "merton";

export interface EarningsHover { clientX: number; clientY: number; event: EarningsEvent }

export type InsightType = "positive" | "negative" | "warning" | "info";
export interface Insight { type: InsightType; icon: string; text: string }

export type ScoreRating = "buy" | "hold" | "sell";
export interface TickerScore { score: number; rating: ScoreRating; breakdown: { label: string; pts: number; max: number }[] }
