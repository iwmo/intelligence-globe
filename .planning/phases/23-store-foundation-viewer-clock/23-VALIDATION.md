---
phase: 23
slug: store-foundation-viewer-clock
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `frontend/vite.config.ts` (inline `test:` block) |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 0 | PLAY-01 | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | ✅ | ⬜ pending |
| 23-01-02 | 01 | 0 | PLAY-03 | unit | `cd frontend && npx vitest run src/hooks/__tests__/useViewerClock.test.ts` | ❌ W0 | ⬜ pending |
| 23-01-03 | 01 | 0 | VIS-02 | unit | `cd frontend && npx vitest run src/components/__tests__/CinematicHUD.test.tsx` | ❌ W0 | ⬜ pending |
| 23-02-01 | 02 | 1 | PLAY-01 | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | ✅ | ⬜ pending |
| 23-02-02 | 02 | 1 | PLAY-01 | unit | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ✅ | ⬜ pending |
| 23-03-01 | 03 | 2 | PLAY-03 | unit | `cd frontend && npx vitest run src/hooks/__tests__/useViewerClock.test.ts` | ❌ W0 | ⬜ pending |
| 23-04-01 | 04 | 2 | VIS-02 | unit | `cd frontend && npx vitest run src/components/__tests__/CinematicHUD.test.tsx` | ❌ W0 | ⬜ pending |
| 23-04-02 | 04 | 2 | VIS-03 | unit | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/hooks/__tests__/useViewerClock.test.ts` — stubs for PLAY-03 (mock `viewer.scene.postUpdate`, assert `addEventListener` called; assert `JulianDate.fromDate` called with correct value)
- [ ] `frontend/src/components/__tests__/CinematicHUD.test.tsx` — stubs for VIS-02 (render in `live` mode → `REC` text; render in `playback` mode → `REPLAY` text)
- [ ] Update existing `frontend/src/components/__tests__/PlaybackBar.test.tsx` mock — add `isPlaying: false` + `setIsPlaying: vi.fn()` to `mockState`
- [ ] Update existing `frontend/src/store/__tests__/useAppStore.test.ts` — add new `describe('isPlaying slice')` block

*Wave 0 completes before Wave 1 execution begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Globe day/night shading darkens on nighttime scrub | VIS-03 | Requires live CesiumJS viewer render | Scrub to 00:00 UTC; verify globe hemisphere facing away from sun goes dark |
| Loading state during snapshot fetch | VIS-03 | Requires mocked network delay or slow endpoint | Throttle network, press play, verify button shows "Loading snapshots..." and is disabled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
