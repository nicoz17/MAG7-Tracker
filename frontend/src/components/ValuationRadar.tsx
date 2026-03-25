import React from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import type { FundamentalsData, CompanyInfo } from "../types";

export function ValuationRadar({ data, tickers, companies }: {
  data: Record<string, FundamentalsData>; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  const axes = [
    { key: "growth",  label: "Crecimiento" },
    { key: "margin",  label: "Rentabilidad" },
    { key: "value",   label: "Valuación" },
    { key: "roe",     label: "ROE" },
    { key: "momentum",label: "Momentum EPS" },
    { key: "quality", label: "Calidad" },
  ];

  const raw: Record<string, Record<string, number | null>> = {};
  for (const t of tickers) {
    const d = data[t];
    if (!d) { raw[t] = {}; continue; }
    const rev_g = d.revenue_growth != null ? d.revenue_growth * 100 : null;
    const eps_g = d.earnings_growth != null ? d.earnings_growth * 100 : null;
    raw[t] = {
      growth:   rev_g,
      margin:   d.profit_margin != null ? d.profit_margin * 100 : null,
      value:    d.forward_pe != null ? Math.max(0, 100 - ((Math.min(d.forward_pe, 80) - 5) / 75) * 100) : null,
      roe:      d.roe != null ? d.roe * 100 : null,
      momentum: eps_g,
      quality:  d.debt_to_equity != null ? Math.max(0, 100 - Math.min(d.debt_to_equity, 200) / 2) : null,
    };
  }

  const normalized: Record<string, Record<string, number>> = {};
  for (const ax of axes) {
    const vals = tickers.map(t => raw[t]?.[ax.key]).filter(v => v != null) as number[];
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const rng = mx - mn || 1;
    for (const t of tickers) {
      if (!normalized[t]) normalized[t] = {};
      const v = raw[t]?.[ax.key];
      normalized[t][ax.key] = v != null ? Math.round(((v - mn) / rng) * 100) : 0;
    }
  }

  const chartData = axes.map(ax => {
    const pt: Record<string, any> = { axis: ax.label };
    for (const t of tickers) pt[t] = normalized[t]?.[ax.key] ?? 0;
    return pt;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
        {tickers.map(t => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: companies[t]?.color }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#8a8a9a" }}>{t}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#1e1e2e" />
          <PolarAngleAxis dataKey="axis" tick={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fill: "#8a8a9a" }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          {tickers.map(t => (
            <Radar key={t} name={t} dataKey={t}
              stroke={companies[t]?.color} fill={companies[t]?.color} fillOpacity={0.08} strokeWidth={2} />
          ))}
          <Tooltip
            contentStyle={{ background: "#1a1a26", border: "1px solid #2a2a3a", borderRadius: 10, fontFamily: "'Space Mono', monospace", fontSize: 11 }}
            formatter={(v: any, name: string) => [`${v}/100`, name]}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", textAlign: "center", marginTop: 4 }}>
        Scores normalizados 0–100 entre los tickers seleccionados · Crecimiento=Rev.Growth · Rentabilidad=Margen Neto · Valuación=100−P/E Forward · Calidad=100−D/E
      </div>
    </div>
  );
}
