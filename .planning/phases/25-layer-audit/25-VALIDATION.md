---
phase: 25
slug: layer-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) |
| **Config file** | frontend/vite.config.ts |
| **Quick run command** | `cd frontend && npm run test -- --run` |
| **Full suite command** | `cd frontend && npm run test -- --run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run test -- --run`
- **After every plan wave:** Run `cd frontend && npm run test -- --run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | LAYR-01 | unit | `cd frontend && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 25-01-02 | 01 | 1 | LAYR-02 | unit | `cd frontend && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 25-01-03 | 01 | 1 | LAYR-02 | unit | `cd frontend && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 25-02-01 | 02 | 1 | LAYR-03 | unit | `cd frontend && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 25-02-02 | 02 | 1 | LAYR-03 | manual | Visual inspection | N/A | ⬜ pending |
| 25-03-01 | 03 | 1 | LAYR-04 | unit | `cd frontend && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 25-04-01 | 04 | 2 | PLAY-04 | unit | `cd frontend && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 25-04-02 | 04 | 2 | PLAY-04 | manual | Return to LIVE timing | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/__tests__/aircraftLayerPlayback.test.ts` — stubs for LAYR-01 lerp guard
- [ ] `frontend/src/__tests__/shipMilitaryPlayback.test.ts` — stubs for LAYR-02 focus-refetch guard
- [ ] `frontend/src/__tests__/gpsJammingPlayback.test.ts` — stubs for LAYR-03 interval/badge
- [ ] `frontend/src/__tests__/streetTrafficPlayback.test.ts` — stubs for LAYR-04 hide/show
- [ ] `frontend/src/__tests__/queryClientExport.test.ts` — stubs for PLAY-04 invalidation

*If no vitest installed: `cd frontend && npm install -D vitest @testing-library/react jsdom`*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GPS jamming amber "LIVE DATA" badge visible during playback | LAYR-03 | DOM/CSS visual check | Start playback → confirm badge is amber and shows "LIVE DATA" text over jamming circles |
| Return to LIVE within 5 seconds | PLAY-04 | Timing requires real network + React Query flush | Toggle LIVE → watch entity positions update; confirm < 5s |
| Street traffic hides/reappears instantly | LAYR-04 | Particle system visual | Start playback → particles gone; stop → particles reappear immediately |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
