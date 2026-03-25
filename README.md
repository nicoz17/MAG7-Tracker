# Magnificent 7 Stock Tracker

Aplicación full-stack para comparar el rendimiento de las "Magnificent 7" (AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA) con dos modos de visualización:

1. **Base 100** — Precio ajustado indexado a 100 en la fecha de inicio
2. **Volatility-Adjusted** — Base 100 dividido por la volatilidad expansiva anualizada (σ√252), reescalado a 100. Penaliza acciones con mayor varianza: una normalización tipo Sharpe.

## Arquitectura

```
frontend/          React 18 + TypeScript + Vite + Recharts
  └─ proxy /api → backend

backend/           Python + FastAPI + yfinance
  └─ GET /api/companies
  └─ GET /api/prices?tickers=...&start=...&end=...
```

## Requisitos

- **Python 3.10+**
- **Node.js 18+**

## Instalación y ejecución

### 1. Backend

```bash
cd C:\Users\nicol\OneDrive\Documents\Código\LarrainVial\mag7-tracker\backend
python -m venv venv 
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend (en otra terminal)

```bash
cd C:\Users\nicol\OneDrive\Documents\Código\LarrainVial\mag7-tracker\frontend
npm install
npm run dev
```

Abre http://localhost:3000

## Uso

1. Selecciona una o más de las Magnificent 7 con los checkboxes
2. Elige fecha de inicio y fin
3. Haz clic en **FETCH PRICES**
4. Alterna entre **Base 100** y **Vol-Adjusted** para ver el rendimiento ajustado por volatilidad

## Metodología: Volatilidad Expansiva

Para cada acción seleccionada:

```
log_returns[t] = ln(price[t] / price[t-1])
expanding_vol[t] = std(log_returns[1..t]) × √252
vol_adjusted[t] = (base100[t] / expanding_vol[t]) × k
```

Donde `k` es una constante de reescalado para que `vol_adjusted[first_valid] = 100`.

Esto es equivalente a una normalización pseudo-Sharpe sin tasa libre de riesgo: una acción que sube 50% con 20% de vol se verá mejor que una que sube 50% con 40% de vol.

## API Endpoints

### GET /api/companies
Retorna la lista de las Mag 7 con nombre y color asignado.

### GET /api/prices
| Param   | Tipo   | Ejemplo              |
|---------|--------|----------------------|
| tickers | string | AAPL,NVDA,TSLA       |
| start   | string | 2024-01-01           |
| end     | string | 2025-03-20           |

Retorna `{ dates: string[], series: { [ticker]: { base100, vol_adjusted } } }`
