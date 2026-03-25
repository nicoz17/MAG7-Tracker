"""
Magnificent 7 Stock Tracker - Backend API
Entry point: uvicorn main:app
"""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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

# API routes
app.include_router(companies_router)
app.include_router(prices_router)
app.include_router(technical_router)
app.include_router(analytics_router)
app.include_router(portfolio_router)
app.include_router(sectors_router)
app.include_router(macro_router)
app.include_router(news_router)
app.include_router(monthly_router)

# Serve frontend static files in production
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve index.html for all non-API routes (SPA fallback)."""
        file = DIST / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(DIST / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
