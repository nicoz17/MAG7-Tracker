import React from "react";
import type { AnalyticsData, CompanyInfo, FundamentalsData } from "../types";
import { SCORE_META } from "../constants";
import { computeScore } from "../utils/helpers";
import { S } from "../styles";

export function InvestmentScoreCard({ analytics, tickers, companies, fundamentals }: {
  analytics: AnalyticsData;
  tickers: string[];
  companies: Record<string, CompanyInfo>;
  fundamentals: Record<string, FundamentalsData> | null;
}) {
  if (tickers.length === 0) return null;
  const scores = tickers.map(t => ({
    t,
    ...computeScore(analytics.metrics[t], analytics.extended_metrics[t], analytics.beta[t] ?? null, fundamentals?.[t]),
  }));

  return (
    <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ ...S.cardTitle, paddingLeft: 0, marginBottom: 14 }}>SCORE DE INVERSIÓN</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
        {scores.map(({ t, score, rating, breakdown }) => {
          const meta = SCORE_META[rating];
          return (
            <div key={t} style={{ flex: "1 1 160px", minWidth: 160, background: meta.bg, border: `1.5px solid ${meta.color}40`, borderRadius: 12, padding: "16px 18px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: companies[t]?.color }} />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: "#e8e6e3" }}>{t}</span>
              </div>
              {/* Big score */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: meta.color, lineHeight: 1 }}>{score}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#5a5a6a" }}>/100</span>
              </div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: meta.color, marginBottom: 12, letterSpacing: "1px" }}>
                {meta.label.toUpperCase()}
              </div>
              {/* Breakdown bars */}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
                {breakdown.map(({ label, pts, max }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#5a5a6a", letterSpacing: "0.5px" }}>{label}</span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#8a8a9a" }}>{pts}/{max}</span>
                    </div>
                    <div style={{ height: 3, background: "#1e1e2e", borderRadius: 2 }}>
                      <div style={{ height: 3, width: `${(pts/max)*100}%`, background: meta.color, borderRadius: 2, opacity: 0.8 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginTop: 12 }}>
        Score basado en Sharpe, Alpha (CAPM), Calmar, Sortino, Max Drawdown, Beta
        {fundamentals ? " y Fundamentales (P/E, crecimiento, márgenes)" : " · carga Fundamentales para incluirlos en el score"}.
        No es recomendación de inversión.
      </div>
    </div>
  );
}
