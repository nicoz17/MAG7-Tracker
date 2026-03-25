import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import type { FundamentalsData, CompanyInfo, DCFInputs } from "../types";
import { S } from "../styles";
import { defaultDCFInputs, computeDCF } from "../utils/helpers";

export function DCFModel({ data, tickers, companies }: {
  data: Record<string, FundamentalsData>; tickers: string[]; companies: Record<string, CompanyInfo>;
}) {
  const [active, setActive] = useState(tickers[0] ?? "");
  const [overrides, setOverrides] = useState<Record<string, DCFInputs>>({});

  const getInp = (t: string): DCFInputs => overrides[t] ?? defaultDCFInputs(data[t]);

  const setField = (t: string, field: keyof DCFInputs, val: number) =>
    setOverrides(prev => ({ ...prev, [t]: { ...getInp(t), [field]: val } }));

  const resetTicker = (t: string) =>
    setOverrides(prev => { const n = { ...prev }; delete n[t]; return n; });

  const fmtB = (n: number) => {
    const abs = Math.abs(n), sign = n < 0 ? "−" : "";
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(0)}M`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  if (!tickers.includes(active) && tickers.length > 0) {
    setActive(tickers[0]);
    return null;
  }

  const inp = getInp(active);
  const d = data[active];
  const currentPrice = d?.current_price ?? 0;
  const result = computeDCF(inp);
  const upside = result && currentPrice > 0 ? (result.intrinsic - currentPrice) / currentPrice * 100 : null;
  const upsideColor = upside == null ? "#5a5a7a" : upside > 10 ? "#4ade80" : upside < -10 ? "#fc5c7d" : "#f0c27f";

  const chartData = result
    ? result.years.map(y => ({ name: `Y${y.year}`, pv: parseFloat((y.pv / 1e9).toFixed(1)), fill: y.year <= 5 ? "#f0c27f" : "#fc5c7d" }))
        .concat([{ name: "TV", pv: parseFloat((result.tvPV / 1e9).toFixed(1)), fill: "#a78bfa" }])
    : [];

  const sliderRow = (label: string, field: keyof DCFInputs, min: number, max: number, step: number, fmt?: (v: number) => string) => (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a7a" }}>{label}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#f0c27f", fontWeight: 700 }}>
          {fmt ? fmt(inp[field] as number) : `${inp[field]}%`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={inp[field] as number}
        onChange={e => setField(active, field, parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#f0c27f", cursor: "pointer", height: 4 }} />
    </div>
  );

  const statBox = (label: string, val: string) => (
    <div style={{ padding: "8px 10px", background: "#0a0a14", borderRadius: 4, border: "1px solid #1e1e2e" }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginBottom: 3, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#c0c0d0" }}>{val}</div>
    </div>
  );

  return (
    <div>
      {/* Ticker tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" as const }}>
        {tickers.map(t => (
          <button key={t} onClick={() => setActive(t)} style={{
            padding: "6px 14px", fontFamily: "'Space Mono', monospace", fontSize: 11, cursor: "pointer",
            background: active === t ? (companies[t]?.color ?? "#f0c27f") + "22" : "transparent",
            border: `1px solid ${active === t ? (companies[t]?.color ?? "#f0c27f") : "#2a2a3e"}`,
            color: active === t ? (companies[t]?.color ?? "#f0c27f") : "#5a5a7a", borderRadius: 4,
          }}>{t}</button>
        ))}
        {overrides[active] && (
          <button onClick={() => resetTicker(active)} style={{
            marginLeft: "auto", padding: "6px 12px", fontFamily: "'Space Mono', monospace", fontSize: 10,
            background: "transparent", border: "1px solid #2a2a3e", color: "#5a5a7a", borderRadius: 4, cursor: "pointer",
          }}>↺ Reset supuestos</button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        {/* Left -- Inputs */}
        <div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", textTransform: "uppercase" as const, marginBottom: 14, letterSpacing: 1 }}>
            Supuestos del modelo
          </div>

          {/* FCF Base */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#5a5a7a" }}>FCF Base TTM</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#f0c27f", fontWeight: 700 }}>{fmtB(inp.fcf)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" value={parseFloat((inp.fcf / 1e9).toFixed(2))}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setField(active, "fcf", v * 1e9); }}
                style={{ ...S.input, padding: "5px 8px", fontSize: 11, width: "100%", boxSizing: "border-box" as const }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", whiteSpace: "nowrap" as const }}>USD B</span>
            </div>
          </div>

          {sliderRow("Crecimiento FCF · Años 1–5", "g1", -10, 60, 1)}
          {sliderRow("Crecimiento FCF · Años 6–10", "g2", -10, 40, 1)}
          {sliderRow("Crecimiento Terminal", "gTerminal", 0, 5, 0.5)}
          {sliderRow("WACC · Tasa de descuento", "wacc", 5, 20, 0.5)}

          <div style={{ marginTop: 6, padding: "10px 12px", background: "#0a0a14", borderRadius: 4, border: "1px solid #1e1e2e" }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginBottom: 4, textTransform: "uppercase" as const }}>Deuda Neta</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: inp.netDebt < 0 ? "#4ade80" : "#fc5c7d" }}>
              {inp.netDebt < 0 ? `Caja neta ${fmtB(Math.abs(inp.netDebt))}` : fmtB(inp.netDebt)}
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginTop: 2 }}>
              {fmtB(d?.total_debt ?? 0)} deuda · {fmtB(d?.total_cash ?? 0)} caja
            </div>
          </div>
        </div>

        {/* Right -- Results */}
        <div>
          {result ? (
            <>
              <div style={{ textAlign: "center", padding: "18px 0 16px", borderBottom: "1px solid #1e1e2e", marginBottom: 16 }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  Valor Intrínseco Estimado · {active}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 40, fontWeight: 700, color: "#f0c27f", letterSpacing: -1, lineHeight: 1 }}>
                  ${result.intrinsic.toFixed(2)}
                </div>
                {currentPrice > 0 && upside != null && (
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: upsideColor, fontWeight: 700 }}>
                      {upside > 0 ? "▲" : "▼"} {Math.abs(upside).toFixed(1)}% {upside > 0 ? "potencial upside" : "sobrevaluado"}
                    </span>
                    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#3a3a4a", marginTop: 4 }}>
                      precio actual ${currentPrice.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {statBox("Enterprise Value", fmtB(result.ev))}
                {statBox("Equity Value", fmtB(result.equity))}
                {statBox("PV FCFs (1–10)", fmtB(result.totalPV))}
                {statBox("PV Terminal", fmtB(result.tvPV))}
                {statBox("TV / EV", `${(result.tvPV / result.ev * 100).toFixed(0)}%`)}
                {statBox("Acciones", `${(inp.shares / 1e9).toFixed(2)}B`)}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 20px", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#3a3a4a", lineHeight: 1.8 }}>
              {inp.fcf <= 0
                ? "FCF negativo · ajusta el FCF base para proyectar"
                : "WACC debe ser mayor al crecimiento terminal"}
            </div>
          )}
        </div>
      </div>

      {/* Bar chart */}
      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#3a3a4a", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            Valor presente por período (B USD) ·{" "}
            <span style={{ color: "#f0c27f" }}>Años 1–5</span> ·{" "}
            <span style={{ color: "#fc5c7d" }}>Años 6–10</span> ·{" "}
            <span style={{ color: "#a78bfa" }}>Valor Terminal</span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chartData} margin={{ top: 4, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} />
              <YAxis tick={{ fontSize: 9, fontFamily: "'Space Mono', monospace", fill: "#5a5a6a" }} tickFormatter={v => `$${v}B`} />
              <Tooltip formatter={(v: number) => [`$${v}B`, "VP"]}
                contentStyle={{ background: "#0f0f1a", border: "1px solid #2a2a3e", fontFamily: "'Space Mono', monospace", fontSize: 10 }} />
              <Bar dataKey="pv" radius={[3, 3, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#2a2a3e", marginTop: 12, lineHeight: 1.7 }}>
        Modelo DCF 2 etapas · 10 años + Valor Terminal · EV = Σ PV(FCF) + PV(TV) · Equity = EV − Deuda Neta ·
        Supuestos por defecto: FCF TTM de Yahoo Finance, WACC ≈ rf(4.5%) + β×5.5%, g1 ≈ crecimiento revenue TTM ·
        Solo orientativo — no constituye asesoramiento de inversión.
      </div>
    </div>
  );
}
