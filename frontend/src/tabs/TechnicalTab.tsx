import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  ComposedChart, Area, Bar, Cell,
} from "recharts";
import type {
  CompanyInfo, TechnicalData, BacktestData, NewsData,
  EarningsHover, EarningsEvent, AiSummaryData,
} from "../types";
import { TICKER_ICONS, MA_COLORS } from "../constants";
import { S } from "../styles";
import { hover } from "../styles";
import { fmtAxis } from "../utils/helpers";
import { TechnicalTooltip } from "../components/TechnicalTooltip";
import { EarningsLabel } from "../components/EarningsLabel";
import { EarningsTooltip } from "../components/EarningsTooltip";
import { SignalsPanel } from "../components/SignalsPanel";
import { BacktestPanel } from "../components/BacktestPanel";
import { NewsPanel } from "../components/NewsPanel";

interface TechnicalTabProps {
  companies: Record<string, CompanyInfo>;
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  techTicker: string;
  setTechTicker: (v: string) => void;
  techData: TechnicalData | null;
  techLoading: boolean;
  techChartData: Record<string, any>[];
  showMA: Record<number, boolean>;
  setShowMA: (fn: (prev: Record<number, boolean>) => Record<number, boolean>) => void;
  showBB: boolean;
  setShowBB: (fn: (prev: boolean) => boolean) => void;
  hoveredEarning: EarningsHover | null;
  setHoveredEarning: (v: EarningsHover | null) => void;
  earningsSnapped: (EarningsEvent & { snapped: string })[];
  error: string | null;
  fetchTechnical: () => void;
  // Backtest
  backtestData: BacktestData | null;
  backtestLoading: boolean;
  backtestStrategy: "rsi"|"macd"|"sma_cross"|"bb";
  setBacktestStrategy: (v: "rsi"|"macd"|"sma_cross"|"bb") => void;
  fetchBacktest: (ticker: string, strategy: string) => void;
  // News
  newsData: NewsData | null;
  newsLoading: boolean;
  fetchNews: (ticker: string) => void;
  // AI Summary
  aiSummary: AiSummaryData | null;
  aiSummaryLoading: boolean;
  aiSummaryError: string | null;
  fetchAiSummary: (ticker: string, start: string, end: string) => void;
}

export function TechnicalTab(props: TechnicalTabProps) {
  const {
    companies, startDate, endDate, setStartDate, setEndDate,
    techTicker, setTechTicker, techData, techLoading, techChartData,
    showMA, setShowMA, showBB, setShowBB,
    hoveredEarning, setHoveredEarning, earningsSnapped,
    error, fetchTechnical,
    backtestData, backtestLoading, backtestStrategy, setBacktestStrategy, fetchBacktest,
    newsData, newsLoading, fetchNews,
    aiSummary, aiSummaryLoading, aiSummaryError, fetchAiSummary,
  } = props;

  return (
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

          {/* Signals */}
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
  );
}
