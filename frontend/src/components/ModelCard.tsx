import React from "react";
import type { FcstModel } from "../types";
import { MODEL_INFO } from "../constants";

export function ModelCard({ model, active }: { model: FcstModel; active: boolean }) {
  const m = MODEL_INFO[model];
  return (
    <div style={{
      flex: 1, minWidth: 200, background: active ? "#16161f" : "#0e0e16",
      border: `1.5px solid ${active ? "#f0c27f" : "#1e1e2e"}`,
      borderRadius: 12, padding: "16px 18px", transition: "all 0.2s",
    }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: active ? "#f0c27f" : "#5a5a6a", marginBottom: 6, letterSpacing: "0.5px" }}>
        {m.title}
      </div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: active ? "#a0a0b0" : "#3a3a4a", background: "#0a0a0f", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
        {m.formula}
      </div>
      <div style={{ fontSize: 11, color: active ? "#8a8a9a" : "#3a3a4a", lineHeight: 1.6, marginBottom: 8 }}>
        {m.desc}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#4ade80", background: "#4ade8010", border: "1px solid #4ade8030", borderRadius: 4, padding: "2px 8px" }}>
          ✓ {m.pro}
        </span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#f87171", background: "#f8717110", border: "1px solid #f8717130", borderRadius: 4, padding: "2px 8px" }}>
          ✗ {m.con}
        </span>
      </div>
    </div>
  );
}
