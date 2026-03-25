import React from "react";

const T_SKIP = new Set(["bb_lower_stack", "bb_fill"]);
const T_NAMES: Record<string, string> = {
  close: "Close", sma20: "SMA 20", sma50: "SMA 50", sma200: "SMA 200",
  bb_upper: "BB Upper", bb_lower: "BB Lower", rsi: "RSI",
  macd_line: "MACD", macd_signal: "Signal", macd_hist: "Hist",
  volume: "Volume",
};

export function TechnicalTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter((e: any) => !T_SKIP.has(String(e.dataKey)) && e.value != null);
  if (!entries.length) return null;
  return (
    <div style={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 10, padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b7b", marginBottom: 8 }}>{label}</div>
      {entries.map((e: any) => (
        <div key={e.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color || "#e8e6e3", flexShrink: 0 }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#8a8a9a" }}>{T_NAMES[e.dataKey] || e.dataKey}</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: e.color || "#e8e6e3", marginLeft: "auto", fontWeight: 700 }}>
            {e.dataKey === "volume"
              ? (e.value >= 1e6 ? `${(e.value/1e6).toFixed(1)}M` : e.value.toLocaleString())
              : typeof e.value === "number" ? e.value.toFixed(2) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
