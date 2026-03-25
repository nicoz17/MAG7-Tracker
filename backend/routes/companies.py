"""
/api/companies endpoint.
"""

from fastapi import APIRouter

from config import MAGNIFICENT_7

router = APIRouter()


@router.get("/api/companies")
def get_companies():
    return {
        ticker: {"name": info["name"], "color": info["color"]}
        for ticker, info in MAGNIFICENT_7.items()
    }
