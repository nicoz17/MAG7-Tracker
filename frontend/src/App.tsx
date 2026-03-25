import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
  ComposedChart, Area, Bar, BarChart, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

/* ─── Types ─── */
interface CompanyInfo { name: string; color: string }
interface SeriesData {
  name: string; color: string;
  base100: (number | null)[]; vol_adjusted: (number | null)[];
}
interface ApiResponse { dates: string[]; series: Record<string, SeriesData> }
interface ForecastBand { median: number[]; p_lo: number[]; p_hi: number[] }
interface ForecastSeriesData {
  last_historical: number;
  last_historical_va: number;
  va_factor: number;
  gbm: ForecastBand; garch: ForecastBand; merton: ForecastBand;
}
interface ForecastResponse {
  forecast_dates: string[]; band_pct: number;
  series: Record<string, ForecastSeriesData>;
}
interface EarningsEvent {
  date: string;
  eps_estimate: number | null;
  eps_actual: number | null;
  eps_surprise: number | null;
}
interface TechnicalSignal {
  indicator: string; type: "bullish" | "bearish" | "neutral";
  strength: "strong" | "weak" | "neutral"; icon: string; title: string; detail: string;
}
interface TechnicalData {
  ticker: string; name: string; color: string; dates: string[];
  close: (number|null)[]; sma20: (number|null)[]; sma50: (number|null)[]; sma200: (number|null)[];
  bb_upper: (number|null)[]; bb_lower: (number|null)[]; bb_middle: (number|null)[];
  rsi: (number|null)[]; macd_line: (number|null)[]; macd_signal: (number|null)[]; macd_hist: (number|null)[];
  volume: (number|null)[]; earnings_dates: EarningsEvent[];
  signals: TechnicalSignal[];
}
interface BacktestTrade {
  entry_date: string; exit_date: string; entry_price: number; exit_price: number;
  return_pct: number; duration_days: number; win: boolean; open?: boolean;
}
interface BacktestMetrics {
  strategy_return: number; bah_return: number; excess_return: number;
  sharpe: number | null; max_drawdown: number; n_trades: number;
  win_rate: number | null; time_in_market: number;
}
interface BacktestData {
  strategy: string; dates: string[];
  equity: number[]; bah_equity: number[];
  trades: BacktestTrade[]; metrics: BacktestMetrics;
}
interface TickerMetrics {
  total_return: number | null; ann_vol: number | null;
  sharpe: number | null; max_drawdown: number | null;
}
interface ExtendedMetrics {
  alpha: number | null; treynor: number | null;
  calmar: number | null; sortino: number | null;
}
interface FundamentalsData {
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
interface DCFInputs {
  fcf: number; g1: number; g2: number;
  gTerminal: number; wacc: number;
  netDebt: number; shares: number;
}
interface AnalyticsData {
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
interface PortfolioData {
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
interface SectorData {
  dates: string[];
  series: Record<string, { name: string; color: string; base100: (number|null)[]; metrics: TickerMetrics }>;
}
interface NewsArticle {
  title: string; publisher: string; published_at: string | number; url: string; thumbnail: string | null;
}
interface NewsSentiment {
  sentiment: "bullish" | "bearish" | "neutral" | "Bullish" | "Bearish" | "Neutral";
  score: number;
  themes: string[];
  analysis: string;
  article_scores: number[];
}
interface NewsData {
  ticker: string; company: string;
  articles: NewsArticle[];
  sentiment: NewsSentiment | null;
}

interface MacroItem {
  label: string; color: string; price: number;
  chg_1d: number | null; chg_1w: number | null; chg_1m: number | null;
}
type MacroData = Record<string, MacroItem>;

interface MonthlyReturnsData {
  ticker: string;
  returns: Record<number, Record<number, number>>; // year → month(1-12) → %
}
interface AiSummaryData {
  ticker: string; company: string; summary: string;
  price: number; period_return: number; generated_at: string;
}

type ViewMode  = "base100" | "vol_adjusted";
type AppMode   = "comparison" | "technical" | "analytics" | "portfolio" | "sectors";
type FcstModel = "gbm" | "garch" | "merton";

/* ─── Constants ─── */
const TICKER_ICONS: Record<string, string> = {
  AAPL: "🍎", MSFT: "🪟", GOOGL: "🔍", AMZN: "📦", NVDA: "🟢", META: "👁", TSLA: "⚡",
};
const MA_COLORS: Record<number, string> = { 20: "#f0c27f", 50: "#fc5c7d", 200: "#4285F4" };

const MODEL_INFO: Record<FcstModel, { title: string; formula: string; desc: string; pro: string; con: string }> = {
  gbm: {
    title:   "GBM — Geometric Brownian Motion",
    formula: "S(t+1) = S(t)·exp((μ−σ²/2) + σZ)",
    desc:    "Modelo clásico. Drift μ y volatilidad σ constantes en el tiempo. Base del modelo Black-Scholes. Supone retornos log-normales independientes.",
    pro:     "Simple, rápido, analítico",
    con:     "Ignora clusters de vol y crash risk",
  },
  garch: {
    title:   "GARCH(1,1) — Volatilidad Condicional",
    formula: "σ²(t) = ω + α·ε²(t-1) + β·σ²(t-1)",
    desc:    "La volatilidad no es constante: σ² del día de mañana depende del shock de hoy y la varianza de ayer. Captura el efecto 'volatility clustering' real en mercados.",
    pro:     "Modela clusters de vol, más realista",
    con:     "No captura saltos bruscos",
  },
  merton: {
    title:   "Merton Jump-Diffusion",
    formula: "dS/S = (μ−λκ)dt + σdW + J·dN(λ)",
    desc:    "Extiende GBM con saltos aleatorios (proceso de Poisson). Los retornos extremos (|r|>2.5σ) se tratan como 'saltos' y se simulan por separado. Mejor fat tails y crash risk.",
    pro:     "Modela saltos y fat tails",
    con:     "Sensible al umbral de clasificación de saltos",
  },
};

const BAND_OPTIONS = [50, 60, 70, 80, 90] as const;

/* ─── Helpers ─── */
function formatDate(d: Date) { return d.toISOString().slice(0, 10) }
function getDefaultDates() {
  const end = new Date(), start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return { start: formatDate(start), end: formatDate(end) };
}
const fmtAxis = (v: string) => {
  const d = new Date(v);
  return `${d.toLocaleString("en", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
};
function corrBg(v: number): string {
  const t = Math.max(0, Math.min(1, v));
  return `rgba(240,194,127,${(t * 0.75).toFixed(2)})`;
}
function metricColor(val: number | null, good: "high" | "low"): string {
  if (val == null) return "#6b6b7b";
  const positive = good === "high" ? val > 0 : val > -5;
  return positive ? "#4ade80" : val > (good === "high" ? -1 : -15) ? "#f0c27f" : "#f87171";
}
function betaColor(b: number | null): string {
  if (b == null) return "#6b6b7b";
  return b > 1.3 ? "#f87171" : b < 0.7 ? "#4ade80" : "#f0c27f";
}

/* ─── Styles ─── */
const S = {
  container:   { maxWidth: 1200, margin: "0 auto", padding: "32px 24px" } as React.CSSProperties,
  header:      { marginBottom: 32 } as React.CSSProperties,
  title: {
    fontFamily: "'Space Mono', monospace", fontSize: 42, fontWeight: 700, margin: 0,
    letterSpacing: "-1px",
    background: "linear-gradient(135deg, #f0c27f 0%, #fc5c7d 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  } as React.CSSProperties,
  subtitle: {
    fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#6b6b7b",
    marginTop: 6, letterSpacing: "2px", textTransform: "uppercase" as const,
  } as React.CSSProperties,
  modeSwitcher: {
    display: "flex", background: "#16161f", borderRadius: 12,
    padding: 4, width: "fit-content", marginTop: 24, marginBottom: 32, flexWrap: "wrap" as const, gap: 2,
  } as React.CSSProperties,
  modeTab: (active: boolean) => ({
    background: active ? "linear-gradient(135deg, #f0c27f 0%, #fc5c7d 100%)" : "transparent",
    color: active ? "#0a0a0f" : "#6b6b7b", border: "none", borderRadius: 9,
    padding: "10px 22px", fontFamily: "'Space Mono', monospace", fontSize: 11,
    fontWeight: active ? 700 : 400, cursor: "pointer",
    letterSpacing: "1px", textTransform: "uppercase" as const, transition: "all 0.2s",
  } as React.CSSProperties),
  row: {
    display: "flex", gap: 20, flexWrap: "wrap" as const,
    alignItems: "flex-end", marginBottom: 28,
  } as React.CSSProperties,
  fg:  { display: "flex", flexDirection: "column" as const, gap: 6 } as React.CSSProperties,
  lbl: {
    fontFamily: "'Space Mono', monospace", fontSize: 10,
    letterSpacing: "1.5px", textTransform: "uppercase" as const, color: "#6b6b7b",
  } as React.CSSProperties,
  input: {
    background: "#16161f", border: "1px solid #2a2a3a", borderRadius: 8,
    padding: "10px 14px", color: "#e8e6e3",
    fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none",
  } as React.CSSProperties,
  chips: { display: "flex", gap: 10, flexWrap: "wrap" as const, marginBottom: 28 } as React.CSSProperties,
  btn: {
    background: "linear-gradient(135deg, #f0c27f 0%, #fc5c7d 100%)",
    border: "none", borderRadius: 10, padding: "12px 32px", color: "#0a0a0f",
    fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
    letterSpacing: "1px", textTransform: "uppercase" as const, cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 4px 20px rgba(252,92,125,0.25)",
  } as React.CSSProperties,
  card: {
    background: "#12121a", border: "1px solid #1e1e2e", borderRadius: 16,
    padding: "24px 20px 16px 8px", marginBottom: 16,
  } as React.CSSProperties,
  cardTitle: {
    fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: "1px",
    color: "#8a8a9a", marginBottom: 12, paddingLeft: 20,
  } as React.CSSProperties,
  toggle: {
    display: "flex", gap: 4, background: "#16161f",
    borderRadius: 10, padding: 4, width: "fit-content",
  } as React.CSSProperties,
  tBtn: (active: boolean) => ({
    background: active ? "linear-gradient(135deg, #f0c27f 0%, #fc5c7d 100%)" : "transparent",
    color: active ? "#0a0a0f" : "#6b6b7b", border: "none", borderRadius: 8,
    padding: "8px 18px", fontFamily: "'Space Mono', monospace", fontSize: 11,
    fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.2s",
  } as React.CSSProperties),
  iBtn: (active: boolean, color: string) => ({
    background: active ? `${color}22` : "transparent",
    border: `1.5px solid ${active ? color : "#2a2a3a"}`,
    borderRadius: 8, padding: "6px 14px", color: active ? color : "#5a5a6a",
    fontFamily: "'Space Mono', monospace", fontSize: 11, cursor: "pointer", transition: "all 0.2s",
  } as React.CSSProperties),
  spinner: {
    display: "flex", alignItems: "center", justifyContent: "center", height: 300,
    fontFamily: "'Space Mono', monospace", color: "#6b6b7b", fontSize: 14,
  } as React.CSSProperties,
  err: {
    background: "rgba(252,92,125,0.08)", border: "1px solid rgba(252,92,125,0.25)",
    borderRadius: 10, padding: "14px 20px", color: "#fc5c7d",
    fontFamily: "'Space Mono', monospace", fontSize: 12, marginBottom: 20,
  } as React.CSSProperties,
  empty: {
    display: "flex", flexDirection: "column" as const,
    alignItems: "center", justifyContent: "center", height: 300,
    gap: 12, color: "#3a3a4a",
  } as React.CSSProperties,
  info: {
    background: "#12121a", border: "1px solid #1e1e2e", borderRadius: 12,
    padding: "14px 20px", marginBottom: 20,
    fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b7b", lineHeight: 1.7,
  } as React.CSSProperties,
  footer: {
    textAlign: "center" as const, padding: "32px 0 16px",
    fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", letterSpacing: "1.5px",
  } as React.CSSProperties,
};

/* ─── TickerChip ─── */
function TickerChip({ ticker, info, selected, onToggle }: {
  ticker: string; info: CompanyInfo; selected: boolean; onToggle: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
      borderRadius: 10, border: `1.5px solid ${selected ? info.color : "#2a2a3a"}`,
      background: selected ? `${info.color}12` : "#16161f",
      cursor: "pointer", transition: "all 0.2s", userSelect: "none",
    }} onClick={onToggle}>
      <span style={{ fontSize: 18 }}>{TICKER_ICONS[ticker]}</span>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: selected ? info.color : "#3a3a4a", flexShrink: 0 }} />
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: selected ? "#e8e6e3" : "#5a5a6a" }}>{ticker}</span>
      <span style={{ fontSize: 11, color: selected ? "#8a8a9a" : "#3a3a4a" }}>{info.name}</span>
    </div>
  );
}

/* ─── CustomTooltip ─── */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const hist = payload.filter((e: any) => !String(e.dataKey).includes("_"));
  const fcst = payload.filter((e: any) => String(e.dataKey).endsWith("_median"));
  const entries = [
    ...hist.map((e: any) => ({ ...e, dn: e.name, forecast: false })),
    ...fcst.map((e: any) => ({ ...e, dn: String(e.dataKey).replace("_median", "") + " (fcst)", forecast: true })),
  ];
  if (!entries.length) return null;
  return (
    <div style={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 10, padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b7b", marginBottom: 8 }}>{label}</div>
      {entries.map((e: any) => (
        <div key={e.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, opacity: e.forecast ? 0.6 : 1 }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: e.forecast ? "#8a8a9a" : "#e8e6e3" }}>{e.dn}</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: e.color, marginLeft: "auto", fontWeight: 700 }}>
            {e.value != null ? e.value.toFixed(1) : "—"}{e.forecast && <span style={{ fontSize: 9 }}> ~</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── TechnicalTooltip ─── */
const T_SKIP = new Set(["bb_lower_stack", "bb_fill"]);
const T_NAMES: Record<string, string> = {
  close: "Close", sma20: "SMA 20", sma50: "SMA 50", sma200: "SMA 200",
  bb_upper: "BB Upper", bb_lower: "BB Lower", rsi: "RSI",
  macd_line: "MACD", macd_signal: "Signal", macd_hist: "Hist",
  volume: "Volume",
};
function TechnicalTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter((e: any) => !T_SKIP.has(String(e.dataKey)) && e.value != null);
  if (!entries.length) return null;
  return (
    <div style={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 10, padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b7b", marginBottom: 8 }}>{label}</div>
      {entries.map((e: any) => (
        <div key={e.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color || "#e8e6e3", flexShrink: 0 }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#8a8a9a" }}>{T_NAMES[e.dataKey] || e.dataKey}</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: e.color || "#e8e6e3", marginLeft: "auto", fontWeight: 700 }}>
            {e.dataKey === "volume"
              ? (e.value >= 1e6 ? `${(e.value/1e6).toFixed(1)}M` : e.value.toLocaleString())
              : typeof e.value === "number" ? e.value.toFixed(2) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── MetricsTable ─── */
function MetricsTable({ metrics, beta, extended, tickers, companies, benchmark }: {
  metrics: Record<string, TickerMetrics>;
  beta: Record<string, number | null>;
  extended: Record<string, ExtendedMetrics>;
  tickers: string[];
  companies: Record<string, CompanyInfo>;
  benchmark: AnalyticsData["benchmark"];
}) {
  const cols = ["Retorno", "Ann. Vol", "Sharpe", "Max DD", "Beta", "Alpha", "Calmar", "Sortino"];
  const th: React.CSSProperties = {
    fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "1.5px",
    color: "#6b6b7b", padding: "10px 14px", textAlign: "right" as const,
    textTransform: "uppercase",
  };
  const td = (color: string): React.CSSProperties => ({
    fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
    color, padding: "10px 14px", textAlign: "right" as const,
  });
  const fmt = (v: number | null, suffix = "%") =>
    v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}${suffix}`;

  const alphaColor = (v: number | null) => v == null ? "#6b6b7b" : v > 5 ? "#4ade80" : v > 0 ? "#a3e635" : v > -5 ? "#f0c27f" : "#f87171";
  const ratioColor = (v: number | null) => v == null ? "#6b6b7b" : v > 1 ? "#4ade80" : v > 0 ? "#f0c27f" : "#f87171";

  const renderRow = (t: string, m: TickerMetrics, b: number | null, ex: ExtendedMetrics | undefined, color: string, name: string, dashed = false) => (
    <tr key={t} style={{ borderBottom: "1px solid #1e1e2e" }}>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0,
            ...(dashed ? { border: `2px dashed ${color}`, background: "transparent" } : {}) }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: "#e8e6e3" }}>{t}</span>
          <span style={{ fontSize: 11, color: "#5a5a6a" }}>{name}</span>
        </div>
      </td>
      <td style={td(metricColor(m.total_return, "high"))}>{fmt(m.total_return)}</td>
      <td style={td("#e8e6e3")}>{fmt(m.ann_vol)}</td>
      <td style={td(m.sharpe == null ? "#6b6b7b" : m.sharpe >= 1.5 ? "#4ade80" : m.sharpe >= 0.5 ? "#f0c27f" : "#f87171")}>
        {m.sharpe == null ? "—" : m.sharpe.toFixed(2)}
      </td>
      <td style={td(metricColor(m.max_drawdown ?? 0, "low"))}>{fmt(m.max_drawdown)}</td>
      <td style={td(betaColor(b))}>{b != null ? b.toFixed(2) : "—"}</td>
      <td style={td(alphaColor(ex?.alpha ?? null))}>{ex?.alpha != null ? `${ex.alpha > 0 ? "+" : ""}${ex.alpha.toFixed(1)}%` : "—"}</td>
      <td style={td(ratioColor(ex?.calmar ?? null))}>{ex?.calmar != null ? ex.calmar.toFixed(2) : "—"}</td>
      <td style={td(ratioColor(ex?.sortino ?? null))}>{ex?.sortino != null ? ex.sortino.toFixed(2) : "—"}</td>
    </tr>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #2a2a3a" }}>
            <th style={{ ...th, textAlign: "left" as const }}>Stock</th>
            {cols.map(c => <th key={c} style={th}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {tickers.map(t => renderRow(t, metrics[t], beta[t] ?? null, extended[t], companies[t]?.color ?? "#fff", companies[t]?.name ?? t))}
          <tr><td colSpan={9} style={{ height: 1, background: "#2a2a3a" }} /></tr>
          {renderRow(benchmark.ticker, benchmark.metrics, benchmark.beta, undefined, benchmark.color, benchmark.name, true)}
        </tbody>
      </table>
    </div>
  );
}

/* ─── CorrelationHeatmap ─── */
function CorrelationHeatmap({ correlation, tickers, companies }: {
  correlation: Record<string, Record<string, number>>;
  tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  const cell: React.CSSProperties = {
    fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700,
    textAlign: "center" as const, padding: "12px 8px", minWidth: 64,
  };
  const hdr: React.CSSProperties = {
    fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b",
    letterSpacing: "1px", textAlign: "center" as const, padding: "8px",
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", margin: "0 auto" }}>
        <thead>
          <tr>
            <th style={{ ...hdr, width: 80 }} />
            {tickers.map(t => (
              <th key={t} style={hdr}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: companies[t]?.color }} />{t}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map(row => (
            <tr key={row}>
              <td style={{ ...hdr, textAlign: "right" as const, paddingRight: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                  {row}<div style={{ width: 8, height: 8, borderRadius: "50%", background: companies[row]?.color }} />
                </div>
              </td>
              {tickers.map(col => {
                const v = correlation[row]?.[col] ?? 0;
                const isDiag = row === col;
                return (
                  <td key={col} style={{ ...cell, background: corrBg(isDiag ? 1 : v), color: isDiag ? "#0a0a0f" : "#e8e6e3", borderRadius: isDiag ? 6 : 4 }}>
                    {isDiag ? "—" : v.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", textAlign: "center", marginTop: 12 }}>
        Correlación de log-retornos diarios · Escala: 0 (gris) → 1 (dorado)
      </div>
    </div>
  );
}

/* ─── InsightPanel ─── */
type InsightType = "positive" | "negative" | "warning" | "info";
interface Insight { type: InsightType; icon: string; text: string }

const INSIGHT_COLORS: Record<InsightType, string> = {
  positive: "#4ade80", negative: "#f87171", warning: "#f0c27f", info: "#60a5fa",
};

function generateInsights(
  analytics: AnalyticsData,
  tickers: string[],
  companies: Record<string, CompanyInfo>,
): Insight[] {
  if (tickers.length === 0) return [];
  const m = analytics.metrics;
  const ex = analytics.extended_metrics;
  const b = analytics.beta;
  const corr = analytics.correlation;
  const out: Insight[] = [];

  // 1. Best / worst performer
  const byRet = [...tickers].sort((a, z) => (m[z].total_return ?? -999) - (m[a].total_return ?? -999));
  if (byRet.length >= 2) {
    const best = byRet[0], worst = byRet[byRet.length - 1];
    const bv = m[best].total_return, wv = m[worst].total_return;
    out.push({ type: bv != null && bv > 0 ? "positive" : "warning", icon: "📈",
      text: `Mejor desempeño: ${best} (${bv != null ? (bv > 0 ? "+" : "") + bv.toFixed(1) + "%" : "—"}) · peor: ${worst} (${wv != null ? (wv > 0 ? "+" : "") + wv.toFixed(1) + "%" : "—"})` });
  }

  // 2. Best Sharpe
  const bySharpe = [...tickers].sort((a, z) => (m[z].sharpe ?? -99) - (m[a].sharpe ?? -99));
  if (bySharpe.length > 0) {
    const t = bySharpe[0];
    const s = m[t].sharpe;
    out.push({ type: s != null && s > 1 ? "positive" : "info", icon: "🎯",
      text: `Mejor riesgo/retorno: ${t} con Sharpe ${s?.toFixed(2) ?? "—"} — retorna ${s != null && s > 1 ? "bien" : "moderadamente"} por unidad de riesgo asumido` });
  }

  // 3. Alpha leader
  const alphas = tickers.map(t => ({ t, a: ex[t]?.alpha })).filter(x => x.a != null).sort((a, z) => (z.a ?? 0) - (a.a ?? 0));
  if (alphas.length > 0) {
    const top = alphas[0], bot = alphas[alphas.length - 1];
    out.push({ type: (top.a ?? 0) > 0 ? "positive" : "warning", icon: "💡",
      text: `Mayor alpha vs CAPM: ${top.t} (${(top.a! > 0 ? "+" : "") + top.a!.toFixed(1)}pp) · menor: ${bot.t} (${(bot.a! > 0 ? "+" : "") + bot.a!.toFixed(1)}pp). Alpha mide cuánto retorno no explica el mercado` });
  }

  // 4. Beta extremes
  const betas = tickers.map(t => ({ t, b: b[t] ?? 0 })).sort((a, z) => z.b - a.b);
  if (betas.length >= 2) {
    const hi = betas[0], lo = betas[betas.length - 1];
    out.push({ type: hi.b > 1.5 ? "warning" : "info", icon: "⚡",
      text: `Mayor sensibilidad al mercado: ${hi.t} (β=${hi.b.toFixed(2)}) — si el S&P cae 10%, esperarías ~${(hi.b * 10).toFixed(0)}% de caída. Más defensivo: ${lo.t} (β=${lo.b.toFixed(2)})` });
  }

  // 5. Correlation insight
  if (tickers.length >= 2) {
    let minC = 2, maxC = -2;
    let minP = ["", ""], maxP = ["", ""];
    for (let i = 0; i < tickers.length; i++) {
      for (let j = i + 1; j < tickers.length; j++) {
        const c = corr[tickers[i]]?.[tickers[j]] ?? 0;
        if (c < minC) { minC = c; minP = [tickers[i], tickers[j]]; }
        if (c > maxC) { maxC = c; maxP = [tickers[i], tickers[j]]; }
      }
    }
    out.push({ type: "info", icon: "🔗",
      text: `Par más correlacionado: ${maxP[0]}-${maxP[1]} (${maxC.toFixed(2)}) — poca diversificación entre ellos. Par menos: ${minP[0]}-${minP[1]} (${minC.toFixed(2)}) — mejor complemento en portfolio` });
  }

  // 6. Worst drawdown
  const byDD = [...tickers].sort((a, z) => (m[a].max_drawdown ?? 0) - (m[z].max_drawdown ?? 0));
  if (byDD.length > 0) {
    const t = byDD[0], dd = m[t].max_drawdown;
    out.push({ type: dd != null && dd < -30 ? "negative" : "warning", icon: "📉",
      text: `Mayor caída desde máximo: ${t} con ${dd?.toFixed(1)}%. Calmar ratio: ${ex[t]?.calmar?.toFixed(2) ?? "—"} (retorno anual / máx drawdown)` });
  }

  // 7. Sortino (downside risk)
  const bySortino = tickers.map(t => ({ t, s: ex[t]?.sortino })).filter(x => x.s != null).sort((a, z) => (z.s ?? 0) - (a.s ?? 0));
  if (bySortino.length > 0) {
    const top = bySortino[0];
    out.push({ type: (top.s ?? 0) > 1 ? "positive" : "info", icon: "🛡️",
      text: `Mejor Sortino: ${top.t} (${top.s?.toFixed(2)}) — penaliza solo la volatilidad negativa. Un Sortino alto significa que las subidas son más grandes que las bajadas` });
  }

  return out;
}

function InsightPanel({ analytics, tickers, companies }: {
  analytics: AnalyticsData; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  const insights = generateInsights(analytics, tickers, companies);
  if (insights.length === 0) return null;
  return (
    <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ ...S.cardTitle, paddingLeft: 0, marginBottom: 14 }}>ANÁLISIS AUTOMÁTICO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "#0e0e16", borderRadius: 8, borderLeft: `3px solid ${INSIGHT_COLORS[ins.type]}` }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{ins.icon}</span>
            <span style={{ fontSize: 12, color: "#c8c8d8", lineHeight: 1.5 }}>{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── InvestmentScore ─── */
type ScoreRating = "buy" | "hold" | "sell";
interface TickerScore { score: number; rating: ScoreRating; breakdown: { label: string; pts: number; max: number }[] }

const SCORE_META: Record<ScoreRating, { emoji: string; label: string; color: string; bg: string }> = {
  buy:  { emoji: "🟢", label: "Buy",  color: "#4ade80", bg: "rgba(74,222,128,0.08)"  },
  hold: { emoji: "🟡", label: "Hold", color: "#f0c27f", bg: "rgba(240,194,127,0.08)" },
  sell: { emoji: "🔴", label: "Sell", color: "#f87171", bg: "rgba(248,113,113,0.08)" },
};

function computeScore(
  m: TickerMetrics,
  ex: ExtendedMetrics | undefined,
  beta: number | null,
  fund: FundamentalsData | null | undefined,
): TickerScore {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const breakdown: { label: string; pts: number; max: number }[] = [];

  // Sharpe  (0-20 pts)
  const sharpe = m.sharpe ?? 0;
  const shPts = clamp(sharpe <= 0 ? 0 : sharpe >= 2 ? 20 : sharpe * 10, 0, 20);
  breakdown.push({ label: "Sharpe", pts: Math.round(shPts), max: 20 });

  // Alpha   (0-20 pts)
  const alpha = ex?.alpha ?? 0;
  const alPts = clamp(alpha <= -10 ? 0 : alpha >= 15 ? 20 : ((alpha + 10) / 25) * 20, 0, 20);
  breakdown.push({ label: "Alpha", pts: Math.round(alPts), max: 20 });

  // Calmar  (0-15 pts)
  const calmar = ex?.calmar ?? 0;
  const caPts = clamp(calmar <= 0 ? 0 : calmar >= 2 ? 15 : calmar * 7.5, 0, 15);
  breakdown.push({ label: "Calmar", pts: Math.round(caPts), max: 15 });

  // Sortino (0-15 pts)
  const sortino = ex?.sortino ?? 0;
  const soPts = clamp(sortino <= 0 ? 0 : sortino >= 2 ? 15 : sortino * 7.5, 0, 15);
  breakdown.push({ label: "Sortino", pts: Math.round(soPts), max: 15 });

  // Max DD  (0-15 pts) — closer to 0 is better
  const dd = m.max_drawdown ?? -100;
  const ddPts = clamp(dd <= -60 ? 0 : dd >= -5 ? 15 : ((dd + 60) / 55) * 15, 0, 15);
  breakdown.push({ label: "Max DD", pts: Math.round(ddPts), max: 15 });

  // Beta    (0-15 pts) — 0.7-1.2 is sweet spot
  const b = beta ?? 1;
  const bPts = b < 0.4 ? 8 : b <= 1.2 ? 15 : b <= 1.8 ? clamp(15 - (b - 1.2) * 12, 0, 15) : 0;
  breakdown.push({ label: "Beta", pts: Math.round(bPts), max: 15 });

  // Fundamentals bonus (0-15 pts, only if loaded)
  if (fund) {
    const pe   = fund.trailing_pe;
    const grow = fund.revenue_growth;
    const margin = fund.profit_margin;
    let fPts = 0;
    if (pe    != null) fPts += pe < 20 ? 5 : pe < 35 ? 3 : pe < 50 ? 1 : 0;
    if (grow  != null) fPts += grow > 0.15 ? 5 : grow > 0.05 ? 3 : grow > 0 ? 1 : 0;
    if (margin!= null) fPts += margin > 0.20 ? 5 : margin > 0.10 ? 3 : margin > 0 ? 1 : 0;
    breakdown.push({ label: "Fundamentals", pts: Math.round(fPts), max: 15 });
  }

  const total = breakdown.reduce((s, x) => s + x.pts, 0);
  const maxTotal = breakdown.reduce((s, x) => s + x.max, 0);
  const pct = total / maxTotal;
  const rating: ScoreRating = pct >= 0.60 ? "buy" : pct >= 0.38 ? "hold" : "sell";
  return { score: Math.round(pct * 100), rating, breakdown };
}

function InvestmentScoreCard({ analytics, tickers, companies, fundamentals }: {
  analytics: AnalyticsData;
  tickers: string[];
  companies: Record<string, CompanyInfo>;
  fundamentals: Record<string, FundamentalsData> | null;
}) {
  if (tickers.length === 0) return null;
  const scores = tickers.map(t => ({
    t,
    ...computeScore(analytics.metrics[t], analytics.extended_metrics[t], analytics.beta[t] ?? null, fundamentals?.[t]),
  }));

  return (
    <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ ...S.cardTitle, paddingLeft: 0, marginBottom: 14 }}>SCORE DE INVERSIÓN</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
        {scores.map(({ t, score, rating, breakdown }) => {
          const meta = SCORE_META[rating];
          return (
            <div key={t} style={{ flex: "1 1 160px", minWidth: 160, background: meta.bg, border: `1.5px solid ${meta.color}40`, borderRadius: 12, padding: "16px 18px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: companies[t]?.color }} />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: "#e8e6e3" }}>{t}</span>
              </div>
              {/* Big score */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: meta.color, lineHeight: 1 }}>{score}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#5a5a6a" }}>/100</span>
              </div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: meta.color, marginBottom: 12, letterSpacing: "1px" }}>
                {meta.label.toUpperCase()}
              </div>
              {/* Breakdown bars */}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
                {breakdown.map(({ label, pts, max }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#5a5a6a", letterSpacing: "0.5px" }}>{label}</span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#8a8a9a" }}>{pts}/{max}</span>
                    </div>
                    <div style={{ height: 3, background: "#1e1e2e", borderRadius: 2 }}>
                      <div style={{ height: 3, width: `${(pts/max)*100}%`, background: meta.color, borderRadius: 2, opacity: 0.8 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginTop: 12 }}>
        Score basado en Sharpe, Alpha (CAPM), Calmar, Sortino, Max Drawdown, Beta
        {fundamentals ? " y Fundamentales (P/E, crecimiento, márgenes)" : " · carga Fundamentales para incluirlos en el score"}.
        No es recomendación de inversión.
      </div>
    </div>
  );
}

/* ─── ValuationRadar ─── */
function ValuationRadar({ data, tickers, companies }: {
  data: Record<string, FundamentalsData>; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  // 6 axes — higher score = better for every axis (we invert where needed)
  const axes = [
    { key: "growth",  label: "Crecimiento" },
    { key: "margin",  label: "Rentabilidad" },
    { key: "value",   label: "Valuación" },
    { key: "roe",     label: "ROE" },
    { key: "momentum",label: "Momentum EPS" },
    { key: "quality", label: "Calidad" },
  ];

  // Compute raw scores per ticker
  const raw: Record<string, Record<string, number | null>> = {};
  for (const t of tickers) {
    const d = data[t];
    if (!d) { raw[t] = {}; continue; }
    const rev_g = d.revenue_growth != null ? d.revenue_growth * 100 : null;
    const eps_g = d.earnings_growth != null ? d.earnings_growth * 100 : null;
    raw[t] = {
      growth:   rev_g,
      margin:   d.profit_margin != null ? d.profit_margin * 100 : null,
      // value: lower P/E = better → invert (score = 100 - clamp(fpe, 5, 80) mapped to 0-100)
      value:    d.forward_pe != null ? Math.max(0, 100 - ((Math.min(d.forward_pe, 80) - 5) / 75) * 100) : null,
      roe:      d.roe != null ? d.roe * 100 : null,
      momentum: eps_g,
      quality:  d.debt_to_equity != null ? Math.max(0, 100 - Math.min(d.debt_to_equity, 200) / 2) : null,
    };
  }

  // Min-max normalize each axis across available tickers → 0-100
  const normalized: Record<string, Record<string, number>> = {};
  for (const ax of axes) {
    const vals = tickers.map(t => raw[t]?.[ax.key]).filter(v => v != null) as number[];
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const rng = mx - mn || 1;
    for (const t of tickers) {
      if (!normalized[t]) normalized[t] = {};
      const v = raw[t]?.[ax.key];
      normalized[t][ax.key] = v != null ? Math.round(((v - mn) / rng) * 100) : 0;
    }
  }

  // Build recharts data: one object per axis
  const chartData = axes.map(ax => {
    const pt: Record<string, any> = { axis: ax.label };
    for (const t of tickers) pt[t] = normalized[t]?.[ax.key] ?? 0;
    return pt;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
        {tickers.map(t => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: companies[t]?.color }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#8a8a9a" }}>{t}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#1e1e2e" />
          <PolarAngleAxis dataKey="axis" tick={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fill: "#8a8a9a" }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          {tickers.map(t => (
            <Radar key={t} name={t} dataKey={t}
              stroke={companies[t]?.color} fill={companies[t]?.color} fillOpacity={0.08} strokeWidth={2} />
          ))}
          <Tooltip
            contentStyle={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 10, fontFamily: "'Space Mono', monospace", fontSize: 11 }}
            formatter={(v: any, name: string) => [`${v}/100`, name]}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", textAlign: "center", marginTop: 4 }}>
        Scores normalizados 0–100 entre los tickers seleccionados · Crecimiento=Rev.Growth · Rentabilidad=Margen Neto · Valuación=100−P/E Forward · Calidad=100−D/E
      </div>
    </div>
  );
}

/* ─── AnalystTargets ─── */
const REC_LABEL: Record<string, { label: string; color: string }> = {
  "strong_buy":  { label: "Compra Fuerte", color: "#4ade80" },
  "buy":         { label: "Compra",        color: "#86efac" },
  "hold":        { label: "Mantener",      color: "#f0c27f" },
  "underperform":{ label: "Subperformance",color: "#f87171" },
  "sell":        { label: "Venta",         color: "#ef4444" },
};

function AnalystTargets({ data, tickers, companies }: {
  data: Record<string, FundamentalsData>; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {tickers.map(t => {
        const d = data[t];
        if (!d) return null;
        const price   = d.current_price;
        const mean    = d.target_mean;
        const high    = d.target_high;
        const low     = d.target_low;
        const count   = d.analyst_count;
        const rec     = (d.recommendation ?? "").toLowerCase();
        const recInfo = REC_LABEL[rec] ?? { label: rec || "N/D", color: "#6b6b7b" };
        const upside  = price && mean ? ((mean / price - 1) * 100) : null;
        const upsideColor = upside == null ? "#6b6b7b" : upside > 10 ? "#4ade80" : upside > 0 ? "#f0c27f" : "#f87171";

        // Bar: show low/mean/high range vs current price
        const barMin  = Math.min(price ?? 0, low ?? price ?? 0) * 0.97;
        const barMax  = Math.max(price ?? 0, high ?? price ?? 0) * 1.02;
        const barRng  = barMax - barMin || 1;
        const pricePct = price ? ((price - barMin) / barRng * 100) : null;
        const lowPct   = low   ? ((low   - barMin) / barRng * 100) : null;
        const highPct  = high  ? ((high  - barMin) / barRng * 100) : null;
        const meanPct  = mean  ? ((mean  - barMin) / barRng * 100) : null;

        return (
          <div key={t} style={{ background: "#0e0e16", border: `1px solid ${companies[t]?.color}30`, borderRadius: 12, padding: "16px 18px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: companies[t]?.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: "#e8e6e3" }}>{t}</span>
              </div>
              <div style={{ background: `${recInfo.color}18`, border: `1px solid ${recInfo.color}40`, borderRadius: 6, padding: "3px 8px" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, color: recInfo.color }}>{recInfo.label.toUpperCase()}</span>
              </div>
            </div>

            {/* Upside */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", marginBottom: 2 }}>Precio actual</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: "#e8e6e3" }}>
                  {price ? `$${price.toFixed(2)}` : "—"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", marginBottom: 2 }}>Upside al target</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: upsideColor }}>
                  {upside != null ? `${upside > 0 ? "+" : ""}${upside.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>

            {/* Range bar */}
            {price && low && high && mean && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ position: "relative", height: 28, background: "#1a1a2a", borderRadius: 6, overflow: "visible" }}>
                  {/* Low–High band */}
                  <div style={{
                    position: "absolute", top: "25%", height: "50%",
                    left: `${lowPct}%`, width: `${(highPct! - lowPct!)}%`,
                    background: `${companies[t]?.color}25`, borderRadius: 3,
                  }} />
                  {/* Mean target marker */}
                  {meanPct != null && (
                    <div style={{
                      position: "absolute", top: "10%", height: "80%", width: 3, borderRadius: 2,
                      left: `calc(${meanPct}% - 1.5px)`, background: companies[t]?.color,
                    }} />
                  )}
                  {/* Current price marker */}
                  {pricePct != null && (
                    <div style={{
                      position: "absolute", top: 0, height: "100%", width: 2, borderRadius: 2,
                      left: `calc(${pricePct}% - 1px)`, background: "#ffffff80",
                    }} />
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#5a5a6a" }}>${low.toFixed(0)}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: companies[t]?.color }}>▾ ${mean.toFixed(0)}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#5a5a6a" }}>${high.toFixed(0)}</span>
                </div>
              </div>
            )}

            {/* Analyst count */}
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", textAlign: "center" }}>
              {count ? `${count} analistas` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── DCFModel ─── */
function defaultDCFInputs(d: FundamentalsData | undefined): DCFInputs {
  if (!d) return { fcf: 0, g1: 15, g2: 8, gTerminal: 2.5, wacc: 10, netDebt: 0, shares: 1 };
  const g1 = d.revenue_growth != null
    ? Math.round(Math.min(Math.max(d.revenue_growth * 100, 0), 50))
    : 15;
  const wacc = d.beta != null
    ? Math.round(Math.min(Math.max(4.5 + d.beta * 5.5, 7), 15) * 10) / 10
    : 10;
  return {
    fcf: d.free_cash_flow ?? 0,
    g1,
    g2: Math.max(Math.round(g1 * 0.5), 3),
    gTerminal: 2.5,
    wacc,
    netDebt: (d.total_debt ?? 0) - (d.total_cash ?? 0),
    shares: d.shares_outstanding ?? 1,
  };
}

function computeDCF(inp: DCFInputs) {
  const w = inp.wacc / 100, g1r = inp.g1 / 100, g2r = inp.g2 / 100, gTr = inp.gTerminal / 100;
  if (w <= gTr || inp.shares <= 0 || inp.fcf <= 0) return null;
  let fcfPrev = inp.fcf, totalPV = 0;
  const years: { year: number; fcf: number; pv: number }[] = [];
  for (let t = 1; t <= 10; t++) {
    const fcfT = fcfPrev * (1 + (t <= 5 ? g1r : g2r));
    const pv = fcfT / Math.pow(1 + w, t);
    years.push({ year: t, fcf: fcfT, pv });
    totalPV += pv;
    fcfPrev = fcfT;
  }
  const tv = years[9].fcf * (1 + gTr) / (w - gTr);
  const tvPV = tv / Math.pow(1 + w, 10);
  const ev = totalPV + tvPV;
  const equity = ev - inp.netDebt;
  const intrinsic = equity / inp.shares;
  return { years, tv, tvPV, totalPV, ev, equity, intrinsic };
}

function DCFModel({ data, tickers, companies }: {
  data: Record<string, FundamentalsData>; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  const [active, setActive] = useState(tickers[0] ?? "");
  const [overrides, setOverrides] = useState<Record<string, DCFInputs>>({});

  const getInp = (t: string): DCFInputs => overrides[t] ?? defaultDCFInputs(data[t]);

  const setField = (t: string, field: keyof DCFInputs, val: number) =>
    setOverrides(prev => ({ ...prev, [t]: { ...getInp(t), [field]: val } }));

  const resetTicker = (t: string) =>
    setOverrides(prev => { const n = { ...prev }; delete n[t]; return n; });

  const fmtB = (n: number) => {
    const abs = Math.abs(n), sign = n < 0 ? "−" : "";
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(0)}M`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  if (!tickers.includes(active) && tickers.length > 0) {
    setActive(tickers[0]);
    return null;
  }
  const inp = getInp(active);
  const d = data[active];
  const currentPrice = d?.current_price ?? 0;
  const result = computeDCF(inp);
  const upside = result && currentPrice > 0 ? (result.intrinsic - currentPrice) / currentPrice * 100 : null;
  const upsideColor = upside == null ? "#5a5a7a" : upside > 10 ? "#4ade80" : upside < -10 ? "#fc5c7d" : "#f0c27f";

  const chartData = result
    ? result.years.map(y => ({ name: `Y${y.year}`, pv: parseFloat((y.pv / 1e9).toFixed(1)), fill: y.year <= 5 ? "#f0c27f" : "#fc5c7d" }))
        .concat([{ name: "TV", pv: parseFloat((result.tvPV / 1e9).toFixed(1)), fill: "#a78bfa" }])
    : [];

  const sliderRow = (label: string, field: keyof DCFInputs, min: number, max: number, step: number, fmt?: (v: number) => string) => (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a7a" }}>{label}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#f0c27f", fontWeight: 700 }}>
          {fmt ? fmt(inp[field] as number) : `${inp[field]}%`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={inp[field] as number}
        onChange={e => setField(active, field, parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#f0c27f", cursor: "pointer", height: 4 }} />
    </div>
  );

  const statBox = (label: string, val: string) => (
    <div style={{ padding: "8px 10px", background: "#0a0a14", borderRadius: 4, border: "1px solid #1e1e2e" }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginBottom: 3, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#c0c0d0" }}>{val}</div>
    </div>
  );

  return (
    <div>
      {/* Ticker tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" as const }}>
        {tickers.map(t => (
          <button key={t} onClick={() => setActive(t)} style={{
            padding: "6px 14px", fontFamily: "'Space Mono', monospace", fontSize: 11, cursor: "pointer",
            background: active === t ? (companies[t]?.color ?? "#f0c27f") + "22" : "transparent",
            border: `1px solid ${active === t ? (companies[t]?.color ?? "#f0c27f") : "#2a2a3e"}`,
            color: active === t ? (companies[t]?.color ?? "#f0c27f") : "#5a5a7a", borderRadius: 4,
          }}>{t}</button>
        ))}
        {overrides[active] && (
          <button onClick={() => resetTicker(active)} style={{
            marginLeft: "auto", padding: "6px 12px", fontFamily: "'Space Mono', monospace", fontSize: 10,
            background: "transparent", border: "1px solid #2a2a3e", color: "#5a5a7a", borderRadius: 4, cursor: "pointer",
          }}>↺ Reset supuestos</button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        {/* Left — Inputs */}
        <div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", textTransform: "uppercase" as const, marginBottom: 14, letterSpacing: 1 }}>
            Supuestos del modelo
          </div>

          {/* FCF Base */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a7a" }}>FCF Base TTM</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#f0c27f", fontWeight: 700 }}>{fmtB(inp.fcf)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" value={parseFloat((inp.fcf / 1e9).toFixed(2))}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setField(active, "fcf", v * 1e9); }}
                style={{ ...S.input, padding: "5px 8px", fontSize: 11, width: "100%", boxSizing: "border-box" as const }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", whiteSpace: "nowrap" as const }}>USD B</span>
            </div>
          </div>

          {sliderRow("Crecimiento FCF · Años 1–5", "g1", -10, 60, 1)}
          {sliderRow("Crecimiento FCF · Años 6–10", "g2", -10, 40, 1)}
          {sliderRow("Crecimiento Terminal", "gTerminal", 0, 5, 0.5)}
          {sliderRow("WACC · Tasa de descuento", "wacc", 5, 20, 0.5)}

          <div style={{ marginTop: 6, padding: "10px 12px", background: "#0a0a14", borderRadius: 4, border: "1px solid #1e1e2e" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginBottom: 4, textTransform: "uppercase" as const }}>Deuda Neta</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: inp.netDebt < 0 ? "#4ade80" : "#fc5c7d" }}>
              {inp.netDebt < 0 ? `Caja neta ${fmtB(Math.abs(inp.netDebt))}` : fmtB(inp.netDebt)}
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginTop: 2 }}>
              {fmtB(d?.total_debt ?? 0)} deuda · {fmtB(d?.total_cash ?? 0)} caja
            </div>
          </div>
        </div>

        {/* Right — Results */}
        <div>
          {result ? (
            <>
              <div style={{ textAlign: "center", padding: "18px 0 16px", borderBottom: "1px solid #1e1e2e", marginBottom: 16 }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  Valor Intrínseco Estimado · {active}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 40, fontWeight: 700, color: "#f0c27f", letterSpacing: -1, lineHeight: 1 }}>
                  ${result.intrinsic.toFixed(2)}
                </div>
                {currentPrice > 0 && upside != null && (
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: upsideColor, fontWeight: 700 }}>
                      {upside > 0 ? "▲" : "▼"} {Math.abs(upside).toFixed(1)}% {upside > 0 ? "potencial upside" : "sobrevaluado"}
                    </span>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", marginTop: 4 }}>
                      precio actual ${currentPrice.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {statBox("Enterprise Value", fmtB(result.ev))}
                {statBox("Equity Value", fmtB(result.equity))}
                {statBox("PV FCFs (1–10)", fmtB(result.totalPV))}
                {statBox("PV Terminal", fmtB(result.tvPV))}
                {statBox("TV / EV", `${(result.tvPV / result.ev * 100).toFixed(0)}%`)}
                {statBox("Acciones", `${(inp.shares / 1e9).toFixed(2)}B`)}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 20px", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a3a4a", lineHeight: 1.8 }}>
              {inp.fcf <= 0
                ? "FCF negativo · ajusta el FCF base para proyectar"
                : "WACC debe ser mayor al crecimiento terminal"}
            </div>
          )}
        </div>
      </div>

      {/* Bar chart */}
      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            Valor presente por período (B USD) ·{" "}
            <span style={{ color: "#f0c27f" }}>Años 1–5</span> ·{" "}
            <span style={{ color: "#fc5c7d" }}>Años 6–10</span> ·{" "}
            <span style={{ color: "#a78bfa" }}>Valor Terminal</span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chartData} margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} />
              <YAxis tick={{ fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={v => `$${v}B`} />
              <Tooltip formatter={(v: number) => [`$${v}B`, "VP"]}
                contentStyle={{ background: "#0f0f1a", border: "1px solid #2a2a3e", fontFamily: "'Space Mono', monospace", fontSize: 10 }} />
              <Bar dataKey="pv" radius={[3, 3, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#2a2a3e", marginTop: 12, lineHeight: 1.7 }}>
        Modelo DCF 2 etapas · 10 años + Valor Terminal · EV = Σ PV(FCF) + PV(TV) · Equity = EV − Deuda Neta ·
        Supuestos por defecto: FCF TTM de Yahoo Finance, WACC ≈ rf(4.5%) + β×5.5%, g1 ≈ crecimiento revenue TTM ·
        Solo orientativo — no constituye asesoramiento de inversión.
      </div>
    </div>
  );
}

/* ─── FundamentalsCard ─── */
function FundamentalsCard({ data, tickers, companies }: {
  data: Record<string, FundamentalsData>; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  const fmtMcap = (v: number | null) => {
    if (v == null) return "—";
    if (v >= 1e12) return `$${(v/1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `$${(v/1e9).toFixed(1)}B`;
    return `$${(v/1e6).toFixed(0)}M`;
  };
  const fmtPct = (v: number | null) => v == null ? "—" : `${(v*100).toFixed(1)}%`;
  const fmtX   = (v: number | null, dec = 1) => v == null ? "—" : `${v.toFixed(dec)}x`;

  const rows: { label: string; key: keyof FundamentalsData; fmt: (v: number | null) => string; goodHigh?: boolean }[] = [
    { label: "Market Cap",     key: "market_cap",     fmt: fmtMcap },
    { label: "P/E (trailing)", key: "trailing_pe",    fmt: v => fmtX(v, 1) },
    { label: "P/E (forward)",  key: "forward_pe",     fmt: v => fmtX(v, 1) },
    { label: "P/B",            key: "price_to_book",  fmt: v => fmtX(v, 2) },
    { label: "EV/EBITDA",      key: "ev_to_ebitda",   fmt: v => fmtX(v, 1) },
    { label: "PEG",            key: "peg_ratio",      fmt: v => fmtX(v, 2) },
    { label: "Rev. Growth",    key: "revenue_growth",  fmt: fmtPct, goodHigh: true },
    { label: "EPS Growth",     key: "earnings_growth", fmt: fmtPct, goodHigh: true },
    { label: "Profit Margin",  key: "profit_margin",   fmt: fmtPct, goodHigh: true },
    { label: "ROE",            key: "roe",             fmt: fmtPct, goodHigh: true },
    { label: "Deuda/Capital",  key: "debt_to_equity",  fmt: v => fmtX(v, 2), goodHigh: false },
    { label: "Div. Yield",     key: "dividend_yield",  fmt: fmtPct, goodHigh: true },
  ];

  const th: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "1px", color: "#6b6b7b", padding: "8px 12px", textAlign: "center" as const };
  const tdS = (good?: boolean, val?: number | null): React.CSSProperties => ({
    fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600,
    padding: "8px 12px", textAlign: "center" as const,
    color: val == null ? "#3a3a4a" : good == null ? "#e8e6e3" : good && val > 0 ? "#4ade80" : !good && val < 3 ? "#4ade80" : "#e8e6e3",
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #2a2a3a" }}>
            <th style={{ ...th, textAlign: "left" as const, minWidth: 110 }}>Métrica</th>
            {tickers.map(t => (
              <th key={t} style={th}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: companies[t]?.color }} />
                  {t}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} style={{ borderBottom: "1px solid #1a1a2a" }}>
              <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b", padding: "8px 12px", letterSpacing: "0.5px" }}>
                {row.label}
              </td>
              {tickers.map(t => {
                const val = data[t]?.[row.key] as number | null | undefined;
                return <td key={t} style={tdS(row.goodHigh, val ?? null)}>{row.fmt(val ?? null)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── EarningsLabel (Yahoo-style triangle flag with hover tooltip) ─── */
interface EarningsHover { clientX: number; clientY: number; event: EarningsEvent }

function EarningsLabel({ viewBox, earningEvent, onEnter, onLeave }: any) {
  if (!viewBox) return null;
  const { x, y, height } = viewBox;
  const bY = y + height;
  const w = 14, h = 9;
  return (
    <g
      style={{ cursor: "pointer" }}
      onMouseEnter={(e: React.MouseEvent) => onEnter?.({ clientX: e.clientX, clientY: e.clientY, event: earningEvent })}
      onMouseLeave={() => onLeave?.()}
    >
      <polygon points={`${x},${bY} ${x - w/2},${bY + h} ${x + w/2},${bY + h}`} fill="#f0c27f" opacity={0.9} />
      <text x={x} y={bY + h + 9} textAnchor="middle" fill="#f0c27f" fontSize={8} fontFamily="'Space Mono', monospace" fontWeight={700}>E</text>
      {/* Invisible wider hit area */}
      <rect x={x - 10} y={bY - 4} width={20} height={h + 16} fill="transparent" />
    </g>
  );
}

function EarningsTooltip({ hover }: { hover: EarningsHover | null }) {
  if (!hover) return null;
  const { clientX, clientY, event: ev } = hover;
  const beat = ev.eps_surprise != null ? ev.eps_surprise > 0 : null;
  return (
    <div style={{
      position: "fixed", left: clientX + 14, top: clientY - 10, zIndex: 9999,
      background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 10,
      padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      pointerEvents: "none", minWidth: 180,
    }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#f0c27f", fontWeight: 700, marginBottom: 10, letterSpacing: "0.5px" }}>
        ● Earnings
      </div>
      {[
        { label: "Date",         value: ev.date },
        { label: "EPS Estimate", value: ev.eps_estimate != null ? ev.eps_estimate.toFixed(2) : "—" },
        { label: "EPS Actual",   value: ev.eps_actual   != null ? ev.eps_actual.toFixed(2)   : "—" },
        { label: "EPS Surprise", value: ev.eps_surprise != null ? `${ev.eps_surprise > 0 ? "+" : ""}${ev.eps_surprise.toFixed(2)}%` : "—",
          color: beat == null ? "#e8e6e3" : beat ? "#4ade80" : "#f87171" },
      ].map(row => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "3px 0" }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b7b" }}>{row.label}</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: (row as any).color ?? "#e8e6e3" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── SignalsPanel ─── */
const SIGNAL_COLORS = { bullish: "#4ade80", bearish: "#f87171", neutral: "#94a3b8" };

function SignalsPanel({ signals, ticker }: { signals: TechnicalSignal[]; ticker: string }) {
  if (!signals.length) return null;

  const bullish = signals.filter(s => s.type === "bullish");
  const bearish = signals.filter(s => s.type === "bearish");
  const neutral  = signals.filter(s => s.type === "neutral");

  const bullScore = bullish.filter(s => s.strength === "strong").length * 2 + bullish.filter(s => s.strength === "weak").length;
  const bearScore = bearish.filter(s => s.strength === "strong").length * 2 + bearish.filter(s => s.strength === "weak").length;
  const overall: "bullish" | "bearish" | "neutral" = bullScore > bearScore ? "bullish" : bearScore > bullScore ? "bearish" : "neutral";
  const overallColor = SIGNAL_COLORS[overall];
  const overallLabel = overall === "bullish" ? "🟢 Alcista" : overall === "bearish" ? "🔴 Bajista" : "🟡 Neutral";

  return (
    <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, paddingLeft: 0 }}>SEÑALES TÉCNICAS · {ticker}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${overallColor}12`, border: `1.5px solid ${overallColor}40`, borderRadius: 10, padding: "8px 16px" }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: overallColor }}>{overallLabel}</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a" }}>
            {bullish.length}B / {bearish.length}Ba / {neutral.length}N
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        {[...signals].sort((a, b) => {
          const order = { strong: 0, weak: 1, neutral: 2 };
          return order[a.strength] - order[b.strength];
        }).map((sig, i) => {
          const col = SIGNAL_COLORS[sig.type];
          const opacity = sig.strength === "strong" ? 1 : 0.65;
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "#0e0e16", borderRadius: 8, borderLeft: `3px solid ${col}`, opacity }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{sig.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: col }}>{sig.title}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", background: "#1e1e2e", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.5px" }}>{sig.indicator}</span>
                  {sig.strength === "strong" && <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: col, background: `${col}15`, borderRadius: 4, padding: "1px 6px" }}>FUERTE</span>}
                </div>
                <span style={{ fontSize: 11, color: "#8a8a9a", lineHeight: 1.5 }}>{sig.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginTop: 10 }}>
        Señales basadas en valores actuales de indicadores · No constituyen recomendación de inversión
      </div>
    </div>
  );
}

/* ─── BacktestPanel ─── */
const STRATEGY_INFO: Record<string, { label: string; desc: string; icon: string }> = {
  rsi:       { icon: "📊", label: "RSI Mean Revert",  desc: "Compra cuando RSI<30, vende cuando RSI>70" },
  macd:      { icon: "📈", label: "MACD Crossover",   desc: "Long cuando MACD>señal, flat cuando cruza bajo" },
  sma_cross: { icon: "⭐", label: "SMA Golden/Death", desc: "Long cuando SMA50>SMA200, flat cuando cruza bajo" },
  bb:        { icon: "🎯", label: "BB Mean Revert",   desc: "Compra en banda inferior, vende en banda media" },
};

function BacktestPanel({ data, ticker, color }: { data: BacktestData; ticker: string; color: string }) {
  const { metrics, trades } = data;
  const info = STRATEGY_INFO[data.strategy];
  const excess = metrics.excess_return;
  const excessColor = excess > 0 ? "#4ade80" : excess < 0 ? "#f87171" : "#94a3b8";

  const btChartData = data.dates.map((d, i) => ({ date: d, strategy: data.equity[i], bah: data.bah_equity[i] }));

  const fmtRet = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

  const metricCells = [
    { label: "Retorno Estrategia", value: fmtRet(metrics.strategy_return), color: metrics.strategy_return > 0 ? "#4ade80" : "#f87171" },
    { label: "Buy & Hold",         value: fmtRet(metrics.bah_return),       color: metrics.bah_return > 0 ? "#4ade80" : "#f87171" },
    { label: "Exceso vs B&H",      value: fmtRet(metrics.excess_return),    color: excessColor },
    { label: "Sharpe",             value: metrics.sharpe != null ? metrics.sharpe.toFixed(2) : "—", color: metrics.sharpe != null && metrics.sharpe > 1 ? "#4ade80" : metrics.sharpe != null && metrics.sharpe > 0 ? "#f0c27f" : "#f87171" },
    { label: "Max Drawdown",       value: `${metrics.max_drawdown.toFixed(2)}%`, color: metrics.max_drawdown > -15 ? "#f0c27f" : "#f87171" },
    { label: "Nº Trades",          value: String(metrics.n_trades),          color: "#e8e6e3" },
    { label: "Win Rate",           value: metrics.win_rate != null ? `${metrics.win_rate.toFixed(1)}%` : "—", color: metrics.win_rate != null && metrics.win_rate > 50 ? "#4ade80" : "#f87171" },
    { label: "Tiempo en Mercado",  value: `${metrics.time_in_market.toFixed(1)}%`, color: "#94a3b8" },
  ];

  return (
    <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ ...S.cardTitle, paddingLeft: 0, marginBottom: 4 }}>
            {info.icon} {info.label.toUpperCase()} · {ticker}
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a" }}>{info.desc}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${excessColor}12`, border: `1.5px solid ${excessColor}40`, borderRadius: 10, padding: "8px 16px" }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: excessColor }}>
              {excess > 0 ? "↑ BATE" : excess < 0 ? "↓ PIERDE" : "= EMPATE"} B&H
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: excessColor }}>
              {fmtRet(excess)}
            </div>
          </div>
        </div>
      </div>

      {/* Equity curve */}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={btChartData} margin={{ top: 8, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
          <YAxis stroke="#3a3a4a" tick={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} domain={["auto","auto"]} tickFormatter={v => `${v.toFixed(0)}`} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={100} stroke="#3a3a4a" strokeDasharray="4 2" />
          <Legend wrapperStyle={{ fontFamily: "'Space Mono', monospace", fontSize: 11, paddingTop: 8 }} />
          <Line dataKey="strategy" name={`${info.label}`} stroke={color} strokeWidth={2} dot={false} connectNulls />
          <Line dataKey="bah"      name="Buy & Hold"        stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>

      {/* Metrics grid */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 16, marginBottom: 16 }}>
        {metricCells.map(({ label, value, color: c }) => (
          <div key={label} style={{ flex: "1 1 130px", background: "#0e0e16", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#5a5a6a", letterSpacing: "1px", marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: c }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Trade log */}
      {trades.length > 0 && (
        <div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", letterSpacing: "1.5px", marginBottom: 8 }}>HISTORIAL DE TRADES</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2a3a" }}>
                  {["Entrada", "Salida", "P. Entrada", "P. Salida", "Retorno", "Días", ""].map(h => (
                    <th key={h} style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#5a5a6a", padding: "6px 10px", textAlign: "right" as const, letterSpacing: "1px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.slice(-20).map((t, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1a1a2a" }}>
                    <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#8a8a9a", padding: "6px 10px", textAlign: "right" as const }}>{t.entry_date}</td>
                    <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: t.open ? "#f0c27f" : "#8a8a9a", padding: "6px 10px", textAlign: "right" as const }}>{t.open ? "Abierto" : t.exit_date}</td>
                    <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#e8e6e3", padding: "6px 10px", textAlign: "right" as const }}>${t.entry_price.toFixed(2)}</td>
                    <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#e8e6e3", padding: "6px 10px", textAlign: "right" as const }}>{t.open ? "—" : `$${t.exit_price.toFixed(2)}`}</td>
                    <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: t.win ? "#4ade80" : "#f87171", padding: "6px 10px", textAlign: "right" as const }}>
                      {t.return_pct > 0 ? "+" : ""}{t.return_pct.toFixed(2)}%
                    </td>
                    <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", padding: "6px 10px", textAlign: "right" as const }}>{t.duration_days}d</td>
                    <td style={{ padding: "6px 8px", textAlign: "center" as const }}>{t.win ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trades.length > 20 && (
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", textAlign: "center", paddingTop: 6 }}>
                Mostrando últimos 20 de {trades.length} trades
              </div>
            )}
          </div>
        </div>
      )}

      {trades.length === 0 && (
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a3a4a", textAlign: "center", padding: "16px 0" }}>
          Esta estrategia no generó trades en el período seleccionado
        </div>
      )}
    </div>
  );
}

/* ─── NewsPanel ─── */
function NewsPanel({ data }: { data: NewsData }) {
  const { sentiment, articles, ticker } = data;

  const SENT_META = {
    bullish: { emoji: "📈", label: "Bullish", color: "#4ade80", bg: "rgba(74,222,128,0.08)" },
    bearish: { emoji: "📉", label: "Bearish", color: "#f87171", bg: "rgba(248,113,113,0.08)" },
    neutral: { emoji: "➡️",  label: "Neutral", color: "#f0c27f", bg: "rgba(240,194,127,0.08)" },
  };

  const sentKey = sentiment ? (sentiment.sentiment.toLowerCase() as "bullish" | "bearish" | "neutral") : null;
  const meta = sentKey ? SENT_META[sentKey] ?? SENT_META.neutral : null;

  const fmtDate = (s: string | number) => {
    try {
      const d = typeof s === "number" ? new Date(s * 1000) : new Date(s);
      return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
    } catch { return String(s); }
  };

  // article_scores: -1 (bearish), 0 (neutral), 1 (bullish)
  const scoreColor = (v: number) => v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#f0c27f";
  const scoreLabel = (v: number) => v > 0 ? "▲ Bullish" : v < 0 ? "▼ Bearish" : "— Neutral";

  return (
    <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, paddingLeft: 0 }}>
          NOTICIAS & SENTIMIENTO IA · {ticker}
        </div>
        {meta && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: meta.bg, border: `1.5px solid ${meta.color}40`, borderRadius: 10, padding: "8px 16px" }}>
            <span style={{ fontSize: 18 }}>{meta.emoji}</span>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: meta.color }}>
                {meta.label.toUpperCase()}
              </div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#5a5a6a" }}>
                Score: {sentiment!.score > 0 ? "+" : ""}{sentiment!.score}/10
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      {sentiment && (
        <>
          <div style={{ background: "#0e0e16", borderRadius: 10, padding: "14px 16px", marginBottom: 14, borderLeft: `3px solid ${meta!.color}` }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", letterSpacing: "1px", marginBottom: 6 }}>ANÁLISIS IA (Claude)</div>
            <p style={{ fontSize: 13, color: "#c8c8d8", lineHeight: 1.7, margin: 0 }}>{sentiment.analysis}</p>
          </div>

          {sentiment.themes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 14 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", letterSpacing: "1px", alignSelf: "center" }}>TEMAS:</span>
              {sentiment.themes.map(theme => (
                <span key={theme} style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: meta!.color, background: meta!.bg, border: `1px solid ${meta!.color}30`, borderRadius: 5, padding: "3px 10px" }}>
                  {theme}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Articles */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {articles.map((art, i) => {
          const artScore = sentiment?.article_scores?.[i] ?? null;
          return (
            <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", background: "#0e0e16", borderRadius: 8, alignItems: "flex-start", borderLeft: artScore != null ? `3px solid ${scoreColor(artScore)}` : "3px solid #1e1e2e" }}>
              {art.thumbnail && (
                <img src={art.thumbnail} alt="" style={{ width: 60, height: 44, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={art.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#e8e6e3", textDecoration: "none", lineHeight: 1.4, display: "block", marginBottom: 4 }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = "#f0c27f"}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = "#e8e6e3"}>
                  {art.title}
                </a>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a" }}>{art.publisher}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a" }}>·</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a" }}>{fmtDate(art.published_at)}</span>
                  {artScore != null && (
                    <>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a" }}>·</span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: scoreColor(artScore), fontWeight: 700 }}>
                        {scoreLabel(artScore)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginTop: 12 }}>
        Fuente: Yahoo Finance News · Análisis de sentimiento: Claude Opus · Score: −10 (muy bajista) → +10 (muy alcista) · Caché 30 min
      </div>
    </div>
  );
}

/* ─── ModelCard ─── */
function ModelCard({ model, active }: { model: FcstModel; active: boolean }) {
  const m = MODEL_INFO[model];
  return (
    <div style={{
      flex: 1, minWidth: 200, background: active ? "#16161f" : "#0e0e16",
      border: `1.5px solid ${active ? "#f0c27f" : "#1e1e2e"}`,
      borderRadius: 12, padding: "16px 18px", transition: "all 0.2s",
    }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: active ? "#f0c27f" : "#5a5a6a", marginBottom: 6, letterSpacing: "0.5px" }}>
        {m.title}
      </div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: active ? "#a0a0b0" : "#3a3a4a", background: "#0a0a0f", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
        {m.formula}
      </div>
      <div style={{ fontSize: 11, color: active ? "#8a8a9a" : "#3a3a4a", lineHeight: 1.6, marginBottom: 8 }}>
        {m.desc}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#4ade80", background: "#4ade8010", border: "1px solid #4ade8030", borderRadius: 4, padding: "2px 8px" }}>
          ✓ {m.pro}
        </span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#f87171", background: "#f8717110", border: "1px solid #f8717130", borderRadius: 4, padding: "2px 8px" }}>
          ✗ {m.con}
        </span>
      </div>
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  const defaults = getDefaultDates();

  /* Shared */
  const [companies,  setCompanies]  = useState<Record<string, CompanyInfo>>({});
  const [startDate,  setStartDate]  = useState(defaults.start);
  const [endDate,    setEndDate]    = useState(defaults.end);
  const [error,      setError]      = useState<string | null>(null);
  const [appMode,    setAppMode]    = useState<AppMode>("comparison");

  /* Comparison */
  const [selected,       setSelected]       = useState<Set<string>>(new Set());
  const [data,           setData]           = useState<ApiResponse | null>(null);
  const [forecastData,   setForecastData]   = useState<ForecastResponse | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [viewMode,       setViewMode]       = useState<ViewMode>("base100");
  const [showForecast,   setShowForecast]   = useState(false);
  const [forecastModel,  setForecastModel]  = useState<FcstModel>("gbm");
  const [bandPct,        setBandPct]        = useState(80);

  /* Technical */
  const [techTicker,     setTechTicker]     = useState("AAPL");
  const [techData,       setTechData]       = useState<TechnicalData | null>(null);
  const [techLoading,    setTechLoading]    = useState(false);
  const [showMA,         setShowMA]         = useState<Record<number, boolean>>({ 20: true, 50: true, 200: false });
  const [showBB,         setShowBB]         = useState(true);
  const [hoveredEarning,   setHoveredEarning]   = useState<EarningsHover | null>(null);
  const [newsData,         setNewsData]         = useState<NewsData | null>(null);
  const [newsLoading,      setNewsLoading]      = useState(false);
  const [backtestData,     setBacktestData]     = useState<BacktestData | null>(null);
  const [backtestLoading,  setBacktestLoading]  = useState(false);
  const [backtestStrategy, setBacktestStrategy] = useState<"rsi"|"macd"|"sma_cross"|"bb">("rsi");

  /* Analytics */
  const [analyticsData,       setAnalyticsData]       = useState<AnalyticsData | null>(null);
  const [analyticsLoading,    setAnalyticsLoading]    = useState(false);
  const [fundamentalsData,    setFundamentalsData]    = useState<Record<string, FundamentalsData> | null>(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);

  /* Portfolio */
  const [portfolioWeights,    setPortfolioWeights]    = useState<Record<string, number>>({});
  const [portfolioData,       setPortfolioData]       = useState<PortfolioData | null>(null);
  const [portfolioLoading,    setPortfolioLoading]    = useState(false);
  const [showPortfolioStocks, setShowPortfolioStocks] = useState(false);
  const [showTangent,         setShowTangent]         = useState(true);

  /* Sectors */
  const [sectorData,    setSectorData]    = useState<SectorData | null>(null);
  const [sectorLoading, setSectorLoading] = useState(false);

  /* Macro */
  const [macroData, setMacroData] = useState<MacroData | null>(null);

  /* Monthly Returns */
  const [monthlyData,    setMonthlyData]    = useState<MonthlyReturnsData | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyTicker,  setMonthlyTicker]  = useState("AAPL");

  /* AI Summary */
  const [aiSummary,        setAiSummary]        = useState<AiSummaryData | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError,   setAiSummaryError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/companies")
      .then(r => r.json())
      .then(d => { setCompanies(d); setSelected(new Set(Object.keys(d))); })
      .catch(() => setError("Could not load company list. Is the backend running?"));
  }, []);

  useEffect(() => {
    Object.assign(document.body.style, { margin: "0", padding: "0", background: "#0a0a0f", color: "#e8e6e3" });
  }, []);

  // Macro: fetch once on mount, then every 60s
  useEffect(() => {
    const load = () => fetch("/api/macro").then(r => r.json()).then(setMacroData).catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchMonthlyReturns = useCallback(async (ticker: string) => {
    setMonthlyLoading(true);
    setMonthlyData(null);
    try {
      const r = await fetch(`/api/monthly_returns?ticker=${ticker}&years=5`);
      if (!r.ok) throw new Error();
      setMonthlyData(await r.json());
    } catch { /* silent */ } finally { setMonthlyLoading(false); }
  }, []);

  const fetchAiSummary = useCallback(async (ticker: string, start: string, end: string) => {
    setAiSummaryLoading(true);
    setAiSummaryError(null);
    setAiSummary(null);
    try {
      const p = new URLSearchParams({ ticker, start, end });
      const r = await fetch(`/api/ai_summary?${p}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail ?? "Error generando resumen");
      }
      setAiSummary(await r.json());
    } catch (e: any) {
      setAiSummaryError(e.message ?? "Error desconocido");
    } finally {
      setAiSummaryLoading(false);
    }
  }, []);

  /* Comparison */
  const toggleTicker = useCallback((t: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
  }, []);
  const selectAll  = useCallback(() => setSelected(new Set(Object.keys(companies))), [companies]);
  const selectNone = useCallback(() => setSelected(new Set()), []);

  const fetchData = useCallback(async () => {
    if (!selected.size) { setError("Select at least one company"); return; }
    setLoading(true); setError(null); setForecastData(null);
    try {
      const p  = new URLSearchParams({ tickers: Array.from(selected).join(","), start: startDate, end: endDate });
      const fp = new URLSearchParams({ tickers: Array.from(selected).join(","), start: startDate, end: endDate, band_pct: String(bandPct) });
      const [pR, fR] = await Promise.all([fetch(`/api/prices?${p}`), fetch(`/api/forecast?${fp}`)]);
      if (!pR.ok) { const b = await pR.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${pR.status}`); }
      setData(await pR.json());
      if (fR.ok) setForecastData(await fR.json());
    } catch (e: any) { setError(e.message || "Failed to fetch"); }
    finally { setLoading(false); }
  }, [selected, startDate, endDate, bandPct]);

  /* Technical */
  const fetchTechnical = useCallback(async () => {
    setTechLoading(true); setError(null); setTechData(null);
    try {
      const p = new URLSearchParams({ ticker: techTicker, start: startDate, end: endDate });
      const r = await fetch(`/api/technical?${p}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`); }
      setTechData(await r.json());
    } catch (e: any) { setError(e.message || "Failed to fetch technical"); }
    finally { setTechLoading(false); }
  }, [techTicker, startDate, endDate]);

  const fetchBacktest = useCallback(async (ticker: string, strategy: string) => {
    setBacktestLoading(true); setBacktestData(null);
    try {
      const p = new URLSearchParams({ ticker, strategy, start: startDate, end: endDate });
      const r = await fetch(`/api/backtest?${p}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`); }
      setBacktestData(await r.json());
    } catch (e: any) { setError(e.message || "Failed to fetch backtest"); }
    finally { setBacktestLoading(false); }
  }, [startDate, endDate]);

  const fetchNews = useCallback(async (ticker: string) => {
    setNewsLoading(true); setNewsData(null);
    try {
      const r = await fetch(`/api/news?ticker=${ticker}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`); }
      setNewsData(await r.json());
    } catch (e: any) { setError(e.message || "Failed to fetch news"); }
    finally { setNewsLoading(false); }
  }, []);

  /* Analytics */
  const fetchAnalytics = useCallback(async () => {
    if (!selected.size) { setError("Select at least one company"); return; }
    setAnalyticsLoading(true); setError(null); setAnalyticsData(null);
    try {
      const p = new URLSearchParams({ tickers: Array.from(selected).join(","), start: startDate, end: endDate });
      const r = await fetch(`/api/analytics?${p}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`); }
      setAnalyticsData(await r.json());
    } catch (e: any) { setError(e.message || "Failed to fetch analytics"); }
    finally { setAnalyticsLoading(false); }
  }, [selected, startDate, endDate]);

  const fetchFundamentals = useCallback(async () => {
    if (!selected.size) return;
    setFundamentalsLoading(true); setFundamentalsData(null);
    try {
      const p = new URLSearchParams({ tickers: Array.from(selected).join(",") });
      const r = await fetch(`/api/fundamentals?${p}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`); }
      setFundamentalsData(await r.json());
    } catch (e: any) { setError(e.message || "Failed to fetch fundamentals"); }
    finally { setFundamentalsLoading(false); }
  }, [selected]);

  /* Portfolio weight init */
  useEffect(() => {
    if (appMode === "portfolio" && selected.size > 0) {
      setPortfolioWeights(prev => {
        const arr = Array.from(selected);
        const eq  = Math.round(10000 / arr.length) / 100;
        const next: Record<string, number> = {};
        arr.forEach(t => { next[t] = prev[t] ?? eq; });
        return next;
      });
    }
  }, [appMode, selected]);

  const fetchPortfolio = useCallback(async () => {
    if (!selected.size) { setError("Select at least one company"); return; }
    const tArr = Array.from(selected);
    const wArr = tArr.map(t => portfolioWeights[t] ?? 1);
    setPortfolioLoading(true); setError(null); setPortfolioData(null);
    try {
      const p = new URLSearchParams({ tickers: tArr.join(","), weights: wArr.join(","), start: startDate, end: endDate });
      const r = await fetch(`/api/portfolio?${p}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`); }
      setPortfolioData(await r.json());
    } catch (e: any) { setError(e.message || "Failed to fetch portfolio"); }
    finally { setPortfolioLoading(false); }
  }, [selected, portfolioWeights, startDate, endDate]);

  /* Sectors */
  const fetchSectors = useCallback(async () => {
    setSectorLoading(true); setError(null); setSectorData(null);
    try {
      const p = new URLSearchParams({ start: startDate, end: endDate });
      const r = await fetch(`/api/sectors?${p}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`); }
      setSectorData(await r.json());
    } catch (e: any) { setError(e.message || "Failed to fetch sectors"); }
    finally { setSectorLoading(false); }
  }, [startDate, endDate]);

  /* ── Chart data memos ── */

  const chartData = React.useMemo(() => {
    if (!data) return [];
    const hist = data.dates.map((date, i) => {
      const pt: Record<string, any> = { date };
      for (const [t, s] of Object.entries(data.series)) pt[t] = s[viewMode][i];
      return pt;
    });
    if (!forecastData || !showForecast || viewMode !== "base100") return hist;
    const last = { ...hist[hist.length - 1] };
    for (const [t, fs] of Object.entries(forecastData.series)) {
      last[`${t}_median`] = fs.last_historical;
      last[`${t}_p_lo`]   = fs.last_historical;
      last[`${t}_p_hi`]   = fs.last_historical;
    }
    hist[hist.length - 1] = last;
    const fcst = forecastData.forecast_dates.map((date, i) => {
      const pt: Record<string, any> = { date };
      for (const [t, fs] of Object.entries(forecastData.series)) {
        const b = fs[forecastModel];
        pt[`${t}_median`] = b.median[i];
        pt[`${t}_p_lo`]   = b.p_lo[i];
        pt[`${t}_p_hi`]   = b.p_hi[i];
      }
      return pt;
    });
    return [...hist, ...fcst];
  }, [data, forecastData, viewMode, showForecast, forecastModel]);

  // Map each earnings date to the nearest trading day in techData.dates
  const earningsSnapped = React.useMemo(() => {
    if (!techData?.earnings_dates?.length || !techData.dates.length) return [];
    const tradingDays = techData.dates;
    return techData.earnings_dates.map(ev => {
      // Find closest trading day (prefer same day, then next, then previous)
      if (tradingDays.includes(ev.date)) return { ...ev, snapped: ev.date };
      const target = new Date(ev.date).getTime();
      let best = tradingDays[0];
      let bestDiff = Math.abs(new Date(tradingDays[0]).getTime() - target);
      for (const d of tradingDays) {
        const diff = Math.abs(new Date(d).getTime() - target);
        if (diff < bestDiff) { bestDiff = diff; best = d; }
      }
      return { ...ev, snapped: best };
    });
  }, [techData]);

  const techChartData = React.useMemo(() => {
    if (!techData) return [];
    return techData.dates.map((date, i) => {
      const bL = techData.bb_lower[i], bU = techData.bb_upper[i];
      return {
        date, close: techData.close[i],
        sma20: techData.sma20[i], sma50: techData.sma50[i], sma200: techData.sma200[i],
        bb_upper: bU, bb_lower: bL,
        bb_lower_stack: bL,
        bb_fill: bL != null && bU != null ? Math.max(0, bU - bL) : null,
        rsi: techData.rsi[i],
        macd_line: techData.macd_line[i], macd_signal: techData.macd_signal[i], macd_hist: techData.macd_hist[i],
        volume: techData.volume[i],
      };
    });
  }, [techData]);

  const ddChartData = React.useMemo(() => {
    if (!analyticsData) return [];
    return analyticsData.dates.map((date, i) => {
      const pt: Record<string, any> = { date, SPY: analyticsData.benchmark.drawdown[i] };
      for (const [t, dd] of Object.entries(analyticsData.drawdown)) pt[t] = dd[i];
      return pt;
    });
  }, [analyticsData]);

  const rollingVolChartData = React.useMemo(() => {
    if (!analyticsData) return [];
    return analyticsData.dates.map((date, i) => {
      const pt: Record<string, any> = { date, SPY: analyticsData.rolling_vol["SPY"]?.[i] };
      for (const t of Object.keys(analyticsData.rolling_vol)) {
        if (t !== "SPY") pt[t] = analyticsData.rolling_vol[t]?.[i];
      }
      return pt;
    });
  }, [analyticsData]);

  const portfolioChartData = React.useMemo(() => {
    if (!portfolioData) return [];
    return portfolioData.dates.map((date, i) => {
      const pt: Record<string, any> = {
        date,
        PORTFOLIO: portfolioData.portfolio.base100[i],
        SPY: portfolioData.benchmark.base100[i],
      };
      if (showTangent && portfolioData.tangent?.base100) pt["TANGENT"] = portfolioData.tangent.base100[i];
      if (showPortfolioStocks) {
        for (const [t, s] of Object.entries(portfolioData.tickers)) pt[t] = s.base100[i];
      }
      return pt;
    });
  }, [portfolioData, showPortfolioStocks, showTangent]);

  const sectorChartData = React.useMemo(() => {
    if (!sectorData) return [];
    return sectorData.dates.map((date, i) => {
      const pt: Record<string, any> = { date };
      for (const [t, s] of Object.entries(sectorData.series)) pt[t] = s.base100[i];
      return pt;
    });
  }, [sectorData]);

  const tickers          = data         ? Object.keys(data.series)         : [];
  const analyticsTickers = analyticsData ? Object.keys(analyticsData.metrics) : [];
  const sectorTickers    = sectorData   ? Object.keys(sectorData.series)   : [];

  /* ── CSV export ── */
  function downloadCSV(filename: string, rows: Record<string, any>[], keys: string[]) {
    const csv = [keys.join(","), ...rows.map(r => keys.map(k => r[k] ?? "").join(","))].join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: filename,
    });
    a.click();
  }

  const hover = {
    onMouseOver: (e: any) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 8px 30px rgba(252,92,125,0.35)"; },
    onMouseOut:  (e: any) => { e.target.style.transform = ""; e.target.style.boxShadow = "0 4px 20px rgba(252,92,125,0.25)"; },
  };

  /* ── MacroPanel ─────────────────────────────────────────── */
  const MacroPanel = () => {
    if (!macroData || Object.keys(macroData).length === 0) return null;
    const ORDER = ["VIX", "DXY", "US10Y", "SPY"];
    return (
      <div style={{ display: "flex", gap: 10, padding: "10px 0 4px", flexWrap: "wrap" }}>
        {ORDER.filter(k => macroData[k]).map(key => {
          const m = macroData[key];
          const chg = m.chg_1d;
          const up = chg != null && chg >= 0;
          const chgColor = chg == null ? "#6b6b7b" : up ? "#4ade80" : "#f87171";
          return (
            <div key={key} style={{
              background: "#12121c", border: "1px solid #1e1e2e", borderRadius: 10,
              padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, flex: "1 1 0", minWidth: 130,
            }}>
              <div style={{ width: 3, height: 32, background: m.color, borderRadius: 2, flexShrink: 0 }} />
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: m.color }}>{key}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b" }}>{m.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: "#e8e6e3" }}>
                    {key === "US10Y" ? `${m.price.toFixed(2)}%` : key === "VIX" ? m.price.toFixed(2) : m.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {chg != null && (
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: chgColor, fontWeight: 600 }}>
                      {key === "US10Y"
                        ? `${up ? "▲" : "▼"} ${Math.abs(chg).toFixed(0)}bps`
                        : `${up ? "▲" : "▼"} ${Math.abs(chg).toFixed(2)}%`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── MonthlyHeatmap ─────────────────────────────────────── */
  const MonthlyHeatmap = () => {
    const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const cellColor = (v: number | undefined) => {
      if (v == null) return "transparent";
      const clamped = Math.max(-12, Math.min(12, v));
      if (clamped >= 0) {
        const t = clamped / 12;
        const g = Math.round(80 + t * 100), r = Math.round(30 - t * 20), b = Math.round(50 - t * 40);
        return `rgb(${r},${g},${b})`;
      } else {
        const t = Math.abs(clamped) / 12;
        const r = Math.round(80 + t * 130), g = Math.round(30 - t * 20), b = Math.round(50 - t * 40);
        return `rgb(${r},${g},${b})`;
      }
    };

    const tickers = Object.keys(companies);
    const years = monthlyData
      ? Object.keys(monthlyData.returns).map(Number).sort((a, b) => b - a)
      : [];

    return (
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={S.cardTitle}>RETORNOS MENSUALES</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {tickers.map(t => (
              <button key={t} onClick={() => { setMonthlyTicker(t); fetchMonthlyReturns(t); }}
                style={{ ...S.tBtn(monthlyTicker === t && !!monthlyData && monthlyData.ticker === t), fontSize: 11, padding: "4px 10px" }}>
                {t}
              </button>
            ))}
          </div>
          {!monthlyData && !monthlyLoading && (
            <button onClick={() => fetchMonthlyReturns(monthlyTicker)}
              style={{ ...S.btn, padding: "6px 16px", fontSize: 11 }}>
              Cargar
            </button>
          )}
        </div>

        {monthlyLoading && <div style={{ color: "#6b6b7b", fontFamily: "'Space Mono', monospace", fontSize: 12 }}>Cargando...</div>}

        {monthlyData && !monthlyLoading && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "'Space Mono', monospace", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ padding: "4px 10px", color: "#6b6b7b", textAlign: "left", fontWeight: 400 }}>Año</th>
                  {MONTHS.map(m => (
                    <th key={m} style={{ padding: "4px 6px", color: "#6b6b7b", textAlign: "center", fontWeight: 400, minWidth: 46 }}>{m}</th>
                  ))}
                  <th style={{ padding: "4px 10px", color: "#6b6b7b", textAlign: "right", fontWeight: 400 }}>Año</th>
                </tr>
              </thead>
              <tbody>
                {years.map(year => {
                  const row = monthlyData.returns[year] ?? {};
                  const annualRet = Object.values(row).reduce((acc, r) => (1 + acc) * (1 + r / 100) - 1, 0) * 100;
                  return (
                    <tr key={year}>
                      <td style={{ padding: "3px 10px", color: "#9b9bab", fontWeight: 700 }}>{year}</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const v = row[m];
                        return (
                          <td key={m} title={v != null ? `${v > 0 ? "+" : ""}${v.toFixed(2)}%` : "—"}
                            style={{
                              padding: "3px 2px", textAlign: "center", borderRadius: 4,
                              background: cellColor(v),
                              color: v != null ? (Math.abs(v) > 3 ? "#fff" : "#ccc") : "#2a2a3a",
                              fontSize: 10, minWidth: 46,
                            }}>
                            {v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}` : "·"}
                          </td>
                        );
                      })}
                      <td style={{
                        padding: "3px 10px", textAlign: "right", fontWeight: 700,
                        color: annualRet >= 0 ? "#4ade80" : "#f87171",
                      }}>
                        {annualRet > 0 ? "+" : ""}{annualRet.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
              <span style={{ fontSize: 10, color: "#6b6b7b", fontFamily: "'Space Mono', monospace" }}>≤ −12%</span>
              {[-12,-8,-4,-2,0,2,4,8,12].map(v => (
                <div key={v} style={{ width: 18, height: 12, borderRadius: 2, background: cellColor(v) }} />
              ))}
              <span style={{ fontSize: 10, color: "#6b6b7b", fontFamily: "'Space Mono', monospace" }}>≥ +12%</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={S.container}>
      <header style={S.header}>
        <h1 style={S.title}>MAG 7 TRACKER</h1>
        <p style={S.subtitle}>Magnificent Seven · Performance Analysis</p>
      </header>

      {/* Earnings hover tooltip — rendered at root so it escapes SVG */}
      <EarningsTooltip hover={hoveredEarning} />

      {/* Macro context strip */}
      <MacroPanel />

      {/* Mode tabs */}
      <div style={S.modeSwitcher}>
        {(["comparison","technical","analytics","portfolio","sectors"] as AppMode[]).map(m => (
          <button key={m} style={S.modeTab(appMode === m)} onClick={() => setAppMode(m)}>
            {m === "comparison" ? "Comparison" : m === "technical" ? "Technical" : m === "analytics" ? "Analytics" : m === "portfolio" ? "Portfolio" : "Sectors"}
          </button>
        ))}
      </div>

      {/* ── COMPARISON ── */}
      {appMode === "comparison" && (
        <>
          <div style={S.row}>
            <div style={S.fg}><label style={S.lbl}>Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S.input} /></div>
            <div style={S.fg}><label style={S.lbl}>End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={S.input} /></div>
            <div style={S.fg}>
              <label style={S.lbl}>View Mode</label>
              <div style={S.toggle}>
                <button style={S.tBtn(viewMode === "base100")}      onClick={() => setViewMode("base100")}>Base 100</button>
                <button style={S.tBtn(viewMode === "vol_adjusted")} onClick={() => setViewMode("vol_adjusted")}>Vol-Adj</button>
              </div>
            </div>
            {viewMode === "base100" && (<div style={S.fg}>
              <label style={S.lbl}>30D Forecast</label>
              <div style={S.toggle}>
                <button style={{ ...S.tBtn(showForecast), opacity: forecastData ? 1 : 0.35, cursor: forecastData ? "pointer" : "not-allowed" }}
                  onClick={() => forecastData && setShowForecast(v => !v)}>
                  {showForecast ? "Visible" : "Hidden"}
                </button>
              </div>
            </div>)}
            {viewMode === "base100" && showForecast && forecastData && (
              <>
                <div style={S.fg}>
                  <label style={S.lbl}>Model</label>
                  <div style={S.toggle}>
                    {(["gbm","garch","merton"] as FcstModel[]).map(m => (
                      <button key={m} style={S.tBtn(forecastModel === m)} onClick={() => setForecastModel(m)}>{m.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                <div style={S.fg}>
                  <label style={S.lbl}>Banda CI</label>
                  <div style={S.toggle}>
                    {BAND_OPTIONS.map(b => (
                      <button key={b} style={S.tBtn(bandPct === b)} onClick={() => setBandPct(b)}>{b}%</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <button style={S.btn} onClick={fetchData} disabled={loading} {...hover}>{loading ? "Loading…" : "Fetch Prices"}</button>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <span style={S.lbl}>Select Companies</span>
            <span style={{ ...S.lbl, cursor: "pointer", color: "#f0c27f" }} onClick={selectAll}>All</span>
            <span style={{ ...S.lbl, cursor: "pointer", color: "#fc5c7d" }} onClick={selectNone}>None</span>
          </div>
          <div style={S.chips}>
            {Object.entries(companies).map(([t, info]) => (
              <TickerChip key={t} ticker={t} info={info} selected={selected.has(t)} onToggle={() => toggleTicker(t)} />
            ))}
          </div>

          {error && <div style={S.err}>{error}</div>}

          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingLeft: 20 }}>
              <div style={{ ...S.cardTitle, marginBottom: 0, paddingLeft: 0 }}>
                {viewMode === "base100" ? "PERFORMANCE · BASE 100 INDEX" : "PERFORMANCE · VOLATILITY-ADJUSTED"}
                {showForecast && forecastData && viewMode === "base100" && (
                  <span style={{ color: "#f0c27f", marginLeft: 12 }}>+ 30D {forecastModel.toUpperCase()} · CI {bandPct}%</span>
                )}
              </div>
              {data && (
                <button style={{ ...S.tBtn(false), padding: "6px 14px", fontSize: 10 }}
                  onClick={() => downloadCSV(`mag7_${viewMode}_${startDate}_${endDate}.csv`, chartData, ["date", ...tickers])}>
                  ↓ CSV
                </button>
              )}
            </div>
            {loading ? <div style={S.spinner}>⏳ Fetching from Yahoo Finance…</div>
            : !data    ? <div style={S.empty}><div style={{ fontSize: 48, opacity: 0.4 }}>📈</div><div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13 }}>Select companies and fetch</div></div>
            : (
              <ResponsiveContainer width="100%" height={460}>
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                  <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
                  <YAxis stroke="#3a3a4a" tick={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} domain={["auto","auto"]} />
                  <Tooltip content={<CustomTooltip />} />
                  {viewMode === "base100" && <ReferenceLine y={100} stroke="#3a3a4a" strokeDasharray="6 3" />}
                  {showForecast && forecastData && viewMode === "base100" && (
                    <ReferenceLine x={data.dates[data.dates.length-1]} stroke="#5a5a6a" strokeDasharray="4 2"
                      label={{ value: "TODAY", position: "insideTopRight", fill: "#5a5a6a", fontSize: 9, fontFamily: "'Space Mono', monospace" }} />
                  )}
                  <Legend wrapperStyle={{ fontFamily: "'Space Mono', monospace", fontSize: 11, paddingTop: 12 }} />
                  {tickers.map(t => <Line key={t} type="monotone" dataKey={t} name={`${t} · ${data.series[t].name}`} stroke={data.series[t].color} strokeWidth={2} dot={false} connectNulls animationDuration={800} />)}
                  {showForecast && forecastData && viewMode === "base100" && tickers.map(t => (
                    <React.Fragment key={`fc-${t}`}>
                      <Line dataKey={`${t}_median`} stroke={data.series[t].color} strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls legendType="none" animationDuration={0} />
                      <Line dataKey={`${t}_p_lo`}   stroke={data.series[t].color} strokeWidth={1} strokeDasharray="2 4" strokeOpacity={0.3} dot={false} connectNulls legendType="none" animationDuration={0} />
                      <Line dataKey={`${t}_p_hi`}   stroke={data.series[t].color} strokeWidth={1} strokeDasharray="2 4" strokeOpacity={0.3} dot={false} connectNulls legendType="none" animationDuration={0} />
                    </React.Fragment>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Model descriptions */}
          {data && showForecast && forecastData && viewMode === "base100" && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {(["gbm","garch","merton"] as FcstModel[]).map(m => (
                <ModelCard key={m} model={m} active={forecastModel === m} />
              ))}
            </div>
          )}

          {data && viewMode === "vol_adjusted" && (
            <div style={S.info}>
              <strong style={{ color: "#f0c27f" }}>Vol-Adjusted:</strong> Retorno base-100 dividido por volatilidad anualizada expandida (σ√252) · normalización tipo Sharpe.
            </div>
          )}
        </>
      )}

      {/* ── TECHNICAL ── */}
      {appMode === "technical" && (
        <>
          <div style={S.row}>
            <div style={S.fg}>
              <label style={S.lbl}>Stock</label>
              <select value={techTicker} onChange={e => setTechTicker(e.target.value)} style={{ ...S.input, cursor: "pointer" }}>
                {Object.entries(companies).map(([t, info]) => <option key={t} value={t}>{TICKER_ICONS[t]} {t} — {info.name}</option>)}
              </select>
            </div>
            <div style={S.fg}><label style={S.lbl}>Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S.input} /></div>
            <div style={S.fg}><label style={S.lbl}>End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={S.input} /></div>
            <button style={S.btn} onClick={fetchTechnical} disabled={techLoading} {...hover}>{techLoading ? "Loading…" : "Analyze"}</button>
          </div>

          {techData && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
              <span style={S.lbl}>Indicators</span>
              {([20, 50, 200] as const).map(n => (
                <button key={n} style={S.iBtn(showMA[n], MA_COLORS[n])} onClick={() => setShowMA(p => ({ ...p, [n]: !p[n] }))}>SMA {n}</button>
              ))}
              <button style={S.iBtn(showBB, "#a78bfa")} onClick={() => setShowBB(v => !v)}>BB (20)</button>
            </div>
          )}

          {error && <div style={S.err}>{error}</div>}

          {techLoading ? <div style={S.spinner}>⏳ Calculando indicadores…</div>
          : !techData  ? <div style={S.empty}><div style={{ fontSize: 48, opacity: 0.4 }}>📊</div><div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13 }}>Selecciona un stock y haz Analyze</div></div>
          : (
            <>
              {/* Price + MA + BB */}
              <div style={S.card}>
                <div style={S.cardTitle}>
                  {techData.ticker} · PRECIO
                  {showBB && <span style={{ color: "#a78bfa", marginLeft: 10 }}>+ BB(20)</span>}
                  {([20, 50, 200] as const).filter(n => showMA[n]).map(n => <span key={n} style={{ color: MA_COLORS[n], marginLeft: 8 }}>SMA{n}</span>)}
                  {techData.earnings_dates?.length > 0 && <span style={{ color: "#f0c27f", marginLeft: 8 }}>· E={techData.earnings_dates.length} earnings</span>}
                </div>
                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart data={techChartData} syncId="tech" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
                    <YAxis stroke="#3a3a4a" tick={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} domain={["auto","auto"]} />
                    <Tooltip content={<TechnicalTooltip />} />
                    {showBB && <>
                      <Area dataKey="bb_lower_stack" stackId="bb" stroke="none" fill="none" legendType="none" dot={false} />
                      <Area dataKey="bb_fill" stackId="bb" stroke="none" fill="#a78bfa" fillOpacity={0.08} legendType="none" dot={false} />
                    </>}
                    {([20, 50, 200] as const).map(n => showMA[n] && <Line key={n} dataKey={`sma${n}`} stroke={MA_COLORS[n]} strokeWidth={1.5} dot={false} connectNulls={false} legendType="none" name={`SMA ${n}`} />)}
                    <Line dataKey="close" stroke={techData.color} strokeWidth={2} dot={false} connectNulls name="Close" />
                    {earningsSnapped.map(ev => (
                      <ReferenceLine key={ev.date} x={ev.snapped} stroke="#f0c27f" strokeDasharray="4 3" strokeOpacity={0.5}
                        label={<EarningsLabel earningEvent={ev} onEnter={setHoveredEarning} onLeave={() => setHoveredEarning(null)} />} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Volume */}
              <div style={S.card}>
                <div style={S.cardTitle}>VOLUMEN DIARIO</div>
                <ResponsiveContainer width="100%" height={120}>
                  <ComposedChart data={techChartData} syncId="tech" margin={{ top: 4, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
                    <YAxis stroke="#3a3a4a" tick={{ fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }}
                      tickFormatter={v => v >= 1e9 ? `${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v.toLocaleString()} width={48} />
                    <Tooltip content={<TechnicalTooltip />} />
                    <Bar dataKey="volume" maxBarSize={4} name="Volume">
                      {techChartData.map((_, i) => <Cell key={i} fill={techData.color} fillOpacity={0.55} />)}
                    </Bar>
                    {earningsSnapped.map(ev => (
                      <ReferenceLine key={ev.date} x={ev.snapped} stroke="#f0c27f" strokeDasharray="4 3" strokeOpacity={0.5}
                        label={<EarningsLabel earningEvent={ev} onEnter={setHoveredEarning} onLeave={() => setHoveredEarning(null)} />} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* RSI */}
              <div style={S.card}>
                <div style={S.cardTitle}>RSI · 14 períodos</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={techChartData} syncId="tech" margin={{ top: 8, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
                    <YAxis stroke="#3a3a4a" tick={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} domain={[0,100]} ticks={[0,30,50,70,100]} />
                    <Tooltip content={<TechnicalTooltip />} />
                    <ReferenceLine y={70} stroke="#fc5c7d" strokeDasharray="4 2" strokeOpacity={0.6} label={{ value: "OB 70", position: "insideTopRight", fill: "#fc5c7d", fontSize: 9, fontFamily: "'Space Mono', monospace" }} />
                    <ReferenceLine y={30} stroke="#4ade80" strokeDasharray="4 2" strokeOpacity={0.6} label={{ value: "OS 30", position: "insideBottomRight", fill: "#4ade80", fontSize: 9, fontFamily: "'Space Mono', monospace" }} />
                    <ReferenceLine y={50} stroke="#3a3a4a" strokeDasharray="2 4" />
                    <Line dataKey="rsi" stroke={techData.color} strokeWidth={1.5} dot={false} connectNulls name="RSI" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* MACD */}
              <div style={S.card}>
                <div style={S.cardTitle}>MACD · 12 / 26 / 9</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={techChartData} syncId="tech" margin={{ top: 8, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
                    <YAxis stroke="#3a3a4a" tick={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} domain={["auto","auto"]} />
                    <Tooltip content={<TechnicalTooltip />} />
                    <ReferenceLine y={0} stroke="#3a3a4a" />
                    <Bar dataKey="macd_hist" maxBarSize={6} name="Hist">
                      {techChartData.map((e, i) => <Cell key={i} fill={(e.macd_hist ?? 0) >= 0 ? "#4ade80" : "#f87171"} fillOpacity={0.7} />)}
                    </Bar>
                    <Line dataKey="macd_line"   stroke={techData.color} strokeWidth={1.5} dot={false} connectNulls name="MACD" />
                    <Line dataKey="macd_signal" stroke="#e8e6e3" strokeWidth={1.5} dot={false} connectNulls name="Signal" strokeOpacity={0.7} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div style={S.info}>
                <strong style={{ color: "#f0c27f" }}>Indicadores:</strong>{" "}
                SMA = media móvil · BB = Bollinger Bands (20,±2σ) · RSI(14) = momentum (OB &gt;70, OS &lt;30) · MACD(12,26,9) = cruce de EMAs · Volumen = acciones operadas.
                {techData.earnings_dates?.length > 0 && <span style={{ color: "#f0c27f" }}> · <strong>E</strong> = earnings trimestrales ({techData.earnings_dates.length} en el período)</span>}
              </div>

              {/* Signals — automatic */}
              {techData.signals?.length > 0 && (
                <SignalsPanel signals={techData.signals} ticker={techData.ticker} />
              )}

              {/* AI Summary */}
              <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: aiSummary?.ticker === techData.ticker ? 16 : 0 }}>
                  <div>
                    <div style={{ ...S.cardTitle, paddingLeft: 0, marginBottom: 2 }}>📋 RESUMEN CUANTITATIVO · {techData.ticker}</div>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a" }}>
                      Análisis automático: precio + señales técnicas + fundamentales
                    </div>
                  </div>
                  <button
                    style={{ ...S.tBtn(false), padding: "8px 18px", fontSize: 10 }}
                    onClick={() => fetchAiSummary(techData.ticker, startDate, endDate)}
                    disabled={aiSummaryLoading}
                  >
                    {aiSummaryLoading ? "Calculando…" : aiSummary?.ticker === techData.ticker ? "↻ Regenerar" : "📋 Generar Resumen"}
                  </button>
                </div>
                {aiSummaryLoading && (
                  <div style={{ ...S.spinner, height: 80 }}>⏳ Calculando resumen…</div>
                )}
                {aiSummaryError && !aiSummaryLoading && (
                  <div style={S.err}>{aiSummaryError}</div>
                )}
                {!aiSummaryLoading && aiSummary?.ticker === techData.ticker && (
                  <div style={{ background: "linear-gradient(135deg, rgba(240,194,127,0.06) 0%, rgba(252,92,125,0.06) 100%)", border: "1px solid rgba(240,194,127,0.2)", borderRadius: 12, padding: "18px 20px" }}>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#d8d6d3", lineHeight: 1.75, margin: 0 }}>
                      {aiSummary.summary}
                    </p>
                    <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" as const }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b" }}>
                        Precio: <strong style={{ color: "#e8e6e3" }}>${aiSummary.price.toFixed(2)}</strong>
                      </span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b" }}>
                        Período: <strong style={{ color: aiSummary.period_return >= 0 ? "#4ade80" : "#f87171" }}>
                          {aiSummary.period_return > 0 ? "+" : ""}{aiSummary.period_return.toFixed(1)}%
                        </strong>
                      </span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginLeft: "auto" }}>
                        {new Date(aiSummary.generated_at).toLocaleString("es", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#2a2a3a", marginTop: 8 }}>
                      Generado automáticamente a partir de indicadores cuantitativos · No constituye recomendación de inversión
                    </div>
                  </div>
                )}
                {!aiSummaryLoading && !aiSummaryError && !aiSummary && (
                  <div style={{ textAlign: "center", padding: "20px 0", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a3a4a" }}>
                    Presiona el botón para generar un análisis IA del ticker seleccionado
                  </div>
                )}
              </div>

              {/* Backtesting */}
              <div style={{ ...S.card, padding: "20px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 12, marginBottom: backtestData ? 16 : 0 }}>
                  <div style={{ ...S.cardTitle, marginBottom: 0 }}>BACKTESTING · ESTRATEGIAS</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
                    <div style={S.toggle}>
                      {(["rsi","macd","sma_cross","bb"] as const).map(s => (
                        <button key={s} style={S.tBtn(backtestStrategy === s)} onClick={() => setBacktestStrategy(s)}>
                          {s === "sma_cross" ? "SMA CROSS" : s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button style={{ ...S.tBtn(false), padding: "8px 18px", fontSize: 10 }}
                      onClick={() => fetchBacktest(techTicker, backtestStrategy)} disabled={backtestLoading}>
                      {backtestLoading ? "Calculando…" : "▶ Run Backtest"}
                    </button>
                  </div>
                </div>
                {!backtestData && !backtestLoading && (
                  <div style={{ textAlign: "center", padding: "28px 0", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a3a4a" }}>
                    Selecciona una estrategia y ejecuta el backtest sobre el período analizado
                  </div>
                )}
                {backtestLoading && <div style={{ ...S.spinner, height: 120 }}>⏳ Ejecutando backtest…</div>}
              </div>
              {backtestData && !backtestLoading && (
                <BacktestPanel data={backtestData} ticker={techData.ticker} color={techData.color} />
              )}

              {/* News & Sentiment */}
              <div style={{ ...S.card, padding: "20px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ ...S.cardTitle, marginBottom: 0 }}>NOTICIAS & SENTIMIENTO IA</div>
                  <button style={{ ...S.tBtn(false), padding: "8px 18px", fontSize: 10 }}
                    onClick={() => fetchNews(techTicker)} disabled={newsLoading}>
                    {newsLoading ? "Analizando…" : newsData?.ticker === techTicker ? "↻ Refresh" : "🤖 Analizar Noticias"}
                  </button>
                </div>
                {newsLoading ? (
                  <div style={{ ...S.spinner, height: 120 }}>⏳ Buscando noticias y analizando con IA…</div>
                ) : newsData && newsData.ticker === techTicker ? (
                  <NewsPanel data={newsData} />
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 0", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a3a4a" }}>
                    Presiona "Analizar Noticias" para ver las últimas noticias y sentimiento de inversión con IA
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── ANALYTICS ── */}
      {appMode === "analytics" && (
        <>
          <div style={S.row}>
            <div style={S.fg}><label style={S.lbl}>Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S.input} /></div>
            <div style={S.fg}><label style={S.lbl}>End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={S.input} /></div>
            <button style={S.btn} onClick={fetchAnalytics} disabled={analyticsLoading} {...hover}>{analyticsLoading ? "Loading…" : "Run Analytics"}</button>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <span style={S.lbl}>Select Companies</span>
            <span style={{ ...S.lbl, cursor: "pointer", color: "#f0c27f" }} onClick={selectAll}>All</span>
            <span style={{ ...S.lbl, cursor: "pointer", color: "#fc5c7d" }} onClick={selectNone}>None</span>
          </div>
          <div style={S.chips}>
            {Object.entries(companies).map(([t, info]) => (
              <TickerChip key={t} ticker={t} info={info} selected={selected.has(t)} onToggle={() => toggleTicker(t)} />
            ))}
          </div>

          {error && <div style={S.err}>{error}</div>}

          {analyticsLoading ? <div style={S.spinner}>⏳ Calculando métricas…</div>
          : !analyticsData  ? <div style={S.empty}><div style={{ fontSize: 48, opacity: 0.4 }}>🔬</div><div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13 }}>Selecciona stocks y ejecuta Run Analytics</div></div>
          : (
            <>
              {/* ── 1. Analyst Price Targets (consenso de mercado) ── */}
              <div style={{ ...S.card, padding: "24px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ ...S.cardTitle, marginBottom: 0 }}>PRECIO OBJETIVO DE ANALISTAS · CONSENSO</div>
                  <button style={{ ...S.tBtn(false), padding: "8px 18px", fontSize: 10 }}
                    onClick={fetchFundamentals} disabled={fundamentalsLoading}>
                    {fundamentalsLoading ? "Loading…" : fundamentalsData ? "↻ Refresh" : "Load Fundamentals"}
                  </button>
                </div>
                {fundamentalsLoading ? (
                  <div style={{ ...S.spinner, height: 120 }}>⏳ Cargando datos de analistas…</div>
                ) : fundamentalsData ? (
                  <AnalystTargets data={fundamentalsData} tickers={analyticsTickers} companies={companies} />
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 0", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a3a4a" }}>
                    Presiona "Load Fundamentals" para ver el precio objetivo de analistas
                  </div>
                )}
              </div>

              {/* ── 2. DCF Interactivo ── */}
              <div style={{ ...S.card, padding: "24px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ ...S.cardTitle, marginBottom: 0 }}>DCF INTERACTIVO · VALORACIÓN POR DESCUENTO DE FLUJOS</div>
                  <button style={{ ...S.tBtn(false), padding: "8px 18px", fontSize: 10 }}
                    onClick={fetchFundamentals} disabled={fundamentalsLoading}>
                    {fundamentalsLoading ? "Loading…" : fundamentalsData ? "↻ Refresh" : "Load Fundamentals"}
                  </button>
                </div>
                {fundamentalsLoading ? (
                  <div style={{ ...S.spinner, height: 120 }}>⏳ Cargando datos fundamentales…</div>
                ) : fundamentalsData ? (
                  <DCFModel data={fundamentalsData} tickers={analyticsTickers} companies={companies} />
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 0", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a3a4a" }}>
                    Presiona "Load Fundamentals" para modelar el DCF de cada empresa
                  </div>
                )}
              </div>

              {/* ── 3. Investment Score (cuantitativo propio) ── */}
              <InvestmentScoreCard analytics={analyticsData} tickers={analyticsTickers} companies={companies} fundamentals={fundamentalsData} />

              {/* ── 3. Automated Insights ── */}
              <InsightPanel analytics={analyticsData} tickers={analyticsTickers} companies={companies} />

              {/* ── 4. Metrics Table ── */}
              <div style={{ ...S.card, padding: "24px 24px" }}>
                <div style={S.cardTitle}>MÉTRICAS DEL PERÍODO · vs S&P 500 (SPY)</div>
                <MetricsTable
                  metrics={analyticsData.metrics}
                  beta={analyticsData.beta}
                  extended={analyticsData.extended_metrics}
                  tickers={analyticsTickers}
                  companies={companies}
                  benchmark={analyticsData.benchmark}
                />
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", marginTop: 16 }}>
                  Sharpe: rf=4.5% · Vol y retorno anualizados (252 días/año) · Beta vs SPY (β&gt;1 = más volátil que el mercado)
                </div>
              </div>

              {/* ── 5. Drawdown ── */}
              <div style={S.card}>
                <div style={S.cardTitle}>DRAWDOWN DESDE MÁXIMO · vs SPY</div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={ddChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
                    <YAxis stroke="#3a3a4a" tick={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#3a3a4a" />
                    <Legend wrapperStyle={{ fontFamily: "'Space Mono', monospace", fontSize: 11, paddingTop: 12 }} />
                    {analyticsTickers.map(t => (
                      <Line key={t} type="monotone" dataKey={t} name={`${t} · ${companies[t]?.name}`}
                        stroke={companies[t]?.color} strokeWidth={1.5} dot={false} connectNulls animationDuration={600} />
                    ))}
                    <Line dataKey="SPY" name="S&P 500 (SPY)" stroke="#94a3b8" strokeWidth={1.5}
                      strokeDasharray="5 3" dot={false} connectNulls animationDuration={600} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* ── 6. Rolling Volatility ── */}
              <div style={S.card}>
                <div style={S.cardTitle}>VOLATILIDAD RODANTE · 21 DÍAS ANUALIZADA</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={rollingVolChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
                    <YAxis stroke="#3a3a4a" tick={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: "'Space Mono', monospace", fontSize: 11, paddingTop: 12 }} />
                    {analyticsTickers.map(t => (
                      <Line key={t} type="monotone" dataKey={t} name={`${t} · ${companies[t]?.name}`}
                        stroke={companies[t]?.color} strokeWidth={1.5} dot={false} connectNulls animationDuration={600} />
                    ))}
                    <Line dataKey="SPY" name="S&P 500 (SPY)" stroke="#94a3b8" strokeWidth={1.5}
                      strokeDasharray="5 3" dot={false} connectNulls animationDuration={600} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* ── 7. Correlation ── */}
              {analyticsTickers.length > 1 && (
                <div style={{ ...S.card, padding: "24px 24px" }}>
                  <div style={S.cardTitle}>CORRELACIÓN DE RETORNOS DIARIOS</div>
                  <CorrelationHeatmap correlation={analyticsData.correlation} tickers={analyticsTickers} companies={companies} />
                </div>
              )}

              {/* ── 8. Fundamentals raw data ── */}
              <div style={{ ...S.card, padding: "24px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ ...S.cardTitle, marginBottom: 0 }}>FUNDAMENTALES · VALUACIÓN Y CRECIMIENTO</div>
                  <button style={{ ...S.tBtn(false), padding: "8px 18px", fontSize: 10 }}
                    onClick={fetchFundamentals} disabled={fundamentalsLoading}>
                    {fundamentalsLoading ? "Loading…" : fundamentalsData ? "↻ Refresh" : "Load Fundamentals"}
                  </button>
                </div>
                {fundamentalsLoading ? (
                  <div style={{ ...S.spinner, height: 120 }}>⏳ Cargando fundamentales…</div>
                ) : fundamentalsData ? (
                  <FundamentalsCard data={fundamentalsData} tickers={analyticsTickers} companies={companies} />
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 0", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a3a4a" }}>
                    Presiona "Load Fundamentals" para ver P/E, P/B, márgenes y más
                  </div>
                )}
              </div>

              {/* ── 9. Valuation Radar ── */}
              {fundamentalsData && (
                <div style={{ ...S.card, padding: "24px 24px" }}>
                  <div style={{ ...S.cardTitle, marginBottom: 16 }}>RADAR DE VALUACIÓN · COMPARATIVA MULTIDIMENSIONAL</div>
                  <ValuationRadar data={fundamentalsData} tickers={analyticsTickers} companies={companies} />
                </div>
              )}

              <div style={S.info}>
                <strong style={{ color: "#f0c27f" }}>Drawdown</strong> = caída desde el máximo ·{" "}
                <strong style={{ color: "#f0c27f" }}>Vol rodante</strong> = σ anualizada en ventana 21d ·{" "}
                <strong style={{ color: "#f0c27f" }}>Beta</strong> = cov(rᵢ, rSPY) / var(rSPY) ·{" "}
                <strong style={{ color: "#f0c27f" }}>Alpha</strong> = Jensen's alpha vs CAPM (rf=4.5%) ·{" "}
                <strong style={{ color: "#f0c27f" }}>Calmar</strong> = retorno anual / |max drawdown| ·{" "}
                <strong style={{ color: "#f0c27f" }}>Sortino</strong> = retorno / volatilidad negativa.
              </div>
            </>
          )}

          {/* Monthly Returns Heatmap */}
          <MonthlyHeatmap />
        </>
      )}

      {/* ── PORTFOLIO ── */}
      {appMode === "portfolio" && (
        <>
          <div style={S.row}>
            <div style={S.fg}><label style={S.lbl}>Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S.input} /></div>
            <div style={S.fg}><label style={S.lbl}>End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={S.input} /></div>
            <button style={S.btn} onClick={fetchPortfolio} disabled={portfolioLoading} {...hover}>{portfolioLoading ? "Loading…" : "Run Portfolio"}</button>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <span style={S.lbl}>Select Stocks</span>
            <span style={{ ...S.lbl, cursor: "pointer", color: "#f0c27f" }} onClick={selectAll}>All</span>
            <span style={{ ...S.lbl, cursor: "pointer", color: "#fc5c7d" }} onClick={selectNone}>None</span>
          </div>
          <div style={S.chips}>
            {Object.entries(companies).map(([t, info]) => (
              <TickerChip key={t} ticker={t} info={info} selected={selected.has(t)} onToggle={() => toggleTicker(t)} />
            ))}
          </div>

          {/* Weight sliders */}
          {selected.size > 0 && (
            <div style={{ ...S.card, padding: "20px 24px", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ ...S.cardTitle, marginBottom: 0, paddingLeft: 0 }}>PORTFOLIO WEIGHTS</div>
                <button style={S.tBtn(false)} onClick={() => {
                  const arr = Array.from(selected);
                  const eq  = Math.round(10000 / arr.length) / 100;
                  setPortfolioWeights(Object.fromEntries(arr.map(t => [t, eq])));
                }}>Equal Weight</button>
              </div>
              {Array.from(selected).map(t => {
                const w = portfolioWeights[t] ?? 0;
                return (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                      <span style={{ fontSize: 16 }}>{TICKER_ICONS[t]}</span>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: companies[t]?.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: "#e8e6e3" }}>{t}</span>
                    </div>
                    <input type="range" min="0" max="100" step="1" value={w}
                      onChange={e => setPortfolioWeights(p => ({ ...p, [t]: Number(e.target.value) }))}
                      style={{ flex: 1, accentColor: companies[t]?.color, cursor: "pointer" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" min="0" max="100" step="1" value={w}
                        onChange={e => setPortfolioWeights(p => ({ ...p, [t]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                        style={{ ...S.input, width: 58, padding: "6px 8px", fontSize: 12, textAlign: "right" as const }} />
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b7b" }}>%</span>
                    </div>
                  </div>
                );
              })}
              {(() => {
                const total = Array.from(selected).reduce((s, t) => s + (portfolioWeights[t] ?? 0), 0);
                const ok = Math.abs(total - 100) < 0.5;
                return (
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 12, borderTop: "1px solid #1e1e2e" }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b" }}>TOTAL</span>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: ok ? "#4ade80" : "#f0c27f" }}>{total.toFixed(1)}%</span>
                    {!ok && <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a" }}>→ will normalize</span>}
                  </div>
                );
              })()}
            </div>
          )}

          {error && <div style={S.err}>{error}</div>}

          {portfolioLoading ? <div style={S.spinner}>⏳ Calculando portfolio y portafolio tangente…</div>
          : !portfolioData  ? <div style={S.empty}><div style={{ fontSize: 48, opacity: 0.4 }}>💼</div><div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13 }}>Configura los pesos y ejecuta Run Portfolio</div></div>
          : (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <button style={S.iBtn(showPortfolioStocks, "#f0c27f")} onClick={() => setShowPortfolioStocks(v => !v)}>
                  Individual Stocks
                </button>
                {portfolioData.tangent && (
                  <button style={S.iBtn(showTangent, "#4ade80")} onClick={() => setShowTangent(v => !v)}>
                    Tangente (Max Sharpe)
                  </button>
                )}
                <button style={{ ...S.tBtn(false), padding: "8px 16px", fontSize: 10 }}
                  onClick={() => {
                    const keys = ["date", "PORTFOLIO", ...(portfolioData.tangent ? ["TANGENT"] : []), "SPY", ...Object.keys(portfolioData.tickers)];
                    downloadCSV(`portfolio_${startDate}_${endDate}.csv`, portfolioChartData, keys);
                  }}>
                  ↓ CSV
                </button>
              </div>

              {/* Chart */}
              <div style={S.card}>
                <div style={S.cardTitle}>
                  PORTFOLIO vs TANGENTE vs S&P 500 · BASE 100
                  {showPortfolioStocks && <span style={{ color: "#6b6b7b", marginLeft: 8 }}>+ INDIVIDUAL</span>}
                </div>
                <ResponsiveContainer width="100%" height={420}>
                  <LineChart data={portfolioChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
                    <YAxis stroke="#3a3a4a" tick={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} domain={["auto","auto"]} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={100} stroke="#3a3a4a" strokeDasharray="6 3" />
                    <Legend wrapperStyle={{ fontFamily: "'Space Mono', monospace", fontSize: 11, paddingTop: 12 }} />
                    {showPortfolioStocks && Object.entries(portfolioData.tickers).map(([t, s]) => (
                      <Line key={t} type="monotone" dataKey={t}
                        name={`${t} · ${s.name} (${s.weight.toFixed(1)}%)`}
                        stroke={s.color} strokeWidth={1} strokeOpacity={0.45} dot={false} connectNulls animationDuration={400} />
                    ))}
                    <Line dataKey="SPY"       name="S&P 500 (SPY)"      stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls animationDuration={600} />
                    {showTangent && portfolioData.tangent && (
                      <Line dataKey="TANGENT" name="Tangente (Max Sharpe)" stroke="#4ade80" strokeWidth={2.5} strokeDasharray="8 3" dot={false} connectNulls animationDuration={600} />
                    )}
                    <Line dataKey="PORTFOLIO" name="Tu Portfolio"        stroke="#f0c27f" strokeWidth={3} dot={false} connectNulls animationDuration={600} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Metrics */}
              <div style={{ ...S.card, padding: "24px 24px" }}>
                <div style={S.cardTitle}>MÉTRICAS COMPARADAS</div>
                {[
                  { key: "Tu Portfolio",         color: "#f0c27f", m: portfolioData.portfolio.metrics, dashed: false },
                  ...(portfolioData.tangent ? [{ key: "Tangente (Max Sharpe)", color: "#4ade80", m: portfolioData.tangent.metrics, dashed: false }] : []),
                  { key: "S&P 500 (SPY)",        color: "#94a3b8", m: portfolioData.benchmark.metrics, dashed: true  },
                ].map(({ key, color, m, dashed }) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid #1e1e2e" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 200 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                        ...(dashed ? { border: `2px dashed ${color}`, background: "transparent" } : { background: color }) }} />
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: "#e8e6e3" }}>{key}</span>
                    </div>
                    {[
                      { label: "Retorno",  val: m.total_return != null ? `${m.total_return > 0 ? "+" : ""}${m.total_return.toFixed(2)}%` : "—", c: metricColor(m.total_return, "high") },
                      { label: "Ann. Vol", val: m.ann_vol     != null ? `${m.ann_vol.toFixed(2)}%` : "—", c: "#e8e6e3" },
                      { label: "Sharpe",   val: m.sharpe      != null ? m.sharpe.toFixed(2) : "—",
                        c: m.sharpe == null ? "#6b6b7b" : m.sharpe >= 1.5 ? "#4ade80" : m.sharpe >= 0.5 ? "#f0c27f" : "#f87171" },
                      { label: "Max DD",   val: m.max_drawdown != null ? `${m.max_drawdown.toFixed(2)}%` : "—", c: metricColor(m.max_drawdown ?? 0, "low") },
                    ].map(({ label, val, c }) => (
                      <div key={label} style={{ flex: 1, textAlign: "center" as const }}>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#5a5a6a", letterSpacing: "1px", marginBottom: 4, textTransform: "uppercase" as const }}>{label}</div>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: c }}>{val}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Tangent weights */}
              {portfolioData.tangent && (
                <div style={{ ...S.card, padding: "20px 24px" }}>
                  <div style={{ ...S.cardTitle, marginBottom: 16, paddingLeft: 0 }}>
                    PESOS ÓPTIMOS — PORTAFOLIO TANGENTE
                    <span style={{ color: "#4ade80", marginLeft: 8 }}>Sharpe: {portfolioData.tangent.sharpe?.toFixed(2)} · σ: {portfolioData.tangent.expected_vol.toFixed(1)}% · μ: {portfolioData.tangent.expected_return > 0 ? "+" : ""}{portfolioData.tangent.expected_return.toFixed(1)}%</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {Object.entries(portfolioData.tangent.weights)
                      .sort(([,a],[,b]) => b - a)
                      .map(([t, w]) => {
                        const pct = (w * 100).toFixed(1);
                        return (
                          <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 16px", background: "#0e0e16", border: `1.5px solid ${companies[t]?.color ?? "#2a2a3a"}`, borderRadius: 10 }}>
                            <span style={{ fontSize: 20 }}>{TICKER_ICONS[t]}</span>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: companies[t]?.color }}>{t}</span>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: "#e8e6e3" }}>{pct}%</span>
                            <div style={{ width: 48, height: 4, background: "#2a2a3a", borderRadius: 2 }}>
                              <div style={{ width: `${Math.min(w * 100, 100)}%`, height: "100%", background: companies[t]?.color, borderRadius: 2 }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div style={S.info}>
                <strong style={{ color: "#f0c27f" }}>Buy-and-Hold:</strong> pesos normalizados, sin rebalanceo.{" "}
                <strong style={{ color: "#4ade80" }}>Portafolio Tangente:</strong> maximiza el Sharpe Ratio mediante SLSQP (long-only). Es la intersección de la Línea de Mercado de Capitales con la frontera eficiente.
              </div>
            </>
          )}
        </>
      )}

      {/* ── SECTORS ── */}
      {appMode === "sectors" && (
        <>
          <div style={S.row}>
            <div style={S.fg}><label style={S.lbl}>Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S.input} /></div>
            <div style={S.fg}><label style={S.lbl}>End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={S.input} /></div>
            <button style={S.btn} onClick={fetchSectors} disabled={sectorLoading} {...hover}>{sectorLoading ? "Loading…" : "Load Markets"}</button>
          </div>

          {error && <div style={S.err}>{error}</div>}

          {sectorLoading ? <div style={S.spinner}>⏳ Cargando ETFs de mercado…</div>
          : !sectorData  ? <div style={S.empty}><div style={{ fontSize: 48, opacity: 0.4 }}>🌍</div><div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13 }}>Carga los ETFs de referencia de mercado</div></div>
          : (
            <>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 12 }}>
                <button style={{ ...S.tBtn(false), padding: "6px 14px", fontSize: 10 }}
                  onClick={() => downloadCSV(`sectors_${startDate}_${endDate}.csv`, sectorChartData, ["date", ...sectorTickers])}>
                  ↓ CSV
                </button>
              </div>

              <div style={S.card}>
                <div style={S.cardTitle}>ÍNDICES DE REFERENCIA · BASE 100</div>
                <ResponsiveContainer width="100%" height={420}>
                  <LineChart data={sectorChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" stroke="#3a3a4a" tick={{ fontSize: 10, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={fmtAxis} minTickGap={60} />
                    <YAxis stroke="#3a3a4a" tick={{ fontSize: 11, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} domain={["auto","auto"]} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={100} stroke="#3a3a4a" strokeDasharray="6 3" />
                    <Legend wrapperStyle={{ fontFamily: "'Space Mono', monospace", fontSize: 11, paddingTop: 12 }} />
                    {sectorTickers.map(t => (
                      <Line key={t} type="monotone" dataKey={t}
                        name={`${t} · ${sectorData.series[t].name}`}
                        stroke={sectorData.series[t].color} strokeWidth={t === "SPY" ? 1.5 : 2}
                        strokeDasharray={t === "SPY" ? "5 3" : undefined}
                        dot={false} connectNulls animationDuration={700} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Sector metrics table */}
              <div style={{ ...S.card, padding: "24px 24px" }}>
                <div style={S.cardTitle}>MÉTRICAS DEL PERÍODO</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #2a2a3a" }}>
                        {["ETF", "Total Return", "Ann. Vol", "Sharpe", "Max DD"].map((h, i) => (
                          <th key={h} style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "1.5px", color: "#6b6b7b", padding: "10px 14px", textAlign: i === 0 ? "left" as const : "right" as const, textTransform: "uppercase" as const }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sectorTickers.map(t => {
                        const m = sectorData.series[t].metrics;
                        const color = sectorData.series[t].color;
                        return (
                          <tr key={t} style={{ borderBottom: "1px solid #1e1e2e" }}>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: "#e8e6e3" }}>{t}</span>
                                <span style={{ fontSize: 11, color: "#5a5a6a" }}>{sectorData.series[t].name}</span>
                              </div>
                            </td>
                            <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, padding: "10px 14px", textAlign: "right", color: metricColor(m.total_return, "high") }}>
                              {m.total_return != null ? `${m.total_return > 0 ? "+" : ""}${m.total_return.toFixed(2)}%` : "—"}
                            </td>
                            <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, padding: "10px 14px", textAlign: "right", color: "#e8e6e3" }}>
                              {m.ann_vol != null ? `${m.ann_vol.toFixed(2)}%` : "—"}
                            </td>
                            <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, padding: "10px 14px", textAlign: "right",
                              color: m.sharpe == null ? "#6b6b7b" : m.sharpe >= 1.5 ? "#4ade80" : m.sharpe >= 0.5 ? "#f0c27f" : "#f87171" }}>
                              {m.sharpe != null ? m.sharpe.toFixed(2) : "—"}
                            </td>
                            <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, padding: "10px 14px", textAlign: "right", color: metricColor(m.max_drawdown ?? 0, "low") }}>
                              {m.max_drawdown != null ? `${m.max_drawdown.toFixed(2)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={S.info}>
                <strong style={{ color: "#f0c27f" }}>Índices:</strong>{" "}
                <strong>SPY</strong> = S&P 500 ·{" "}
                <strong>QQQ</strong> = Nasdaq 100 (top 100 no-financiero) ·{" "}
                <strong>XLK</strong> = SPDR Tech Sector ·{" "}
                <strong>VGT</strong> = Vanguard IT ·{" "}
                <strong>IWM</strong> = Russell 2000 (small caps)
              </div>
            </>
          )}
        </>
      )}

      <footer style={S.footer}>
        DATA VIA YAHOO FINANCE · PRICES ARE ADJUSTED CLOSE · NOT FINANCIAL ADVICE
      </footer>
    </div>
  );
}
