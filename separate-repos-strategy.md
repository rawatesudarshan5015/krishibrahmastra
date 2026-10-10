# Bio-Input Swap — Separate Repository Strategy
### Frontend + Backend as Independent Repos

---

## Overview

Splitting into two repositories gives each team (or contractor) full ownership of their domain, clean deployment pipelines, and no risk of one side's commits breaking the other's CI. The contract between them is the API — nothing else is shared.

```
GitHub Organisation: bio-input-swap
├── bioinput-api          ← FastAPI backend (Python)
└── bioinput-web          ← React frontend (TypeScript)
```

Both repos are owned by the same GitHub organisation. They communicate exclusively through the versioned HTTP API. Neither imports code from the other.

---

## Repository Breakdown

### `bioinput-api` — Backend

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
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── limiter.py
│   │   └── middleware.py
│   ├── services/
│   │   ├── ocr_service.py
│   │   ├── swap_service.py
│   │   ├── storage_service.py
│   │   └── auth_service.py
│   ├── tasks/
│   │   ├── celery_app.py
│   │   └── ocr_task.py
│   ├── db/
│   │   └── client.py
│   └── main.py
├── prisma/
│   └── schema.prisma          # Single source of truth for DB schema
├── tests/
│   ├── unit/
│   └── integration/
├── .github/
│   └── workflows/
│       ├── ci.yml             # Lint, test, type-check on every PR
│       └── deploy.yml         # Deploy to Railway / Render on merge to main
├── Dockerfile
├── docker-compose.dev.yml     # Local dev: postgres + redis + api + worker
├── requirements.txt
├── .env.example
└── README.md
```

### `bioinput-web` — Frontend

```
bioinput-web/
├── src/
│   ├── api/
│   │   ├── client.ts          # Axios base + JWT interceptor
│   │   ├── auth.ts
│   │   ├── scan.ts
│   │   ├── chemicals.ts
│   │   └── brc.ts
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives
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
│   │   └── auth.ts
│   ├── hooks/
│   │   ├── useScan.ts
│   │   └── useAuth.ts
│   └── App.tsx
├── .github/
│   └── workflows/
│       ├── ci.yml             # Lint, type-check, build check on every PR
│       └── deploy.yml         # Deploy to Vercel / Netlify on merge to main
├── public/
├── Dockerfile                 # For self-hosted deploy option
├── vite.config.ts
├── .env.example
└── README.md
```

---

## How They Connect — the API Contract

The only thing shared between repos is the **API URL** (an environment variable) and the **API contract** (the endpoint schema documented in the backend README). No shared packages, no shared types by default.

```
bioinput-web  ──── HTTPS + JSON ────►  bioinput-api
              ◄─── JSON responses ────
```

### Environment variables

```bash
# bioinput-web/.env.local  (never committed)
VITE_API_URL=https://api.swap.in          # production
VITE_API_URL=http://localhost:8000        # local dev
```

```bash
# bioinput-api/.env  (never committed)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_KEY=...
S3_BUCKET=...
CORS_ORIGINS=https://swap.in,https://admin.swap.in
```

The backend reads `CORS_ORIGINS` from its env and registers them dynamically:

```python
# app/core/config.py
class Settings(BaseSettings):
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
```

This means adding a new frontend domain (staging, admin panel, mobile preview) requires only a change to the backend's `CORS_ORIGINS` env var — no code change, no redeploy of the frontend.

---

## 4 Options for Shared Types (pick one)

One genuine friction point with separate repos is keeping TypeScript types on the frontend in sync with the Pydantic schemas on the backend. Here are four options ordered from simplest to most robust.

---

### Option A — Generate types from OpenAPI (recommended)

FastAPI auto-generates an OpenAPI spec at `/openapi.json`. You run a code-gen script in the frontend repo that fetches this spec and produces TypeScript types. No manual sync needed.

**Setup (bioinput-web):**

```bash
npm install --save-dev openapi-typescript
```

```json
// package.json
{
  "scripts": {
    "types:generate": "openapi-typescript $VITE_API_URL/openapi.json -o src/api/types.generated.ts"
  }
}
```

Run it whenever the backend schema changes:

```bash
VITE_API_URL=http://localhost:8000 npm run types:generate
```

Then use the generated types throughout the frontend:

```typescript
// src/api/scan.ts
import type { paths } from "./types.generated";

type ScanResponse = paths["/api/v1/scan/{scan_id}"]["get"]["responses"]["200"]["content"]["application/json"];
```

**Pros:** Zero manual work after initial setup. Always in sync with the actual API.
**Cons:** Requires the backend to be running locally when you regenerate. Run this as part of your weekly dev routine or on every backend release.

---

### Option B — Shared types npm package

Create a third, private npm package (`@bioinput/types`) that lives in its own small repo or as a GitHub package. Both repos install it as a dependency.

```
GitHub Organisation: bio-input-swap
├── bioinput-api
├── bioinput-web
└── bioinput-types          ← shared TypeScript types only
```

**bioinput-types structure:**
```
bioinput-types/
├── src/
│   ├── auth.ts
│   ├── scan.ts
│   ├── chemical.ts
│   └── index.ts
└── package.json
```

```typescript
// bioinput-types/src/scan.ts
export type ScanStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface ScanResult {
  id: string;
  status: ScanStatus;
  matchedChemical: string | null;
  confidence: number | null;
  createdAt: string;
}
```

Install in the frontend:
```bash
npm install @bioinput/types
```

**Pros:** Types are versioned and published independently. Works offline.
**Cons:** Requires discipline — every API change needs a types package release before the frontend can consume it. Adds a third repo to maintain.

---

### Option C — Copy-paste types (simplest, lowest overhead)

Write types manually in the frontend that mirror the Pydantic schemas. No tooling, no extra repos.

```typescript
// src/api/types.ts  (manually maintained)
export type ScanStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface User {
  id: string;
  name: string;
  phone: string;
}

export interface ScanResult {
  id: string;
  userId: string;
  status: ScanStatus;
  matchedChemical: string | null;
  confidence: number | null;
  imageKey: string | null;
  createdAt: string;
}
```

**Pros:** Zero tooling. No external dependencies. Works immediately.
**Cons:** Can drift from the backend. Requires discipline when the API changes.

**When to use:** Early in the project (Phase 0–2). Upgrade to Option A once the API stabilises.

---

### Option D — GraphQL or tRPC (most robust, most complex)

Replace the REST JSON API with a typed protocol where the TypeScript types are generated from the schema automatically, with no manual step required. Not recommended for this project in its current stage — REST + OpenAPI codegen (Option A) gives 90% of the benefit with 10% of the complexity.

---

## Recommended Approach

| Phase | Type strategy |
|---|---|
| Phase 0–2 (building fast) | Option C — hand-written types |
| Phase 3+ (API stabilising) | Migrate to Option A — OpenAPI codegen |
| If you hire a dedicated types engineer | Option B — shared npm package |

---

## Local Development Without Monorepo

Without `docker-compose` at the root, developers need two terminals:

```bash
# Terminal 1 — backend
cd bioinput-api
docker compose -f docker-compose.dev.yml up    # starts postgres, redis, api, worker

# Terminal 2 — frontend
cd bioinput-web
npm install
npm run dev                                    # starts at localhost:5173
```

Frontend `.env.local` points to the local API:
```bash
VITE_API_URL=http://localhost:8000
```

The two repos are completely independent on the local machine. No shared `node_modules`, no shared virtualenvs.

---

## Optional: Cross-repo Docker Compose for Onboarding

If you want new developers to spin up everything with one command, add a separate `bioinput-local` repo containing only a `docker-compose.yml` that references both services:

```
GitHub Organisation: bio-input-swap
├── bioinput-api
├── bioinput-web
└── bioinput-local             ← onboarding-only, no production code
    └── docker-compose.yml
```

```yaml
# bioinput-local/docker-compose.yml
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

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: ../bioinput-api          # references the sibling repo
    ports:
      - "8000:8000"
    env_file: ../bioinput-api/.env
    depends_on: [postgres, redis]
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  worker:
    build:
      context: ../bioinput-api
    env_file: ../bioinput-api/.env
    depends_on: [postgres, redis]
    command: celery -A app.tasks.celery_app worker --loglevel=info

  web:
    build:
      context: ../bioinput-web          # references the sibling repo
    ports:
      - "5173:5173"
    env_file: ../bioinput-web/.env.local
    command: npm run dev -- --host
```

Clone all three side-by-side, then:
```bash
cd bioinput-local
docker compose up
```

This is **only for local dev onboarding** — production deploys independently from each repo's own CI.

---

## CI/CD — Independent Pipelines

Each repo has its own GitHub Actions pipelines. They never trigger each other.

### `bioinput-api` — CI pipeline

```yaml
# .github/workflows/ci.yml
name: Backend CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:15-3.3
        env:
          POSTGRES_DB: bioinput_test
          POSTGRES_USER: bioinput
          POSTGRES_PASSWORD: testpassword
        ports: ["5432:5432"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - run: prisma generate
      - run: prisma migrate deploy
        env:
          DATABASE_URL: postgresql://bioinput:testpassword@localhost:5432/bioinput_test
      - run: pytest tests/ -v
        env:
          DATABASE_URL: postgresql://bioinput:testpassword@localhost:5432/bioinput_test
          REDIS_URL: redis://localhost:6379/0
          SECRET_KEY: test-secret-key
          ENV: test
```

### `bioinput-api` — Deploy pipeline

```yaml
# .github/workflows/deploy.yml
name: Backend Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up --service api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### `bioinput-web` — CI pipeline

```yaml
# .github/workflows/ci.yml
name: Frontend CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run type-check       # tsc --noEmit
      - run: npm run lint             # eslint
      - run: npm run build            # vite build — catches import errors
        env:
          VITE_API_URL: https://api.swap.in
```

### `bioinput-web` — Deploy pipeline

```yaml
# .github/workflows/deploy.yml
name: Frontend Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"
```

---

## Branching Strategy — Both Repos

Both repos follow the same branch model:

```
main          ← production — protected, requires PR + review
dev           ← staging — PRs merge here first
feature/*     ← feature branches cut from dev
hotfix/*      ← emergency fixes cut from main, merged to both
```

```
feature/phase-1-auth  →  dev  →  main
                              ↑
                        staging deploy
                                        ↑
                                  production deploy
```

**Rule:** The backend `main` is always deployed before the frontend `main` when shipping a new API version. Frontend is backwards-compatible with the previous API version until both are live.

---

## Deployment Targets (recommended per phase)

| Repo | Recommended host | Why |
|---|---|---|
| `bioinput-api` | Railway or Render | Native Docker support, managed PostgreSQL + Redis add-ons, easy env vars |
| `bioinput-web` | Vercel or Netlify | Zero-config Vite/React deploys, global CDN, preview URLs per PR |
| Database | Railway PostgreSQL or Supabase | Both support PostGIS extension |
| Redis | Railway Redis or Upstash | Managed, no ops overhead |
| Images (S3) | Cloudflare R2 | No egress fees, S3-compatible API |

### Preview deploys (very useful for testing phases)

Vercel creates a unique preview URL for every PR in `bioinput-web`. Point it at the staging backend URL:

```bash
# Vercel project settings → Environment Variables → Preview
VITE_API_URL=https://api-staging.swap.in
```

This means every frontend PR can be tested against the real staging API before merging, with no extra setup.

---

## README Templates

### `bioinput-api` README (root)

```markdown
# bioinput-api

FastAPI backend for Bio-Input Swap. Headless JSON API.

## Quick start (local)

git clone https://github.com/bio-input-swap/bioinput-api
cd bioinput-api
cp .env.example .env           # fill in values
docker compose -f docker-compose.dev.yml up

# API running at http://localhost:8000
# Docs at http://localhost:8000/docs

## Run migrations

docker compose exec api prisma migrate dev

## Run tests

docker compose exec api pytest tests/ -v

## API contract

OpenAPI spec: http://localhost:8000/openapi.json
Base URL: https://api.swap.in/api/v1

## Frontend repo

https://github.com/bio-input-swap/bioinput-web
```

### `bioinput-web` README (root)

```markdown
# bioinput-web

React + TypeScript frontend for Bio-Input Swap.

## Quick start (local)

git clone https://github.com/bio-input-swap/bioinput-web
cd bioinput-web
cp .env.example .env.local
npm install
npm run dev

# App running at http://localhost:5173
# Requires bioinput-api running at http://localhost:8000

## Regenerate API types

npm run types:generate        # requires backend running locally

## Backend repo

https://github.com/bio-input-swap/bioinput-api
```

---

## Coordination Rules Between Repos

These rules prevent the most common cross-repo breakages:

**1. API versioning.** All endpoints are prefixed `/api/v1/`. Breaking changes get a new version prefix `/api/v2/`. The old version stays live until the frontend has shipped support for the new one.

**2. Backend ships first.** When a phase adds new endpoints, merge and deploy the backend before the frontend. Frontend code can safely ignore endpoints it hasn't implemented yet.

**3. No frontend-breaking changes on main.** If you remove or rename a field that the frontend uses, add a deprecation period: keep the old field alongside the new one for at least one release cycle.

**4. Document the contract in the backend README.** Every endpoint, its request shape, and its response shape. The frontend developer should never have to read Python to understand the API.

**5. Cross-repo PRs get linked.** If a frontend PR depends on a backend PR being merged first, add a comment in the frontend PR: `Depends on: bio-input-swap/bioinput-api#42`. Don't merge the frontend PR until the backend PR is deployed.

**6. Environment variables are not secrets until they need to be.** Both repos keep `.env.example` files with all keys but no values. Any developer can onboard by copying the example and filling in values from the team password manager.

---

## Summary

| Concern | Solution |
|---|---|
| Shared types | OpenAPI codegen (Option A) after Phase 2 |
| Local dev with both repos | Two terminals, or `bioinput-local` docker-compose |
| CI/CD | Independent GitHub Actions per repo |
| CORS | Backend reads allowed origins from env var |
| Breaking API changes | Version prefix + deploy backend before frontend |
| Preview testing | Vercel preview URLs pointed at staging API |
| Type sync discipline | Regenerate types on every backend release |
