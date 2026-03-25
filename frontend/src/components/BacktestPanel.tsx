import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { BacktestData } from "../types";
import { STRATEGY_INFO } from "../constants";
import { S } from "../styles";
import { fmtAxis } from "../utils/helpers";
import { CustomTooltip } from "./CustomTooltip";

export function BacktestPanel({ data, ticker, color }: { data: BacktestData; ticker: string; color: string }) {
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
    { label: "Nº Trades",     value: String(metrics.n_trades),          color: "#e8e6e3" },
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
