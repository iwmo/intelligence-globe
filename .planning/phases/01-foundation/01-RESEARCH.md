# Phase 1: Foundation - Research

**Researched:** 2026-03-11
**Domain:** CesiumJS + Vite + React + FastAPI + Docker Compose + PostGIS
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use **Cesium ion** for terrain (Cesium World Terrain) and default imagery — requires a free ion access token stored in `.env` / Docker env vars
- ion token injected at build time via Vite env variable (`VITE_CESIUM_ION_TOKEN`)
- Fallback to Ellipsoid terrain if token is absent (graceful degradation, no crash)
- **Accent color: neon blue** — `#00D4FF` / `#00CFFF` — mission control / aerospace aesthetic
- Background behind globe: pure black (`#000000`)
- No default CesiumJS chrome visible: hide Cesium credit container, animation widget, base layer picker, geocoder, home button, navigation help
- Atmosphere and night-side lighting enabled; stars enabled with default density
- Globe fills **100% of viewport** (fullscreen) — no margins, no scrollbar
- Phase 1 scaffolds the **structural skeleton** of the UI chrome even if empty/placeholder:
  - Left sidebar (collapsed by default, placeholder)
  - Bottom status bar (placeholder, shows "OpenSignal Globe" branding)
  - Right detail drawer (hidden until Phase 2+)
- Tailwind CSS + shadcn/ui for components
- **Two-file approach**: `docker-compose.yml` (production-ready) + `docker-compose.override.yml` (dev: volume mounts for hot reload)
- Frontend: Vite dev server with HMR via volume mount in dev
- Backend: FastAPI with `--reload` via volume mount in dev
- Redis and PostgreSQL+PostGIS as named services with healthchecks
- `.env.example` committed; `.env` gitignored
- Single `GET /api/health` endpoint returning `{"status": "ok", "version": "..."}` in Phase 1
- CORS configured to allow frontend origin
- SQLAlchemy + GeoAlchemy2 with PostGIS extension auto-enabled on startup
- **Zustand** for client state (pre-decided over Redux)
- TanStack Query for server state / data fetching

### Claude's Discretion
- Exact Dockerfile layering and build optimization
- PostgreSQL connection pool settings
- Specific Tailwind config and CSS reset choices
- CesiumJS camera initial position and zoom level
- Vite CesiumJS plugin configuration details

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GLOB-01 | User sees a 3D interactive globe with terrain, atmosphere, day/night shading, and star field | CesiumJS Viewer with Cesium World Terrain + `globe.enableLighting = true` + SkyAtmosphere + default SkyBox stars |
| GLOB-02 | Globe renders with cinematic dark theme and glowing accents (mission control aesthetic) | Viewer constructor with all chrome widgets disabled; CSS overrides for `.cesium-viewer` background; Tailwind dark palette applied to UI shell |
| INFRA-01 | Full stack deployable via Docker Compose on homelab/VPS | `docker-compose.yml` + `docker-compose.override.yml` with healthchecks; `depends_on: condition: service_healthy` |
| INFRA-02 | FastAPI backend with PostgreSQL + PostGIS for spatial data storage | FastAPI + SQLAlchemy 2 async + GeoAlchemy2 + `postgis/postgis:16-3.5` image with auto PostGIS extension |
</phase_requirements>

---

## Summary

Phase 1 establishes the full technical foundation: a Docker Compose stack running four services (frontend, backend, PostgreSQL+PostGIS, Redis) and a polished, visually impressive empty CesiumJS globe. No real data is loaded — the goal is infrastructure running and the globe looking cinematic from the first browser load.

The two hardest sub-problems are (1) correctly wiring CesiumJS into Vite — a well-documented but still finicky build configuration — and (2) achieving the dark cinematic visual identity, which requires disabling all of CesiumJS's default UI chrome and applying correct CSS overrides. The rest (FastAPI skeleton, Docker Compose with healthchecks, PostGIS init) follows established patterns with low novelty risk.

All five technology areas have HIGH-confidence patterns from official sources. The main traps are the CesiumJS Vite build configuration (CESIUM_BASE_URL must match the static copy target) and shadcn/ui's Tailwind v4 vs v3 split (must use `shadcn@latest` for v4 or `shadcn@2.3.0` for v3).

**Primary recommendation:** Use the official `viteStaticCopy` approach from the CesiumGS/cesium-vite-example repository for CesiumJS integration — it is the only maintained, officially-endorsed path as of 2025. Avoid `vite-plugin-cesium` (unmaintained since 2024).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cesium | ^1.139.1 | 3D globe rendering, terrain, atmosphere | Industry standard for geospatial 3D web; only mature option with Cesium World Terrain |
| vite | ^6.x | Build tool + dev server | Official CesiumGS example uses Vite; HMR critical for globe dev workflow |
| react | ^19.x | UI framework | Pre-decided in spec |
| typescript | ^5.7 | Type safety | Pre-decided in spec |
| zustand | ^5.0.8 | Client state management | Pre-decided over Redux; zero boilerplate |
| @tanstack/react-query | ^5.x | Server state / data fetching | Pre-decided; handles stale data, refetch, loading states |
| tailwindcss | ^4.x | Utility CSS | Pre-decided; v4 is current as of 2025 |
| @shadcn/ui | latest | Component primitives | Pre-decided for UI shell |
| fastapi | ^0.115 | Backend framework | Pre-decided |
| sqlalchemy | ^2.0 | ORM with async support | Required for async patterns |
| geoalchemy2 | ^0.15 | PostGIS geometry types in SQLAlchemy | Standard integration for FastAPI + PostGIS |
| asyncpg | ^0.30 | Async PostgreSQL driver | Required for SQLAlchemy 2 async engine |
| pydantic | ^2.x | Request/response schemas | Bundled with FastAPI |

### Supporting (Dev)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-static-copy | ^1.x | Copies CesiumJS static assets (Workers, Assets, Widgets, ThirdParty) | Required for Vite build |
| @vitejs/plugin-react | ^4.x | React fast refresh | Standard React + Vite setup |
| pytest | ^8.x | Backend tests | Backend test suite |
| httpx | ^0.27 | Async HTTP client for pytest | Required for `AsyncClient` testing pattern |
| pytest-asyncio | ^0.24 | Async test support | Required for async FastAPI tests |
| alembic | ^1.14 | DB schema migrations | Required even in Phase 1 for PostGIS init |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| viteStaticCopy approach | vite-plugin-cesium | vite-plugin-cesium is unmaintained as of 2024; owner confirmed discontinued |
| viteStaticCopy approach | vite-plugin-cesium-build | Maintained alternative but less widely validated; official example uses viteStaticCopy |
| asyncpg | psycopg3 (async) | Both work; asyncpg is more battle-tested with GeoAlchemy2 |
| postgis/postgis:16-3.5 | postgis/postgis:17-3.5 | PG17 is available but PG16 is the current LTS-equivalent with widest compat |

**Installation (frontend):**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install cesium @tanstack/react-query zustand
npm install -D vite-plugin-static-copy @vitejs/plugin-react tailwindcss
npx shadcn@latest init
```

**Installation (backend):**
```bash
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] geoalchemy2 asyncpg alembic pydantic-settings
pip install --dev pytest httpx pytest-asyncio
```

---

## Architecture Patterns

### Recommended Project Structure
```
opensignal-globe/
├── docker-compose.yml           # Production-ready base services
├── docker-compose.override.yml  # Dev: volume mounts + hot reload
├── .env.example                 # Template with all required vars
├── .env                         # Gitignored
├── frontend/
│   ├── Dockerfile
│   ├── vite.config.ts           # CRITICAL: viteStaticCopy config + CESIUM_BASE_URL
│   ├── src/
│   │   ├── main.tsx             # Ion token init + QueryClientProvider + App
│   │   ├── App.tsx              # Layout shell (sidebar, status bar, drawer)
│   │   ├── components/
│   │   │   ├── GlobeView.tsx    # CesiumJS viewer mount, sole owner of viewer ref
│   │   │   ├── LeftSidebar.tsx  # Placeholder skeleton
│   │   │   ├── BottomStatusBar.tsx
│   │   │   └── RightDrawer.tsx  # Hidden placeholder
│   │   ├── store/
│   │   │   └── useAppStore.ts   # Zustand store
│   │   ├── lib/
│   │   │   └── api.ts           # Axios/fetch wrappers for /api/*
│   │   └── styles/
│   │       └── globe.css        # Cesium chrome overrides
└── backend/
    ├── Dockerfile
    ├── alembic.ini
    ├── app/
    │   ├── main.py              # FastAPI app, CORS, lifespan
    │   ├── config.py            # Pydantic settings
    │   ├── db.py                # Async engine, session factory
    │   ├── models/              # SQLAlchemy models (satellites etc. — stubbed in Phase 1)
    │   └── api/
    │       └── routes_health.py
    └── tests/
        └── test_health.py
```

### Pattern 1: CesiumJS Vite Configuration (CESIUM_BASE_URL)

**What:** CesiumJS requires four directories of static assets (Workers, Assets, Widgets, ThirdParty) to be available at a known URL at runtime. Vite's default bundling does not handle this — you must explicitly copy them and tell CesiumJS where to find them via `window.CESIUM_BASE_URL`.

**When to use:** Every Vite + CesiumJS project. This is mandatory.

**Example:**
```typescript
// vite.config.ts — Source: https://cesium.com/blog/2024/02/13/configuring-vite-or-webpack-for-cesiumjs/
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const cesiumSource = 'node_modules/cesium/Build/Cesium';
const cesiumBaseUrl = 'cesiumStatic';

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}/`),
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
      ],
    }),
  ],
  build: {
    // CesiumJS uses BigInt — required for some build targets
    target: 'esnext',
  },
});
```

### Pattern 2: CesiumJS Viewer — Dark Cinematic Setup

**What:** Creating a Viewer with all default UI chrome disabled and cinematic visual settings enabled.

**When to use:** GlobeView.tsx component initialization.

**Example:**
```typescript
// Source: https://cesium.com/learn/ion-sdk/ref-doc/Viewer.html
import { Ion, Viewer, createWorldTerrainAsync, SkyAtmosphere, Color } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// In GlobeView.tsx useEffect:
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';

const viewer = new Viewer(containerRef.current, {
  // Disable all default chrome
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  // Terrain: Cesium World Terrain or fallback
  terrainProvider: ionToken
    ? await createWorldTerrainAsync()
    : undefined,  // defaults to EllipsoidTerrainProvider
  // Keep default SkyBox (stars) and SkyAtmosphere
});

// Enable day/night lighting
viewer.scene.globe.enableLighting = true;
viewer.scene.globe.dynamicAtmosphereLighting = true;

// Make background pure black
viewer.scene.backgroundColor = Color.BLACK;

// Hide credit container via CSS class (not DOM removal — ToS requires credits)
// Apply in globe.css: .cesium-widget-credits { display: none !important; }
// Note: Cesium ion TOS requires credits visible for commercial use.
// For personal/homelab use this is acceptable. Verify ToS for your context.
```

### Pattern 3: FastAPI Async Setup with GeoAlchemy2

**What:** Async SQLAlchemy 2 engine + session dependency + PostGIS auto-enable on startup.

**When to use:** db.py + main.py lifespan.

**Example:**
```python
# db.py — Source: https://berkkaraal.com/blog/2024/09/19/...
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, AsyncAttrs
from sqlalchemy import text

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@postgres:5432/opensignal",
    echo=False,
    pool_size=5,
    max_overflow=10,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(AsyncAttrs, DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    """Enable PostGIS extension — idempotent."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
```

```python
# main.py — lifespan pattern
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

### Pattern 4: Docker Compose Two-File Dev Setup

**What:** `docker-compose.yml` defines production-ready services. `docker-compose.override.yml` adds volume mounts and `--reload`/HMR for dev. `docker compose up` automatically merges both in dev.

**Example:**
```yaml
# docker-compose.yml (base — production-ready)
services:
  postgres:
    image: postgis/postgis:16-3.5
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  backend:
    build: ./backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379/0
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

```yaml
# docker-compose.override.yml (dev — auto-merged)
services:
  backend:
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    volumes:
      - ./frontend/src:/app/src
    command: npm run dev -- --host 0.0.0.0
```

### Pattern 5: Zustand Store Shape (Phase 1 skeleton)

**What:** Establish the store shape that Phase 2+ will populate. Phase 1 only uses `uiState`.

**Example:**
```typescript
// store/useAppStore.ts — Source: https://github.com/pmndrs/zustand
import { create } from 'zustand';

interface AppState {
  // Phase 1: UI chrome state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  // Phase 2+: layer visibility (stubbed)
  layers: { satellites: boolean; aircraft: boolean };
  setLayerVisible: (layer: keyof AppState['layers'], visible: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  layers: { satellites: false, aircraft: false },
  setLayerVisible: (layer, visible) =>
    set((s) => ({ layers: { ...s.layers, [layer]: visible } })),
}));
```

### Anti-Patterns to Avoid

- **Creating multiple Viewer instances:** CesiumJS Viewer must be created once and held in a ref. React strict mode double-invokes effects — use a `viewerRef.current` guard.
- **Placing Viewer in React state:** Never `useState(viewer)` — triggers re-renders that destroy the globe.
- **Forgetting to call `viewer.destroy()` on unmount:** Causes GPU memory leaks. Always clean up in useEffect return.
- **Using `vite-plugin-cesium`:** Unmaintained since 2024. Use `viteStaticCopy` instead.
- **Calling `CREATE EXTENSION postgis` without `IF NOT EXISTS`:** Crashes on restart with existing volume.
- **Setting `allow_origins=["*"]` in CORS:** Use explicit frontend origin; wildcard blocks cookies/credentials.
- **Importing from `cesium/Source/`:** Always import from `"cesium"` (the ES module build), not source paths.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CesiumJS static asset serving | Custom webpack/Vite plugin | `vite-plugin-static-copy` | Workers/Assets paths are complex; CesiumGS publishes official approach |
| PostGIS Docker setup | Custom Dockerfile with extension install | `postgis/postgis:16-3.5` image | Image auto-creates extension on default DB; handles init scripts |
| Docker service startup ordering | `wait-for-it.sh` scripts | `healthcheck` + `depends_on: condition: service_healthy` | Native Compose feature; no extra scripts |
| Async DB session management | Manual session handling | `async_sessionmaker` + FastAPI `Depends` | Handles connection pool, rollback, cleanup |
| UI component primitives | Hand-coded dark buttons/panels | shadcn/ui | Accessible, Tailwind-based, consistent with dark theme |
| Ion token management | Hardcoded token | `import.meta.env.VITE_CESIUM_ION_TOKEN` | Vite's env system; `.env` gitignored |

**Key insight:** CesiumJS has unusually complex static asset requirements for a JS library — do not attempt to solve this with a custom build approach. Follow the official CesiumGS Vite example exactly.

---

## Common Pitfalls

### Pitfall 1: CESIUM_BASE_URL Mismatch
**What goes wrong:** CesiumJS loads at runtime but Workers silently fail — satellite propagation and terrain will not work (relevant from Phase 2).
**Why it happens:** The `define.CESIUM_BASE_URL` in vite.config.ts and the `dest` path in `viteStaticCopy` targets must be identical. If they differ, CesiumJS requests assets from the wrong path and gets 404s.
**How to avoid:** Set `const cesiumBaseUrl = 'cesiumStatic'` once and reference it in both places.
**Warning signs:** Console errors like `Failed to load resource: .../cesiumStatic/Workers/...` or `RuntimeError: Unable to load required Workers`.

### Pitfall 2: React StrictMode Double-Invocation Destroys Globe
**What goes wrong:** Viewer is created, destroyed, and created again during development — leaves orphaned WebGL contexts.
**Why it happens:** React 18+ StrictMode invokes effects twice in development to detect side effects.
**How to avoid:** Guard viewer creation with `if (viewerRef.current) return;` at the start of the useEffect, OR move viewer to a module-level singleton outside React's lifecycle.
**Warning signs:** "WebGL context lost" errors in dev, globe flickers on load.

### Pitfall 3: PostGIS Extension Not Created on Named Database
**What goes wrong:** Backend starts, DB connects, but `geoalchemy2` geometry columns fail — `type "geometry" does not exist`.
**Why it happens:** The `postgis/postgis` image auto-creates the extension only on the default `postgres` database. A custom `POSTGRES_DB` value gets the database created but NOT the extension unless an init script or the app calls `CREATE EXTENSION IF NOT EXISTS postgis`.
**How to avoid:** Call `CREATE EXTENSION IF NOT EXISTS postgis` in the FastAPI lifespan `init_db()` function, OR mount a `.sql` file in `/docker-entrypoint-initdb.d/`.
**Warning signs:** `sqlalchemy.exc.ProgrammingError: (asyncpg.exceptions.UndefinedObjectError) type "geometry" does not exist`.

### Pitfall 4: CesiumJS Credit Container TOS
**What goes wrong:** Using `display: none` on the credit container in a commercial context violates Cesium ion Terms of Service.
**Why it happens:** Cesium ion ToS requires attribution to be displayed when using their hosted assets (World Terrain, Bing imagery).
**How to avoid:** For personal/homelab use (this project's stated context), CSS hiding is acceptable. If the project ever becomes public-facing, move credits to a custom styled container instead of hiding.
**Warning signs:** Review terms at https://cesium.com/legal/terms-of-service/ if deployment scope changes.

### Pitfall 5: Tailwind v4 / shadcn Incompatibility
**What goes wrong:** `npx shadcn-ui@latest init` fails or produces broken output.
**Why it happens:** shadcn/ui moved to support Tailwind v4 with `shadcn@latest` (CLI). The older `shadcn-ui` package name is deprecated. If the project uses Tailwind v3, must use `shadcn@2.3.0`.
**How to avoid:** Use `npx shadcn@latest init` (not `shadcn-ui`) and let it detect Tailwind version automatically.
**Warning signs:** PostCSS errors, or shadcn components not applying styles.

### Pitfall 6: `--reload` in Production Docker
**What goes wrong:** Uvicorn runs in development reload mode in production — watches filesystem, wastes CPU, not stable.
**Why it happens:** `command:` in `docker-compose.override.yml` includes `--reload`; if override is accidentally used in production it carries over.
**How to avoid:** The two-file approach prevents this: production uses only `docker-compose.yml` (no `up` merges override). Document explicitly in README.
**Warning signs:** Uvicorn logs showing `Watching for file changes` in production.

---

## Code Examples

### Minimal Health Endpoint
```python
# Source: https://fastapi.tiangolo.com/tutorial/testing/
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
```

### Health Endpoint Test
```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_returns_200():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_health_has_version():
    response = client.get("/api/health")
    data = response.json()
    assert "version" in data
    assert isinstance(data["version"], str)
```

### Globe CSS Overrides
```css
/* src/styles/globe.css */

/* Remove all default Cesium background so globe floats on pure black */
.cesium-viewer,
.cesium-widget,
.cesium-widget canvas {
  background: #000000 !important;
}

/* Hide credit container (personal/homelab use only) */
.cesium-viewer-bottom {
  display: none !important;
}

/* Fullscreen globe */
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #000000;
}

#cesiumContainer {
  width: 100vw;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
}
```

### Vite Proxy for Dev
```typescript
// vite.config.ts server section
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```

### TanStack Query Health Check Hook
```typescript
// lib/api.ts + hooks/useHealth.ts
import { useQuery } from '@tanstack/react-query';

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Backend unreachable');
      return res.json() as Promise<{ status: string; version: string }>;
    },
    staleTime: 30_000,
    retry: 3,
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vite-plugin-cesium` (nshen) | `viteStaticCopy` + official CesiumGS example | 2024 (plugin abandoned) | Must migrate; plugin no longer maintained |
| `Ion.defaultAccessToken = "token"` hardcoded | `import.meta.env.VITE_CESIUM_ION_TOKEN` | Ongoing best practice | Security — token never in source |
| `@types/cesium` separate package | Types included in `cesium` package | ~1.100 | No longer install `@types/cesium` separately |
| `FastAPI.on_event("startup")` | `asynccontextmanager` lifespan | FastAPI 0.93+ | `on_event` deprecated; use lifespan |
| `celery` for background jobs | `RQ` (pre-decided for this project) | Project decision | Phase 2+ concern, not Phase 1 |
| `shadcn-ui` CLI package name | `shadcn` CLI package name | 2024 | Run `npx shadcn@latest init`, not `shadcn-ui` |

**Deprecated/outdated:**
- `@types/cesium`: Do not install — types ship with `cesium` package itself since ~v1.100
- `Cesium.Ion.defaultAccessToken = "your_token_here"` directly in source: Use env vars
- `app.on_event("startup")` in FastAPI: Replaced by `asynccontextmanager` lifespan pattern

---

## Open Questions

1. **Cesium ion token for CI/CD**
   - What we know: Token must be in `.env`; dev has it locally
   - What's unclear: How to handle automated tests that boot the frontend where `VITE_CESIUM_ION_TOKEN` may be absent
   - Recommendation: The CONTEXT.md decision covers this — fallback to EllipsoidTerrainProvider when token absent. Tests should set `VITE_CESIUM_ION_TOKEN=` (empty) and verify no crash.

2. **PostGIS version compatibility with GeoAlchemy2**
   - What we know: GeoAlchemy2 0.15+ supports PostGIS 3.x
   - What's unclear: Whether `postgis/postgis:16-3.5` vs `17-3.5` matters for this phase
   - Recommendation: Use `16-3.5` — Phase 1 only needs PostGIS enabled; no spatial queries yet.

3. **shadcn/ui component scope for Phase 1**
   - What we know: Only placeholder sidebar, status bar, and drawer needed
   - What's unclear: Exactly which shadcn components needed in Phase 1
   - Recommendation: Install shadcn init + `Sheet` (for drawers) + `Separator` — sufficient for skeleton. Phase 4 adds more.

---

## Validation Architecture

> `workflow.nyquist_validation: true` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + httpx + pytest-asyncio |
| Config file | `backend/pytest.ini` or `pyproject.toml [tool.pytest.ini_options]` — Wave 0 gap |
| Quick run command | `pytest backend/tests/test_health.py -x` |
| Full suite command | `pytest backend/tests/ -v` |

Frontend testing is **manual-only** for Phase 1 (visual validation — no Playwright/Cypress yet). Phase 5 adds performance validation tooling.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | `docker compose up` brings all services online | smoke (manual) | `docker compose up -d && docker compose ps` — all "healthy" | ❌ Wave 0 |
| INFRA-01 | postgres healthcheck passes | automated | `pytest backend/tests/test_db.py::test_postgres_reachable -x` | ❌ Wave 0 |
| INFRA-01 | redis healthcheck passes | automated | `pytest backend/tests/test_db.py::test_redis_reachable -x` | ❌ Wave 0 |
| INFRA-02 | FastAPI health endpoint returns 200 | unit | `pytest backend/tests/test_health.py::test_health_returns_200 -x` | ❌ Wave 0 |
| INFRA-02 | Health response contains `status: ok` | unit | `pytest backend/tests/test_health.py::test_health_has_version -x` | ❌ Wave 0 |
| INFRA-02 | PostGIS extension exists in DB | integration | `pytest backend/tests/test_db.py::test_postgis_extension_exists -x` | ❌ Wave 0 |
| GLOB-01 | Globe renders with terrain, atmosphere, stars | visual (manual) | Open browser at `localhost:3000`, confirm globe visible | N/A |
| GLOB-02 | No default CesiumJS chrome visible | visual (manual) | Confirm no animation widget, geocoder, home button, base layer picker | N/A |
| GLOB-02 | Frontend communicates with backend health endpoint | e2e (manual) | BottomStatusBar shows "connected" (TanStack Query health hook) | N/A |

### Sampling Rate
- **Per task commit:** `pytest backend/tests/test_health.py -x` (< 5 seconds)
- **Per wave merge:** `pytest backend/tests/ -v` (full backend suite)
- **Phase gate:** Full suite green + manual globe visual check before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_health.py` — covers INFRA-02 health endpoint
- [ ] `backend/tests/test_db.py` — covers INFRA-01 (postgres reachable, redis reachable, PostGIS extension exists)
- [ ] `backend/pytest.ini` or `pyproject.toml` test config — asyncio_mode = "auto"
- [ ] Framework install verification: `pip install pytest httpx pytest-asyncio` in backend Dockerfile dev stage

---

## Sources

### Primary (HIGH confidence)
- [CesiumGS/cesium-vite-example](https://github.com/CesiumGS/cesium-vite-example) — Official minimal Vite + CesiumJS setup
- [Cesium Blog: Configuring Vite or Webpack for CesiumJS](https://cesium.com/blog/2024/02/13/configuring-vite-or-webpack-for-cesiumjs/) — Official 2024 guide, viteStaticCopy approach
- [CesiumJS Viewer API Reference](https://cesium.com/learn/ion-sdk/ref-doc/Viewer.html) — All constructor options for disabling chrome
- [CesiumJS Globe API Reference](https://cesium.com/learn/ion-sdk/ref-doc/Globe.html) — enableLighting, showGroundAtmosphere properties
- [FastAPI Docker Deployment](https://fastapi.tiangolo.com/deployment/docker/) — Official FastAPI Docker guide
- [TanStack Query v5 Quick Start](https://tanstack.com/query/v5/docs/react/quick-start) — Official setup docs
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite) — Official Vite + shadcn/ui setup
- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) — Official healthcheck + depends_on docs
- [postgis/postgis Docker Hub](https://hub.docker.com/r/postgis/postgis) — Image tags and init behavior

### Secondary (MEDIUM confidence)
- [Setup FastAPI with Async SQLAlchemy 2, Alembic, PostgreSQL](https://berkkaraal.com/blog/2024/09/19/setup-fastapi-project-with-async-sqlalchemy-2-alembic-postgresql-and-docker/) — Verified against official SQLAlchemy docs; async engine + session dependency pattern
- [zustand npm](https://www.npmjs.com/package/zustand) — Current version 5.0.8 confirmed
- [cesium npm](https://www.npmjs.com/package/cesium) — Current version 1.139.1 confirmed

### Tertiary (LOW confidence)
- Community Cesium forum posts on credit container CSS — practice is widespread but not officially documented as acceptable for ion ToS; flag for review if project becomes commercial

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed from npm registry; official docs consulted
- Architecture: HIGH — follows official CesiumGS example and FastAPI best practices
- Pitfalls: HIGH for build config (direct official source); MEDIUM for ToS credit issue (community-sourced)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (CesiumJS releases monthly; check for breaking changes in 1.140+)
