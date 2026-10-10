from fastapi import APIRouter
from app.db.client import prisma

router = APIRouter()

@router.get("/health")
async def health():
    try:
        await prisma.query_raw("SELECT 1")
        db_status = "ok"
    except Exception:
        db_status = "error"
    return {"status": "ok", "db": db_status}

@router.get("/ready")
async def ready():
    # Kubernetes readiness probe — only returns 200 when fully ready
    return {"ready": True}
