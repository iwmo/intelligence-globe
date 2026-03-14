# Phase 30: CI Pipeline - Research

**Researched:** 2026-03-14
**Domain:** GitHub Actions, pytest/asyncio, vitest, TypeScript, gitleaks, Docker Buildx
**Confidence:** HIGH

## Summary

Phase 30 creates a GitHub Actions CI pipeline that satisfies four requirements: backend Python tests (CI-01), frontend type-checking and unit tests (CI-02), secret scanning (CI-03), and Docker image build verification (CI-04). No `.github/workflows/` directory exists yet — everything is net-new.

The backend test suite uses `pytest-asyncio` with a live PostgreSQL + asyncpg connection (see `conftest.py`). This means CI must spin up a PostgreSQL service container (the `postgis/postgis:16-3.5` image is used in docker-compose, matching the production stack). The tests do NOT mock the database — the conftest patches the SQLAlchemy engine to a `NullPool` variant but still connects to a real DB. Redis is NOT used by any current test file; the conftest only patches the DB engine.

The frontend uses Vitest 4.x with jsdom, already configured in `vite.config.ts`. The only test file in the tree is `test-setup.ts` (a setup file, not a test). Vitest will run zero tests but must exit 0 — this is fine and CI-compliant. `tsc --noEmit` runs against `tsconfig.app.json` (strict mode, `noUnusedLocals`, `noUnusedParameters`). The `build` script already runs `tsc -b && vite build`, but for CI we use `npx tsc --noEmit` to skip the Vite bundle step.

**Primary recommendation:** One workflow file per concern (4 files, or one consolidated file with 4 jobs). The consolidated approach is preferred — single workflow with parallel jobs, fewer files to maintain.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CI-01 | GitHub Actions workflow runs `pytest` on every push and PR | Service container pattern for postgis/postgis:16-3.5; pip caching via `setup-python` cache; DATABASE_URL env var injection |
| CI-02 | GitHub Actions workflow runs `vitest run` and `tsc --noEmit` on every push and PR | `setup-node@v4` with `cache: npm`; `npm ci`; `npx tsc --noEmit`; `npx vitest run` |
| CI-03 | GitHub Actions workflow runs gitleaks secret scanning | `gitleaks/gitleaks-action@v2`; `fetch-depth: 0` for full history scan; no license needed for personal repos |
| CI-04 | GitHub Actions workflow builds backend and frontend Docker images with `--target production` | `docker/setup-buildx-action@v3`; `docker/build-push-action@v6`; `push: false`; `--target production` / `--target builder` for backend/frontend respectively |
</phase_requirements>

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `actions/checkout` | v4 | Checkout code | Required first step in all jobs |
| `actions/setup-python` | v5 | Python environment + pip cache | Official; supports `cache: pip` shorthand |
| `actions/setup-node` | v4 | Node.js environment + npm cache | Official; supports `cache: npm` shorthand |
| `docker/setup-buildx-action` | v3 | Docker Buildx for advanced caching | Unlocks GHA cache backend |
| `docker/build-push-action` | v6 | Build (and optionally push) images | Handles multi-stage targets cleanly |
| `gitleaks/gitleaks-action` | v2 (latest: v2.3.9) | Secret scanning | Official action; personal repos = no license |
| PostgreSQL service | `postgis/postgis:16-3.5` | Live DB for pytest | Matches production image exactly |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `actions/cache` | v4 | Supplementary caching | Only if setup-node/setup-python cache insufficient |

**Installation:** No package installs — all tools are GitHub Actions from the Marketplace.

## Architecture Patterns

### Recommended Workflow Structure

One consolidated workflow file with 4 parallel jobs triggered on every push and PR:

```
.github/
└── workflows/
    └── ci.yml          # All 4 CI checks as parallel jobs
```

Parallel jobs: `pytest`, `frontend`, `secret-scan`, `docker-build`

### Pattern 1: PostgreSQL Service Container (CI-01)

**What:** Spin up a real postgis/postgis:16-3.5 container as a GitHub Actions service. The runner's `DATABASE_URL` env var points to `postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal`.

**When to use:** Any time tests require a live DB connection (this project's conftest does NOT mock the DB).

**Key constraint:** Must use `ubuntu-latest` runner — service containers only work on Linux runners.

**Example:**
```yaml
# Source: https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers
jobs:
  pytest:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.5
        env:
          POSTGRES_DB: opensignal
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
          cache-dependency-path: backend/requirements-dev.txt
      - name: Install dependencies
        run: pip install -r backend/requirements.txt -r backend/requirements-dev.txt
        working-directory: backend
      - name: Run pytest
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal
        run: pytest
        working-directory: backend
```

**Critical detail:** The `DATABASE_URL` env var overrides the `settings.database_url` default in `app/config.py` because pydantic-settings reads env vars. No `.env` file is needed in CI.

### Pattern 2: Frontend Type-Check + Vitest (CI-02)

**What:** `setup-node` with `cache: npm`, then `npm ci`, then `npx tsc --noEmit` and `npx vitest run`.

**Key constraint:** The project uses a `tsconfig.json` with `references` (project references). Running `tsc --noEmit` against the root `tsconfig.json` traverses all referenced configs. Running `tsc -p tsconfig.app.json --noEmit` is also valid and more explicit.

**Example:**
```yaml
# Source: https://stevekinney.com/courses/testing/continuous-integration
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - name: Install dependencies
        run: npm ci
        working-directory: frontend
      - name: Type-check
        run: npx tsc --noEmit
        working-directory: frontend
      - name: Run vitest
        run: npx vitest run
        working-directory: frontend
```

**Note on Cesium:** The `CESIUM_BASE_URL` is defined at build time in vite.config.ts. Vitest in jsdom mode does not load Cesium assets. No special env var needed for vitest run.

### Pattern 3: Secret Scanning with Gitleaks (CI-03)

**What:** Run `gitleaks/gitleaks-action@v2` with `fetch-depth: 0` so the full git history is scanned (not just the current commit).

**License:** Personal account repos do NOT require a license key.

**Example:**
```yaml
# Source: https://github.com/marketplace/actions/gitleaks
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Important:** The `GITHUB_TOKEN` is automatically available in all Actions runs — no manual secret configuration needed.

### Pattern 4: Docker Image Build Verification (CI-04)

**What:** Use `docker/build-push-action` with `push: false` and the appropriate `--target`. Backend uses `--target production`. Frontend uses `--target builder` (the `builder` stage produces the dist, then the `production` stage copies from it — but to verify the full chain, target `production`).

**Buildx cache:** Use `type=gha` cache backend to speed up repeated builds. Requires `docker/setup-buildx-action` first.

**Key detail for frontend:** The `VITE_CESIUM_ION_TOKEN` is a build `ARG` in the frontend Dockerfile. In CI, this must be passed as a build arg. An empty or placeholder value is acceptable for build verification — the goal is to confirm the Dockerfile is syntactically valid and the build succeeds, not to produce a functional image.

**Example:**
```yaml
# Source: https://docs.docker.com/build/ci/github-actions/cache/
  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build backend image
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          target: production
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Build frontend image
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          target: production
          push: false
          build-args: |
            VITE_CESIUM_ION_TOKEN=ci-placeholder
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Anti-Patterns to Avoid

- **Using `postgres` as hostname:** When jobs run directly on the runner (not inside a container), the service hostname is `localhost`, not `postgres`. Use `localhost` + explicit `ports` mapping.
- **Missing `fetch-depth: 0` for gitleaks:** Without it, only the current HEAD commit is checked, not the full history — defeats the purpose.
- **Running `tsc -b` in CI:** `tsc -b` writes `.tsbuildinfo` files. Use `tsc --noEmit` (or `tsc -p tsconfig.app.json --noEmit`) to avoid touching the filesystem.
- **Caching `node_modules` directly:** GitHub recommends against this. Use `setup-node` with `cache: npm` which caches `~/.npm` (the npm cache) and is cross-version safe.
- **Separate workflow file per job:** Harder to see overall CI status at a glance. Consolidated `ci.yml` with parallel jobs is the standard approach.
- **Omitting `working-directory`:** The repo root is the checkout location. Backend and frontend are subdirectories — all `run` steps must set `working-directory` accordingly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret scanning | Custom grep for API keys | `gitleaks/gitleaks-action@v2` | Gitleaks has 150+ built-in rules for common secret patterns; regex is brittle |
| Docker layer caching | Manual tar/untar of image layers | `type=gha` cache in `build-push-action` | Native GHA cache API integration, no size limits per layer |
| PostgreSQL wait logic | `sleep 30` before connecting | `--health-cmd pg_isready` with `options` | GHA waits for the health check to pass before proceeding to steps |
| pip cache | `actions/cache` with manual key | `setup-python` with `cache: pip` | Handles cache key hashing automatically |

**Key insight:** GitHub Actions Marketplace actions for the specific tools (gitleaks, docker buildx) are maintained by the tool authors and are more reliable than DIY shell scripts.

## Common Pitfalls

### Pitfall 1: PostGIS Image vs Plain Postgres Image

**What goes wrong:** Using `image: postgres:16` works for plain SQL but the project uses `postgis/postgis:16-3.5` which includes the PostGIS extension. If any test accesses a PostGIS-typed column (the DB schema uses GeoAlchemy2), the plain image will fail.

**Why it happens:** The schema includes geometry columns; psycopg/asyncpg will see extension-not-found errors.

**How to avoid:** Use `postgis/postgis:16-3.5` (matches docker-compose.yml exactly).

**Warning signs:** `UndefinedObject: type "geometry" does not exist` in pytest output.

### Pitfall 2: DATABASE_URL Must Match asyncpg Driver Prefix

**What goes wrong:** `postgresql://...` fails with asyncpg; it requires `postgresql+asyncpg://...`.

**Why it happens:** SQLAlchemy uses the URL scheme to select the driver dialect.

**How to avoid:** Set `DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal` in the job `env`.

**Warning signs:** `ModuleNotFoundError` or `OperationalError: unknown dialect`.

### Pitfall 3: Alembic Migrations Not Run

**What goes wrong:** Tests that query tables fail with `UndefinedTable` because the schema hasn't been created.

**Why it happens:** The service container starts with an empty DB; no migration step runs before pytest.

**How to avoid:** Add `alembic upgrade head` as a step before `pytest`, running from the `backend/` directory with the `DATABASE_URL` env var set.

**Warning signs:** `asyncpg.exceptions.UndefinedTableError` in test output.

### Pitfall 4: `vitest run` Exits Non-Zero When No Tests Found

**What goes wrong:** If Vitest finds zero test files, it may exit with code 1 in some configurations.

**Why it happens:** Vitest 4.x default behavior is to exit 0 when no tests found, but older configurations may have `passWithNoTests: false`.

**How to avoid:** Confirm `vitest run` exits 0 with current config. The `vite.config.ts` does not set `passWithNoTests: false`, so default behavior (exit 0 on no tests) applies.

**Warning signs:** CI fails with "No test files found" and non-zero exit.

### Pitfall 5: Gitleaks Finds Historical Credentials

**What goes wrong:** The known historical credential exposure (OpenSky, AISStream keys in old docker-compose) causes gitleaks to fail on every PR permanently.

**Why it happens:** `fetch-depth: 0` scans all history, including commits before Phase 27 cleanup.

**How to avoid:** Use a `.gitleaksignore` file or a custom `gitleaks.toml` to allowlist the known historical paths/commits that were already remediated. The user still needs to rotate credentials (documented in STATE.md). The allowlist covers CI unblocking without silencing future detections.

**Warning signs:** CI-03 always fails on `docker-compose.yml` mentions in old commits.

### Pitfall 6: Frontend `tsc --noEmit` vs `tsc -b`

**What goes wrong:** Running `tsc -b` writes build info files and may fail if node_modules is incomplete. Running `tsc --noEmit` on the root `tsconfig.json` (which uses `references`) does not type-check referenced projects — it requires `--build` mode.

**How to avoid:** Run `tsc -p tsconfig.app.json --noEmit` which directly targets the app config without composite project references. This is the correct command for CI type-checking with this project's tsconfig structure.

**Warning signs:** `tsc --noEmit` exits 0 but TypeScript errors still exist in .tsx files.

## Code Examples

Verified patterns from official sources:

### Complete Consolidated CI Workflow Skeleton

```yaml
# Source: https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers
# Source: https://github.com/marketplace/actions/gitleaks
# Source: https://docs.docker.com/build/ci/github-actions/cache/
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

jobs:
  pytest:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.5
        env:
          POSTGRES_DB: opensignal
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
          cache-dependency-path: backend/requirements-dev.txt
      - run: pip install -r requirements.txt -r requirements-dev.txt
        working-directory: backend
      - run: alembic upgrade head
        working-directory: backend
      - run: pytest
        working-directory: backend

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npx tsc -p tsconfig.app.json --noEmit
        working-directory: frontend
      - run: npx vitest run
        working-directory: frontend

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build backend (production target)
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          target: production
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Build frontend (production target)
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          target: production
          push: false
          build-args: VITE_CESIUM_ION_TOKEN=ci-placeholder
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Gitleaks Allowlist for Historical Credentials

```toml
# .gitleaks.toml — allowlist known historical false positives from before Phase 27
[allowlist]
  description = "Historical credentials removed in Phase 27 (SEC-01)"
  commits = [
    # Add SHA of the commit(s) that contained real credentials before cleanup
    # Run: git log --oneline -- docker-compose.yml | head -20
  ]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `actions/cache@v3` manually | `setup-python`/`setup-node` built-in `cache:` param | 2023 | Simpler, auto-key |
| `docker/build-push-action@v5` | `docker/build-push-action@v6` | 2024 | Improved attestation support |
| `gitleaks-action@v1` | `gitleaks-action@v2` | 2022 | License model, more rules |
| GitHub Actions Cache API v1 | Cache API v2 only (from April 2025) | April 2025 | `type=gha` cache backend affected |

**Deprecated/outdated:**
- `actions/setup-python@v4`: Use v5 — v4 is still functional but v5 adds Python 3.13 support and improved cache reliability.
- `docker/build-push-action` without Buildx: Always use with `setup-buildx-action` to enable GHA cache backend.

## Open Questions

1. **Historical gitleaks failures**
   - What we know: STATE.md documents known credential exposure in git history (OpenSky, AISStream keys) from before Phase 27
   - What's unclear: Whether `gitleaks-action@v2` will flag these historical commits and permanently block CI-03
   - Recommendation: Add a `.gitleaks.toml` with `allowlist.commits` listing the offending SHAs, OR use `--no-git` scan mode that only scans the working tree (not history); investigate which approach gitleaks-action v2 supports

2. **Redis service for pytest**
   - What we know: The conftest only patches the DB engine; no Redis fixture is patched
   - What's unclear: Whether any test (e.g., `test_ingest_ais.py`) imports RQ/Redis at module scope and fails if Redis is absent
   - Recommendation: Scan test files for Redis imports; if any test instantiates Redis, add a Redis service container. Current analysis suggests Redis is not needed for the test suite.

3. **Alembic migration in CI**
   - What we know: Tests query real tables (e.g., `test_aircraft.py` reads from aircraft table)
   - What's unclear: Whether the alembic migration command succeeds cleanly in CI without a pre-existing DB state
   - Recommendation: Run `alembic upgrade head` before pytest; this is the standard pattern and should succeed on a fresh empty DB.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 8.x + pytest-asyncio 0.24 |
| Framework (frontend) | Vitest 4.x |
| Config file (backend) | `backend/pytest.ini` |
| Config file (frontend) | `frontend/vite.config.ts` (test block) |
| Quick run command (backend) | `cd backend && pytest tests/test_health.py -x` |
| Full suite command (backend) | `cd backend && pytest` |
| Quick run command (frontend) | `cd frontend && npx vitest run` |
| Full suite command (frontend) | `cd frontend && npx tsc -p tsconfig.app.json --noEmit && npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-01 | pytest runs and reports pass/fail in PR | smoke (manual — requires GH Actions) | `cd backend && pytest` | ✅ (tests exist) |
| CI-02 | vitest run + tsc --noEmit pass | smoke (manual — requires GH Actions) | `cd frontend && npx tsc -p tsconfig.app.json --noEmit && npx vitest run` | ✅ (vite.config.ts test block) |
| CI-03 | gitleaks fails on real credential | smoke (manual — requires GH Actions + test commit) | N/A locally | ❌ Wave 0: `.gitleaks.toml` |
| CI-04 | docker build --target production passes | smoke (manual — requires GH Actions) | `docker build --target production ./backend && docker build --target production --build-arg VITE_CESIUM_ION_TOKEN=x ./frontend` | ✅ (Dockerfiles exist) |

### Sampling Rate

- **Per task commit:** `cd backend && pytest tests/test_health.py -x` (fast smoke)
- **Per wave merge:** Full `pytest` + `tsc --noEmit` + `vitest run`
- **Phase gate:** All 4 workflow jobs green in GitHub Actions before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `.gitleaks.toml` — allowlist for known historical credential commits (covers CI-03 unblocking)
- [ ] `.github/workflows/ci.yml` — the workflow file itself (the primary deliverable of this phase)

## Sources

### Primary (HIGH confidence)
- [GitHub Docs: Creating PostgreSQL service containers](https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers) — service container YAML structure, health check options, hostname behavior
- [Docker Docs: Cache management with GitHub Actions](https://docs.docker.com/build/ci/github-actions/cache/) — `type=gha` cache backend, `setup-buildx-action`, `build-push-action`
- [Gitleaks Action on GitHub Marketplace](https://github.com/marketplace/actions/gitleaks) — version (v2.3.9), license requirements, minimal YAML

### Secondary (MEDIUM confidence)
- [Steve Kinney: Setting Up GitHub Actions to Run Vitest Unit Tests](https://stevekinney.com/courses/testing/continuous-integration) — vitest CI pattern verified against official vitest docs
- [GitHub Actions `setup-node` docs](https://github.com/actions/setup-node) — `cache: npm` option verified in action README

### Tertiary (LOW confidence)
- [Medium: GitHub Actions using Postgres/PostGIS](https://medium.com/chrisrbailey/github-actions-using-postgres-postgis-and-psql-e920a2aea7e1) — PostGIS-specific image name pattern; single source, mark for validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all action versions verified from official Marketplace/docs
- Architecture: HIGH — PostgreSQL service container pattern from GitHub Docs; Docker Buildx from Docker Docs
- Pitfalls: MEDIUM — PostGIS-specific pitfall (Pitfall 1) is inferred from PostGIS extension requirements; historical gitleaks issue (Pitfall 5) is documented in STATE.md

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (GitHub Actions action versions stable; Docker cache API v2 transition April 2025 already complete)
