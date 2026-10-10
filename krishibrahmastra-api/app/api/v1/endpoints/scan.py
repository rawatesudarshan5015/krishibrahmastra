from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request
from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.tasks.ocr_task import process_scan_task
from app.db.client import prisma
from app.services.storage_service import get_image_url

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_MAGIC = {b"\xff\xd8\xff", b"\x89PNG"}  # JPEG, PNG magic bytes


@router.post("/scan", status_code=202)
@limiter.limit("10/minute")
async def submit_scan(
    request: Request,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    # 1. MIME type check
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only JPEG, PNG, or WebP images are accepted")

    content = await file.read()

    # 2. Magic byte validation (prevents MIME spoofing)
    if not any(content.startswith(magic) for magic in ALLOWED_MAGIC):
        raise HTTPException(400, "File content does not match a valid image format")

    # 3. Size limit
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 10MB")

    # 4. Create PENDING scan record
    scan = await prisma.scan.create(data={"userId": current_user.id})

    # 5. Enqueue Celery task (returns immediately)
    process_scan_task.delay(scan.id, content, file.filename, file.content_type)

    return {"scan_id": scan.id, "status": "PENDING"}


@router.get("/scan/history")
async def get_scan_history(current_user=Depends(get_current_user)):
    scans = await prisma.scan.find_many(
        where={"userId": current_user.id},
        order={"createdAt": "desc"}
    )
    return scans


@router.get("/scan/{scan_id}")
async def get_scan_result(scan_id: str, current_user=Depends(get_current_user)):
    scan = await prisma.scan.find_unique(
        where={"id": scan_id},
        include={"alternatives": True}
    )
    if not scan or scan.userId != current_user.id:
        raise HTTPException(404, "Scan not found")

    # Serialize to dict and inject a public image URL derived from the stored key
    scan_dict = scan.model_dump()
    scan_dict["imageUrl"] = get_image_url(scan.imageKey) if scan.imageKey else None
    return scan_dict
