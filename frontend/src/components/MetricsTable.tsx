import React from "react";
import type { TickerMetrics, ExtendedMetrics, CompanyInfo, AnalyticsData } from "../types";
import { metricColor, betaColor } from "../utils/helpers";

export function MetricsTable({ metrics, beta, extended, tickers, companies, benchmark }: {
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
