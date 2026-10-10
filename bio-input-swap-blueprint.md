# Bio-Input Swap — Full Architecture Blueprint
### Revised & Improved | Phased Delivery Plan | Backend + Frontend

> **Review basis:** API-First Decoupled Architecture with FastAPI (Python) backend, Prisma ORM + PostgreSQL/PostGIS database, React (Vite + TypeScript) frontend. All issues identified in the engineering review are addressed below.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Technology Stack (Revised)](#2-technology-stack-revised)
3. [Repository & Directory Structure](#3-repository--directory-structure) — two separate repos, local dev, type sync, deployment
4. [Phase 0 — Foundation & Dev Environment](#phase-0--foundation--dev-environment)
5. [Phase 1 — Auth: Backend + Frontend](#phase-1--auth-backend--frontend)
6. [Phase 2 — OCR Scan Pipeline: Backend + Frontend](#phase-2--ocr-scan-pipeline-backend--frontend)
7. [Phase 3 — Chemical Database & Swap Results: Backend + Frontend](#phase-3--chemical-database--swap-results-backend--frontend)
8. [Phase 4 — BRC Geospatial Finder: Backend + Frontend](#phase-4--brc-geospatial-finder-backend--frontend)
9. [Phase 5 — Observability, Security Hardening & Admin Panel](#phase-5--observability-security-hardening--admin-panel)
10. [Phase 6 — Mobile Readiness & Offline Support](#phase-6--mobile-readiness--offline-support)
11. [Prisma Schema (Complete)](#prisma-schema-complete)
12. [Security Checklist](#security-checklist)
13. [API Contract Reference](#api-contract-reference)
14. [Environment Variables Reference](#environment-variables-reference)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                        │
│                                                                              │
│   ┌─────────────────────┐          ┌──────────────────────────┐             │
│   │   React Web App     │          │   Android App (Kotlin /  │             │
│   │   (Vite + TS)       │          │   Flutter — future)      │             │
│   │   https://swap.in   │          │   App Package Instance   │             │
│   └──────────┬──────────┘          └─────────────┬────────────┘             │
└──────────────┼──────────────────────────────────-┼─────────────────────────┘
               │  HTTPS + JWT Bearer                │  HTTPS + JWT Bearer
               ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY LAYER                                     │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │   Nginx / Caddy  (TLS termination, rate limiting, CORS headers)      │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────────────-┼─────────────────────────────────────┘
                                       │
               ┌───────────────────────┴──────────────────────┐
               ▼                                               ▼
┌──────────────────────────┐                   ┌──────────────────────────────┐
│  FastAPI App (Uvicorn)   │                   │  Celery Worker               │
│  Stateless JSON API      │──── enqueue ─────►│  (OCR + ML heavy tasks)      │
│  /api/v1/...             │                   │  Async task queue            │
└──────────────┬───────────┘                   └──────────────────────────────┘
               │                                               │
     ┌─────────┼──────────────────────────────────────────────┤
     ▼         ▼                    ▼                          ▼
┌─────────┐ ┌──────────┐  ┌────────────────┐       ┌──────────────────────┐
│PostgreSQL│ │  Redis   │  │ S3 / GCS       │       │  PaddleOCR + OpenCV  │
│PostGIS  │ │  Cache + │  │ Image Storage  │       │  (inside worker)     │
│Prisma   │ │  Queue   │  │ + CDN          │       └──────────────────────┘
└─────────┘ └──────────┘  └────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Reason |
|---|---|---|
| ORM + Migrations | **Prisma** (via Prisma Client Python) | Type-safe, readable schema, excellent migration tooling |
| Task Queue | **Celery + Redis** | OCR must not block HTTP threads |
| Cache | **Redis** | Scan result cache, token blacklist, rate limiter |
| Image Storage | **S3-compatible** (AWS S3 / Cloudflare R2) | Audit trail, never store images in DB |
| Geo Queries | **PostGIS** on PostgreSQL | Spatial indexing for BRC finder |
| Auth | **Dual JWT** (access 15m / refresh 30d + rotation + Redis blacklist) | Stateless + revocable |
| Frontend | **React + Vite + TypeScript + TanStack Query** | Fast, type-safe, great DX |
| Fuzzy Matching | **RapidFuzz** | OCR output is noisy; exact match fails constantly |

---

## 2. Technology Stack (Revised)

### Backend
```
Python 3.11+
FastAPI                  — HTTP framework, async support
Uvicorn                  — ASGI server
Prisma Client Python     — Type-safe DB access + migrations
PostgreSQL 15 + PostGIS  — Primary DB + geospatial
Redis 7                  — Cache, task queue broker, token blacklist
Celery 5                 — Background task queue for OCR
PaddleOCR                — OCR engine (angle classifier on)
OpenCV (cv2)             — Image preprocessing
RapidFuzz                — Fuzzy string matching for chemical names
slowapi                  — Rate limiting middleware for FastAPI
python-jose              — JWT creation and decoding
passlib[bcrypt]          — Password hashing
boto3                    — S3 image uploads
Sentry SDK               — Error tracking
OpenTelemetry            — Distributed tracing
```

### Frontend
```
React 18 + Vite + TypeScript     — Core framework
TanStack Query (React Query)     — Server state, caching, polling
React Router v6                  — Client-side routing
Axios                            — HTTP client with JWT interceptors
React Hook Form + Zod            — Form handling and validation
Tailwind CSS                     — Utility-first styling
shadcn/ui                        — Accessible component primitives
Leaflet / react-leaflet          — Map for BRC finder
React Dropzone                   — Image upload UX
Zustand                          — Global client state (auth token)
```

### Infrastructure
```
Docker + Docker Compose          — Local dev and production containers
GitHub Actions                   — CI/CD pipeline
Nginx / Caddy                    — Reverse proxy, TLS, rate limiting
Cloudflare R2 or AWS S3          — Image object storage
```

---

## 3. Repository & Directory Structure

### Two Separate Repositories

Frontend and backend live in separate GitHub repositories under one organisation. They communicate exclusively through the versioned HTTP API — no shared code, no shared `node_modules`, no shared virtualenvs.

```
GitHub Organisation: bio-input-swap
├── bioinput-api          ← FastAPI backend (Python)
└── bioinput-web          ← React frontend (TypeScript)
```

> Full separate-repos strategy, CI/CD pipelines, shared-types options, branching rules, and deployment targets are documented in `separate-repos-strategy.md`.

---

### `bioinput-api` — Backend repo structure

```
bioinput-api/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── auth.py
│   │       │   ├── scan.py
│   │       │   ├── chemicals.py
│   │       │   ├── alternatives.py
│   │       │   ├── brc.py
│   │       │   ├── admin.py
│   │       │   └── health.py
│   │       └── router.py
│   ├── core/
│   │   ├── config.py              # Pydantic BaseSettings, env loading
│   │   ├── security.py            # JWT create/decode, bcrypt
│   │   ├── limiter.py             # slowapi rate limiter setup
│   │   └── middleware.py          # Request ID injection, logging
│   ├── services/
│   │   ├── ocr_service.py         # Image preprocessing + PaddleOCR
│   │   ├── swap_service.py        # Chemical lookup + fuzzy match
│   │   ├── storage_service.py     # S3 upload/download
│   │   └── auth_service.py        # Token creation, refresh, blacklist
│   ├── tasks/
│   │   ├── celery_app.py          # Celery init + Redis broker config
│   │   └── ocr_task.py            # Async OCR Celery task
│   ├── db/
│   │   └── client.py              # Prisma client singleton
│   └── main.py                    # FastAPI app init, middleware wiring
├── prisma/
│   └── schema.prisma              # Single source of truth for DB schema
├── tests/
│   ├── unit/
│   └── integration/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint + test + migrate on every PR
│       └── deploy.yml             # Deploy to Railway on merge to main
├── Dockerfile
├── docker-compose.dev.yml         # Local: postgres + redis + api + worker
├── requirements.txt
├── .env.example
└── README.md                      # API contract docs + quickstart
```

### `bioinput-web` — Frontend repo structure

```
bioinput-web/
├── src/
│   ├── api/
│   │   ├── client.ts              # Axios base + JWT interceptor
│   │   ├── types.ts               # API types (hand-written or generated)
│   │   ├── auth.ts
│   │   ├── scan.ts
│   │   ├── chemicals.ts
│   │   └── brc.ts
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── auth/
│   │   ├── scan/
│   │   ├── results/
│   │   └── map/
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── ScanPage.tsx
│   │   ├── ResultPage.tsx
│   │   ├── BRCFinderPage.tsx
│   │   └── HistoryPage.tsx
│   ├── store/
│   │   └── auth.ts                # Zustand auth store
│   ├── hooks/
│   │   ├── useScan.ts
│   │   └── useAuth.ts
│   └── App.tsx
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Type-check + lint + build on every PR
│       └── deploy.yml             # Deploy to Vercel on merge to main
├── public/
├── Dockerfile                     # For self-hosted deploy option
├── vite.config.ts
├── .env.example
└── README.md                      # Quickstart + link to API repo
```

### How the two repos connect

The only shared surface is the API URL (an environment variable) and the documented API contract.

```bash
# bioinput-web/.env.local
VITE_API_URL=http://localhost:8000        # local dev
VITE_API_URL=https://api.swap.in         # production
```

```bash
# bioinput-api/.env
CORS_ORIGINS=https://swap.in,https://admin.swap.in
```

Adding a new frontend domain (staging, admin panel) requires only changing `CORS_ORIGINS` in the backend env — no code change.

### Local development (two terminals)

```bash
# Terminal 1 — backend
cd bioinput-api
docker compose -f docker-compose.dev.yml up    # postgres + redis + api + worker

# Terminal 2 — frontend
cd bioinput-web
npm install && npm run dev                     # localhost:5173
```

### Shared TypeScript types — strategy by phase

| Phase | Approach |
|---|---|
| Phase 0–2 (building fast) | Hand-write types in `src/api/types.ts` mirroring Pydantic schemas |
| Phase 3+ (API stabilising) | Generate types from OpenAPI: `npm run types:generate` |

**OpenAPI codegen setup (Phase 3+):**
```bash
npm install --save-dev openapi-typescript
```
```json
// package.json
{ "scripts": { "types:generate": "openapi-typescript $VITE_API_URL/openapi.json -o src/api/types.generated.ts" } }
```
FastAPI auto-generates the OpenAPI spec at `/openapi.json`. Run the script whenever the backend adds or changes endpoints.

### Branching rules

Both repos follow the same model:
```
main        ← production — protected, requires PR review
dev         ← staging — PRs merge here first
feature/*   ← cut from dev
hotfix/*    ← cut from main, merged to both
```

**Critical rule:** Always deploy `bioinput-api` to production before `bioinput-web` when shipping a new API version. The frontend is always backwards-compatible with the previous API version.

### Deployment targets

| Repo | Host | Notes |
|---|---|---|
| `bioinput-api` | Railway or Render | Native Docker, managed PostgreSQL + Redis add-ons |
| `bioinput-web` | Vercel or Netlify | Zero-config Vite deploy, preview URL per PR |
| Database | Railway PostgreSQL or Supabase | Both support PostGIS |
| Redis | Railway Redis or Upstash | Managed, no ops overhead |
| Images | Cloudflare R2 | No egress fees, S3-compatible |

Vercel creates a preview URL for every frontend PR — point it at the staging API:
```bash
# Vercel project settings → Environment Variables → Preview
VITE_API_URL=https://api-staging.swap.in
```

---

---

# Phase 0 — Foundation & Dev Environment

**Goal:** Every developer can run the entire stack locally with one command. Nothing is built yet, but the wiring is complete.

**Duration estimate:** 2–3 days

---

## Backend — Phase 0

### 1. Docker Compose (full local stack)

```yaml
# docker-compose.dev.yml
version: "3.9"

services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: bioinput_dev
      POSTGRES_USER: bioinput
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    volumes:
      - ./backend:/app          # Hot reload in dev
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    depends_on:
      - postgres
      - redis
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    volumes:
      - ./backend:/app
    env_file: ./backend/.env
    depends_on:
      - postgres
      - redis
    command: celery -A app.tasks.celery_app worker --loglevel=info

volumes:
  pgdata:
```

### 2. Dockerfile (backend)

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV + PaddleOCR
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Generate Prisma client
COPY prisma/ ./prisma/
RUN prisma generate

COPY . .

EXPOSE 8000
```

### 3. Health Endpoint (first endpoint — always ship this first)

```python
# app/api/v1/endpoints/health.py
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
```

### 4. Request ID Middleware

```python
# app/core/middleware.py
import uuid
from starlette.middleware.base import BaseHTTPMiddleware

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

### 5. main.py (wired up)

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.middleware import RequestIDMiddleware
from app.api.v1.router import api_router
from app.db.client import prisma

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Bio-Input Swap API",
    version="1.0.0",
    docs_url="/docs" if settings.ENV == "development" else None,
    redoc_url=None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Request ID
app.add_middleware(RequestIDMiddleware)

# CORS — strict, environment-aware
origins = (
    ["http://localhost:5173", "http://localhost:3000"]
    if settings.ENV == "development"
    else ["https://swap.in", "https://admin.swap.in"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

app.include_router(api_router, prefix="/api/v1")

@app.on_event("startup")
async def startup():
    await prisma.connect()

@app.on_event("shutdown")
async def shutdown():
    await prisma.disconnect()
```

---

## Frontend — Phase 0

### 1. Vite + React + TypeScript scaffold

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install @tanstack/react-query axios react-router-dom zustand
npm install react-hook-form zod @hookform/resolvers
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 2. Axios client with JWT interceptor

```typescript
// src/api/client.ts
import axios from "axios";
import { useAuthStore } from "../store/auth";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // sends HttpOnly refresh cookie
});

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true }
        );
        useAuthStore.getState().setAccessToken(data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
```

### 3. Auth store (Zustand)

```typescript
// src/store/auth.ts
import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  user: { id: string; name: string; phone: string } | null;
  setAccessToken: (token: string) => void;
  setUser: (user: AuthState["user"]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  logout: () => set({ accessToken: null, user: null }),
}));
```

### ✅ Phase 0 Completion Checklist
- [ ] `docker compose up` starts postgres, redis, api, worker
- [ ] `GET /api/v1/health` returns `{ "status": "ok", "db": "ok" }`
- [ ] `GET /api/v1/ready` returns 200
- [ ] Frontend runs at `localhost:5173` with no errors
- [ ] Axios client wired with base URL from `.env`
- [ ] Prisma schema file exists and `prisma generate` runs clean

---

---

# Phase 1 — Auth: Backend + Frontend

**Goal:** A farmer can register with phone number, log in, receive tokens, and log out. Token refresh works silently. Session survives app restart.

**Duration estimate:** 3–4 days

**Test:** Log in → close browser → reopen → still logged in. Log out → token rejected.

---

## Backend — Phase 1

### Prisma Schema (Auth tables only)

```prisma
// prisma/schema.prisma (auth portion)
model User {
  id           String   @id @default(cuid())
  phone        String   @unique
  name         String
  passwordHash String
  role         Role     @default(FARMER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  scans        Scan[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())
}

enum Role {
  FARMER
  ADMIN
}
```

```bash
# Run migration
prisma migrate dev --name "add_users_auth"
```

### Auth Service

```python
# app/services/auth_service.py
import secrets
import redis
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.core.config import settings
from app.db.client import prisma

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "access"},
        settings.SECRET_KEY, algorithm="HS256"
    )

def decode_access_token(token: str) -> dict:
    """Raises JWTError on invalid/expired token."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    # Check Redis blacklist
    if redis_client.get(f"blacklist:{token}"):
        raise JWTError("Token has been revoked")
    return payload

async def create_refresh_token(user_id: str) -> str:
    """Stores refresh token in DB for rotation + revocation."""
    token = secrets.token_urlsafe(64)
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    await prisma.refreshtoken.create(data={
        "token": token, "userId": user_id, "expiresAt": expires_at
    })
    return token

async def rotate_refresh_token(old_token: str) -> tuple[str, str]:
    """Revoke old token, issue new access + refresh pair (token rotation)."""
    record = await prisma.refreshtoken.find_unique(where={"token": old_token})
    if not record or record.revokedAt or record.expiresAt < datetime.utcnow():
        raise ValueError("Invalid or expired refresh token")
    # Revoke old
    await prisma.refreshtoken.update(
        where={"id": record.id},
        data={"revokedAt": datetime.utcnow()}
    )
    # Issue new pair
    access_token = create_access_token(record.userId)
    new_refresh = await create_refresh_token(record.userId)
    return access_token, new_refresh

async def revoke_all_user_tokens(user_id: str):
    """Call on logout — revokes all refresh tokens for the user."""
    await prisma.refreshtoken.update_many(
        where={"userId": user_id, "revokedAt": None},
        data={"revokedAt": datetime.utcnow()}
    )
```

### Auth Endpoint

```python
# app/api/v1/endpoints/auth.py
from fastapi import APIRouter, HTTPException, Response, Cookie, Depends, Request, status
from slowapi.util import get_remote_address
from app.core.limiter import limiter
from app.services.auth_service import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, rotate_refresh_token, revoke_all_user_tokens,
    decode_access_token
)
from app.db.client import prisma
from pydantic import BaseModel

router = APIRouter()

class RegisterRequest(BaseModel):
    phone: str
    name: str
    password: str

class LoginRequest(BaseModel):
    phone: str
    password: str

def set_refresh_cookie(response: Response, token: str):
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=True,             # HTTPS only
        samesite="strict",
        max_age=30 * 24 * 3600,
        path="/api/v1/auth",     # Scope to auth routes only
    )

@router.post("/register", status_code=201)
@limiter.limit("5/minute")  # Prevent registration spam
async def register(request: Request, body: RegisterRequest, response: Response):
    existing = await prisma.user.find_unique(where={"phone": body.phone})
    if existing:
        raise HTTPException(status_code=409, detail="Phone number already registered")
    user = await prisma.user.create(data={
        "phone": body.phone,
        "name": body.name,
        "passwordHash": hash_password(body.password),
    })
    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(user.id)
    set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "user": {"id": user.id, "name": user.name}}

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, response: Response):
    user = await prisma.user.find_unique(where={"phone": body.phone})
    if not user or not verify_password(body.password, user.passwordHash):
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(user.id)
    set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "user": {"id": user.id, "name": user.name}}

@router.post("/refresh")
async def refresh(response: Response, refresh_token: str = Cookie(None)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        access_token, new_refresh = await rotate_refresh_token(refresh_token)
        set_refresh_cookie(response, new_refresh)
        return {"access_token": access_token}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/logout")
async def logout(response: Response, refresh_token: str = Cookie(None)):
    if refresh_token:
        # Find user from token and revoke all their refresh tokens
        from app.db.client import prisma
        record = await prisma.refreshtoken.find_unique(where={"token": refresh_token})
        if record:
            await revoke_all_user_tokens(record.userId)
    response.delete_cookie("refresh_token", path="/api/v1/auth")
    return {"message": "Logged out"}
```

### Dependency: Current User

```python
# app/api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from app.services.auth_service import decode_access_token
from app.db.client import prisma

bearer = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer)
):
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await prisma.user.find_unique(where={"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(user=Depends(get_current_user)):
    if user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

---

## Frontend — Phase 1

### Login Page

```typescript
// src/pages/LoginPage.tsx
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/auth";

const schema = z.object({
  phone: z.string().min(10, "Enter a valid phone number"),
  password: z.string().min(6, "Password too short"),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { setAccessToken, setUser } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const loginMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient.post("/api/v1/auth/login", data).then((r) => r.data),
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      setUser(data.user);
      navigate("/scan");
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <form
        onSubmit={handleSubmit((data) => loginMutation.mutate(data))}
        className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-green-800">Bio-Input Swap</h1>
        <p className="text-gray-500 text-sm">Sign in to your farmer account</p>

        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input {...register("phone")} className="input-field" placeholder="+91 98765 43210" />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input {...register("password")} type="password" className="input-field" />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {loginMutation.isError && (
          <p className="text-red-500 text-sm">Invalid phone or password</p>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full bg-green-700 text-white py-2 rounded-lg font-medium hover:bg-green-800 disabled:opacity-50"
        >
          {loginMutation.isPending ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
```

### ✅ Phase 1 Completion Checklist
- [ ] `POST /auth/register` creates user, returns tokens
- [ ] `POST /auth/login` returns access token + sets HttpOnly cookie
- [ ] `POST /auth/refresh` rotates tokens; old refresh token is revoked in DB
- [ ] `POST /auth/logout` revokes all refresh tokens for the user
- [ ] Protected route returns 401 without valid Bearer token
- [ ] Login page submits, stores access token in Zustand, redirects to /scan
- [ ] 401 response triggers silent token refresh via Axios interceptor
- [ ] Rate limiter blocks > 10 login attempts/minute from same IP

---

---

# Phase 2 — OCR Scan Pipeline: Backend + Frontend

**Goal:** A farmer uploads a bottle photo. The API queues the OCR task, returns a job ID. The frontend polls for the result. Result includes the identified chemical name and confidence score.

**Duration estimate:** 5–7 days (heaviest technical phase)

**Test:** Upload a photo of an Imidacloprid bottle → result returns `"IMIDACLOPRID"` with confidence > 0.8 in under 30 seconds.

---

## Backend — Phase 2

### Prisma Schema (Scan tables)

```prisma
// Add to prisma/schema.prisma
model Scan {
  id               String      @id @default(cuid())
  userId           String
  user             User        @relation(fields: [userId], references: [id])
  status           ScanStatus  @default(PENDING)
  imageKey         String?     // S3 object key for audit trail
  rawOcrText       String?     // Raw OCR output for debugging
  matchedChemical  String?     // Matched chemical name
  confidence       Float?      // OCR + match confidence (0.0–1.0)
  errorMessage     String?     // If status = FAILED
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt
  alternatives     Alternative[]
}

enum ScanStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

```bash
prisma migrate dev --name "add_scans"
```

### Celery App Setup

```python
# app/tasks/celery_app.py
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "bioinput",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.update(
    task_serializer="json",
    result_expires=3600,           # Results kept for 1 hour
    worker_prefetch_multiplier=1,  # One task at a time (OCR is heavy)
    task_acks_late=True,           # Requeue on worker crash
)
```

### Improved OCR Service (with fuzzy matching + confidence)

```python
# app/services/ocr_service.py
import cv2
import numpy as np
from paddleocr import PaddleOCR
from rapidfuzz import process, fuzz
from fastapi import UploadFile
import logging

logger = logging.getLogger("ocr_service")

# Confidence threshold for fuzzy matching
MATCH_THRESHOLD = 80  # RapidFuzz score 0–100

class AgrochemicalOCRService:
    def __init__(self):
        self.ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)

    def preprocess_image(self, raw_bytes: bytes) -> np.ndarray:
        nparr = np.frombuffer(raw_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image — file may be corrupted")

        # Validate dimensions
        h, w = img.shape[:2]
        if w > 4096 or h > 4096:
            img = cv2.resize(img, (min(w, 4096), min(h, 4096)))

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        smoothed = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(smoothed)

    async def run_ocr(self, file: UploadFile) -> dict:
        """Returns dict with matched_chemical, confidence, raw_text."""
        content = await file.read()

        # File size guard (10MB max)
        if len(content) > 10 * 1024 * 1024:
            raise ValueError("Image too large. Maximum size is 10MB.")

        processed = self.preprocess_image(content)
        color_img = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
        result = self.ocr_engine.ocr(color_img, cls=True)

        extracted_words = []
        confidence_scores = []

        if result and result[0]:
            for line in result[0]:
                text, confidence = line[1][0].strip().upper(), line[1][1]
                if confidence > 0.5:  # Filter low-confidence OCR tokens
                    extracted_words.append(text)
                    confidence_scores.append(confidence)

        raw_text = " ".join(extracted_words)
        logger.info(f"OCR extracted: {raw_text}")

        match_result = self.fuzzy_match(extracted_words)
        avg_ocr_confidence = (
            sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0
        )

        return {
            "matched_chemical": match_result["chemical"],
            "confidence": min(avg_ocr_confidence, match_result["score"] / 100),
            "raw_text": raw_text,
        }

    def fuzzy_match(self, words: list[str]) -> dict:
        """
        Fuzzy-matches OCR tokens against the registered chemicals DB.
        Returns best match above threshold, or UNKNOWN.
        NOTE: In production, `registered_chemicals` is loaded from DB, not hardcoded.
        """
        registered = ["IMIDACLOPRID", "CYPERMETHRIN", "CHLORPYRIFOS", "UREA", "DELTAMETHRIN"]
        best_chemical, best_score = "UNKNOWN", 0

        for word in words:
            match = process.extractOne(word, registered, scorer=fuzz.ratio)
            if match and match[1] > best_score:
                best_chemical, best_score = match[0], match[1]

        if best_score < MATCH_THRESHOLD:
            return {"chemical": "UNKNOWN", "score": 0}
        return {"chemical": best_chemical, "score": best_score}


ocr_service = AgrochemicalOCRService()
```

### Celery OCR Task

```python
# app/tasks/ocr_task.py
import asyncio
from app.tasks.celery_app import celery_app
from app.db.client import prisma
from app.services.ocr_service import ocr_service
from app.services.storage_service import upload_image

@celery_app.task(bind=True, max_retries=2)
def process_scan_task(self, scan_id: str, image_bytes: bytes, filename: str):
    """Runs OCR in Celery worker. Updates Scan record on completion."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_run(self, scan_id, image_bytes, filename))

async def _run(task, scan_id: str, image_bytes: bytes, filename: str):
    await prisma.connect()
    try:
        # Mark as processing
        await prisma.scan.update(
            where={"id": scan_id},
            data={"status": "PROCESSING"}
        )
        # Upload raw image to S3 for audit trail
        image_key = await upload_image(image_bytes, filename)

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
        await prisma.scan.update(
            where={"id": scan_id},
            data={"status": "FAILED", "errorMessage": str(exc)}
        )
        task.retry(exc=exc, countdown=5)
    finally:
        await prisma.disconnect()
```

### Scan Endpoint (non-blocking)

```python
# app/api/v1/endpoints/scan.py
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request, status
from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.tasks.ocr_task import process_scan_task
from app.db.client import prisma
import imghdr

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
    process_scan_task.delay(scan.id, content, file.filename)

    return {"scan_id": scan.id, "status": "PENDING"}

@router.get("/scan/{scan_id}")
async def get_scan_result(scan_id: str, current_user=Depends(get_current_user)):
    scan = await prisma.scan.find_unique(
        where={"id": scan_id},
        include={"alternatives": True}
    )
    if not scan or scan.userId != current_user.id:
        raise HTTPException(404, "Scan not found")
    return scan
```

---

## Frontend — Phase 2

### Scan Page with Polling

```typescript
// src/pages/ScanPage.tsx
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { useNavigate } from "react-router-dom";

export function ScanPage() {
  const navigate = useNavigate();
  const [scanId, setScanId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // 1. Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiClient.post("/api/v1/scan", form).then((r) => r.data);
    },
    onSuccess: (data) => setScanId(data.scan_id),
  });

  // 2. Poll for result every 3 seconds until completed/failed
  const { data: scanResult } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => apiClient.get(`/api/v1/scan/${scanId}`).then((r) => r.data),
    enabled: !!scanId,
    refetchInterval: (data) => {
      if (!data || data.status === "PENDING" || data.status === "PROCESSING") return 3000;
      return false; // Stop polling on terminal state
    },
    onSuccess: (data) => {
      if (data.status === "COMPLETED") navigate(`/results/${scanId}`);
    },
  });

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    uploadMutation.mutate(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <h1 className="text-2xl font-bold text-green-800 mb-6">Scan Bottle Label</h1>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${
          isDragActive ? "border-green-500 bg-green-100" : "border-gray-300 bg-white"
        }`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
        ) : (
          <p className="text-gray-500">
            Drag a bottle photo here, or tap to take/select one
          </p>
        )}
      </div>

      {/* Status indicator */}
      {scanId && (
        <div className="mt-6 bg-white rounded-xl p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="font-medium text-gray-800">
              {scanResult?.status === "PROCESSING" ? "Reading label..." : "Uploading..."}
            </p>
            <p className="text-xs text-gray-400">This usually takes 10–30 seconds</p>
          </div>
        </div>
      )}

      {scanResult?.status === "FAILED" && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          Could not read the label. Please try a clearer photo.
        </div>
      )}

      {uploadMutation.isError && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          Upload failed. Check your connection and try again.
        </div>
      )}
    </div>
  );
}
```

### ✅ Phase 2 Completion Checklist
- [ ] Upload endpoint validates MIME + magic bytes + size
- [ ] Scan record created with status PENDING before returning
- [ ] Celery worker picks up task, updates status to PROCESSING
- [ ] OCR runs with fuzzy matching; result stored with confidence score
- [ ] Image uploaded to S3 with scan_id as key
- [ ] GET `/scan/{id}` returns current status
- [ ] Frontend polls every 3s, stops on COMPLETED or FAILED
- [ ] User redirected to results page on COMPLETED
- [ ] Rate limiter: 10 scans/minute per IP

---

---

# Phase 3 — Chemical Database & Swap Results: Backend + Frontend

**Goal:** Admin can manage chemicals and their bio-alternatives via API. Farmer sees rich swap results: preparation steps, pros/cons, confidence score.

**Duration estimate:** 4–5 days

---

## Backend — Phase 3

### Prisma Schema (Chemicals)

```prisma
model Chemical {
  id               String        @id @default(cuid())
  name             String        @unique
  commonNames      String[]      // e.g. ["Confidor", "Gaucho"]
  category         String        // e.g. "Insecticide"
  isActive         Boolean       @default(true)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  alternatives     Alternative[]
}

model Alternative {
  id               String   @id @default(cuid())
  chemicalId       String
  chemical         Chemical @relation(fields: [chemicalId], references: [id])
  scanId           String?
  scan             Scan?    @relation(fields: [scanId], references: [id])
  name             String   // Bio alternative name
  type             String   // e.g. "Botanical", "Microbial", "Mineral"
  preparationSteps String[] // Step-by-step guide
  pros             String[]
  cons             String[]
  efficacyRating   Float    // 0.0–5.0
  createdAt        DateTime @default(now())
}
```

```bash
prisma migrate dev --name "add_chemicals_alternatives"
```

### Admin Chemical Endpoint

```python
# app/api/v1/endpoints/admin.py
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import require_admin
from app.db.client import prisma
from pydantic import BaseModel

router = APIRouter()

class ChemicalCreate(BaseModel):
    name: str
    commonNames: list[str] = []
    category: str

class AlternativeCreate(BaseModel):
    name: str
    type: str
    preparationSteps: list[str]
    pros: list[str]
    cons: list[str]
    efficacyRating: float

@router.post("/chemicals", status_code=201)
async def create_chemical(body: ChemicalCreate, _=Depends(require_admin)):
    existing = await prisma.chemical.find_unique(where={"name": body.name.upper()})
    if existing:
        raise HTTPException(409, "Chemical already exists")
    chemical = await prisma.chemical.create(data={
        "name": body.name.upper(),
        "commonNames": body.commonNames,
        "category": body.category,
    })
    return chemical

@router.post("/chemicals/{chemical_id}/alternatives", status_code=201)
async def add_alternative(
    chemical_id: str, body: AlternativeCreate, _=Depends(require_admin)
):
    chemical = await prisma.chemical.find_unique(where={"id": chemical_id})
    if not chemical:
        raise HTTPException(404, "Chemical not found")
    alt = await prisma.alternative.create(data={
        "chemicalId": chemical_id,
        "name": body.name,
        "type": body.type,
        "preparationSteps": body.preparationSteps,
        "pros": body.pros,
        "cons": body.cons,
        "efficacyRating": body.efficacyRating,
    })
    return alt

@router.get("/chemicals")
async def list_chemicals(_=Depends(require_admin)):
    return await prisma.chemical.find_many(include={"alternatives": True})
```

### Public Alternatives Endpoint

```python
# app/api/v1/endpoints/alternatives.py
from fastapi import APIRouter, HTTPException, Depends
from app.api.deps import get_current_user
from app.db.client import prisma
import redis
import json
from app.core.config import settings

router = APIRouter()
cache = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

@router.get("/alternatives/{chemical_name}")
async def get_alternatives(chemical_name: str, current_user=Depends(get_current_user)):
    cache_key = f"alternatives:{chemical_name.upper()}"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    chemical = await prisma.chemical.find_unique(
        where={"name": chemical_name.upper()},
        include={"alternatives": True}
    )
    if not chemical:
        raise HTTPException(404, f"No bio-alternatives found for {chemical_name}")

    result = {
        "chemical": chemical.name,
        "category": chemical.category,
        "alternatives": [
            {
                "name": alt.name,
                "type": alt.type,
                "preparationSteps": alt.preparationSteps,
                "pros": alt.pros,
                "cons": alt.cons,
                "efficacyRating": alt.efficacyRating,
            }
            for alt in chemical.alternatives
        ],
    }
    cache.setex(cache_key, 3600, json.dumps(result))  # Cache for 1 hour
    return result
```

---

## Frontend — Phase 3

### Results Page

```typescript
// src/pages/ResultPage.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";

export function ResultPage() {
  const { scanId } = useParams<{ scanId: string }>();

  const { data: scan, isLoading } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => apiClient.get(`/api/v1/scan/${scanId}`).then((r) => r.data),
  });

  const { data: alternatives } = useQuery({
    queryKey: ["alternatives", scan?.matchedChemical],
    queryFn: () =>
      apiClient.get(`/api/v1/alternatives/${scan.matchedChemical}`).then((r) => r.data),
    enabled: !!scan?.matchedChemical && scan.matchedChemical !== "UNKNOWN",
  });

  if (isLoading) return <div className="p-6">Loading results...</div>;

  return (
    <div className="min-h-screen bg-green-50 p-6 space-y-6">
      {/* Identified chemical */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <p className="text-sm text-gray-500 mb-1">Detected chemical</p>
        <h2 className="text-2xl font-bold text-green-800">{scan?.matchedChemical}</h2>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${(scan?.confidence ?? 0) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {Math.round((scan?.confidence ?? 0) * 100)}% confidence
          </span>
        </div>
      </div>

      {/* Bio-alternatives */}
      {alternatives?.alternatives.map((alt: any, i: number) => (
        <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">{alt.name}</h3>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              {alt.type}
            </span>
          </div>

          {/* Efficacy */}
          <div className="flex items-center gap-1 mb-4">
            {Array.from({ length: 5 }).map((_, s) => (
              <span key={s} className={s < alt.efficacyRating ? "text-yellow-400" : "text-gray-200"}>
                ★
              </span>
            ))}
            <span className="text-xs text-gray-500 ml-1">Efficacy</span>
          </div>

          {/* Preparation Steps */}
          <p className="text-sm font-medium text-gray-700 mb-2">How to prepare:</p>
          <ol className="space-y-1 mb-4">
            {alt.preparationSteps.map((step: string, j: number) => (
              <li key={j} className="text-sm text-gray-600 flex gap-2">
                <span className="text-green-600 font-medium">{j + 1}.</span>
                {step}
              </li>
            ))}
          </ol>

          {/* Pros / Cons */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-green-700 mb-1">Pros</p>
              {alt.pros.map((p: string, j: number) => (
                <p key={j} className="text-xs text-gray-600">✓ {p}</p>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium text-red-600 mb-1">Cons</p>
              {alt.cons.map((c: string, j: number) => (
                <p key={j} className="text-xs text-gray-600">✗ {c}</p>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### ✅ Phase 3 Completion Checklist
- [ ] Admin can create chemicals and add alternatives via API (admin JWT required)
- [ ] Chemical names stored and matched case-insensitively
- [ ] `GET /alternatives/{name}` returns full alternatives with steps, pros/cons
- [ ] Redis caches alternative results for 1 hour
- [ ] Results page shows chemical name + confidence bar
- [ ] Each alternative shows preparation steps + star rating + pros/cons
- [ ] Unknown chemical shows helpful "Try a clearer photo" message

---

---

# Phase 4 — BRC Geospatial Finder: Backend + Frontend

**Goal:** Farmer can find the nearest Bio-Input Resource Center on a map. Tapping a pin shows address, contact, and distance.

**Duration estimate:** 3–4 days

---

## Backend — Phase 4

### Prisma Schema (BRC) + PostGIS Note

```prisma
// Prisma doesn't natively support PostGIS geometry types.
// Use Unsupported("geometry") and raw queries for spatial operations.

model BioResourceCenter {
  id            String   @id @default(cuid())
  name          String
  operatorType  String   // "Government" | "Cooperative" | "NGO"
  address       String
  contactNumber String
  latitude      Float
  longitude     Float
  geom          Unsupported("geometry")?  // PostGIS point — set via raw query
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
}
```

```bash
prisma migrate dev --name "add_brc"
```

```sql
-- Run after migration to add PostGIS index
-- (add to a seed/setup script)
CREATE INDEX IF NOT EXISTS brc_geom_idx ON "BioResourceCenter" USING GIST (geom);

-- Trigger to auto-populate geom from lat/lng
CREATE OR REPLACE FUNCTION sync_brc_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brc_geom_sync
BEFORE INSERT OR UPDATE ON "BioResourceCenter"
FOR EACH ROW EXECUTE FUNCTION sync_brc_geom();
```

### BRC Endpoint (fixed SRID: 4326, not 44326)

```python
# app/api/v1/endpoints/brc.py
from fastapi import APIRouter, Depends, Query, HTTPException
from app.api.deps import get_current_user
from app.db.client import prisma

router = APIRouter()

@router.get("/brc/near")
async def find_nearest_brc(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(default=25, le=200),
    current_user=Depends(get_current_user),
):
    """
    Returns BRCs within radius_km kilometres, ordered by distance.
    Uses PostGIS ST_DWithin with correct SRID 4326.
    """
    radius_degrees = radius_km / 111.0  # ~111 km per degree

    results = await prisma.query_raw(
        """
        SELECT
            id, name, "operatorType", address, "contactNumber",
            latitude, longitude,
            ROUND(
                ST_Distance(
                    geom::geography,
                    ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
                ) / 1000, 2
            ) AS distance_km
        FROM "BioResourceCenter"
        WHERE
            "isActive" = true
            AND ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                $3
            )
        ORDER BY distance_km ASC
        LIMIT 20
        """,
        lat, lng, radius_km * 1000  # ST_DWithin in geography mode takes metres
    )

    if not results:
        raise HTTPException(404, f"No BRCs found within {radius_km}km of your location")

    return results
```

---

## Frontend — Phase 4

### BRC Finder Page

```typescript
// src/pages/BRCFinderPage.tsx
import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import "leaflet/dist/leaflet.css";

export function BRCFinderPage() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError("Could not get your location. Please enable GPS.")
    );
  };

  const { data: brcs, isLoading } = useQuery({
    queryKey: ["brc", location],
    queryFn: () =>
      apiClient
        .get("/api/v1/brc/near", { params: { lat: location!.lat, lng: location!.lng, radius_km: 25 } })
        .then((r) => r.data),
    enabled: !!location,
  });

  return (
    <div className="min-h-screen bg-green-50">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-green-800 mb-2">Nearby BRC Centers</h1>
        <p className="text-gray-500 text-sm mb-4">Find a Bio-Input Resource Center near you</p>

        {!location && (
          <button
            onClick={locateMe}
            className="bg-green-700 text-white px-6 py-3 rounded-xl font-medium w-full"
          >
            📍 Use My Location
          </button>
        )}
        {locationError && <p className="text-red-500 text-sm mt-2">{locationError}</p>}
      </div>

      {location && (
        <div className="h-64 w-full">
          <MapContainer center={[location.lat, location.lng]} zoom={11} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Circle center={[location.lat, location.lng]} radius={25000} color="green" fillOpacity={0.05} />
            {brcs?.map((brc: any) => (
              <Marker key={brc.id} position={[brc.latitude, brc.longitude]}>
                <Popup>
                  <strong>{brc.name}</strong><br />
                  {brc.address}<br />
                  📞 {brc.contactNumber}<br />
                  📍 {brc.distance_km} km away
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* BRC List */}
      {isLoading && <div className="p-6 text-gray-500">Finding centers near you...</div>}
      <div className="p-6 space-y-4">
        {brcs?.map((brc: any) => (
          <div key={brc.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">{brc.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{brc.address}</p>
                <p className="text-sm text-green-700 mt-1">📞 {brc.contactNumber}</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-green-600">{brc.distance_km} km</span>
                <p className="text-xs text-gray-400">{brc.operatorType}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### ✅ Phase 4 Completion Checklist
- [ ] PostGIS trigger auto-populates `geom` from lat/lng on insert/update
- [ ] GIST spatial index created on `geom` column
- [ ] SRID is `4326` (not `44326`) — confirmed in raw query
- [ ] Distance returned in kilometres (not raw degrees)
- [ ] BRC results ordered by distance ASC, limited to 20
- [ ] Frontend requests GPS permission; shows error on denial
- [ ] Map renders markers; tap shows name, address, contact, distance
- [ ] BRC list shows below map as scrollable cards

---

---

# Phase 5 — Observability, Security Hardening & Admin Panel

**Goal:** The system is production-safe. Logs are structured. Errors surface in Sentry. Admin can view all scans and manage chemicals.

**Duration estimate:** 4–5 days

---

## Backend — Phase 5

### Structured Logging with Request ID

```python
# app/core/logging_config.py
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log = {
            "time": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "request_id": getattr(record, "request_id", None),
        }
        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)
        return json.dumps(log)

def setup_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logging.root.setLevel(logging.INFO)
    logging.root.addHandler(handler)
```

### Sentry Integration

```python
# In app/main.py, add before app creation:
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    integrations=[FastApiIntegration(), SqlalchemyIntegration()],
    traces_sample_rate=0.2,    # 20% of transactions traced
    environment=settings.ENV,
)
```

### Scan Audit Trail Endpoint

```python
# In app/api/v1/endpoints/admin.py (add to existing router)
@router.get("/scans")
async def list_all_scans(
    page: int = 1,
    limit: int = 50,
    status: str = None,
    _=Depends(require_admin)
):
    where = {}
    if status:
        where["status"] = status
    scans = await prisma.scan.find_many(
        where=where,
        include={"user": True},
        skip=(page - 1) * limit,
        take=limit,
        order={"createdAt": "desc"},
    )
    total = await prisma.scan.count(where=where)
    return {"scans": scans, "total": total, "page": page}
```

### Security Hardening Additions

```python
# app/core/security_headers.py
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Remove server fingerprint
        response.headers.pop("server", None)
        return response
```

---

## Frontend — Phase 5

### Scan History Page

```typescript
// src/pages/HistoryPage.tsx
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { Link } from "react-router-dom";

export function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["scan-history"],
    queryFn: () => apiClient.get("/api/v1/scan/history").then((r) => r.data),
  });

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <h1 className="text-2xl font-bold text-green-800 mb-6">Scan History</h1>
      {isLoading && <p className="text-gray-500">Loading...</p>}
      <div className="space-y-3">
        {data?.scans.map((scan: any) => (
          <Link key={scan.id} to={`/results/${scan.id}`}>
            <div className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">
                  {scan.matchedChemical ?? "Unknown"}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(scan.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                scan.status === "COMPLETED"
                  ? "bg-green-100 text-green-700"
                  : scan.status === "FAILED"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {scan.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

### ✅ Phase 5 Completion Checklist
- [ ] All logs output as structured JSON with request ID
- [ ] Sentry captures unhandled exceptions in production
- [ ] Security headers added to all responses
- [ ] `GET /admin/scans` returns paginated scan history (admin only)
- [ ] Scan history page shows user's past scans with status badges
- [ ] Frontend 500 errors display a generic "Something went wrong" UI — not a raw error

---

---

# Phase 6 — Mobile Readiness & Offline Support

**Goal:** The web app works on low-connectivity 2G/3G. Images are compressed before upload. Failed uploads retry automatically.

**Duration estimate:** 2–3 days

---

## Frontend — Phase 6

### Client-side Image Compression Before Upload

```typescript
// src/utils/compressImage.ts
export async function compressImage(file: File, maxWidthPx = 1200): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidthPx / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name, { type: "image/jpeg" })),
        "image/jpeg",
        0.82    // 82% quality — good balance for bottle labels
      );
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
```

### Upload with Retry Logic

```typescript
// In useScan.ts — wrap upload with automatic retry
async function uploadWithRetry(file: File, maxRetries = 3): Promise<any> {
  const compressed = await compressImage(file);
  const form = new FormData();
  form.append("file", compressed);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data } = await apiClient.post("/api/v1/scan", form, {
        timeout: 30000,   // 30 second timeout for slow connections
      });
      return data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt)); // Backoff
    }
  }
}
```

### Offline Detection Banner

```typescript
// src/components/OfflineBanner.tsx
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  if (!offline) return null;
  return (
    <div className="bg-yellow-500 text-white text-sm text-center py-2 px-4">
      ⚠️ You're offline. Some features won't work until connection is restored.
    </div>
  );
}
```

### ✅ Phase 6 Completion Checklist
- [ ] Images compressed to max 1200px wide and ~82% JPEG quality before upload
- [ ] Upload retries automatically up to 3 times with backoff
- [ ] Offline banner shown when network is unavailable
- [ ] All API calls have explicit timeout (30s)
- [ ] App is installable as PWA (manifest + service worker)

---

---

# Prisma Schema (Complete)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-py"
  interface = "asyncio"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(cuid())
  phone         String         @unique
  name          String
  passwordHash  String
  role          Role           @default(FARMER)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  scans         Scan[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  token     String    @unique
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
}

model Chemical {
  id           String        @id @default(cuid())
  name         String        @unique
  commonNames  String[]
  category     String
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  alternatives Alternative[]
}

model Alternative {
  id               String   @id @default(cuid())
  chemicalId       String
  chemical         Chemical @relation(fields: [chemicalId], references: [id])
  name             String
  type             String
  preparationSteps String[]
  pros             String[]
  cons             String[]
  efficacyRating   Float
  createdAt        DateTime @default(now())
}

model Scan {
  id              String       @id @default(cuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id])
  status          ScanStatus   @default(PENDING)
  imageKey        String?
  rawOcrText      String?
  matchedChemical String?
  confidence      Float?
  errorMessage    String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  alternatives    Alternative[]
}

model BioResourceCenter {
  id            String   @id @default(cuid())
  name          String
  operatorType  String
  address       String
  contactNumber String
  latitude      Float
  longitude     Float
  geom          Unsupported("geometry")?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
}

enum Role {
  FARMER
  ADMIN
}

enum ScanStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

---

# Security Checklist

| Area | Requirement | Phase |
|---|---|---|
| Auth | JWT access tokens expire in 15 minutes | 1 |
| Auth | Refresh token rotation on every use | 1 |
| Auth | Refresh token revocation list in DB | 1 |
| Auth | Redis blacklist for access tokens on logout | 1 |
| Auth | Refresh cookie: HttpOnly, Secure, SameSite=Strict | 1 |
| Input | MIME type + magic byte validation on upload | 2 |
| Input | File size limit: 10MB | 2 |
| Input | Image dimension cap: 4096×4096 | 2 |
| Rate limiting | Login: 10/min per IP | 1 |
| Rate limiting | Register: 5/min per IP | 1 |
| Rate limiting | Scan upload: 10/min per IP | 2 |
| CORS | Strict allowlist: only your domains | 0 |
| Headers | X-Content-Type-Options, X-Frame-Options, HSTS | 5 |
| Errors | No stack traces or system info in error responses | 2 |
| Errors | Specific HTTP status codes (not blanket 500) | 2 |
| Admin | All admin routes require ADMIN role JWT | 3 |
| PostGIS | SRID is 4326 (verified) | 4 |
| Logging | No PII (phone, password) in log output | 5 |

---

# API Contract Reference

| Method | Endpoint | Auth | Phase | Description |
|---|---|---|---|---|
| GET | `/api/v1/health` | None | 0 | DB health check |
| GET | `/api/v1/ready` | None | 0 | Kubernetes readiness |
| POST | `/api/v1/auth/register` | None | 1 | Register farmer |
| POST | `/api/v1/auth/login` | None | 1 | Login, get tokens |
| POST | `/api/v1/auth/refresh` | Cookie | 1 | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Cookie | 1 | Revoke all tokens |
| POST | `/api/v1/scan` | Bearer | 2 | Submit scan (async) |
| GET | `/api/v1/scan/{id}` | Bearer | 2 | Poll scan status |
| GET | `/api/v1/scan/history` | Bearer | 5 | User's past scans |
| GET | `/api/v1/alternatives/{name}` | Bearer | 3 | Get bio-swaps |
| GET | `/api/v1/brc/near` | Bearer | 4 | Nearest BRC centers |
| POST | `/api/v1/admin/chemicals` | Admin | 3 | Create chemical |
| POST | `/api/v1/admin/chemicals/{id}/alternatives` | Admin | 3 | Add alternative |
| GET | `/api/v1/admin/chemicals` | Admin | 3 | List all chemicals |
| GET | `/api/v1/admin/scans` | Admin | 5 | All scans (paginated) |

---

# Environment Variables Reference

```bash
# backend/.env.example

# Application
ENV=development                    # development | production
SECRET_KEY=your-secret-key-here    # 32+ random bytes
PORT=8000

# Database (PostgreSQL + PostGIS)
DATABASE_URL=postgresql://bioinput:devpassword@localhost:5432/bioinput_dev

# Redis
REDIS_URL=redis://localhost:6379/0

# Storage (S3-compatible)
S3_BUCKET=bioinput-scans
S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Sentry (optional in dev)
SENTRY_DSN=

# frontend/.env.example
VITE_API_URL=http://localhost:8000
```

---

## Summary: Phase Delivery Order

| Phase | What ships | When you can test it |
|---|---|---|
| **0 — Foundation** | Docker stack, health endpoints, project scaffold | Day 1 |
| **1 — Auth** | Register, login, refresh, logout + login UI | Day 5 |
| **2 — OCR Scan** | Upload → queue → OCR → result + scan UI | Day 12 |
| **3 — Chemicals** | Admin CRUD + swap results + results UI | Day 17 |
| **4 — BRC Finder** | Geo search + map UI | Day 21 |
| **5 — Observability** | Logs, Sentry, security headers, history UI | Day 26 |
| **6 — Mobile** | Compression, retry, offline banner, PWA | Day 29 |

> Each phase ends with a working, testable slice. You never need to merge an incomplete feature to test the system. Frontend and backend ship together per phase.
