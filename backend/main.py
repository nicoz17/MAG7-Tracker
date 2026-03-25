"""
Magnificent 7 Stock Tracker - Backend API
Entry point: uvicorn main:app
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.companies import router as companies_router
from routes.prices import router as prices_router
from routes.technical import router as technical_router
from routes.analytics import router as analytics_router
from routes.portfolio import router as portfolio_router
from routes.sectors import router as sectors_router
from routes.macro import router as macro_router
from routes.news import router as news_router
from routes.monthly import router as monthly_router

app = FastAPI(title="Mag7 Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies_router)
app.include_router(prices_router)
app.include_router(technical_router)
app.include_router(analytics_router)
app.include_router(portfolio_router)
app.include_router(sectors_router)
app.include_router(macro_router)
app.include_router(news_router)
app.include_router(monthly_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
