---
phase: 11
slug: replay-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (frontend) + pytest 8.x (backend) |
| **Config file** | `frontend/vite.config.ts` (`test.environment: 'jsdom'`) / `backend/pytest.ini` (`asyncio_mode = auto`) |
| **Quick run command** | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx src/hooks/__tests__/useReplaySnapshots.test.ts` |
| **Full suite command** | `cd frontend && npx vitest run` and `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~15 seconds (frontend) + ~10 seconds (backend) |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx src/hooks/__tests__/useReplaySnapshots.test.ts`
- **After every plan wave:** Run `cd frontend && npx vitest run` and `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | REP-02 | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 0 | REP-03 | unit | `cd frontend && npx vitest run src/hooks/__tests__/useReplaySnapshots.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 0 | REP-02 | smoke | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 0 | REP-04 | integration | `cd backend && python -m pytest tests/test_replay.py::test_replay_window_route -x` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | REP-02 | smoke | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | REP-03 | smoke | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 1 | REP-03 | unit | `cd frontend && npx vitest run src/hooks/__tests__/useReplaySnapshots.test.ts` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 2 | REP-04 | smoke | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/__tests__/PlaybackBar.test.tsx` — smoke tests: LIVE/PLAYBACK toggle renders, speed presets render, event markers render in playback mode (REP-02, REP-03, REP-04)
- [ ] `frontend/src/hooks/__tests__/useReplaySnapshots.test.ts` — unit tests: `useReplaySnapshots` returns empty Map when disabled; `findAdjacentSnapshots` returns correct bracket for mid-range ts (REP-03)
- [ ] `backend/tests/test_replay.py` — extend with `test_replay_window_route`: expects GET `/api/replay/window` returns 200 with `oldest_ts` and `newest_ts` keys (REP-04) — RED before route is implemented
- [ ] `frontend/src/store/__tests__/useAppStore.test.ts` — extend existing: assert `replayMode`, `replayTs`, `replaySpeedMultiplier` initial state and setters (REP-02)

*Framework already installed — vitest 4.x in devDependencies, pytest in requirements-dev.txt*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Globe freezes live updates when PLAYBACK toggled | REP-02 | Requires running docker-compose with live data feeds | 1. Start live globe. 2. Click PLAYBACK. 3. Verify aircraft/ships stop moving. 4. Click LIVE. 5. Verify motion resumes within one poll interval. |
| Smooth interpolation between 60s snapshots | REP-03 | Requires real snapshot data in DB (Phase 10 must have run ≥1h) | 1. Enter PLAYBACK. 2. Set speed to 1m/s. 3. Scrub to a time with entity data. 4. Play — verify entities move smoothly without jumps. |
| Speed presets produce correct playback rate | REP-03 | Requires visual inspection of entity movement rate | 1. Set 1m/s — verify 1 real second = 1 simulated minute of motion. 2. Set 1h/s — verify 1 real second = 1 simulated hour. |
| Event marker click jumps scrubber | REP-04 | Requires seeded OSINT events and interactive click | 1. Enter PLAYBACK. 2. Click a colored event dot on timeline. 3. Verify scrubber and timestamp jump to event's ts. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 25s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
