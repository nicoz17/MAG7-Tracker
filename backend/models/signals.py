"""
Technical signal computation from indicator lists.
"""


def _compute_signals(
    close_list: list,
    rsi_list: list,
    macd_line_list: list,
    macd_signal_list: list,
    sma50_list: list,
    sma200_list: list,
    bb_upper_list: list,
    bb_lower_list: list,
) -> list[dict]:
    """Derive automatic technical signals from pre-computed indicator lists."""

    def lv(lst: list):
        """Return last non-None value in list, or None if all are None."""
        for v in reversed(lst):
            if v is not None:
                return v
        return None

    signals: list[dict] = []

    # -- 1. RSI --
    rsi_val = lv(rsi_list)
    if rsi_val is not None:
        if rsi_val < 30:
            signals.append({
                "indicator": "RSI",
                "type": "bullish",
                "strength": "strong",
                "icon": "\U0001f4c8",
                "title": "RSI Sobreventa",
                "detail": f"RSI en {rsi_val:.1f} \u2014 zona de sobreventa extrema (<30)",
            })
        elif rsi_val < 40:
            signals.append({
                "indicator": "RSI",
                "type": "bullish",
                "strength": "weak",
                "icon": "\U0001f4c8",
                "title": "RSI Zona Baja",
                "detail": f"RSI en {rsi_val:.1f} \u2014 zona baja (30-40)",
            })
        elif rsi_val > 70:
            signals.append({
                "indicator": "RSI",
                "type": "bearish",
                "strength": "strong",
                "icon": "\U0001f4c9",
                "title": "RSI Sobrecompra",
                "detail": f"RSI en {rsi_val:.1f} \u2014 zona de sobrecompra extrema (>70)",
            })
        elif rsi_val > 60:
            signals.append({
                "indicator": "RSI",
                "type": "bearish",
                "strength": "weak",
                "icon": "\U0001f4c9",
                "title": "RSI Zona Alta",
                "detail": f"RSI en {rsi_val:.1f} \u2014 zona alta (60-70)",
            })
        else:
            signals.append({
                "indicator": "RSI",
                "type": "neutral",
                "strength": "neutral",
                "icon": "\u27a1\ufe0f",
                "title": "RSI Neutral",
                "detail": f"RSI en {rsi_val:.1f} \u2014 zona neutra (40-60)",
            })

    # -- 2. MACD crossover --
    macd_pairs: list[tuple[float, float]] = []
    for m, s in zip(reversed(macd_line_list), reversed(macd_signal_list)):
        if m is not None and s is not None:
            macd_pairs.append((m, s))
            if len(macd_pairs) == 2:
                break
    if len(macd_pairs) == 2:
        curr_diff = macd_pairs[0][0] - macd_pairs[0][1]
        prev_diff = macd_pairs[1][0] - macd_pairs[1][1]
        if prev_diff <= 0 and curr_diff > 0:
            signals.append({
                "indicator": "MACD",
                "type": "bullish",
                "strength": "strong",
                "icon": "\U0001f4c8",
                "title": "MACD Cruce Alcista",
                "detail": "La l\u00ednea MACD cruz\u00f3 por encima de la se\u00f1al (cruce alcista)",
            })
        elif prev_diff >= 0 and curr_diff < 0:
            signals.append({
                "indicator": "MACD",
                "type": "bearish",
                "strength": "strong",
                "icon": "\U0001f4c9",
                "title": "MACD Cruce Bajista",
                "detail": "La l\u00ednea MACD cruz\u00f3 por debajo de la se\u00f1al (cruce bajista)",
            })
        elif curr_diff > 0:
            signals.append({
                "indicator": "MACD",
                "type": "bullish",
                "strength": "weak",
                "icon": "\U0001f4c8",
                "title": "MACD Positivo",
                "detail": f"MACD por encima de la se\u00f1al (+{curr_diff:.4f})",
            })
        else:
            signals.append({
                "indicator": "MACD",
                "type": "bearish",
                "strength": "weak",
                "icon": "\U0001f4c9",
                "title": "MACD Negativo",
                "detail": f"MACD por debajo de la se\u00f1al ({curr_diff:.4f})",
            })

    # -- 3. SMA50/200 cross --
    sma_pairs: list[tuple[int, float, float]] = []
    for i in range(len(sma50_list) - 1, -1, -1):
        s50 = sma50_list[i]
        s200 = sma200_list[i]
        if s50 is not None and s200 is not None:
            sma_pairs.append((i, s50, s200))
            if len(sma_pairs) == 15:
                break

    if len(sma_pairs) >= 2:
        curr_above = sma_pairs[0][1] > sma_pairs[0][2]
        golden_cross_days: int | None = None
        death_cross_days: int | None = None
        for k in range(1, len(sma_pairs)):
            prev_above = sma_pairs[k][1] > sma_pairs[k][2]
            if not prev_above and curr_above:
                golden_cross_days = sma_pairs[0][0] - sma_pairs[k][0]
                break
            elif prev_above and not curr_above:
                death_cross_days = sma_pairs[0][0] - sma_pairs[k][0]
                break
            curr_above = prev_above

        curr_s50 = sma_pairs[0][1]
        curr_s200 = sma_pairs[0][2]
        pct_diff = (curr_s50 / curr_s200 - 1) * 100

        if golden_cross_days is not None:
            signals.append({
                "indicator": "SMA",
                "type": "bullish",
                "strength": "strong",
                "icon": "\u2b50",
                "title": f"Golden Cross (hace {golden_cross_days}d)",
                "detail": f"SMA50 cruz\u00f3 por encima de SMA200 hace {golden_cross_days} d\u00edas",
            })
        elif death_cross_days is not None:
            signals.append({
                "indicator": "SMA",
                "type": "bearish",
                "strength": "strong",
                "icon": "\U0001f480",
                "title": f"Death Cross (hace {death_cross_days}d)",
                "detail": f"SMA50 cruz\u00f3 por debajo de SMA200 hace {death_cross_days} d\u00edas",
            })
        elif curr_s50 > curr_s200:
            signals.append({
                "indicator": "SMA",
                "type": "bullish",
                "strength": "weak",
                "icon": "\U0001f4c8",
                "title": f"SMA50 > SMA200 (+{pct_diff:.1f}%)",
                "detail": f"SMA50 ({curr_s50:.2f}) est\u00e1 {pct_diff:.1f}% por encima de SMA200 ({curr_s200:.2f})",
            })
        else:
            signals.append({
                "indicator": "SMA",
                "type": "bearish",
                "strength": "weak",
                "icon": "\U0001f4c9",
                "title": f"SMA50 < SMA200 ({pct_diff:.1f}%)",
                "detail": f"SMA50 ({curr_s50:.2f}) est\u00e1 {abs(pct_diff):.1f}% por debajo de SMA200 ({curr_s200:.2f})",
            })

    # -- 4. Bollinger Bands --
    close_val = lv(close_list)
    bb_upper_val = lv(bb_upper_list)
    bb_lower_val = lv(bb_lower_list)
    if close_val is not None and bb_upper_val is not None and bb_lower_val is not None:
        band_width = bb_upper_val - bb_lower_val
        if band_width > 0:
            bb_pct = (close_val - bb_lower_val) / band_width
            if bb_pct > 0.95:
                signals.append({
                    "indicator": "BB",
                    "type": "bearish",
                    "strength": "strong",
                    "icon": "\U0001f4c9",
                    "title": "Precio en Banda Superior BB",
                    "detail": f"Precio ({close_val:.2f}) cerca de la banda superior de Bollinger ({bb_upper_val:.2f})",
                })
            elif bb_pct < 0.05:
                signals.append({
                    "indicator": "BB",
                    "type": "bullish",
                    "strength": "strong",
                    "icon": "\U0001f4c8",
                    "title": "Precio en Banda Inferior BB",
                    "detail": f"Precio ({close_val:.2f}) cerca de la banda inferior de Bollinger ({bb_lower_val:.2f})",
                })

    # -- 5. Trend vs SMA200 --
    sma200_val = lv(sma200_list)
    if close_val is not None and sma200_val is not None and sma200_val > 0:
        pct_vs_sma200 = (close_val / sma200_val - 1) * 100
        if pct_vs_sma200 < -10:
            signals.append({
                "indicator": "Trend",
                "type": "bearish",
                "strength": "strong",
                "icon": "\U0001f4c9",
                "title": f"Precio {abs(pct_vs_sma200):.1f}% bajo SMA200",
                "detail": f"Precio ({close_val:.2f}) est\u00e1 {abs(pct_vs_sma200):.1f}% por debajo de SMA200 ({sma200_val:.2f})",
            })
        elif pct_vs_sma200 > 25:
            signals.append({
                "indicator": "Trend",
                "type": "bearish",
                "strength": "weak",
                "icon": "\u26a0\ufe0f",
                "title": f"Precio {pct_vs_sma200:.1f}% sobre SMA200",
                "detail": f"Precio ({close_val:.2f}) est\u00e1 {pct_vs_sma200:.1f}% por encima de SMA200 ({sma200_val:.2f}) \u2014 posible sobreextensi\u00f3n",
            })

    return signals
