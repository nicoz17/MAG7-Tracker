import React from "react";
import type { CompanyInfo } from "../types";
import { corrBg } from "../utils/helpers";

export function CorrelationHeatmap({ correlation, tickers, companies }: {
  correlation: Record<string, Record<string, number>>;
  tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  const cell: React.CSSProperties = {
    fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700,
    textAlign: "center" as const, padding: "12px 8px", minWidth: 64,
  };
  const hdr: React.CSSProperties = {
    fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b",
    letterSpacing: "1px", textAlign: "center" as const, padding: "8px",
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", margin: "0 auto" }}>
        <thead>
          <tr>
            <th style={{ ...hdr, width: 80 }} />
            {tickers.map(t => (
              <th key={t} style={hdr}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: companies[t]?.color }} />{t}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map(row => (
            <tr key={row}>
              <td style={{ ...hdr, textAlign: "right" as const, paddingRight: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                  {row}<div style={{ width: 8, height: 8, borderRadius: "50%", background: companies[row]?.color }} />
                </div>
              </td>
              {tickers.map(col => {
                const v = correlation[row]?.[col] ?? 0;
                const isDiag = row === col;
                return (
                  <td key={col} style={{ ...cell, background: corrBg(isDiag ? 1 : v), color: isDiag ? "#0a0a0f" : "#e8e6e3", borderRadius: isDiag ? 6 : 4 }}>
                    {isDiag ? "—" : v.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", textAlign: "center", marginTop: 12 }}>
        Correlación de log-retornos diarios · Escala: 0 (gris) → 1 (dorado)
      </div>
    </div>
  );
}
