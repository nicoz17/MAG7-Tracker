import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { CompanyInfo, ApiResponse, ForecastResponse, ViewMode, FcstModel } from "../types";
import { BAND_OPTIONS } from "../constants";
import { S } from "../styles";
import { hover } from "../styles";
import { fmtAxis, downloadCSV } from "../utils/helpers";
import { TickerChip } from "../components/TickerChip";
import { CustomTooltip } from "../components/CustomTooltip";
import { ModelCard } from "../components/ModelCard";

interface ComparisonTabProps {
  companies: Record<string, CompanyInfo>;
  selected: Set<string>;
  toggleTicker: (t: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  showForecast: boolean;
  setShowForecast: (v: boolean | ((prev: boolean) => boolean)) => void;
  forecastModel: FcstModel;
  setForecastModel: (v: FcstModel) => void;
  bandPct: number;
  setBandPct: (v: number) => void;
  loading: boolean;
  error: string | null;
  data: ApiResponse | null;
  forecastData: ForecastResponse | null;
  chartData: Record<string, any>[];
  tickers: string[];
  fetchData: () => void;
}

export function ComparisonTab(props: ComparisonTabProps) {
  const {
    companies, selected, toggleTicker, selectAll, selectNone,
    startDate, endDate, setStartDate, setEndDate,
    viewMode, setViewMode, showForecast, setShowForecast,
    forecastModel, setForecastModel, bandPct, setBandPct,
    loading, error, data, forecastData, chartData, tickers, fetchData,
  } = props;

  return (
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
              onClick={() => forecastData && setShowForecast((v: boolean) => !v)}>
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
  );
}
