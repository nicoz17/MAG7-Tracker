import React from "react";
import type { AnalyticsData, CompanyInfo } from "../types";
import { INSIGHT_COLORS } from "../constants";
import { generateInsights } from "../utils/helpers";
import { S } from "../styles";

export function InsightPanel({ analytics, tickers, companies }: {
  analytics: AnalyticsData; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  const insights = generateInsights(analytics, tickers, companies);
  if (insights.length === 0) return null;
  return (
    <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ ...S.cardTitle, paddingLeft: 0, marginBottom: 14 }}>ANÁLISIS AUTOMÁTICO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "#0e0e16", borderRadius: 8, borderLeft: `3px solid ${INSIGHT_COLORS[ins.type]}` }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{ins.icon}</span>
            <span style={{ fontSize: 12, color: "#c8c8d8", lineHeight: 1.5 }}>{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
