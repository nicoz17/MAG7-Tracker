import React from "react";
import type { TechnicalSignal } from "../types";
import { SIGNAL_COLORS } from "../constants";
import { S } from "../styles";

export function SignalsPanel({ signals, ticker }: { signals: TechnicalSignal[]; ticker: string }) {
  if (!signals.length) return null;

  const bullish = signals.filter(s => s.type === "bullish");
  const bearish = signals.filter(s => s.type === "bearish");
  const neutral  = signals.filter(s => s.type === "neutral");

  const bullScore = bullish.filter(s => s.strength === "strong").length * 2 + bullish.filter(s => s.strength === "weak").length;
  const bearScore = bearish.filter(s => s.strength === "strong").length * 2 + bearish.filter(s => s.strength === "weak").length;
  const overall: "bullish" | "bearish" | "neutral" = bullScore > bearScore ? "bullish" : bearScore > bullScore ? "bearish" : "neutral";
  const overallColor = SIGNAL_COLORS[overall];
  const overallLabel = overall === "bullish" ? "🟢 Alcista" : overall === "bearish" ? "🔴 Bajista" : "🟡 Neutral";

  return (
    <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, paddingLeft: 0 }}>SEÑALES TÉCNICAS · {ticker}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${overallColor}12`, border: `1.5px solid ${overallColor}40`, borderRadius: 10, padding: "8px 16px" }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: overallColor }}>{overallLabel}</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a" }}>
            {bullish.length}B / {bearish.length}Ba / {neutral.length}N
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
        {[...signals].sort((a, b) => {
          const order = { strong: 0, weak: 1, neutral: 2 };
          return order[a.strength] - order[b.strength];
        }).map((sig, i) => {
          const col = SIGNAL_COLORS[sig.type];
          const opacity = sig.strength === "strong" ? 1 : 0.65;
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "#0e0e16", borderRadius: 8, borderLeft: `3px solid ${col}`, opacity }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{sig.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: col }}>{sig.title}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", background: "#1e1e2e", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.5px" }}>{sig.indicator}</span>
                  {sig.strength === "strong" && <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: col, background: `${col}15`, borderRadius: 4, padding: "1px 6px" }}>FUERTE</span>}
                </div>
                <span style={{ fontSize: 11, color: "#8a8a9a", lineHeight: 1.5 }}>{sig.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginTop: 10 }}>
        Señales basadas en valores actuales de indicadores · No constituyen recomendación de inversión
      </div>
    </div>
  );
}
