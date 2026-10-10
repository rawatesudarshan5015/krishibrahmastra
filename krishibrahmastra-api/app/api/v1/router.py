from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, scan, admin, alternatives, brc

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(scan.router, tags=["scan"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(alternatives.router, tags=["alternatives"])
api_router.include_router(brc.router, prefix="/brc", tags=["brc"])
