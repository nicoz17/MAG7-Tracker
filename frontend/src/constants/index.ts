import type { FcstModel, InsightType, ScoreRating } from "../types";

export const TICKER_ICONS: Record<string, string> = {
  AAPL: "🍎", MSFT: "🪟", GOOGL: "🔍", AMZN: "📦", NVDA: "🟢", META: "👁", TSLA: "⚡",
};

export const MA_COLORS: Record<number, string> = { 20: "#f0c27f", 50: "#fc5c7d", 200: "#4285F4" };

export const MODEL_INFO: Record<FcstModel, { title: string; formula: string; desc: string; pro: string; con: string }> = {
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

export const BAND_OPTIONS = [50, 60, 70, 80, 90] as const;

export const STRATEGY_INFO: Record<string, { label: string; desc: string; icon: string }> = {
  rsi:       { icon: "📊", label: "RSI Mean Revert",  desc: "Compra cuando RSI<30, vende cuando RSI>70" },
  macd:      { icon: "📈", label: "MACD Crossover",   desc: "Long cuando MACD>señal, flat cuando cruza bajo" },
  sma_cross: { icon: "⭐", label: "SMA Golden/Death", desc: "Long cuando SMA50>SMA200, flat cuando cruza bajo" },
  bb:        { icon: "🎯", label: "BB Mean Revert",   desc: "Compra en banda inferior, vende en banda media" },
};

export const REC_LABEL: Record<string, { label: string; color: string }> = {
  "strong_buy":  { label: "Compra Fuerte", color: "#4ade80" },
  "buy":         { label: "Compra",        color: "#86efac" },
  "hold":        { label: "Mantener",      color: "#f0c27f" },
  "underperform":{ label: "Subperformance",color: "#f87171" },
  "sell":        { label: "Venta",         color: "#ef4444" },
};

export const SCORE_META: Record<ScoreRating, { emoji: string; label: string; color: string; bg: string }> = {
  buy:  { emoji: "🟢", label: "Buy",  color: "#4ade80", bg: "rgba(74,222,128,0.08)"  },
  hold: { emoji: "🟡", label: "Hold", color: "#f0c27f", bg: "rgba(240,194,127,0.08)" },
  sell: { emoji: "🔴", label: "Sell", color: "#f87171", bg: "rgba(248,113,113,0.08)" },
};

export const SIGNAL_COLORS: Record<string, string> = { bullish: "#4ade80", bearish: "#f87171", neutral: "#94a3b8" };

export const INSIGHT_COLORS: Record<InsightType, string> = {
  positive: "#4ade80", negative: "#f87171", warning: "#f0c27f", info: "#60a5fa",
};
