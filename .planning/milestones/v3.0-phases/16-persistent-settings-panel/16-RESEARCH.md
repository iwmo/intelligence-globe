# Phase 16: Persistent Settings Panel — Research

**Researched:** 2026-03-13
**Domain:** React state management (Zustand), localStorage persistence, keyboard shortcut integration, CesiumJS camera API
**Confidence:** HIGH

---

## Summary

Phase 16 adds a hidden settings panel that lets users configure startup defaults: which layers load, which visual preset is active, where the camera starts, and whether the app opens in LIVE or PLAYBACK mode. All choices persist in `localStorage` and apply on the next page load.

The codebase already has every building block this phase needs. `useAppStore.ts` (Zustand) already contains the `layers`, `visualPreset`, and `replayMode` slices that represent the values to be configured. `DraggablePanel` already implements `localStorage`-backed position/collapse persistence with the project's house pattern. `viewerRegistry.ts` exposes `flyToLandmark` (which accepts `lon`, `lat`, `altMeters`, `heading`, `pitch`) and `setPitchPreset`. `useKeyboardShortcuts.ts` shows exactly how to wire a key handler safely (skip when typing in input/textarea). The keyboard shortcut `Comma` (`,`) is the natural choice for settings — it is unused by the landmark shortcuts (Q/W/E/R/T).

The work is: (1) define a `settingsStore` Zustand slice that owns startup defaults and persists them to `localStorage` using Zustand's `persist` middleware; (2) build `SettingsPanel.tsx` as a `DraggablePanel` that is conditionally rendered from `App.tsx`, toggled by a keyboard shortcut and/or a small gear icon; (3) apply settings at app boot in `App.tsx` — read the store, then call `setLayerVisible`, `setVisualPreset`, `setReplayMode`, and `viewer.camera.flyTo`.

**Primary recommendation:** Add a dedicated `useSettingsStore` with Zustand `persist` middleware (localStorage), render `SettingsPanel` as a `DraggablePanel` hidden by default, toggle open/closed via keyboard shortcut `,` + optional icon, and apply defaults in `App.tsx` after `onViewerReady` fires.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONFIG-01 | Hidden settings panel accessible via keyboard shortcut or icon (not cluttering main view) | `useKeyboardShortcuts` hook pattern shows safe window keydown wiring; DraggablePanel provides the panel container; a boolean `settingsPanelOpen` state in App.tsx gates rendering |
| CONFIG-02 | User can configure which layers are enabled on initial load | `useAppStore.layers` already has the 6 layer keys; `settingsStore` stores mirror defaults; on mount, call `setLayerVisible` for each |
| CONFIG-03 | User can set the default visual preset (Normal, NVG, CRT, FLIR, Noir) | `VisualPreset` type already exported from `useAppStore`; `setVisualPreset` already wired to `PostProcessEngine`; settings store persists chosen default, applied via `setVisualPreset` at boot |
| CONFIG-04 | User can set the default camera starting position, zoom level, and tilt | `viewerRegistry.flyToLandmark` accepts `{ lon, lat, altMeters, pitch }`; camera current position readable via `viewer.camera.positionCartographic` + `viewer.camera.pitch` for "capture current view" UX |
| CONFIG-05 | User can set whether the app starts in LIVE or PLAYBACK mode | `useAppStore.replayMode` already exists; settings store persists default; `setReplayMode` called at boot before any data fetch begins |
| CONFIG-06 | All settings persist in localStorage and apply on next load | Zustand `persist` middleware with `localStorage` storage satisfies this completely; DraggablePanel already uses same pattern (raw localStorage) for position; settings store uses middleware for typed persistence |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.11 (installed) | Settings state + persistence | Already the project's state manager; `persist` middleware built-in |
| zustand/middleware | built into zustand | `persist` middleware for localStorage | Official Zustand persistence pattern; zero additional dependency |
| React (useState) | ^19.2.0 (installed) | `settingsPanelOpen` boolean in App.tsx | Transient UI visibility state — not stored anywhere |
| lucide-react | ^0.577.0 (installed) | Settings gear icon (`Settings` from lucide-react) | Already used project-wide for layer icons |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DraggablePanel (internal) | Phase 13 component | Panel container with drag, collapse, localStorage position | Use for ALL floating UI panels in this project (project memory mandates this) |
| viewerRegistry.ts (internal) | Phase 15 module | `flyToLandmark`, `setPitchPreset`, `getViewer` | Applying camera defaults at boot |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand persist | Custom localStorage read/write | Custom = more code, no TypeScript type safety for partial updates, no hydration helpers. Project already uses Zustand — persist middleware is the zero-cost addition. |
| Separate settingsStore | Add slice to useAppStore | Separate store is cleaner: settings defaults are configuration, not runtime app state. Keeps useAppStore from growing further. Either works; separate is more maintainable. |

**Installation:** No new packages required. All dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── store/
│   ├── useAppStore.ts        # existing — DO NOT modify for Phase 16
│   └── useSettingsStore.ts   # NEW — settings defaults with persist middleware
├── components/
│   ├── SettingsPanel.tsx     # NEW — DraggablePanel wrapping all settings controls
│   └── ...existing...
├── hooks/
│   └── useKeyboardShortcuts.ts  # existing — extend to add ',' shortcut OR add separate hook
└── App.tsx                   # extend: mount SettingsPanel, apply defaults post-onViewerReady
```

### Pattern 1: Zustand persist middleware for localStorage

**What:** Wrap the store creator with `persist()` — Zustand serializes the entire state to a single `localStorage` key on every mutation and rehydrates it synchronously on first access.

**When to use:** Any state that must survive page reload without manual read/write code.

**Example:**
```typescript
// Source: Zustand docs — persist middleware
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  defaultLayers: {
    satellites: boolean;
    aircraft: boolean;
    militaryAircraft: boolean;
    ships: boolean;
    gpsJamming: boolean;
    streetTraffic: boolean;
  };
  defaultPreset: VisualPreset;
  defaultCamera: { lon: number; lat: number; altMeters: number; pitch: number } | null;
  defaultMode: 'live' | 'playback';
  setDefaultLayers: (layers: SettingsState['defaultLayers']) => void;
  setDefaultPreset: (preset: VisualPreset) => void;
  setDefaultCamera: (cam: SettingsState['defaultCamera']) => void;
  setDefaultMode: (mode: 'live' | 'playback') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultLayers: { satellites: true, aircraft: true, militaryAircraft: false, ships: false, gpsJamming: false, streetTraffic: false },
      defaultPreset: 'normal',
      defaultCamera: null,  // null = use CesiumJS built-in default
      defaultMode: 'live',
      setDefaultLayers: (layers) => set({ defaultLayers: layers }),
      setDefaultPreset: (preset) => set({ defaultPreset: preset }),
      setDefaultCamera: (cam) => set({ defaultCamera: cam }),
      setDefaultMode: (mode) => set({ defaultMode: mode }),
    }),
    { name: 'globe-settings' }  // localStorage key
  )
);
```

### Pattern 2: Settings panel toggle — keyboard shortcut + icon

**What:** Boolean `settingsPanelOpen` in App.tsx local state, toggled by keyboard shortcut and an icon button. `SettingsPanel` is rendered only when `settingsPanelOpen` is true (unmount-based hide, not CSS display:none).

**When to use:** Any panel that is intentionally rare-access and should not waste render cycles when hidden.

**Note on shortcut key:** Landmark shortcuts use Q/W/E/R/T. The existing `useKeyboardShortcuts` hook only handles those keys. Add `,` (Comma) for settings — it is clearly distinct, easy to remember as "config", and does not conflict with any existing shortcut.

**Example:**
```typescript
// In App.tsx
const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ',') setSettingsPanelOpen(v => !v);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### Pattern 3: Apply settings at boot in App.tsx

**What:** After `onViewerReady` fires, read `useSettingsStore.getState()` and apply all defaults to `useAppStore` and the CesiumJS viewer.

**When to use:** One-time initialization — runs once per page load.

**Critical ordering:** Layers and mode can apply immediately at mount. Camera position must wait for `onViewerReady` because `flyTo` requires a live `Viewer`. Apply camera via `flyToLandmark` (already in `viewerRegistry`), which handles `cancelFlight` internally.

```typescript
// In App.tsx — inside onViewerReady callback
const settings = useSettingsStore.getState();

// Apply layer defaults
const { setLayerVisible } = useAppStore.getState();
Object.entries(settings.defaultLayers).forEach(([layer, visible]) => {
  setLayerVisible(layer as keyof AppState['layers'], visible);
});

// Apply visual preset
useAppStore.getState().setVisualPreset(settings.defaultPreset);

// Apply replay mode
useAppStore.getState().setReplayMode(settings.defaultMode);

// Apply camera position (only if user has saved one)
if (settings.defaultCamera) {
  flyToLandmark(settings.defaultCamera);
}
```

**Note:** `useAppStore` initializes `layers` with its own hardcoded defaults before settings are read. The apply-on-boot pattern overwrites them. This is correct; settings store is the source of truth for what the user wants.

### Pattern 4: "Capture current view" button for camera default

**What:** A button in SettingsPanel that reads the current camera position from the viewer and saves it as `defaultCamera`.

**Why:** Asking users to type longitude/latitude/altitude numbers is hostile UX. Letting them fly to where they want and click "Save current view" is the correct intelligence-tool pattern.

**Example:**
```typescript
// In SettingsPanel.tsx
import { getViewer } from '../lib/viewerRegistry';
import { Math as CesiumMath } from 'cesium';

function captureCamera() {
  const viewer = getViewer();
  if (!viewer || viewer.isDestroyed()) return;
  const carto = viewer.camera.positionCartographic;
  setDefaultCamera({
    lon: CesiumMath.toDegrees(carto.longitude),
    lat: CesiumMath.toDegrees(carto.latitude),
    altMeters: carto.height,
    pitch: CesiumMath.toDegrees(viewer.camera.pitch),
  });
}
```

### Anti-Patterns to Avoid

- **Don't add settings state to `useAppStore`:** The settings store is persistent configuration; `useAppStore` is live runtime state. Mixing them creates persistence bugs (e.g., selected entity IDs or replayTs getting persisted to localStorage and reloaded as stale values).
- **Don't use `display: none` to hide SettingsPanel:** Unmount the component. Render it conditionally (`{settingsPanelOpen && <SettingsPanel />}`). DraggablePanel saves its own position to localStorage on unmount via the useEffect dep, so there is no position loss on close/reopen.
- **Don't apply camera default before viewer is ready:** `flyToLandmark` calls `_viewer.camera.flyTo` — if called before `onViewerReady`, `_viewer` is null and the call is silently ignored. Always gate camera application inside the `onViewerReady` callback.
- **Don't use the Zustand persist `partialize` option unless needed:** Since this is a dedicated settings store with only configuration data, persisting the entire state is correct. No need to filter.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| localStorage read/write with error handling | Custom JSON.parse/stringify with try/catch | Zustand `persist` middleware | Handles serialization, hydration, storage errors, partial state migrations — all edge cases covered |
| Panel UI container with drag/collapse/position persistence | New panel component | `DraggablePanel` (existing) | Already used for all 4 sidebar panels; consistent visual style; localStorage already wired |
| Camera position snapshot | Custom Cartographic math | `getViewer()` + `viewer.camera.positionCartographic` + `CesiumMath.toDegrees` | Already used in `flyToLandmark`; known-working pattern |
| Settings gear icon SVG | Inline SVG | `Settings` from `lucide-react` (installed) | Consistent with existing layer icons |

**Key insight:** This phase is almost entirely wiring — the hard problems (persistence, panel UI, camera API, keyboard shortcuts) are all solved in the existing codebase.

---

## Common Pitfalls

### Pitfall 1: Settings applied before viewer is ready

**What goes wrong:** Camera `flyTo` is called in a `useEffect` that runs before `onViewerReady` fires. `getViewer()` returns `null`. Camera starts at CesiumJS default silently.

**Why it happens:** React `useEffect` with `[]` deps runs after first render; `onViewerReady` is an async callback that fires after CesiumJS async init (which itself awaits imagery provider). The two timelines are independent.

**How to avoid:** Apply camera default inside the `onViewerReady` callback in App.tsx — it is the earliest safe point. Layer and mode defaults can apply at component mount (they don't need the viewer).

**Warning signs:** Globe always starts at the default CesiumJS position even when a camera default is saved.

### Pitfall 2: Runtime state polluted into persisted settings

**What goes wrong:** Putting `replayTs`, `selectedAircraftId`, or other transient runtime values in `useSettingsStore` (which persists to localStorage). On next load, stale values like a selected aircraft from a previous session are immediately applied.

**Why it happens:** Developer adds settings and runtime state to the same store for convenience.

**How to avoid:** `useSettingsStore` holds ONLY the six config defaults. Everything else stays in `useAppStore` (which has no persistence middleware).

**Warning signs:** Entity detail panels open on load, replay starts at a stale timestamp.

### Pitfall 3: Zustand persist rehydration race

**What goes wrong:** A component reads `useSettingsStore` during its render before Zustand has rehydrated from localStorage. Returns initial defaults even though saved values exist.

**Why it happens:** Only relevant when using async storage adapters (IndexedDB, AsyncStorage). Zustand `persist` with `localStorage` is **synchronous** — rehydration completes before first render. This pitfall does NOT apply here.

**How to avoid:** Use the default `localStorage` storage (not async). No extra `onRehydrateStorage` handling needed.

**Warning signs:** Would manifest as settings appearing to reset on hard reload — won't happen with sync storage.

### Pitfall 4: SettingsPanel open state leaking into URL or session storage

**What goes wrong:** Persisting `settingsPanelOpen` causes the panel to reopen on every reload.

**Why it happens:** Adding open/closed visibility state to the persisted settings store.

**How to avoid:** `settingsPanelOpen` lives in App.tsx `useState` only — never persisted. The panel always starts closed.

**Warning signs:** Users complained the settings panel is always visible on load.

### Pitfall 5: `useAppStore` initial layer defaults override settings on reload

**What goes wrong:** `useAppStore` initializes `layers` with hardcoded defaults (`satellites: true, aircraft: true, ...`). If settings application in `onViewerReady` happens after the layer components have already begun fetching, toggling a layer off triggers a redundant fetch+cancel cycle.

**Why it happens:** Layer hooks (`useSatellites`, `useAircraft`, etc.) start fetching as soon as their `layers.X` flag is true — which is immediately on mount before settings are applied.

**How to avoid:** Apply `setLayerVisible` defaults synchronously during module initialization or in a very early `useEffect` in App.tsx with `[]` deps — before layer components mount. One approach: read settings store during the Zustand `create` initializer of `useAppStore` (overriding the hardcoded defaults with stored ones). Simpler: accept the minor fetch/cancel on first load — it is one network request and invisible to the user.

**Warning signs:** Network tab shows a satellite/aircraft fetch immediately followed by cancellation on hard reload when those layers are set to off in settings.

---

## Code Examples

Verified patterns from codebase inspection:

### Zustand store with persist (matches existing useAppStore.ts style)
```typescript
// Source: frontend/src/store/useAppStore.ts + zustand/middleware docs
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VisualPreset } from './useAppStore';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({ /* initial state + actions */ }),
    { name: 'globe-settings' }
  )
);
```

### Keyboard shortcut pattern (from useKeyboardShortcuts.ts)
```typescript
// Source: frontend/src/hooks/useKeyboardShortcuts.ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === ',') setSettingsPanelOpen(v => !v);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### DraggablePanel usage (from LeftSidebar.tsx)
```typescript
// Source: frontend/src/components/LeftSidebar.tsx
<DraggablePanel id="settings" title="SETTINGS" defaultPos={{ x: 300, y: 40 }} minWidth={240}>
  {/* settings content */}
</DraggablePanel>
```

### Capture camera position (from viewerRegistry.ts + GlobeView.tsx patterns)
```typescript
// Source: frontend/src/lib/viewerRegistry.ts — positionCartographic + CesiumMath pattern
import { getViewer } from '../lib/viewerRegistry';
import { Math as CesiumMath } from 'cesium';

const viewer = getViewer();
if (viewer && !viewer.isDestroyed()) {
  const carto = viewer.camera.positionCartographic;
  const snapshot = {
    lon: CesiumMath.toDegrees(carto.longitude),
    lat: CesiumMath.toDegrees(carto.latitude),
    altMeters: carto.height,
    pitch: CesiumMath.toDegrees(viewer.camera.pitch),
  };
}
```

### Apply settings at boot (onViewerReady callback in App.tsx)
```typescript
// Source: pattern derived from GlobeView.tsx + viewerRegistry.ts usage in App.tsx
<GlobeView onViewerReady={(v) => {
  registerViewer(v);
  setCesiumViewer(v);
  // Apply settings after viewer is live
  const s = useSettingsStore.getState();
  const appStore = useAppStore.getState();
  Object.entries(s.defaultLayers).forEach(([k, visible]) =>
    appStore.setLayerVisible(k as keyof typeof s.defaultLayers, visible)
  );
  appStore.setVisualPreset(s.defaultPreset);
  appStore.setReplayMode(s.defaultMode);
  if (s.defaultCamera) flyToLandmark(s.defaultCamera);
}} />
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sliding sidebar with hamburger | Free-floating DraggablePanel per section | Phase 13 (2026-03-13) | Settings panel MUST be a DraggablePanel — no sliding sidebar |
| Zustand 4.x `persist` API | Zustand 5.x `persist` from `zustand/middleware` | v5 (2024) | Import path changed; `create<State>()(persist(...))` double-call syntax required in v5 |
| Chevron/grid-template-rows collapse | +/- button with inline grid collapse | Phase 13 | Already handled by DraggablePanel — no extra code needed |

**Deprecated/outdated:**
- `zustand/middleware/persist` (old path): In Zustand 5.x, import is `import { persist } from 'zustand/middleware'` — confirmed in project's installed version (5.0.11).

---

## Open Questions

1. **Where should the settings toggle icon live?**
   - What we know: Project has no dedicated "system controls" area. CameraControlWidget is bottom-right. LandmarkNav is top. HUD shows lat/lon.
   - What's unclear: Whether to add a standalone icon button somewhere on the globe, or whether the keyboard shortcut alone (`,`) is sufficient for the phase requirements.
   - Recommendation: Per CONFIG-01, both keyboard shortcut AND icon are required. Add a small gear icon (`Settings` from lucide-react) to `CameraControlWidget.tsx` as an additional button in its column, since that widget is already a permanent HUD element. Alternatively, a fixed `position: fixed` icon button in App.tsx is simpler. The planner should decide; either satisfies CONFIG-01.

2. **Should layer defaults in settingsStore mirror or override useAppStore's initial defaults?**
   - What we know: `useAppStore` hardcodes `{ satellites: true, aircraft: true, militaryAircraft: false, ships: false, gpsJamming: false, streetTraffic: false }`. Settings store needs the same shape as its defaults.
   - What's unclear: On first ever load (no localStorage key yet), should settings store initial defaults match `useAppStore` exactly?
   - Recommendation: Yes — initialize `settingsStore.defaultLayers` with identical values so first-ever load is identical to current behavior. Users who never open settings see no change.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| Config file | `frontend/vite.config.ts` (test section, jsdom environment) |
| Quick run command | `cd frontend && npx vitest run src/store/__tests__/useSettingsStore.test.ts` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONFIG-01 | Settings panel hidden by default, toggle opens/closes it | unit | `npx vitest run src/components/__tests__/SettingsPanel.test.tsx` | Wave 0 |
| CONFIG-02 | defaultLayers stored and read back correctly | unit | `npx vitest run src/store/__tests__/useSettingsStore.test.ts` | Wave 0 |
| CONFIG-03 | defaultPreset stored and read back correctly | unit | `npx vitest run src/store/__tests__/useSettingsStore.test.ts` | Wave 0 |
| CONFIG-04 | defaultCamera stored and read back; null = no camera apply at boot | unit | `npx vitest run src/store/__tests__/useSettingsStore.test.ts` | Wave 0 |
| CONFIG-05 | defaultMode stored and read back; applied via setReplayMode | unit | `npx vitest run src/store/__tests__/useSettingsStore.test.ts` | Wave 0 |
| CONFIG-06 | persist middleware serializes to localStorage key "globe-settings" | unit | `npx vitest run src/store/__tests__/useSettingsStore.test.ts` | Wave 0 |

**Note on CONFIG-06:** Vitest with jsdom has a working `localStorage` implementation. Test by calling a setter, then reading `localStorage.getItem('globe-settings')` and parsing — same pattern used for DraggablePanel position tests in other phases. No mocking needed.

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run src/store/__tests__/useSettingsStore.test.ts`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/store/__tests__/useSettingsStore.test.ts` — covers CONFIG-02 through CONFIG-06 (store + persistence)
- [ ] `frontend/src/components/__tests__/SettingsPanel.test.tsx` — covers CONFIG-01 (panel renders, toggle, keyboard shortcut)

*(No framework install needed — Vitest and jsdom already installed and configured.)*

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/store/useAppStore.ts` — existing Zustand store shape, `VisualPreset` type, `layers` keys, `replayMode` type
- `frontend/src/components/DraggablePanel.tsx` — localStorage persistence pattern, panel UI conventions
- `frontend/src/lib/viewerRegistry.ts` — `flyToLandmark`, `getViewer`, `setPitchPreset` signatures
- `frontend/src/hooks/useKeyboardShortcuts.ts` — keyboard shortcut registration pattern
- `frontend/src/App.tsx` — `onViewerReady` callback structure, component mount order
- `frontend/package.json` — confirmed zustand 5.0.11, lucide-react 0.577.0, vitest 4.0.18 installed
- `frontend/vite.config.ts` — confirmed test config: jsdom, setupFiles, globals

### Secondary (MEDIUM confidence)
- Zustand v5 documentation pattern for `persist` middleware (double-call syntax `create<T>()(persist(...))`) — consistent with project's zustand 5.x installation

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed from package.json; no new dependencies
- Architecture: HIGH — DraggablePanel, Zustand persist, viewerRegistry all verified in codebase
- Pitfalls: HIGH — derived from direct code inspection of layer hooks, store initialization, and viewer lifecycle
- Test infrastructure: HIGH — vitest config confirmed, jsdom available, localStorage works in test env

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable stack — no fast-moving dependencies)
