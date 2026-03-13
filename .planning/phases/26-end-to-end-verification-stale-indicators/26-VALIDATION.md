---
phase: 26
slug: end-to-end-verification-stale-indicators
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (frontend) |
| **Config file** | `frontend/vite.config.ts` (test section, jsdom environment) |
| **Quick run command** | `cd frontend && npx vitest run` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 0 | VIS-01 | unit/contract | `cd frontend && npx vitest run src/components/__tests__/AircraftLayer.debounce.test.tsx` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 0 | VIS-01 | unit/contract | `cd frontend && npx vitest run src/components/__tests__/ShipLayer.test.tsx` | ❌ W0 | ⬜ pending |
| 26-01-03 | 01 | 0 | VIS-01 | unit/contract | `cd frontend && npx vitest run src/components/__tests__/MilitaryAircraftLayer.test.tsx` | ❌ W0 | ⬜ pending |
| 26-02-01 | 02 | 0 | VRFY-01 | unit/contract | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ❌ W0 | ⬜ pending |
| 26-02-02 | 02 | 0 | VRFY-01 | unit/contract | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ❌ W0 | ⬜ pending |
| 26-03-01 | 03 | 1 | VIS-01 | unit/contract | `cd frontend && npx vitest run` | ✅ W0 | ⬜ pending |
| 26-03-02 | 03 | 1 | VIS-01 | unit/contract | `cd frontend && npx vitest run` | ✅ W0 | ⬜ pending |
| 26-03-03 | 03 | 1 | VIS-01 | unit/contract | `cd frontend && npx vitest run` | ✅ W0 | ⬜ pending |
| 26-04-01 | 04 | 2 | VRFY-01 | unit/contract | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ✅ W0 | ⬜ pending |
| 26-04-02 | 04 | 2 | VRFY-01 | manual | Browser DevTools — scrub 2h window, check no contamination | N/A | ⬜ pending |
| 26-05-01 | 05 | 3 | VRFY-02 | manual | DevTools Performance tab — 30s recording at 15m/s | N/A | ⬜ pending |
| 26-05-02 | 05 | 3 | VRFY-02 | unit/contract | `cd frontend && npx vitest run` (conditional optimisation) | ❌ W0 cond. | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/__tests__/AircraftLayer.debounce.test.tsx` — new `describe` block for VIS-01 stale tint: playback guard skips, live mode applies tint, `Color.WHITE.clone()` for fresh entities
- [ ] `frontend/src/components/__tests__/ShipLayer.test.tsx` — new `describe` block for VIS-01 stale tint contract (same pattern as aircraft)
- [ ] `frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx` — new `describe` block for VIS-01 stale tint contract (same pattern)
- [ ] `frontend/src/components/__tests__/PlaybackBar.test.tsx` — new `describe` block for VRFY-01: auto-stop boundary at `replayWindowEnd`, speed-preset arithmetic for all 5 presets

*No new test files required — all gaps are `describe` blocks appended to existing test files. Framework install: none needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 2-hour replay scrub with all 6 layers — no contamination | VRFY-01 | Requires running Cesium globe with real snapshot data | Start playback at window start, scrub to end, verify no entity appears at wrong position on any layer |
| Playback auto-stops at window end — play button resets | VRFY-01 | Requires live UI interaction | Observe `isPlaying` badge and play/pause button return to paused state when ts reaches `replayWindowEnd` |
| FPS at 15m/s with aircraft + ships active | VRFY-02 | Requires runtime measurement in real browser | Open DevTools Performance, record 30s at 15m/s with aircraft and ships enabled; verify avg FPS ≥ 30 |
| Return to LIVE after replay — entities refresh within 5s | VRFY-01 | Requires live backend and real-time data | Click LIVE after playback; verify entities update positions within 5 seconds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
