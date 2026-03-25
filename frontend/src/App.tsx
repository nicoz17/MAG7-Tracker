import React, { useState, useEffect, useCallback } from "react";
import type {
  CompanyInfo, ApiResponse, ForecastResponse, TechnicalData,
  BacktestData, NewsData, AnalyticsData, FundamentalsData,
  PortfolioData, SectorData, MacroData, AiSummaryData,
  ViewMode, AppMode, FcstModel, EarningsHover,
} from "./types";
import { S } from "./styles";
import { API_BASE } from "./api";
import { getDefaultDates } from "./utils/helpers";
import { EarningsTooltip } from "./components/EarningsTooltip";
import { MacroPanel } from "./components/MacroPanel";
import { ComparisonTab } from "./tabs/ComparisonTab";
import { TechnicalTab } from "./tabs/TechnicalTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { PortfolioTab } from "./tabs/PortfolioTab";
import { SectorsTab } from "./tabs/SectorsTab";

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

  /* AI Summary */
  const [aiSummary,        setAiSummary]        = useState<AiSummaryData | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError,   setAiSummaryError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/companies`)
      .then(r => r.json())
      .then(d => { setCompanies(d); setSelected(new Set(Object.keys(d))); })
      .catch(() => setError("Could not load company list. Is the backend running?"));
  }, []);

  useEffect(() => {
    Object.assign(document.body.style, { margin: "0", padding: "0", background: "#0a0a0f", color: "#e8e6e3" });
  }, []);

  // Macro: fetch once on mount, then every 60s
  useEffect(() => {
    const load = () => fetch(`${API_BASE}/api/macro`).then(r => r.json()).then(setMacroData).catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchAiSummary = useCallback(async (ticker: string, start: string, end: string) => {
    setAiSummaryLoading(true);
    setAiSummaryError(null);
    setAiSummary(null);
    try {
      const p = new URLSearchParams({ ticker, start, end });
      const r = await fetch(`${API_BASE}/api/ai_summary?${p}`);
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
      const [pR, fR] = await Promise.all([fetch(`${API_BASE}/api/prices?${p}`), fetch(`${API_BASE}/api/forecast?${fp}`)]);
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
      const r = await fetch(`${API_BASE}/api/technical?${p}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`); }
      setTechData(await r.json());
    } catch (e: any) { setError(e.message || "Failed to fetch technical"); }
    finally { setTechLoading(false); }
  }, [techTicker, startDate, endDate]);

  const fetchBacktest = useCallback(async (ticker: string, strategy: string) => {
    setBacktestLoading(true); setBacktestData(null);
    try {
      const p = new URLSearchParams({ ticker, strategy, start: startDate, end: endDate });
      const r = await fetch(`${API_BASE}/api/backtest?${p}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.detail || `HTTP ${r.status}`); }
      setBacktestData(await r.json());
    } catch (e: any) { setError(e.message || "Failed to fetch backtest"); }
    finally { setBacktestLoading(false); }
  }, [startDate, endDate]);

  const fetchNews = useCallback(async (ticker: string) => {
    setNewsLoading(true); setNewsData(null);
    try {
      const r = await fetch(`${API_BASE}/api/news?ticker=${ticker}`);
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
      const r = await fetch(`${API_BASE}/api/analytics?${p}`);
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
      const r = await fetch(`${API_BASE}/api/fundamentals?${p}`);
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
      const r = await fetch(`${API_BASE}/api/portfolio?${p}`);
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
      const r = await fetch(`${API_BASE}/api/sectors?${p}`);
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

  const earningsSnapped = React.useMemo(() => {
    if (!techData?.earnings_dates?.length || !techData.dates.length) return [];
    const tradingDays = techData.dates;
    return techData.earnings_dates.map(ev => {
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

  return (
    <div style={S.container}>
      <header style={S.header}>
        <h1 style={S.title}>MAG 7 TRACKER</h1>
        <p style={S.subtitle}>Magnificent Seven · Performance Analysis</p>
      </header>

      {/* Earnings hover tooltip -- rendered at root so it escapes SVG */}
      <EarningsTooltip hover={hoveredEarning} />

      {/* Macro context strip */}
      <MacroPanel macroData={macroData} />

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
        <ComparisonTab
          companies={companies} selected={selected}
          toggleTicker={toggleTicker} selectAll={selectAll} selectNone={selectNone}
          startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate}
          viewMode={viewMode} setViewMode={setViewMode}
          showForecast={showForecast} setShowForecast={setShowForecast}
          forecastModel={forecastModel} setForecastModel={setForecastModel}
          bandPct={bandPct} setBandPct={setBandPct}
          loading={loading} error={error} data={data} forecastData={forecastData}
          chartData={chartData} tickers={tickers} fetchData={fetchData}
        />
      )}

      {/* ── TECHNICAL ── */}
      {appMode === "technical" && (
        <TechnicalTab
          companies={companies}
          startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate}
          techTicker={techTicker} setTechTicker={setTechTicker}
          techData={techData} techLoading={techLoading} techChartData={techChartData}
          showMA={showMA} setShowMA={setShowMA} showBB={showBB} setShowBB={setShowBB}
          hoveredEarning={hoveredEarning} setHoveredEarning={setHoveredEarning}
          earningsSnapped={earningsSnapped}
          error={error} fetchTechnical={fetchTechnical}
          backtestData={backtestData} backtestLoading={backtestLoading}
          backtestStrategy={backtestStrategy} setBacktestStrategy={setBacktestStrategy}
          fetchBacktest={fetchBacktest}
          newsData={newsData} newsLoading={newsLoading} fetchNews={fetchNews}
          aiSummary={aiSummary} aiSummaryLoading={aiSummaryLoading}
          aiSummaryError={aiSummaryError} fetchAiSummary={fetchAiSummary}
        />
      )}

      {/* ── ANALYTICS ── */}
      {appMode === "analytics" && (
        <AnalyticsTab
          companies={companies} selected={selected}
          toggleTicker={toggleTicker} selectAll={selectAll} selectNone={selectNone}
          startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate}
          analyticsData={analyticsData} analyticsLoading={analyticsLoading}
          analyticsTickers={analyticsTickers}
          ddChartData={ddChartData} rollingVolChartData={rollingVolChartData}
          fundamentalsData={fundamentalsData} fundamentalsLoading={fundamentalsLoading}
          error={error} fetchAnalytics={fetchAnalytics} fetchFundamentals={fetchFundamentals}
        />
      )}

      {/* ── PORTFOLIO ── */}
      {appMode === "portfolio" && (
        <PortfolioTab
          companies={companies} selected={selected}
          toggleTicker={toggleTicker} selectAll={selectAll} selectNone={selectNone}
          startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate}
          portfolioWeights={portfolioWeights} setPortfolioWeights={setPortfolioWeights}
          portfolioData={portfolioData} portfolioLoading={portfolioLoading}
          portfolioChartData={portfolioChartData}
          showPortfolioStocks={showPortfolioStocks} setShowPortfolioStocks={setShowPortfolioStocks}
          showTangent={showTangent} setShowTangent={setShowTangent}
          error={error} fetchPortfolio={fetchPortfolio}
        />
      )}

      {/* ── SECTORS ── */}
      {appMode === "sectors" && (
        <SectorsTab
          startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate}
          sectorData={sectorData} sectorLoading={sectorLoading}
          sectorTickers={sectorTickers} sectorChartData={sectorChartData}
          error={error} fetchSectors={fetchSectors}
        />
      )}

      <footer style={S.footer}>
        DATA VIA YAHOO FINANCE · PRICES ARE ADJUSTED CLOSE · NOT FINANCIAL ADVICE
      </footer>
    </div>
  );
}
