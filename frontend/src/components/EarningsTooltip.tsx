import React from "react";
import type { EarningsHover } from "../types";

export function EarningsTooltip({ hover }: { hover: EarningsHover | null }) {
  if (!hover) return null;
  const { clientX, clientY, event: ev } = hover;
  const beat = ev.eps_surprise != null ? ev.eps_surprise > 0 : null;
  return (
    <div style={{
      position: "fixed", left: clientX + 14, top: clientY - 10, zIndex: 9999,
      background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 10,
      padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      pointerEvents: "none", minWidth: 180,
    }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#f0c27f", fontWeight: 700, marginBottom: 10, letterSpacing: "0.5px" }}>
        ● Earnings
      </div>
      {[
        { label: "Date",         value: ev.date },
        { label: "EPS Estimate", value: ev.eps_estimate != null ? ev.eps_estimate.toFixed(2) : "—" },
        { label: "EPS Actual",   value: ev.eps_actual   != null ? ev.eps_actual.toFixed(2)   : "—" },
        { label: "EPS Surprise", value: ev.eps_surprise != null ? `${ev.eps_surprise > 0 ? "+" : ""}${ev.eps_surprise.toFixed(2)}%` : "—",
          color: beat == null ? "#e8e6e3" : beat ? "#4ade80" : "#f87171" },
      ].map(row => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "3px 0" }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b7b" }}>{row.label}</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: (row as any).color ?? "#e8e6e3" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
