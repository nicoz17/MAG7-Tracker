import React from "react";
import type { FundamentalsData, CompanyInfo } from "../types";

export function FundamentalsCard({ data, tickers, companies }: {
  data: Record<string, FundamentalsData>; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  const fmtMcap = (v: number | null) => {
    if (v == null) return "—";
    if (v >= 1e12) return `$${(v/1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `$${(v/1e9).toFixed(1)}B`;
    return `$${(v/1e6).toFixed(0)}M`;
  };
  const fmtPct = (v: number | null) => v == null ? "—" : `${(v*100).toFixed(1)}%`;
  const fmtX   = (v: number | null, dec = 1) => v == null ? "—" : `${v.toFixed(dec)}x`;

  const rows: { label: string; key: keyof FundamentalsData; fmt: (v: number | null) => string; goodHigh?: boolean }[] = [
    { label: "Market Cap",     key: "market_cap",     fmt: fmtMcap },
    { label: "P/E (trailing)", key: "trailing_pe",    fmt: v => fmtX(v, 1) },
    { label: "P/E (forward)",  key: "forward_pe",     fmt: v => fmtX(v, 1) },
    { label: "P/B",            key: "price_to_book",  fmt: v => fmtX(v, 2) },
    { label: "EV/EBITDA",      key: "ev_to_ebitda",   fmt: v => fmtX(v, 1) },
    { label: "PEG",            key: "peg_ratio",      fmt: v => fmtX(v, 2) },
    { label: "Rev. Growth",    key: "revenue_growth",  fmt: fmtPct, goodHigh: true },
    { label: "EPS Growth",     key: "earnings_growth", fmt: fmtPct, goodHigh: true },
    { label: "Profit Margin",  key: "profit_margin",   fmt: fmtPct, goodHigh: true },
    { label: "ROE",            key: "roe",             fmt: fmtPct, goodHigh: true },
    { label: "Deuda/Capital",  key: "debt_to_equity",  fmt: v => fmtX(v, 2), goodHigh: false },
    { label: "Div. Yield",     key: "dividend_yield",  fmt: fmtPct, goodHigh: true },
  ];

  const th: React.CSSProperties = { fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: "1px", color: "#6b6b7b", padding: "8px 12px", textAlign: "center" as const };
  const tdS = (good?: boolean, val?: number | null): React.CSSProperties => ({
    fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600,
    padding: "8px 12px", textAlign: "center" as const,
    color: val == null ? "#3a3a4a" : good == null ? "#e8e6e3" : good && val > 0 ? "#4ade80" : !good && val < 3 ? "#4ade80" : "#e8e6e3",
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #2a2a3a" }}>
            <th style={{ ...th, textAlign: "left" as const, minWidth: 110 }}>Métrica</th>
            {tickers.map(t => (
              <th key={t} style={th}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: companies[t]?.color }} />
                  {t}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} style={{ borderBottom: "1px solid #1a1a2a" }}>
              <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b", padding: "8px 12px", letterSpacing: "0.5px" }}>
                {row.label}
              </td>
              {tickers.map(t => {
                const val = data[t]?.[row.key] as number | null | undefined;
                return <td key={t} style={tdS(row.goodHigh, val ?? null)}>{row.fmt(val ?? null)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
