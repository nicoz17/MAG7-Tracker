import React, { useState, useCallback } from "react";
import type { CompanyInfo, MonthlyReturnsData } from "../types";
import { S } from "../styles";

export function MonthlyHeatmap({ companies }: { companies: Record<string, CompanyInfo> }) {
  const [monthlyData, setMonthlyData] = useState<MonthlyReturnsData | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyTicker, setMonthlyTicker] = useState("AAPL");

  const fetchMonthlyReturns = useCallback(async (ticker: string) => {
    setMonthlyLoading(true);
    setMonthlyData(null);
    try {
      const r = await fetch(`/api/monthly_returns?ticker=${ticker}&years=5`);
      if (!r.ok) throw new Error();
      setMonthlyData(await r.json());
    } catch { /* silent */ } finally { setMonthlyLoading(false); }
  }, []);

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
}
