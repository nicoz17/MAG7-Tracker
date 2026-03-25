import React from "react";

export function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const hist = payload.filter((e: any) => !String(e.dataKey).includes("_"));
  const fcst = payload.filter((e: any) => String(e.dataKey).endsWith("_median"));
  const entries = [
    ...hist.map((e: any) => ({ ...e, dn: e.name, forecast: false })),
    ...fcst.map((e: any) => ({ ...e, dn: String(e.dataKey).replace("_median", "") + " (fcst)", forecast: true })),
  ];
  if (!entries.length) return null;
  return (
    <div style={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 10, padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b7b", marginBottom: 8 }}>{label}</div>
      {entries.map((e: any) => (
        <div key={e.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, opacity: e.forecast ? 0.6 : 1 }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: e.forecast ? "#8a8a9a" : "#e8e6e3" }}>{e.dn}</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: e.color, marginLeft: "auto", fontWeight: 700 }}>
            {e.value != null ? e.value.toFixed(1) : "—"}{e.forecast && <span style={{ fontSize: 9 }}> ~</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
