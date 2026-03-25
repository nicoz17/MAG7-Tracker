"""
/api/news and /api/ai_summary endpoints.
"""

from datetime import date, datetime, timedelta, timezone
import numpy as np
import pandas as pd
from fastapi import APIRouter, Query, HTTPException

from config import MAGNIFICENT_7
from yahoo import _SESSION, _yahoo_history, _get_ticker_fundamentals, _yahoo_earnings

router = APIRouter()

# ---- News cache ----
_NEWS_CACHE: dict[str, dict] = {}
_NEWS_CACHE_TTL = 1800  # 30 minutes


def _fetch_yahoo_news(ticker: str) -> list[dict]:
    """Fetch latest news headlines from Yahoo Finance search API."""
    url = "https://query1.finance.yahoo.com/v1/finance/search"
    params = {"q": ticker, "newsCount": 8, "quotesCount": 0, "enableFuzzyQuery": "false"}
    try:
        resp = _SESSION.get(url, params=params, timeout=10)
        if not resp.ok:
            return []
        items = resp.json().get("news", [])
        articles = []
        for item in items:
            ts = item.get("providerPublishTime", 0)
            articles.append({
                "title":        item.get("title", ""),
                "publisher":    item.get("publisher", ""),
                "published_at": ts,
                "url":          item.get("link", ""),
                "thumbnail":    (item.get("thumbnail", {}).get("resolutions") or [{}])[0].get("url", ""),
            })
        return articles
    except Exception:
        return []


def _analyze_news_sentiment(articles: list[dict], ticker: str, company: str) -> dict | None:
    """Use Claude to classify sentiment of news articles about a stock."""
    import os, json, re
    try:
        import anthropic
    except ImportError:
        return None

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or not articles:
        return None

    client = anthropic.Anthropic(api_key=api_key)
    headlines = "\n".join(
        f"{i+1}. [{a['publisher']}] {a['title']}"
        for i, a in enumerate(articles)
    )

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                f"Analiza estas {len(articles)} noticias recientes sobre {ticker} ({company}) "
                f"desde la perspectiva de un inversor. Responde SOLO con JSON v\u00e1lido, sin texto extra:\n\n"
                f"{{\n"
                f'  "sentiment": "Bullish|Neutral|Bearish",\n'
                f'  "score": <entero de -10 a +10>,\n'
                f'  "themes": ["tema corto 1", "tema corto 2", "tema corto 3"],\n'
                f'  "analysis": "<2-3 oraciones en espa\u00f1ol: qu\u00e9 implica este flujo de noticias para el inversor>",\n'
                f'  "article_scores": [<un entero -1, 0 o 1 por cada noticia en orden>]\n'
                f"}}\n\n"
                f"Noticias:\n{headlines}"
            ),
        }],
    )

    text = next((b.text for b in message.content if b.type == "text"), "")
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return None


@router.get("/api/news")
def get_news(ticker: str = Query(..., description="Single ticker symbol")):
    """Fetch latest news + Claude sentiment analysis for a MAG7 stock."""
    ticker = ticker.strip().upper()
    if ticker not in MAGNIFICENT_7:
        raise HTTPException(400, f"Invalid ticker: {ticker}")

    # Cache check
    cached = _NEWS_CACHE.get(ticker)
    if cached and (datetime.now(timezone.utc).timestamp() - cached["ts"] < _NEWS_CACHE_TTL):
        return cached["data"]

    articles = _fetch_yahoo_news(ticker)
    company   = MAGNIFICENT_7[ticker]["name"]

    result = {
        "ticker":    ticker,
        "company":   company,
        "articles":  articles,
        "sentiment": None,
    }
    _NEWS_CACHE[ticker] = {"ts": datetime.now(timezone.utc).timestamp(), "data": result}
    return result


# ---- AI Summary ----
_AI_SUMMARY_CACHE: dict = {}
_AI_SUMMARY_CACHE_TTL = 300  # 5 min


@router.get("/api/ai_summary")
def get_ai_summary(
    ticker: str = Query(..., description="MAG7 ticker"),
    start:  str = Query(..., description="Chart start date YYYY-MM-DD"),
    end:    str = Query(..., description="Chart end date YYYY-MM-DD"),
):
    """Generate a 3-4 line AI analysis combining price, technicals and fundamentals."""
    import os, json as _json

    t = ticker.strip().upper()
    if t not in MAGNIFICENT_7:
        raise HTTPException(400, f"Invalid ticker: {t}")

    try:
        start_dt = date.fromisoformat(start)
        end_dt   = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(400, "Dates must be YYYY-MM-DD")

    # Check cache
    cache_key = f"{t}:{start}:{end}"
    cached = _AI_SUMMARY_CACHE.get(cache_key)
    if cached and (datetime.now(timezone.utc).timestamp() - cached["ts"] < _AI_SUMMARY_CACHE_TTL):
        return cached["data"]

    # -- Gather data --
    buffer = start_dt - timedelta(days=250)
    try:
        ohlcv = _yahoo_history(t, buffer, end_dt)
    except HTTPException:
        raise HTTPException(502, "No se pudo obtener datos de precio")

    ohlcv.index = pd.to_datetime(ohlcv.index).normalize()
    ohlcv = ohlcv[~ohlcv.index.duplicated(keep="last")]
    price = ohlcv["close"].dropna()
    mask  = price.index >= pd.Timestamp(start_dt)
    price_win = price.loc[mask]

    if len(price_win) < 5:
        raise HTTPException(404, "Datos insuficientes para el rango seleccionado")

    current_price = float(price_win.iloc[-1])
    first_price   = float(price_win.iloc[0])
    period_return = round((current_price / first_price - 1) * 100, 1)

    # RSI(14)
    delta    = price.diff()
    avg_gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    avg_loss = (-delta).clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    rs       = avg_gain / avg_loss.replace(0, np.nan)
    rsi_ser  = (100 - 100 / (1 + rs)).loc[mask]
    rsi_val  = float(rsi_ser.dropna().iloc[-1]) if not rsi_ser.dropna().empty else None

    # MACD(12,26,9)
    ema12        = price.ewm(span=12, adjust=False).mean()
    ema26        = price.ewm(span=26, adjust=False).mean()
    macd_line    = (ema12 - ema26).loc[mask]
    macd_signal  = macd_line.ewm(span=9, adjust=False).mean()
    macd_diff    = (macd_line - macd_signal).dropna()
    macd_val     = float(macd_diff.iloc[-1]) if not macd_diff.empty else None

    # SMA50 / SMA200 vs price
    sma50_ser  = price.rolling(50).mean().loc[mask]
    sma200_ser = price.rolling(200).mean().loc[mask]
    sma50_last  = float(sma50_ser.dropna().iloc[-1]) if not sma50_ser.dropna().empty else None
    sma200_last = float(sma200_ser.dropna().iloc[-1]) if not sma200_ser.dropna().empty else None

    # Bollinger Bands(20, 2)
    sma20    = price.rolling(20).mean().loc[mask]
    bb_std   = price.rolling(20).std().loc[mask]
    bb_upper = sma20 + 2 * bb_std
    bb_lower = sma20 - 2 * bb_std
    bb_pct   = None
    if not bb_upper.dropna().empty and not bb_lower.dropna().empty:
        u = float(bb_upper.dropna().iloc[-1])
        l = float(bb_lower.dropna().iloc[-1])
        if u > l:
            bb_pct = round((current_price - l) / (u - l) * 100, 0)

    # Fundamentals
    fund = _get_ticker_fundamentals(t)

    # Last earnings surprise
    earn = _yahoo_earnings(t, start_dt - timedelta(days=365), end_dt)
    last_earn_surprise = None
    for e in reversed(earn):
        if e.get("eps_surprise") is not None:
            last_earn_surprise = e["eps_surprise"]
            break

    # -- Build rule-based summary (no external API) --
    company = MAGNIFICENT_7[t]["name"]

    # --- Sentence 1: Technical trend & momentum ---
    trend_parts = []

    if period_return > 15:
        trend_parts.append(f"{t} acumula una ganancia de {period_return:+.1f}% en el per\u00edodo, mostrando una tendencia alcista s\u00f3lida")
    elif period_return > 0:
        trend_parts.append(f"{t} registra un avance de {period_return:+.1f}% en el per\u00edodo con momentum moderadamente positivo")
    elif period_return > -15:
        trend_parts.append(f"{t} cede {period_return:.1f}% en el per\u00edodo, mostrando presi\u00f3n vendedora")
    else:
        trend_parts.append(f"{t} retrocede {period_return:.1f}% en el per\u00edodo en una correcci\u00f3n significativa")

    if sma200_last:
        if current_price > sma200_last * 1.05:
            trend_parts.append(f"el precio cotiza un {((current_price/sma200_last)-1)*100:.1f}% por encima de la SMA200 confirmando tendencia de largo plazo alcista")
        elif current_price > sma200_last:
            trend_parts.append("el precio se mantiene sobre la SMA200, preservando la tendencia de largo plazo")
        else:
            trend_parts.append(f"el precio ha perforado la SMA200 ({sma200_last:.2f}), se\u00f1al de alerta para la tendencia de largo plazo")

    if rsi_val is not None:
        if rsi_val > 70:
            trend_parts.append(f"el RSI en {rsi_val:.0f} indica sobrecompra, sugiriendo posible consolidaci\u00f3n a corto plazo")
        elif rsi_val < 30:
            trend_parts.append(f"el RSI en {rsi_val:.0f} se\u00f1ala sobreventa, lo que puede generar un rebote t\u00e9cnico")
        elif rsi_val > 60:
            trend_parts.append(f"el RSI en {rsi_val:.0f} refleja momentum positivo sin sobrecompra extrema")
        elif rsi_val < 40:
            trend_parts.append(f"el RSI en {rsi_val:.0f} muestra momentum d\u00e9bil")

    if macd_val is not None:
        if macd_val > 0:
            trend_parts.append("el MACD permanece en terreno positivo apoyando el sesgo alcista")
        else:
            trend_parts.append("el MACD en negativo a\u00f1ade presi\u00f3n bajista al momentum")

    sent1 = "; ".join(trend_parts[:3]) + "." if trend_parts else ""

    # --- Sentence 2: Valuation & fundamentals ---
    fund_parts = []
    tpe = fund.get("trailing_pe")
    fpe = fund.get("forward_pe")
    rev_g = fund.get("revenue_growth")
    margin = fund.get("profit_margin")
    roe_v  = fund.get("roe")

    if tpe and fpe:
        if fpe < tpe * 0.85:
            fund_parts.append(f"la valuaci\u00f3n mejora visiblemente (P/E trailing {tpe:.0f}x \u2192 forward {fpe:.0f}x), reflejando expectativas de crecimiento de utilidades")
        elif fpe > tpe * 1.1:
            fund_parts.append(f"el mercado descuenta cierta compresi\u00f3n de ganancias (P/E trailing {tpe:.0f}x vs. forward {fpe:.0f}x)")
        else:
            fund_parts.append(f"la valuaci\u00f3n se mantiene estable con P/E trailing {tpe:.0f}x y forward {fpe:.0f}x")
    elif tpe:
        mag = "elevado" if tpe > 35 else ("moderado" if tpe > 20 else "atractivo")
        fund_parts.append(f"cotiza a un P/E de {tpe:.0f}x, nivel {mag} para el sector tecnol\u00f3gico")

    if rev_g is not None:
        pct = rev_g * 100
        if pct > 15:
            fund_parts.append(f"el crecimiento de ingresos del {pct:.0f}% anual justifica parcialmente la prima de valuaci\u00f3n")
        elif pct > 0:
            fund_parts.append(f"los ingresos crecen a un ritmo moderado del {pct:.0f}%")
        else:
            fund_parts.append(f"los ingresos muestran contracci\u00f3n del {pct:.0f}%, factor de riesgo a monitorear")

    if margin is not None:
        pct = margin * 100
        if pct > 25:
            fund_parts.append(f"el margen neto del {pct:.0f}% destaca como uno de los m\u00e1s altos del sector")
        elif pct > 10:
            fund_parts.append(f"margen neto del {pct:.0f}%")

    if roe_v is not None:
        pct = roe_v * 100
        if pct > 30:
            fund_parts.append(f"ROE del {pct:.0f}% refleja alta eficiencia en el uso del capital")

    if last_earn_surprise is not None:
        if last_earn_surprise > 5:
            fund_parts.append(f"el \u00faltimo reporte de resultados super\u00f3 las estimaciones en un {last_earn_surprise:.1f}%")
        elif last_earn_surprise < -5:
            fund_parts.append(f"el \u00faltimo reporte decepcion\u00f3 las expectativas en un {abs(last_earn_surprise):.1f}%")

    sent2 = ("En t\u00e9rminos fundamentales, " + "; ".join(fund_parts[:3]) + ".") if fund_parts else ""

    # --- Sentence 3: Risks / catalysts ---
    risk_parts = []

    if bb_pct is not None:
        if bb_pct > 85:
            risk_parts.append("el precio se encuentra en la banda superior de Bollinger, zona de posible resistencia o toma de ganancias")
        elif bb_pct < 15:
            risk_parts.append("el precio toca la banda inferior de Bollinger, nivel t\u00e9cnico de soporte clave")

    if sma50_last and sma200_last:
        gap = (sma50_last / sma200_last - 1) * 100
        if sma50_last > sma200_last and gap < 2:
            risk_parts.append("la SMA50 apenas supera la SMA200 (golden cross reciente o inminente), se\u00f1al positiva pero a\u00fan fr\u00e1gil")
        elif sma50_last < sma200_last and gap > -2:
            risk_parts.append("la SMA50 por debajo de la SMA200 (death cross) genera cautela en el mediano plazo")

    if fund.get("debt_to_equity") and fund["debt_to_equity"] > 150:
        risk_parts.append(f"el apalancamiento financiero (D/E {fund['debt_to_equity']:.0f}%) es un factor de riesgo en un entorno de tasas altas")

    if not risk_parts:
        if period_return > 20:
            risk_parts.append("la fuerte suba acumulada eleva el riesgo de correcci\u00f3n si los resultados no confirman las expectativas del mercado")
        elif period_return < -15:
            risk_parts.append("la correcci\u00f3n abre una ventana de acumulaci\u00f3n para inversores de largo plazo, aunque la incertidumbre de corto plazo persiste")
        else:
            risk_parts.append("el seguimiento de resultados trimestrales y los datos macro (tasas, inflaci\u00f3n) ser\u00e1n los principales catalizadores en el corto plazo")

    sent3 = "A vigilar: " + "; ".join(risk_parts[:2]) + "."

    # --- Sentence 4: Overall bias ---
    bull_score = 0
    bear_score = 0
    if period_return > 5:   bull_score += 1
    if period_return < -5:  bear_score += 1
    if rsi_val is not None:
        if rsi_val < 50:    bear_score += 1
        if rsi_val > 50:    bull_score += 1
    if macd_val is not None:
        if macd_val > 0:    bull_score += 1
        else:               bear_score += 1
    if sma200_last and current_price > sma200_last: bull_score += 1
    if sma200_last and current_price < sma200_last: bear_score += 1
    if last_earn_surprise is not None:
        if last_earn_surprise > 3:  bull_score += 1
        if last_earn_surprise < -3: bear_score += 1

    if bull_score > bear_score + 1:
        bias = "alcista con convicci\u00f3n moderada"
        bias_emoji = "\u25b2"
    elif bull_score > bear_score:
        bias = "ligeramente alcista"
        bias_emoji = "\u25b2"
    elif bear_score > bull_score + 1:
        bias = "bajista con convicci\u00f3n moderada"
        bias_emoji = "\u25bc"
    elif bear_score > bull_score:
        bias = "ligeramente bajista"
        bias_emoji = "\u25bc"
    else:
        bias = "neutral"
        bias_emoji = "\u2192"

    sent4 = f"Sesgo general {bias_emoji} {bias} ({bull_score} se\u00f1ales alcistas vs. {bear_score} bajistas sobre los indicadores analizados)."

    summary_text = " ".join(s for s in [sent1, sent2, sent3, sent4] if s)

    result = {
        "ticker":      t,
        "company":     company,
        "summary":     summary_text.strip(),
        "price":       current_price,
        "period_return": period_return,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    _AI_SUMMARY_CACHE[cache_key] = {
        "ts":   datetime.now(timezone.utc).timestamp(),
        "data": result,
    }
    return result
