import asyncio
from app.tasks.celery_app import celery_app
from app.db.client import prisma
from app.services.ocr_service import ocr_service
from app.services.storage_service import upload_image
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, max_retries=2)
def process_scan_task(self, scan_id: str, image_bytes: bytes, filename: str, content_type: str):
    """Runs OCR in Celery worker. Updates Scan record on completion."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_run(self, scan_id, image_bytes, filename, content_type))
    finally:
        loop.close()

async def _run(task, scan_id: str, image_bytes: bytes, filename: str, content_type: str):
    import sys
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__
    try:
        await prisma.connect()
    finally:
        sys.stdout = original_stdout
        sys.stderr = original_stderr
    try:
        # Mark as processing
        await prisma.scan.update(
            where={"id": scan_id},
            data={"status": "PROCESSING"}
        )
        
        # Upload raw image to Minio/S3 for audit trail
        image_key = await upload_image(image_bytes, filename, content_type)

        # Run OCR
        from io import BytesIO
        from fastapi import UploadFile
        upload = UploadFile(filename=filename, file=BytesIO(image_bytes))
        result = await ocr_service.run_ocr(upload)

        await prisma.scan.update(
            where={"id": scan_id},
            data={
                "status": "COMPLETED",
                "imageKey": image_key,
                "matchedChemical": result["matched_chemical"],
                "confidence": result["confidence"],
                "rawOcrText": result["raw_text"],
            }
        )
    except Exception as exc:
        logger.error(f"Scan task failed: {exc}")
        await prisma.scan.update(
            where={"id": scan_id},
            data={"status": "FAILED", "errorMessage": str(exc)}
        )
        task.retry(exc=exc, countdown=5)
    finally:
        await prisma.disconnect()
