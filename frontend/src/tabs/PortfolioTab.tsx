import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { CompanyInfo, PortfolioData } from "../types";
import { TICKER_ICONS } from "../constants";
import { S } from "../styles";
import { hover } from "../styles";
import { fmtAxis, metricColor, downloadCSV } from "../utils/helpers";
import { TickerChip } from "../components/TickerChip";
import { CustomTooltip } from "../components/CustomTooltip";

interface PortfolioTabProps {
  companies: Record<string, CompanyInfo>;
  selected: Set<string>;
  toggleTicker: (t: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  portfolioWeights: Record<string, number>;
  setPortfolioWeights: (fn: (prev: Record<string, number>) => Record<string, number>) => void;
  portfolioData: PortfolioData | null;
  portfolioLoading: boolean;
  portfolioChartData: Record<string, any>[];
  showPortfolioStocks: boolean;
  setShowPortfolioStocks: (fn: (prev: boolean) => boolean) => void;
  showTangent: boolean;
  setShowTangent: (fn: (prev: boolean) => boolean) => void;
  error: string | null;
  fetchPortfolio: () => void;
}

export function PortfolioTab(props: PortfolioTabProps) {
  const {
    companies, selected, toggleTicker, selectAll, selectNone,
    startDate, endDate, setStartDate, setEndDate,
    portfolioWeights, setPortfolioWeights,
    portfolioData, portfolioLoading, portfolioChartData,
    showPortfolioStocks, setShowPortfolioStocks,
    showTangent, setShowTangent,
    error, fetchPortfolio,
  } = props;

  return (
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
              setPortfolioWeights(() => Object.fromEntries(arr.map(t => [t, eq])));
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
  );
}
