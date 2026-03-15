---
phase: 7
slug: visual-engine-navigation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-11
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) |
| **Config file** | frontend/vite.config.ts |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| **Full suite command** | `cd frontend && npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `cd frontend && npx vitest run 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-T1 | 01 | 1 | VIS-04 | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | ✅ W0 | ⬜ pending |
| 7-01-T2 | 01 | 1 | VIS-01/02/03/04, NAV-02/03 | unit | `cd frontend && npx vitest run src/components/__tests__/PostProcessEngine.test.tsx src/components/__tests__/MGRSReadout.test.ts src/data/__tests__/landmarks.test.ts src/hooks/__tests__/useKeyboardShortcuts.test.ts` | ✅ W0 | ⬜ pending |
| 7-02-T1 | 02 | 2 | VIS-01 | unit | `cd frontend && npx tsc --noEmit && npx vitest run src/components/__tests__/PostProcessEngine.test.tsx` | ✅ W0 | ⬜ pending |
| 7-02-T2 | 02 | 2 | VIS-01/02 | unit | `cd frontend && npx vitest run src/components/__tests__/PostProcessEngine.test.tsx` | ✅ W0 | ⬜ pending |
| 7-03-T1 | 03 | 2 | VIS-03/04 | unit | `cd frontend && npx vitest run src/components/__tests__/MGRSReadout.test.ts` | ✅ W0 | ⬜ pending |
| 7-04-T1 | 04 | 2 | NAV-02/03 | unit | `cd frontend && npx vitest run src/data/__tests__/landmarks.test.ts src/hooks/__tests__/useKeyboardShortcuts.test.ts` | ✅ W0 | ⬜ pending |
| 7-04-T2 | 04 | 2 | NAV-01 | type | `cd frontend && npx tsc --noEmit` | n/a | ⬜ pending |
| 7-05-T1 | 05 | 3 | VIS-01/02/03/04, NAV-01/02/03 | type | `cd frontend && npx tsc --noEmit` | n/a | ⬜ pending |
| 7-05-T2 | 05 | 3 | VIS-01/02/03/04, NAV-01/02/03 | manual | `cd frontend && npx vitest run` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 01 Task 2 creates all Wave 0 test stub files before implementation plans run. The following files are created in that task and referenced by plans 02–04 as their verify targets:

- [x] `frontend/src/store/__tests__/useAppStore.test.ts` — extended in Plan 01 Task 1 for VIS-04 (cleanUI and visualPreset slices)
- [x] `frontend/src/components/__tests__/PostProcessEngine.test.tsx` — stubs for VIS-01/02 (stage lifecycle, preset toggling, uniform binding)
- [x] `frontend/src/components/__tests__/MGRSReadout.test.ts` — stubs for VIS-03 (MGRS conversion, polar edge cases)
- [x] `frontend/src/data/__tests__/landmarks.test.ts` — stubs for NAV-02 (landmarks.json schema, shortcut uniqueness)
- [x] `frontend/src/hooks/__tests__/useKeyboardShortcuts.test.ts` — stubs for NAV-03 (Q/W/E/R/T keyboard dispatch, cleanup)

*Wave 0 creates all test stubs before implementation begins. Stubs use `vi.mock` wrappers and `it.todo` so they pass immediately with zero failures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preset visually changes globe appearance (NVG green, CRT scanlines, FLIR heat, Noir B&W) | VIS-01 | WebGL rendering cannot be asserted in jsdom/vitest | Load globe, click each preset, verify visual character changes |
| No frame drop on preset switch | VIS-01 | Performance is subjective / no perf API in test env | Open DevTools Performance, switch presets, verify no >16ms stalls |
| Bloom/Sharpen/Gain sliders update in real time | VIS-02 | Live WebGL uniform binding requires browser | Move each slider, verify immediate visual feedback |
| HUD shows live MGRS updating as camera moves | VIS-03 | Requires live CesiumJS camera events | Rotate globe, verify MGRS string changes |
| Clean UI hides all chrome, HUD remains | VIS-04 | Visual layout check | Toggle Clean UI, verify sidebars gone, HUD visible |
| City quick-jump flies to correct location | NAV-01 | Requires live Nominatim API + camera flyTo | Type "Doha", verify camera flies to Doha |
| Q/W/E/R/T landmark shortcuts center precisely | NAV-02/03 | Requires live CesiumJS camera + landmark JSON | Press Q, verify camera flies to correct landmark |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
