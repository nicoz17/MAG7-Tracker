import React from "react";
import type { NewsData } from "../types";
import { S } from "../styles";

export function NewsPanel({ data }: { data: NewsData }) {
  const { sentiment, articles, ticker } = data;

  const SENT_META = {
    bullish: { emoji: "📈", label: "Bullish", color: "#4ade80", bg: "rgba(74,222,128,0.08)" },
    bearish: { emoji: "📉", label: "Bearish", color: "#f87171", bg: "rgba(248,113,113,0.08)" },
    neutral: { emoji: "➡️",  label: "Neutral", color: "#f0c27f", bg: "rgba(240,194,127,0.08)" },
  };

  const sentKey = sentiment ? (sentiment.sentiment.toLowerCase() as "bullish" | "bearish" | "neutral") : null;
  const meta = sentKey ? SENT_META[sentKey] ?? SENT_META.neutral : null;

  const fmtDate = (s: string | number) => {
    try {
      const d = typeof s === "number" ? new Date(s * 1000) : new Date(s);
      return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
    } catch { return String(s); }
  };

  const scoreColor = (v: number) => v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#f0c27f";
  const scoreLabel = (v: number) => v > 0 ? "▲ Bullish" : v < 0 ? "▼ Bearish" : "— Neutral";

  return (
    <div style={{ ...S.card, padding: "20px 24px", marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ ...S.cardTitle, marginBottom: 0, paddingLeft: 0 }}>
          NOTICIAS & SENTIMIENTO IA · {ticker}
        </div>
        {meta && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: meta.bg, border: `1.5px solid ${meta.color}40`, borderRadius: 10, padding: "8px 16px" }}>
            <span style={{ fontSize: 18 }}>{meta.emoji}</span>
            <div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: meta.color }}>
                {meta.label.toUpperCase()}
              </div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#5a5a6a" }}>
                Score: {sentiment!.score > 0 ? "+" : ""}{sentiment!.score}/10
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      {sentiment && (
        <>
          <div style={{ background: "#0e0e16", borderRadius: 10, padding: "14px 16px", marginBottom: 14, borderLeft: `3px solid ${meta!.color}` }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", letterSpacing: "1px", marginBottom: 6 }}>ANÁLISIS IA (Claude)</div>
            <p style={{ fontSize: 13, color: "#c8c8d8", lineHeight: 1.7, margin: 0 }}>{sentiment.analysis}</p>
          </div>

          {sentiment.themes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 14 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a", letterSpacing: "1px", alignSelf: "center" }}>TEMAS:</span>
              {sentiment.themes.map(theme => (
                <span key={theme} style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: meta!.color, background: meta!.bg, border: `1px solid ${meta!.color}30`, borderRadius: 5, padding: "3px 10px" }}>
                  {theme}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Articles */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {articles.map((art, i) => {
          const artScore = sentiment?.article_scores?.[i] ?? null;
          return (
            <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", background: "#0e0e16", borderRadius: 8, alignItems: "flex-start", borderLeft: artScore != null ? `3px solid ${scoreColor(artScore)}` : "3px solid #1e1e2e" }}>
              {art.thumbnail && (
                <img src={art.thumbnail} alt="" style={{ width: 60, height: 44, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={art.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#e8e6e3", textDecoration: "none", lineHeight: 1.4, display: "block", marginBottom: 4 }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = "#f0c27f"}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = "#e8e6e3"}>
                  {art.title}
                </a>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a6a" }}>{art.publisher}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a" }}>·</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a" }}>{fmtDate(art.published_at)}</span>
                  {artScore != null && (
                    <>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a" }}>·</span>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: scoreColor(artScore), fontWeight: 700 }}>
                        {scoreLabel(artScore)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginTop: 12 }}>
        Fuente: Yahoo Finance News · Análisis de sentimiento: Claude Opus · Score: −10 (muy bajista) → +10 (muy alcista) · Caché 30 min
      </div>
    </div>
  );
}
