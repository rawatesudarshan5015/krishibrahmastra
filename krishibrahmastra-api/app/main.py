from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.core.logging_config import setup_logging
import sentry_sdk

setup_logging()

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=1.0,
    )
from app.api.v1.router import api_router
from app.db.client import prisma

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Krishi Brahmastra API",
    version="1.0.0",
    docs_url="/docs" if settings.ENV == "development" else None,
    redoc_url=None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Request ID
app.add_middleware(RequestIDMiddleware)

# Security Headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

app.include_router(api_router, prefix="/api/v1")

import asyncio
import logging

logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    max_retries = 10
    for i in range(max_retries):
        try:
            await prisma.connect()
            logger.info("Successfully connected to the database.")
            break
        except Exception as e:
            if i == max_retries - 1:
                logger.error(f"Failed to connect to the database after {max_retries} attempts.")
                raise e
            logger.warning(f"Database connection failed ({e}), retrying in 3 seconds... ({i+1}/{max_retries})")
            await asyncio.sleep(3)

@app.on_event("shutdown")
async def shutdown():
    await prisma.disconnect()
