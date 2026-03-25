import React from "react";
import type { MacroData } from "../types";

export function MacroPanel({ macroData }: { macroData: MacroData | null }) {
  if (!macroData || Object.keys(macroData).length === 0) return null;
  const ORDER = ["VIX", "DXY", "US10Y", "SPY"];
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 0 4px", flexWrap: "wrap" }}>
      {ORDER.filter(k => macroData[k]).map(key => {
        const m = macroData[key];
        const chg = m.chg_1d;
        const up = chg != null && chg >= 0;
        const chgColor = chg == null ? "#6b6b7b" : up ? "#4ade80" : "#f87171";
        return (
          <div key={key} style={{
            background: "#12121c", border: "1px solid #1e1e2e", borderRadius: 10,
            padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, flex: "1 1 0", minWidth: 130,
          }}>
            <div style={{ width: 3, height: 32, background: m.color, borderRadius: 2, flexShrink: 0 }} />
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: m.color }}>{key}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6b6b7b" }}>{m.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: "#e8e6e3" }}>
                  {key === "US10Y" ? `${m.price.toFixed(2)}%` : key === "VIX" ? m.price.toFixed(2) : m.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {chg != null && (
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: chgColor, fontWeight: 600 }}>
                    {key === "US10Y"
                      ? `${up ? "▲" : "▼"} ${Math.abs(chg).toFixed(0)}bps`
                      : `${up ? "▲" : "▼"} ${Math.abs(chg).toFixed(2)}%`}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
