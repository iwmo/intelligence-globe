---
phase: 15
slug: camera-navigation-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react 16.x |
| **Config file** | `frontend/vite.config.ts` (test.environment: jsdom) |
| **Quick run command** | `cd frontend && npx vitest run src/components/__tests__/CameraControlWidget.test.tsx` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | NAV-03 | unit | `cd frontend && npx vitest run src/lib/__tests__/viewerRegistry.nav.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | NAV-02 | unit | `cd frontend && npx vitest run src/lib/__tests__/viewerRegistry.nav.test.ts` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | NAV-02, NAV-03 | unit | `cd frontend && npx vitest run src/components/__tests__/CameraControlWidget.test.tsx` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | NAV-01 | unit | `cd frontend && npx vitest run src/components/__tests__/AircraftLayer.debounce.test.tsx` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | NAV-01 | unit | `cd frontend && npx vitest run src/components/__tests__/CameraControlWidget.test.tsx` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 3 | NAV-01, NAV-02, NAV-03 | manual | Browser validation | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/__tests__/CameraControlWidget.test.tsx` — stubs for NAV-02 (tilt presets render + callback) and NAV-03 (zoom +/− callback)
- [ ] `frontend/src/components/__tests__/AircraftLayer.debounce.test.tsx` — stubs for NAV-01 LEFT_CLICK 200ms debounce behavior
- [ ] `frontend/src/lib/__tests__/viewerRegistry.nav.test.ts` — stubs for `zoomStep` (NAV-03) and `setPitchPreset` (NAV-02) with mocked viewer

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Double-click zooms toward cursor on terrain | NAV-01 | CesiumJS camera flight requires real WebGL renderer | Load app, double-click on terrain, verify camera flies toward cursor point |
| Double-click on sky does nothing | NAV-01 | Requires real WebGL scene rendering | Double-click empty sky area, verify no camera movement |
| Double-click does not open entity panel | NAV-01 | Requires real entity rendering + Redux store interaction | Double-click on visible aircraft/ship, verify no detail panel opens |
| 200ms debounce imperceptible for normal click | NAV-01 | Requires human perception test | Click an entity normally, verify panel opens without noticeable delay |
| Widget does not overlap CesiumJS credits or other UI | NAV-02, NAV-03 | Visual layout — requires real browser render | Open app, verify widget positioned above credits and BottomStatusBar |
| Tilt presets produce correct camera orientation visually | NAV-02 | CesiumJS camera pitch requires real 3D scene | Click TOP/45°/HRZ buttons, verify globe reorients to corresponding pitch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
