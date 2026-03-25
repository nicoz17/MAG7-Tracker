import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { SectorData } from "../types";
import { S } from "../styles";
import { hover } from "../styles";
import { fmtAxis, metricColor, downloadCSV } from "../utils/helpers";
import { CustomTooltip } from "../components/CustomTooltip";

interface SectorsTabProps {
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  sectorData: SectorData | null;
  sectorLoading: boolean;
  sectorTickers: string[];
  sectorChartData: Record<string, any>[];
  error: string | null;
  fetchSectors: () => void;
}

export function SectorsTab(props: SectorsTabProps) {
  const {
    startDate, endDate, setStartDate, setEndDate,
    sectorData, sectorLoading, sectorTickers, sectorChartData,
    error, fetchSectors,
  } = props;

  return (
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

          {/* ETF descriptions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {([
              { t: "SPY", desc: "S&P 500 — 500 mayores empresas de EE.UU.", scope: "Mercado amplio" },
              { t: "QQQ", desc: "Nasdaq 100 — Top 100 no-financieras del Nasdaq", scope: "Growth / Tech" },
              { t: "XLK", desc: "SPDR Technology Select — Sector tecnológico S&P 500", scope: "Sector Tech" },
              { t: "VGT", desc: "Vanguard Information Technology — IT amplio", scope: "IT amplio" },
              { t: "IWM", desc: "Russell 2000 — Small caps de EE.UU.", scope: "Small Caps" },
              { t: "GLD", desc: "SPDR Gold Shares — Precio spot del oro", scope: "Commodities" },
              { t: "IEF", desc: "iShares Treasury 7-10Y — Bonos mediano plazo EE.UU.", scope: "Renta Fija" },
              { t: "LQD", desc: "iShares Investment Grade Corp — Bonos corporativos IG", scope: "Renta Fija" },
              { t: "XLE", desc: "SPDR Energy Select — Sector energético S&P 500", scope: "Energía" },
              { t: "XLF", desc: "SPDR Financial Select — Sector financiero S&P 500", scope: "Financiero" },
            ] as const).map(({ t, desc, scope }) => (
              <div key={t} style={{
                background: "#12121c", border: "1px solid #1e1e2e", borderRadius: 10,
                padding: "10px 14px", flex: "1 1 180px", minWidth: 170,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: sectorData.series[t]?.color || "#6b6b7b", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: sectorData.series[t]?.color || "#e8e6e3" }}>{t}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", background: "#1a1a2a", padding: "2px 6px", borderRadius: 4 }}>{scope}</span>
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b", lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
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
            <strong style={{ color: "#f0c27f" }}>Renta Variable:</strong>{" "}
            <strong>SPY</strong> = S&P 500 · <strong>QQQ</strong> = Nasdaq 100 · <strong>XLK</strong> = Tech · <strong>VGT</strong> = Vanguard IT · <strong>IWM</strong> = Small Caps · <strong>XLE</strong> = Energía · <strong>XLF</strong> = Financiero{" "}
            | <strong style={{ color: "#f0c27f" }}> Commodities:</strong> <strong>GLD</strong> = Oro{" "}
            | <strong style={{ color: "#f0c27f" }}> Renta Fija:</strong> <strong>IEF</strong> = Treasury 7-10Y · <strong>LQD</strong> = Corp IG
          </div>
        </>
      )}
    </>
  );
}
