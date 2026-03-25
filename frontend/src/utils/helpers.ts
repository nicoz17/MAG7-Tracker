import type {
  AnalyticsData, CompanyInfo, ExtendedMetrics, FundamentalsData,
  TickerMetrics, DCFInputs, Insight, ScoreRating, TickerScore,
} from "../types";

export function formatDate(d: Date) { return d.toISOString().slice(0, 10); }

export function getDefaultDates() {
  const end = new Date(), start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return { start: formatDate(start), end: formatDate(end) };
}

export const fmtAxis = (v: string) => {
  const d = new Date(v);
  return `${d.toLocaleString("en", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
};

export function corrBg(v: number): string {
  const t = Math.max(0, Math.min(1, v));
  return `rgba(240,194,127,${(t * 0.75).toFixed(2)})`;
}

export function metricColor(val: number | null, good: "high" | "low"): string {
  if (val == null) return "#6b6b7b";
  const positive = good === "high" ? val > 0 : val > -5;
  return positive ? "#4ade80" : val > (good === "high" ? -1 : -15) ? "#f0c27f" : "#f87171";
}

export function betaColor(b: number | null): string {
  if (b == null) return "#6b6b7b";
  return b > 1.3 ? "#f87171" : b < 0.7 ? "#4ade80" : "#f0c27f";
}

export function downloadCSV(filename: string, rows: Record<string, any>[], keys: string[]) {
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => r[k] ?? "").join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: filename,
  });
  a.click();
}

export function generateInsights(
  analytics: AnalyticsData,
  tickers: string[],
  companies: Record<string, CompanyInfo>,
): Insight[] {
  if (tickers.length === 0) return [];
  const m = analytics.metrics;
  const ex = analytics.extended_metrics;
  const b = analytics.beta;
  const corr = analytics.correlation;
  const out: Insight[] = [];

  // 1. Best / worst performer
  const byRet = [...tickers].sort((a, z) => (m[z].total_return ?? -999) - (m[a].total_return ?? -999));
  if (byRet.length >= 2) {
    const best = byRet[0], worst = byRet[byRet.length - 1];
    const bv = m[best].total_return, wv = m[worst].total_return;
    out.push({ type: bv != null && bv > 0 ? "positive" : "warning", icon: "📈",
      text: `Mejor desempeño: ${best} (${bv != null ? (bv > 0 ? "+" : "") + bv.toFixed(1) + "%" : "—"}) · peor: ${worst} (${wv != null ? (wv > 0 ? "+" : "") + wv.toFixed(1) + "%" : "—"})` });
  }

  // 2. Best Sharpe
  const bySharpe = [...tickers].sort((a, z) => (m[z].sharpe ?? -99) - (m[a].sharpe ?? -99));
  if (bySharpe.length > 0) {
    const t = bySharpe[0];
    const s = m[t].sharpe;
    out.push({ type: s != null && s > 1 ? "positive" : "info", icon: "🎯",
      text: `Mejor riesgo/retorno: ${t} con Sharpe ${s?.toFixed(2) ?? "—"} — retorna ${s != null && s > 1 ? "bien" : "moderadamente"} por unidad de riesgo asumido` });
  }

  // 3. Alpha leader
  const alphas = tickers.map(t => ({ t, a: ex[t]?.alpha })).filter(x => x.a != null).sort((a, z) => (z.a ?? 0) - (a.a ?? 0));
  if (alphas.length > 0) {
    const top = alphas[0], bot = alphas[alphas.length - 1];
    out.push({ type: (top.a ?? 0) > 0 ? "positive" : "warning", icon: "💡",
      text: `Mayor alpha vs CAPM: ${top.t} (${(top.a! > 0 ? "+" : "") + top.a!.toFixed(1)}pp) · menor: ${bot.t} (${(bot.a! > 0 ? "+" : "") + bot.a!.toFixed(1)}pp). Alpha mide cuánto retorno no explica el mercado` });
  }

  // 4. Beta extremes
  const betas = tickers.map(t => ({ t, b: b[t] ?? 0 })).sort((a, z) => z.b - a.b);
  if (betas.length >= 2) {
    const hi = betas[0], lo = betas[betas.length - 1];
    out.push({ type: hi.b > 1.5 ? "warning" : "info", icon: "⚡",
      text: `Mayor sensibilidad al mercado: ${hi.t} (β=${hi.b.toFixed(2)}) — si el S&P cae 10%, esperarías ~${(hi.b * 10).toFixed(0)}% de caída. Más defensivo: ${lo.t} (β=${lo.b.toFixed(2)})` });
  }

  // 5. Correlation insight
  if (tickers.length >= 2) {
    let minC = 2, maxC = -2;
    let minP = ["", ""], maxP = ["", ""];
    for (let i = 0; i < tickers.length; i++) {
      for (let j = i + 1; j < tickers.length; j++) {
        const c = corr[tickers[i]]?.[tickers[j]] ?? 0;
        if (c < minC) { minC = c; minP = [tickers[i], tickers[j]]; }
        if (c > maxC) { maxC = c; maxP = [tickers[i], tickers[j]]; }
      }
    }
    out.push({ type: "info", icon: "🔗",
      text: `Par más correlacionado: ${maxP[0]}-${maxP[1]} (${maxC.toFixed(2)}) — poca diversificación entre ellos. Par menos: ${minP[0]}-${minP[1]} (${minC.toFixed(2)}) — mejor complemento en portfolio` });
  }

  // 6. Worst drawdown
  const byDD = [...tickers].sort((a, z) => (m[a].max_drawdown ?? 0) - (m[z].max_drawdown ?? 0));
  if (byDD.length > 0) {
    const t = byDD[0], dd = m[t].max_drawdown;
    out.push({ type: dd != null && dd < -30 ? "negative" : "warning", icon: "📉",
      text: `Mayor caída desde máximo: ${t} con ${dd?.toFixed(1)}%. Calmar ratio: ${ex[t]?.calmar?.toFixed(2) ?? "—"} (retorno anual / máx drawdown)` });
  }

  // 7. Sortino (downside risk)
  const bySortino = tickers.map(t => ({ t, s: ex[t]?.sortino })).filter(x => x.s != null).sort((a, z) => (z.s ?? 0) - (a.s ?? 0));
  if (bySortino.length > 0) {
    const top = bySortino[0];
    out.push({ type: (top.s ?? 0) > 1 ? "positive" : "info", icon: "🛡️",
      text: `Mejor Sortino: ${top.t} (${top.s?.toFixed(2)}) — penaliza solo la volatilidad negativa. Un Sortino alto significa que las subidas son más grandes que las bajadas` });
  }

  return out;
}

export function computeScore(
  m: TickerMetrics,
  ex: ExtendedMetrics | undefined,
  beta: number | null,
  fund: FundamentalsData | null | undefined,
): TickerScore {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const breakdown: { label: string; pts: number; max: number }[] = [];

  // Sharpe  (0-20 pts)
  const sharpe = m.sharpe ?? 0;
  const shPts = clamp(sharpe <= 0 ? 0 : sharpe >= 2 ? 20 : sharpe * 10, 0, 20);
  breakdown.push({ label: "Sharpe", pts: Math.round(shPts), max: 20 });

  // Alpha   (0-20 pts)
  const alpha = ex?.alpha ?? 0;
  const alPts = clamp(alpha <= -10 ? 0 : alpha >= 15 ? 20 : ((alpha + 10) / 25) * 20, 0, 20);
  breakdown.push({ label: "Alpha", pts: Math.round(alPts), max: 20 });

  // Calmar  (0-15 pts)
  const calmar = ex?.calmar ?? 0;
  const caPts = clamp(calmar <= 0 ? 0 : calmar >= 2 ? 15 : calmar * 7.5, 0, 15);
  breakdown.push({ label: "Calmar", pts: Math.round(caPts), max: 15 });

  // Sortino (0-15 pts)
  const sortino = ex?.sortino ?? 0;
  const soPts = clamp(sortino <= 0 ? 0 : sortino >= 2 ? 15 : sortino * 7.5, 0, 15);
  breakdown.push({ label: "Sortino", pts: Math.round(soPts), max: 15 });

  // Max DD  (0-15 pts) — closer to 0 is better
  const dd = m.max_drawdown ?? -100;
  const ddPts = clamp(dd <= -60 ? 0 : dd >= -5 ? 15 : ((dd + 60) / 55) * 15, 0, 15);
  breakdown.push({ label: "Max DD", pts: Math.round(ddPts), max: 15 });

  // Beta    (0-15 pts) — 0.7-1.2 is sweet spot
  const b = beta ?? 1;
  const bPts = b < 0.4 ? 8 : b <= 1.2 ? 15 : b <= 1.8 ? clamp(15 - (b - 1.2) * 12, 0, 15) : 0;
  breakdown.push({ label: "Beta", pts: Math.round(bPts), max: 15 });

  // Fundamentals bonus (0-15 pts, only if loaded)
  if (fund) {
    const pe   = fund.trailing_pe;
    const grow = fund.revenue_growth;
    const margin = fund.profit_margin;
    let fPts = 0;
    if (pe    != null) fPts += pe < 20 ? 5 : pe < 35 ? 3 : pe < 50 ? 1 : 0;
    if (grow  != null) fPts += grow > 0.15 ? 5 : grow > 0.05 ? 3 : grow > 0 ? 1 : 0;
    if (margin!= null) fPts += margin > 0.20 ? 5 : margin > 0.10 ? 3 : margin > 0 ? 1 : 0;
    breakdown.push({ label: "Fundamentals", pts: Math.round(fPts), max: 15 });
  }

  const total = breakdown.reduce((s, x) => s + x.pts, 0);
  const maxTotal = breakdown.reduce((s, x) => s + x.max, 0);
  const pct = total / maxTotal;
  const rating: ScoreRating = pct >= 0.60 ? "buy" : pct >= 0.38 ? "hold" : "sell";
  return { score: Math.round(pct * 100), rating, breakdown };
}

export function defaultDCFInputs(d: FundamentalsData | undefined): DCFInputs {
  if (!d) return { fcf: 0, g1: 15, g2: 8, gTerminal: 2.5, wacc: 10, netDebt: 0, shares: 1 };
  const g1 = d.revenue_growth != null
    ? Math.round(Math.min(Math.max(d.revenue_growth * 100, 0), 50))
    : 15;
  const wacc = d.beta != null
    ? Math.round(Math.min(Math.max(4.5 + d.beta * 5.5, 7), 15) * 10) / 10
    : 10;
  return {
    fcf: d.free_cash_flow ?? 0,
    g1,
    g2: Math.max(Math.round(g1 * 0.5), 3),
    gTerminal: 2.5,
    wacc,
    netDebt: (d.total_debt ?? 0) - (d.total_cash ?? 0),
    shares: d.shares_outstanding ?? 1,
  };
}

export function computeDCF(inp: DCFInputs) {
  const w = inp.wacc / 100, g1r = inp.g1 / 100, g2r = inp.g2 / 100, gTr = inp.gTerminal / 100;
  if (w <= gTr || inp.shares <= 0 || inp.fcf <= 0) return null;
  let fcfPrev = inp.fcf, totalPV = 0;
  const years: { year: number; fcf: number; pv: number }[] = [];
  for (let t = 1; t <= 10; t++) {
    const fcfT = fcfPrev * (1 + (t <= 5 ? g1r : g2r));
    const pv = fcfT / Math.pow(1 + w, t);
    years.push({ year: t, fcf: fcfT, pv });
    totalPV += pv;
    fcfPrev = fcfT;
  }
  const tv = years[9].fcf * (1 + gTr) / (w - gTr);
  const tvPV = tv / Math.pow(1 + w, 10);
  const ev = totalPV + tvPV;
  const equity = ev - inp.netDebt;
  const intrinsic = equity / inp.shares;
  return { years, tv, tvPV, totalPV, ev, equity, intrinsic };
}
