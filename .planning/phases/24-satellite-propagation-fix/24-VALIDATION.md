---
phase: 24
slug: satellite-propagation-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | frontend/vite.config.ts (or vitest.config.ts) |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd frontend && npx vitest run 2>&1 | tail -30` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `cd frontend && npx vitest run 2>&1 | tail -30`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | PLAY-02 | unit | `cd frontend && npx vitest run --reporter=verbose 2>&1 \| tail -20` | ✅ W0 | ⬜ pending |
| 24-01-02 | 01 | 1 | PLAY-02 | unit | `cd frontend && npx vitest run --reporter=verbose 2>&1 \| tail -20` | ✅ W0 | ⬜ pending |
| 24-01-03 | 01 | 1 | PLAY-02 | unit | `cd frontend && npx vitest run --reporter=verbose 2>&1 \| tail -20` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/__tests__/satellitePropagation.test.ts` — unit tests for timestamp-aware propagation
- [ ] `frontend/src/__tests__/propagationWorker.test.ts` — worker handler timestamp tests (if worker is extractable)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scrubbing to 6 hours ago visually displaces satellites | PLAY-02 | Requires visual globe inspection | Set replayTs to `Date.now() - 6h`, confirm satellite positions differ from real-time |
| Pause freezes all satellite motion | PLAY-02 | Requires visual animation check | Play, then pause — confirm no further satellite drift |
| Orbit ring and click-to-fly use replay timestamp | PLAY-02 | Requires UI interaction | Select satellite during playback, verify orbit ring matches scrubber time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
