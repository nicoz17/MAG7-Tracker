import React from "react";

export const S = {
  container:   { maxWidth: 1200, margin: "0 auto", padding: "32px 24px" } as React.CSSProperties,
  header:      { marginBottom: 32 } as React.CSSProperties,
  title: {
    fontFamily: "'Space Mono', monospace", fontSize: 42, fontWeight: 700, margin: 0,
    letterSpacing: "-1px",
    background: "linear-gradient(135deg, #f0c27f 0%, #fc5c7d 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  } as React.CSSProperties,
  subtitle: {
    fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#6b6b7b",
    marginTop: 6, letterSpacing: "2px", textTransform: "uppercase" as const,
  } as React.CSSProperties,
  modeSwitcher: {
    display: "flex", background: "#16161f", borderRadius: 12,
    padding: 4, width: "fit-content", marginTop: 24, marginBottom: 32, flexWrap: "wrap" as const, gap: 2,
  } as React.CSSProperties,
  modeTab: (active: boolean) => ({
    background: active ? "linear-gradient(135deg, #f0c27f 0%, #fc5c7d 100%)" : "transparent",
    color: active ? "#0a0a0f" : "#6b6b7b", border: "none", borderRadius: 9,
    padding: "10px 22px", fontFamily: "'Space Mono', monospace", fontSize: 11,
    fontWeight: active ? 700 : 400, cursor: "pointer",
    letterSpacing: "1px", textTransform: "uppercase" as const, transition: "all 0.2s",
  } as React.CSSProperties),
  row: {
    display: "flex", gap: 20, flexWrap: "wrap" as const,
    alignItems: "flex-end", marginBottom: 28,
  } as React.CSSProperties,
  fg:  { display: "flex", flexDirection: "column" as const, gap: 6 } as React.CSSProperties,
  lbl: {
    fontFamily: "'Space Mono', monospace", fontSize: 10,
    letterSpacing: "1.5px", textTransform: "uppercase" as const, color: "#6b6b7b",
  } as React.CSSProperties,
  input: {
    background: "#16161f", border: "1px solid #2a2a3a", borderRadius: 8,
    padding: "10px 14px", color: "#e8e6e3",
    fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none",
  } as React.CSSProperties,
  chips: { display: "flex", gap: 10, flexWrap: "wrap" as const, marginBottom: 28 } as React.CSSProperties,
  btn: {
    background: "linear-gradient(135deg, #f0c27f 0%, #fc5c7d 100%)",
    border: "none", borderRadius: 10, padding: "12px 32px", color: "#0a0a0f",
    fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
    letterSpacing: "1px", textTransform: "uppercase" as const, cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: "0 4px 20px rgba(252,92,125,0.25)",
  } as React.CSSProperties,
  card: {
    background: "#12121a", border: "1px solid #1e1e2e", borderRadius: 16,
    padding: "24px 20px 16px 8px", marginBottom: 16,
  } as React.CSSProperties,
  cardTitle: {
    fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: "1px",
    color: "#8a8a9a", marginBottom: 12, paddingLeft: 20,
  } as React.CSSProperties,
  toggle: {
    display: "flex", gap: 4, background: "#16161f",
    borderRadius: 10, padding: 4, width: "fit-content",
  } as React.CSSProperties,
  tBtn: (active: boolean) => ({
    background: active ? "linear-gradient(135deg, #f0c27f 0%, #fc5c7d 100%)" : "transparent",
    color: active ? "#0a0a0f" : "#6b6b7b", border: "none", borderRadius: 8,
    padding: "8px 18px", fontFamily: "'Space Mono', monospace", fontSize: 11,
    fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.2s",
  } as React.CSSProperties),
  iBtn: (active: boolean, color: string) => ({
    background: active ? `${color}22` : "transparent",
    border: `1.5px solid ${active ? color : "#2a2a3a"}`,
    borderRadius: 8, padding: "6px 14px", color: active ? color : "#5a5a6a",
    fontFamily: "'Space Mono', monospace", fontSize: 11, cursor: "pointer", transition: "all 0.2s",
  } as React.CSSProperties),
  spinner: {
    display: "flex", alignItems: "center", justifyContent: "center", height: 300,
    fontFamily: "'Space Mono', monospace", color: "#6b6b7b", fontSize: 14,
  } as React.CSSProperties,
  err: {
    background: "rgba(252,92,125,0.08)", border: "1px solid rgba(252,92,125,0.25)",
    borderRadius: 10, padding: "14px 20px", color: "#fc5c7d",
    fontFamily: "'Space Mono', monospace", fontSize: 12, marginBottom: 20,
  } as React.CSSProperties,
  empty: {
    display: "flex", flexDirection: "column" as const,
    alignItems: "center", justifyContent: "center", height: 300,
    gap: 12, color: "#3a3a4a",
  } as React.CSSProperties,
  info: {
    background: "#12121a", border: "1px solid #1e1e2e", borderRadius: 12,
    padding: "14px 20px", marginBottom: 20,
    fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6b6b7b", lineHeight: 1.7,
  } as React.CSSProperties,
  footer: {
    textAlign: "center" as const, padding: "32px 0 16px",
    fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", letterSpacing: "1.5px",
  } as React.CSSProperties,
};

export const hover = {
  onMouseOver: (e: any) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 8px 30px rgba(252,92,125,0.35)"; },
  onMouseOut:  (e: any) => { e.target.style.transform = ""; e.target.style.boxShadow = "0 4px 20px rgba(252,92,125,0.25)"; },
};
