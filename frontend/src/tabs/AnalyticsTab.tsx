import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { CompanyInfo, AnalyticsData, FundamentalsData } from "../types";
import { S } from "../styles";
import { hover } from "../styles";
import { fmtAxis, metricColor } from "../utils/helpers";
import { TickerChip } from "../components/TickerChip";
import { CustomTooltip } from "../components/CustomTooltip";
import { InvestmentScoreCard } from "../components/InvestmentScoreCard";
import { InsightPanel } from "../components/InsightPanel";
import { MetricsTable } from "../components/MetricsTable";
import { CorrelationHeatmap } from "../components/CorrelationHeatmap";
import { FundamentalsCard } from "../components/FundamentalsCard";
import { ValuationRadar } from "../components/ValuationRadar";
import { AnalystTargets } from "../components/AnalystTargets";
import { DCFModel } from "../components/DCFModel";
import { MonthlyHeatmap } from "../components/MonthlyHeatmap";

interface AnalyticsTabProps {
  companies: Record<string, CompanyInfo>;
  selected: Set<string>;
  toggleTicker: (t: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  analyticsData: AnalyticsData | null;
  analyticsLoading: boolean;
  analyticsTickers: string[];
  ddChartData: Record<string, any>[];
  rollingVolChartData: Record<string, any>[];
  fundamentalsData: Record<string, FundamentalsData> | null;
  fundamentalsLoading: boolean;
  error: string | null;
  fetchAnalytics: () => void;
  fetchFundamentals: () => void;
}

export function AnalyticsTab(props: AnalyticsTabProps) {
  const {
    companies, selected, toggleTicker, selectAll, selectNone,
    startDate, endDate, setStartDate, setEndDate,
    analyticsData, analyticsLoading, analyticsTickers,
    ddChartData, rollingVolChartData,
    fundamentalsData, fundamentalsLoading,
    error, fetchAnalytics, fetchFundamentals,
  } = props;

  return (
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
          {/* 1. Analyst Price Targets */}
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

          {/* 2. DCF */}
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

          {/* 3. Investment Score */}
          <InvestmentScoreCard analytics={analyticsData} tickers={analyticsTickers} companies={companies} fundamentals={fundamentalsData} />

          {/* 3b. Automated Insights */}
          <InsightPanel analytics={analyticsData} tickers={analyticsTickers} companies={companies} />

          {/* 4. Metrics Table */}
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

          {/* 5. Drawdown */}
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

          {/* 6. Rolling Volatility */}
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

          {/* 7. Correlation */}
          {analyticsTickers.length > 1 && (
            <div style={{ ...S.card, padding: "24px 24px" }}>
              <div style={S.cardTitle}>CORRELACIÓN DE RETORNOS DIARIOS</div>
              <CorrelationHeatmap correlation={analyticsData.correlation} tickers={analyticsTickers} companies={companies} />
            </div>
          )}

          {/* 8. Fundamentals raw data */}
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

          {/* 9. Valuation Radar */}
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
      <MonthlyHeatmap companies={companies} />
    </>
  );
}
