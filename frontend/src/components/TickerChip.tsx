import React from "react";
import type { CompanyInfo } from "../types";
import { TICKER_ICONS } from "../constants";

export function TickerChip({ ticker, info, selected, onToggle }: {
  ticker: string; info: CompanyInfo; selected: boolean; onToggle: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
      borderRadius: 10, border: `1.5px solid ${selected ? info.color : "#2a2a3a"}`,
      background: selected ? `${info.color}12` : "#16161f",
      cursor: "pointer", transition: "all 0.2s", userSelect: "none",
    }} onClick={onToggle}>
      <span style={{ fontSize: 18 }}>{TICKER_ICONS[ticker]}</span>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: selected ? info.color : "#3a3a4a", flexShrink: 0 }} />
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: selected ? "#e8e6e3" : "#5a5a6a" }}>{ticker}</span>
      <span style={{ fontSize: 11, color: selected ? "#8a8a9a" : "#3a3a4a" }}>{info.name}</span>
    </div>
  );
}
