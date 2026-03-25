import React from "react";
import type { FundamentalsData, CompanyInfo } from "../types";
import { REC_LABEL } from "../constants";

export function AnalystTargets({ data, tickers, companies }: {
  data: Record<string, FundamentalsData>; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {tickers.map(t => {
        const d = data[t];
        if (!d) return null;
        const price   = d.current_price;
        const mean    = d.target_mean;
        const high    = d.target_high;
        const low     = d.target_low;
        const count   = d.analyst_count;
        const rec     = (d.recommendation ?? "").toLowerCase();
        const recInfo = REC_LABEL[rec] ?? { label: rec || "N/D", color: "#6b6b7b" };
        const upside  = price && mean ? ((mean / price - 1) * 100) : null;
        const upsideColor = upside == null ? "#6b6b7b" : upside > 10 ? "#4ade80" : upside > 0 ? "#f0c27f" : "#f87171";

        const barMin  = Math.min(price ?? 0, low ?? price ?? 0) * 0.97;
        const barMax  = Math.max(price ?? 0, high ?? price ?? 0) * 1.02;
        const barRng  = barMax - barMin || 1;
        const pricePct = price ? ((price - barMin) / barRng * 100) : null;
        const lowPct   = low   ? ((low   - barMin) / barRng * 100) : null;
        const highPct  = high  ? ((high  - barMin) / barRng * 100) : null;
        const meanPct  = mean  ? ((mean  - barMin) / barRng * 100) : null;

        return (
          <div key={t} style={{ background: "#0e0e16", border: `1px solid ${companies[t]?.color}30`, borderRadius: 12, padding: "16px 18px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: companies[t]?.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: "#e8e6e3" }}>{t}</span>
              </div>
              <div style={{ background: `${recInfo.color}18`, border: `1px solid ${recInfo.color}40`, borderRadius: 6, padding: "3px 8px" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, color: recInfo.color }}>{recInfo.label.toUpperCase()}</span>
              </div>
            </div>

            {/* Upside */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", marginBottom: 2 }}>Precio actual</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: "#e8e6e3" }}>
                  {price ? `$${price.toFixed(2)}` : "—"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", marginBottom: 2 }}>Upside al target</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: upsideColor }}>
                  {upside != null ? `${upside > 0 ? "+" : ""}${upside.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>

            {/* Range bar */}
            {price && low && high && mean && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ position: "relative", height: 28, background: "#1a1a2a", borderRadius: 6, overflow: "visible" }}>
                  {/* Low-High band */}
                  <div style={{
                    position: "absolute", top: "25%", height: "50%",
                    left: `${lowPct}%`, width: `${(highPct! - lowPct!)}%`,
                    background: `${companies[t]?.color}25`, borderRadius: 3,
                  }} />
                  {/* Mean target marker */}
                  {meanPct != null && (
                    <div style={{
                      position: "absolute", top: "10%", height: "80%", width: 3, borderRadius: 2,
                      left: `calc(${meanPct}% - 1.5px)`, background: companies[t]?.color,
                    }} />
                  )}
                  {/* Current price marker */}
                  {pricePct != null && (
                    <div style={{
                      position: "absolute", top: 0, height: "100%", width: 2, borderRadius: 2,
                      left: `calc(${pricePct}% - 1px)`, background: "#ffffff80",
                    }} />
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#5a5a6a" }}>${low.toFixed(0)}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: companies[t]?.color }}>▾ ${mean.toFixed(0)}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#5a5a6a" }}>${high.toFixed(0)}</span>
                </div>
              </div>
            )}

            {/* Analyst count */}
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", textAlign: "center" }}>
              {count ? `${count} analistas` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
