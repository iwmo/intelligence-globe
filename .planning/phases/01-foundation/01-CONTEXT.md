# Phase 1: Foundation - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the full Docker Compose deployment stack and get a polished, visually impressive empty globe rendering in the browser. No real data yet — just infrastructure (FastAPI + PostgreSQL + PostGIS + Redis) and the CesiumJS globe with terrain, atmosphere, day/night shading, star field, and the dark cinematic theme applied. This is the visual and infrastructure foundation everything else builds on.

</domain>

<decisions>
## Implementation Decisions

### Cesium providers
- Use **Cesium ion** for terrain (Cesium World Terrain) and default imagery — requires a free ion access token stored in `.env` / Docker env vars
- ion token injected at build time via Vite env variable (`VITE_CESIUM_ION_TOKEN`)
- Fallback to Ellipsoid terrain if token is absent (graceful degradation, no crash)

### Globe visual identity
- **Accent color: neon blue** — `#00D4FF` / `#00CFFF` — mission control / aerospace aesthetic
- Background behind globe: pure black (`#000000`)
- Glowing orbit paths, billboard icons, and UI chrome all use this accent color consistently
- No default CesiumJS chrome visible: hide Cesium credit container, animation widget, base layer picker, geocoder, home button, navigation help
- Atmosphere and night-side lighting enabled; stars enabled with default density

### App shell layout
- Globe fills **100% of viewport** (fullscreen) — no margins, no scrollbar
- Phase 1 scaffolds the **structural skeleton** of the UI chrome even if empty/placeholder:
  - Left sidebar (collapsed by default, placeholder)
  - Bottom status bar (placeholder, shows "OpenSignal Globe" branding)
  - Right detail drawer (hidden until Phase 2+)
- This skeleton uses the correct dark palette so Phase 2+ can populate it without restyling
- Tailwind CSS + shadcn/ui for components

### Docker setup
- **Two-file approach**: `docker-compose.yml` (production-ready) + `docker-compose.override.yml` (dev: volume mounts for hot reload)
- Running `docker compose up` alone uses override automatically in dev — works out of the box
- Frontend: Vite dev server with HMR via volume mount in dev
- Backend: FastAPI with `--reload` via volume mount in dev
- Redis and PostgreSQL+PostGIS as named services with healthchecks
- `.env.example` committed; `.env` gitignored

### FastAPI structure
- Single `GET /api/health` endpoint returning `{"status": "ok", "version": "..."}` in Phase 1
- CORS configured to allow frontend origin
- SQLAlchemy + GeoAlchemy2 with PostGIS extension auto-enabled on startup

### State management
- **Zustand** (pre-decided over Redux) for client state
- TanStack Query for server state / data fetching

### Claude's Discretion
- Exact Dockerfile layering and build optimization
- PostgreSQL connection pool settings
- Specific Tailwind config and CSS reset choices
- CesiumJS camera initial position and zoom level
- Vite CesiumJS plugin configuration details

</decisions>

<specifics>
## Specific Ideas

- Visual reference: "mix of Google Earth, FlightRadar movement, aerospace mission control, modern SIGINT dashboard" — from the spec
- The globe should feel **operational and cinematic** from the first load — not a blank white sphere
- "Soft bloom / neon accents" — the accent glow should feel subtle, not garish
- Spec calls for: dark theme, glowing orbit paths, clean side panel, bottom status bar, right-side detail drawer, smooth animation

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield project

### Established Patterns
- No existing patterns — Phase 1 establishes them
- CesiumJS Primitive API (not Entity API) — pre-decided for performance at 5,000+ objects
- satellite.js runs in Web Worker — pre-decided to avoid main-thread jank

### Integration Points
- Frontend connects to backend at `/api/*` — proxied via Vite dev server in dev, nginx/direct in prod
- PostGIS extension must be enabled on DB startup (migration or init script)

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-11*
