from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "bioinput",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.ocr_task"],
)
celery_app.conf.update(
    task_serializer="json",
    result_expires=3600,           # Results kept for 1 hour
    worker_prefetch_multiplier=1,  # One task at a time (OCR is heavy)
    task_acks_late=True,           # Requeue on worker crash
)
