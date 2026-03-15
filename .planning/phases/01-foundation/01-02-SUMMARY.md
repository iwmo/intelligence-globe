---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [cesiumjs, react, vite, zustand, tanstack-query, tailwindcss, shadcn, typescript]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: FastAPI /api/health endpoint that BottomStatusBar queries for connection status

provides:
  - CesiumJS globe rendered at full viewport with cinematic dark theme, atmosphere, day/night lighting
  - App shell skeleton: GlobeView, LeftSidebar (collapsed), BottomStatusBar, RightDrawer (hidden)
  - Zustand store with sidebarOpen and layer visibility stubs for Phase 2+
  - TanStack Query useHealthCheck hook querying /api/health
  - Vite build with CESIUM_BASE_URL pattern preventing Worker 404s
  - shadcn/ui initialized with Sheet and Separator components
  - Multi-stage Dockerfile for frontend (dev/builder/production)

affects:
  - 02-satellite-ingestion
  - 03-aircraft-tracking
  - 04-real-time

# Tech tracking
tech-stack:
  added:
    - cesium@1.139.1 — 3D globe rendering engine
    - zustand@5.0.11 — client state management
    - "@tanstack/react-query@5.90.21" — server state / data fetching
    - vite-plugin-static-copy — copies CesiumJS Worker/Asset files to dist
    - tailwindcss@3.4.19 — utility CSS framework
    - shadcn/ui@4.0.5 — component library (Sheet, Separator, Button)
    - tw-animate-css, @fontsource-variable/geist — shadcn dependencies
  patterns:
    - viewerRef guard pattern: ref check before AND after async await to prevent StrictMode double-invocation
    - CesiumJS import from "cesium" (not source paths) for correct Vite bundling
    - Single cesiumBaseUrl constant shared between define and viteStaticCopy targets
    - Graceful token fallback: skip createWorldTerrainAsync when VITE_CESIUM_ION_TOKEN is absent
    - Fixed-position overlay shell: GlobeView fills 100vw/100vh, chrome overlays use position:fixed

key-files:
  created:
    - frontend/vite.config.ts — CESIUM_BASE_URL define + viteStaticCopy + API proxy + @/* alias
    - frontend/src/components/GlobeView.tsx — CesiumJS Viewer with viewerRef guard and destroy cleanup
    - frontend/src/App.tsx — full-viewport shell with globe + all overlay chrome
    - frontend/src/styles/globe.css — CesiumJS chrome overrides and black background
    - frontend/src/store/useAppStore.ts — Zustand store with sidebarOpen + layer stubs
    - frontend/src/lib/api.ts — TanStack Query useHealthCheck hook
    - frontend/src/components/BottomStatusBar.tsx — branding + backend status display
    - frontend/src/components/LeftSidebar.tsx — collapsed placeholder for Phase 2+
    - frontend/src/components/RightDrawer.tsx — hidden placeholder for Phase 2+
    - frontend/Dockerfile — multi-stage dev/builder/production
    - frontend/tailwind.config.js — CSS variable color mappings for shadcn
    - frontend/postcss.config.js — tailwindcss + autoprefixer
  modified:
    - frontend/src/main.tsx — added QueryClientProvider wrapping
    - frontend/src/index.css — added Tailwind directives, shadcn CSS variables
    - frontend/index.html — title set to "OpenSignal Globe"
    - frontend/tsconfig.app.json — added baseUrl and @/* paths
    - frontend/tsconfig.json — added baseUrl and @/* paths at root level

key-decisions:
  - "viewerRef guard (not useState) for CesiumJS Viewer — prevents StrictMode double-mount destroying GPU context"
  - "Tailwind v3 (not v4) with shadcn/ui — v4 requires different CSS import pattern incompatible with existing vite config"
  - "outline-ring/50 removed from shadcn base CSS — Tailwind v3 does not support opacity modifiers on CSS variable colors"
  - "EllipsoidTerrainProvider fallback when VITE_CESIUM_ION_TOKEN absent — no crash on dev without ion token"

patterns-established:
  - "CesiumJS pattern: single cesiumBaseUrl constant in both define and viteStaticCopy targets to prevent Worker path mismatch"
  - "React pattern: viewerRef.current guard before AND after async initViewer() await — StrictMode strict double-invoke protection"
  - "CSS pattern: position:fixed overlays on top of 100vw/100vh GlobeView — no layout shift, no scrollbar"
  - "State pattern: Zustand store with Phase 2+ stubs (layers.satellites, layers.aircraft) as false defaults"

requirements-completed:
  - GLOB-01
  - GLOB-02

# Metrics
duration: 10min
completed: 2026-03-11
---

# Phase 1 Plan 02: React + Vite + CesiumJS Frontend Summary

**CesiumJS globe with cinematic dark theme, full-viewport app shell (sidebar, status bar, drawer), Zustand store, and TanStack Query health check — builds cleanly with CESIUM_BASE_URL Worker pattern**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-11T11:00:10Z
- **Completed:** 2026-03-11T11:09:57Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- CesiumJS Viewer renders with enableLighting, dynamicAtmosphereLighting, backgroundColor=BLACK, all six chrome widgets disabled
- App shell skeleton establishes correct dark palette (#000000 background, #00D4FF neon blue accents) ready for Phase 2+ without restyling
- Vite build passes with zero TypeScript errors; CesiumJS Workers/Assets copied to dist via viteStaticCopy

## Task Commits

Each task was committed atomically:

1. **Task 1: Vite + CesiumJS build configuration and package setup** - `af0797f` (feat — completed within Plan 01-01 docs commit)
2. **Task 2: Globe component, cinematic theme, and app shell skeleton** - `58b30a2` (feat)

## Files Created/Modified

- `frontend/vite.config.ts` — CESIUM_BASE_URL define + viteStaticCopy using shared cesiumBaseUrl constant, API proxy to :8000, @/* alias
- `frontend/src/components/GlobeView.tsx` — CesiumJS Viewer with viewerRef guard, StrictMode-safe async initViewer, destroy cleanup
- `frontend/src/App.tsx` — 100vw/100vh shell with GlobeView + three overlay chrome components
- `frontend/src/main.tsx` — entry with QueryClientProvider + StrictMode
- `frontend/src/styles/globe.css` — hides cesium-viewer-bottom, sets #000000 background, fullscreen cesiumContainer
- `frontend/src/store/useAppStore.ts` — Zustand: sidebarOpen, setSidebarOpen, layers (satellites/aircraft), setLayerVisible
- `frontend/src/lib/api.ts` — useHealthCheck: TanStack Query polling /api/health with 30s staleTime, 3 retries
- `frontend/src/components/BottomStatusBar.tsx` — fixed bottom bar: "OPENSIGNAL GLOBE" branding + API connection status
- `frontend/src/components/LeftSidebar.tsx` — placeholder (returns null when sidebarOpen=false)
- `frontend/src/components/RightDrawer.tsx` — placeholder (returns null, Phase 2+ populates)
- `frontend/Dockerfile` — multi-stage: base → development (npm run dev --host) → builder → production (nginx:alpine)
- `frontend/tailwind.config.js` — CSS variable color theme (border, background, foreground, primary, etc.)
- `frontend/postcss.config.js` — tailwindcss + autoprefixer
- `frontend/index.html` — title: "OpenSignal Globe"
- `frontend/tsconfig.app.json` / `tsconfig.json` — @/* alias pointing to ./src/*

## Decisions Made

- **viewerRef guard not useState**: CesiumJS Viewer stored in `useRef`, guarded before and after the async `initViewer()` call. React StrictMode invokes effects twice in development; using useState causes a second Viewer to mount on the same DOM node crashing the GPU context.
- **Tailwind v3 over v4**: shadcn/ui 4.0.5 initially detected Tailwind v4 (the default when installing `tailwindcss` from npm), but the Vite + PostGIS build pipeline works cleanly with v3. Downgraded to tailwindcss@3 to maintain a well-understood config-file pattern.
- **Removed `outline-ring/50` from shadcn base CSS**: The `/50` opacity modifier for CSS variable-backed colors is a Tailwind v4 feature. In v3, the modifier is unsupported on arbitrary CSS variable values. Removed to achieve clean build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn/ui init required Tailwind CSS v3 downgrade and CSS directive setup**
- **Found during:** Task 1 (package installation and shadcn init)
- **Issue:** `tailwindcss` installed was v4 (default npm latest). shadcn 4.0.5 init failed validating Tailwind — it detected v4 but our config was not set up for Tailwind v4's new CSS import pattern. Also needed `@tailwind base` directive in index.css for detection.
- **Fix:** Downgraded tailwindcss to v3.4.19, added autoprefixer + postcss.config.js, added `@tailwind base/components/utilities` directives to src/index.css. shadcn init then succeeded.
- **Files modified:** frontend/package.json, frontend/tailwind.config.js, frontend/postcss.config.js, frontend/src/index.css
- **Verification:** shadcn init completed, Sheet + Separator components installed
- **Committed in:** af0797f (Task 1)

**2. [Rule 1 - Bug] shadcn-generated `outline-ring/50` CSS breaks Tailwind v3 build**
- **Found during:** Task 1 (build verification)
- **Issue:** shadcn init wrote `@apply border-border outline-ring/50` into index.css. The `/50` opacity modifier is Tailwind v4 syntax; Tailwind v3 cannot resolve it for CSS variable-backed colors.
- **Fix:** Removed `outline-ring/50` from the `@apply` rule, keeping only `border-border`.
- **Files modified:** frontend/src/index.css
- **Verification:** `npm run build` exits 0 with no CSS errors
- **Committed in:** af0797f (Task 1)

**3. [Rule 3 - Blocking] Vite scaffold created nested `.git` inside frontend/ (submodule conflict)**
- **Found during:** Task 1 (git commit)
- **Issue:** `npm create vite@latest` initializes a git repo inside the scaffolded directory. The parent repo treated `frontend/` as an untracked submodule, preventing individual file staging.
- **Fix:** Removed `frontend/.git` directory to fold frontend into the parent git repository.
- **Files modified:** (metadata only — deleted `frontend/.git`)
- **Verification:** `git add frontend/...` staged files successfully
- **Committed in:** af0797f (Task 1)

---

**Total deviations:** 3 auto-fixed (1 blocking install issue, 1 CSS build bug, 1 git submodule collision)
**Impact on plan:** All three were tooling/environment issues with no impact on delivered functionality. The CesiumJS globe, app shell, and Vite build match the plan specification exactly.

## Issues Encountered

- shadcn 4.x CLI uses a Tailwind v4 CSS schema by default even when v3 is installed — required explicit v3 downgrade and CSS directive setup before init would succeed.

## User Setup Required

None — no external service configuration required for frontend build. Cesium ion token (`VITE_CESIUM_ION_TOKEN`) is optional; omitting it gracefully falls back to EllipsoidTerrainProvider.

## Next Phase Readiness

- Frontend builds cleanly and serves the cinematic globe at localhost:3000 (via `docker compose up` or `npm run dev`)
- App shell layout is established with correct dark palette — Phase 2 can populate LeftSidebar and RightDrawer without restyling
- Zustand store has layer stubs (`layers.satellites`, `layers.aircraft`) ready for Phase 2 satellite data
- useHealthCheck already queries `/api/health` — BottomStatusBar will show "connected" when backend is running
- Vite proxy configured: `/api/*` → `localhost:8000` — Phase 2 API calls need no proxy changes

## Self-Check: PASSED

All files verified present. All commits verified in git history.

---
*Phase: 01-foundation*
*Completed: 2026-03-11*
